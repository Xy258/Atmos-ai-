import { Router, type IRouter } from "express";
import { GoogleGenAI } from "@google/genai";
import { logger } from "../lib/logger.ts";
import {
  GenerateWeatherInsightBody,
  GenerateWeatherInsightResponse,
  GenerateLifestyleAdviceResponse as LifestyleAdvice,
} from "../api-zod/index.ts";

const router: IRouter = Router();

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const OWM_API_BASE = "https://api.openweathermap.org";
const OWM_TILE_BASE = "https://tile.openweathermap.org";
const ALLOWED_OWM_TILE_LAYERS = new Set([
  "clouds_new",
  "precipitation_new",
  "temp_new",
  "wind_new",
  "pressure_new",
]);

let genAiClient: GoogleGenAI | null = null;
function getGenAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!genAiClient) {
    genAiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return genAiClient;
}

function getOpenWeatherApiKey(): string | null {
  const key = process.env.OPENWEATHER_API_KEY?.trim();
  return key ? key : null;
}

export interface IndexHealthTipItem {
  indexName: string;
  value: string;
  status: "good" | "moderate" | "warning" | "alert" | string;
  tip: string;
}

export interface OpenWeatherNormalizedBundle {
  available: true;
  source: "openweathermap";
  stationName: string;
  countryCode: string;
  observedAt: string;
  current: {
    temperature: number;
    apparentTemperature: number;
    humidity: number;
    pressure: number;
    seaLevelPressure?: number;
    groundLevelPressure?: number;
    visibilityKm: number;
    windSpeedKmh: number;
    windDeg: number;
    windGustKmh?: number;
    cloudCover: number;
    precipitationMm1h: number;
    weatherId: number;
    weatherCode: number;
    weatherMain: string;
    weatherDescription: string;
  };
  forecast3h: Array<{
    timeIso: string;
    temperature: number;
    apparentTemperature: number;
    humidity: number;
    pressure: number;
    precipitationProbability: number;
    windSpeedKmh: number;
    windGustKmh?: number;
    weatherCode: number;
    weatherDescription: string;
  }>;
  airPollution: {
    owmAqi: number;
    pm2_5: number;
    pm10: number;
    no2: number;
    o3: number;
    so2: number;
    co: number;
    nh3: number;
    no: number;
  } | null;
}

const owmBundleCache = new Map<string, { expiresAt: number; data: OpenWeatherNormalizedBundle }>();
const OWM_CACHE_TTL_MS = 120_000; // 2 minutes

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} deferred after ${ms}ms`)), ms)
    ),
  ]);
}

function cleanCountry(name?: string): string {
  if (!name) return "";
  return name
    .replace(/\s*\(the\)$/i, "")
    .replace(/^United States of America$/i, "United States")
    .replace(/^United Kingdom of Great Britain and Northern Ireland$/i, "United Kingdom")
    .trim();
}

function resolveCountryCodeName(code?: string): string {
  if (!code) return "";
  const upper = code.trim().toUpperCase();
  if (upper.length !== 2) return cleanCountry(code);
  try {
    const displayNames = new Intl.DisplayNames(["en"], { type: "region" });
    return cleanCountry(displayNames.of(upper) || upper);
  } catch {
    return upper;
  }
}

function cleanCityOrVillage(name?: string): string {
  if (!name) return "";
  let cleaned = name.trim();
  if (cleaned.includes(",")) {
    const parts = cleaned
      .split(",")
      .map((p) => p.replace(/\b(?:taluk|taluka|tehsil|mandal|sub-district|subdistrict)\b/gi, "").trim())
      .filter(Boolean);
    if (parts.length > 0) cleaned = parts[0];
  }
  cleaned = cleaned.replace(/\b(?:taluk|taluka|tehsil|mandal|sub-district|subdistrict)\b/gi, "").trim();
  cleaned = cleaned.replace(/^[,\-\s/]+|[,\-\s/]+$/g, "").replace(/\s{2,}/g, " ").trim();
  return cleaned || name.trim();
}

/**
 * Map OpenWeatherMap condition IDs (2xx..8xx) to WMO weather interpretation codes
 */
function mapOpenWeatherIdToWmo(owmId: number): number {
  if (owmId >= 200 && owmId <= 232) {
    return owmId >= 212 || owmId === 202 ? 96 : 95; // Thunderstorm / heavy thunderstorm
  }
  if (owmId >= 300 && owmId <= 321) {
    if (owmId === 300 || owmId === 310) return 51;
    if (owmId === 302 || owmId === 312 || owmId === 314) return 55;
    return 53; // Drizzle
  }
  if (owmId >= 500 && owmId <= 531) {
    if (owmId === 511) return 66; // Freezing rain
    if (owmId === 502 || owmId === 503 || owmId === 504 || owmId === 522) return 65; // Heavy rain
    if (owmId === 501 || owmId === 521 || owmId === 531) return 63; // Moderate rain / showers
    return 61; // Light rain
  }
  if (owmId >= 600 && owmId <= 622) {
    if (owmId === 602 || owmId === 622) return 75; // Heavy snow
    if (owmId === 611 || owmId === 612 || owmId === 613) return 77; // Sleet / snow grains
    if (owmId === 601 || owmId === 621) return 73; // Moderate snow
    return 71; // Light snow
  }
  if (owmId >= 700 && owmId <= 781) {
    return owmId === 741 ? 45 : 48; // Fog / mist / haze
  }
  if (owmId === 800) return 0; // Clear
  if (owmId === 801) return 1; // Few clouds
  if (owmId === 802) return 2; // Scattered clouds
  return 3; // Broken / overcast clouds (803, 804)
}

async function fetchOpenWeatherBundle(
  lat: number,
  lon: number
): Promise<OpenWeatherNormalizedBundle | null> {
  const apiKey = getOpenWeatherApiKey();
  if (!apiKey || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = owmBundleCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  try {
    const weatherUrl = `${OWM_API_BASE}/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
    const forecastUrl = `${OWM_API_BASE}/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&cnt=8&appid=${apiKey}`;
    const pollutionUrl = `${OWM_API_BASE}/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`;

    const [weatherRes, forecastRes, pollutionRes] = await withTimeout(
      Promise.all([
        fetch(weatherUrl),
        fetch(forecastUrl).catch(() => null),
        fetch(pollutionUrl).catch(() => null),
      ]),
      4500,
      "OpenWeatherMap"
    );

    if (!weatherRes.ok) {
      return null;
    }

    const w = (await weatherRes.json()) as any;
    const f = forecastRes && forecastRes.ok ? ((await forecastRes.json()) as any) : null;
    const p = pollutionRes && pollutionRes.ok ? ((await pollutionRes.json()) as any) : null;

    const weatherEntry = Array.isArray(w.weather) && w.weather[0] ? w.weather[0] : {};
    const weatherId = typeof weatherEntry.id === "number" ? weatherEntry.id : 800;
    const rain1h = typeof w.rain?.["1h"] === "number" ? w.rain["1h"] : 0;
    const snow1h = typeof w.snow?.["1h"] === "number" ? w.snow["1h"] : 0;

    const forecast3h = Array.isArray(f?.list)
      ? f.list.slice(0, 8).map((item: any) => {
          const itemWeather = Array.isArray(item.weather) && item.weather[0] ? item.weather[0] : {};
          const itemId = typeof itemWeather.id === "number" ? itemWeather.id : 800;
          return {
            timeIso: item.dt ? new Date(item.dt * 1000).toISOString() : item.dt_txt || "",
            temperature: Number(item.main?.temp ?? 0),
            apparentTemperature: Number(item.main?.feels_like ?? item.main?.temp ?? 0),
            humidity: Number(item.main?.humidity ?? 0),
            pressure: Number(item.main?.pressure ?? 1013),
            precipitationProbability: Math.round(Number(item.pop ?? 0) * 100),
            windSpeedKmh: Math.round(Number(item.wind?.speed ?? 0) * 3.6 * 10) / 10,
            windGustKmh:
              typeof item.wind?.gust === "number"
                ? Math.round(item.wind.gust * 3.6 * 10) / 10
                : undefined,
            weatherCode: mapOpenWeatherIdToWmo(itemId),
            weatherDescription: String(itemWeather.description || "clear sky"),
          };
        })
      : [];

    const polEntry = Array.isArray(p?.list) && p.list[0] ? p.list[0] : null;
    const airPollution = polEntry
      ? {
          owmAqi: Number(polEntry.main?.aqi ?? 1),
          pm2_5: Number(polEntry.components?.pm2_5 ?? 0),
          pm10: Number(polEntry.components?.pm10 ?? 0),
          no2: Number(polEntry.components?.no2 ?? 0),
          o3: Number(polEntry.components?.o3 ?? 0),
          so2: Number(polEntry.components?.so2 ?? 0),
          co: Number(polEntry.components?.co ?? 0),
          nh3: Number(polEntry.components?.nh3 ?? 0),
          no: Number(polEntry.components?.no ?? 0),
        }
      : null;

    const bundle: OpenWeatherNormalizedBundle = {
      available: true,
      source: "openweathermap",
      stationName: cleanCityOrVillage(String(w.name || "")),
      countryCode: String(w.sys?.country || ""),
      observedAt: w.dt ? new Date(w.dt * 1000).toISOString() : new Date().toISOString(),
      current: {
        temperature: Number(w.main?.temp ?? 0),
        apparentTemperature: Number(w.main?.feels_like ?? w.main?.temp ?? 0),
        humidity: Number(w.main?.humidity ?? 0),
        pressure: Number(w.main?.pressure ?? 1013),
        seaLevelPressure:
          typeof w.main?.sea_level === "number" ? w.main.sea_level : undefined,
        groundLevelPressure:
          typeof w.main?.grnd_level === "number" ? w.main.grnd_level : undefined,
        visibilityKm:
          typeof w.visibility === "number" ? Math.round((w.visibility / 1000) * 10) / 10 : 10,
        windSpeedKmh: Math.round(Number(w.wind?.speed ?? 0) * 3.6 * 10) / 10,
        windDeg: Number(w.wind?.deg ?? 0),
        windGustKmh:
          typeof w.wind?.gust === "number"
            ? Math.round(w.wind.gust * 3.6 * 10) / 10
            : undefined,
        cloudCover: Number(w.clouds?.all ?? 0),
        precipitationMm1h: Math.round((rain1h + snow1h) * 10) / 10,
        weatherId,
        weatherCode: mapOpenWeatherIdToWmo(weatherId),
        weatherMain: String(weatherEntry.main || "Clear"),
        weatherDescription: String(weatherEntry.description || "clear sky"),
      },
      forecast3h,
      airPollution,
    };

    owmBundleCache.set(cacheKey, {
      expiresAt: Date.now() + OWM_CACHE_TTL_MS,
      data: bundle,
    });
    return bundle;
  } catch (err) {
    logger.info("[Atmos] OpenWeatherMap fetch bypassed:", err instanceof Error ? err.message : "");
    return null;
  }
}

function generateAlgorithmicInsight(
  data: {
    location: string;
    localTime: string;
    current: {
      temperature: number;
      apparentTemperature: number;
      weatherCode: number;
      humidity: number;
      windSpeed: number;
      precipitationProbability: number;
      uvIndex: number;
    };
    airQuality: { usAqi: number; pm2_5: number };
    upcoming: Array<{
      date: string;
      weatherCode: number;
      high: number;
      low: number;
      precipitationProbability: number;
    }>;
    focus?: string;
  },
  owmBundle?: OpenWeatherNormalizedBundle | null
) {
  const { current, airQuality, upcoming } = data;
  const temp = Math.round(current.temperature);
  const feelsLike = Math.round(current.apparentTemperature);
  const rain = current.precipitationProbability;
  const wind = Math.round(current.windSpeed);
  const uv = Math.round(current.uvIndex * 10) / 10;
  const aqi = airQuality.usAqi;
  const focus = (data.focus || "general").toLowerCase();

  // Optional OpenWeather station enhancements
  const stationDesc = owmBundle?.current.weatherDescription;
  const stationVis = owmBundle?.current.visibilityKm;
  const stationGust = owmBundle?.current.windGustKmh;
  const next3hPeakPop = owmBundle?.forecast3h?.length
    ? Math.max(...owmBundle.forecast3h.slice(0, 4).map((slot) => slot.precipitationProbability))
    : null;

  // 1. Weather condition health tip
  let weatherHealthTip =
    "Moderate atmospheric baseline. Standard daily outdoor precautions apply.";
  const code = current.weatherCode;
  if ([95, 96, 99].includes(code)) {
    weatherHealthTip =
      "Thunderstorm safety: seek enclosed shelter immediately. Rapid barometric pressure drops and airborne pollen fragmentation can trigger severe thunderstorm asthma.";
  } else if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    weatherHealthTip =
      "Rain hazard: wet surfaces increase slipping risk. Keep footwear and head dry to prevent rapid thermal loss and post-commute chills.";
  } else if ([71, 73, 75, 77, 85, 86].includes(code)) {
    weatherHealthTip =
      "Winter freeze hazard: inhaling sub-freezing air can constrict bronchial passages. Warm up gently indoors and wear high-traction treaded footwear for black ice.";
  } else if ([45, 48].includes(code)) {
    weatherHealthTip =
      "Fog caution: ground-level moisture traps fine vehicle particulates, which can irritate reactive airways; wear a light mask if sensitive.";
  } else if (wind >= 32) {
    weatherHealthTip =
      "High wind advisory: airborne particulates and allergens can cause ocular irritation; wrap-around protective lenses recommended.";
  } else if (code === 0) {
    weatherHealthTip =
      "Clear sky solar exposure: direct sunlight increases ocular strain; wear 100% UV-blocking sunglasses and maintain regular hydration.";
  } else {
    weatherHealthTip =
      "Overcast light: up to 80% of UV rays penetrate thin clouds; maintain skin awareness and hydration during midday hours.";
  }

  // 2. Index health tips (UV, AQI, Thermal Comfort)
  const indexHealthTips: IndexHealthTipItem[] = [];

  if (uv >= 11) {
    indexHealthTips.push({
      indexName: "UV Index",
      value: `${uv} (Extreme)`,
      status: "alert",
      tip: "UV 11+ Extreme: unprotected skin burns in <10 mins. Stay indoors or in dense shade during midday; apply SPF 50+ sunscreen, wear wide-brim hat & UV400 sunglasses.",
    });
  } else if (uv >= 8) {
    indexHealthTips.push({
      indexName: "UV Index",
      value: `${uv} (Very High)`,
      status: "warning",
      tip: "UV 8+ Very High: seek shade between 10am-4pm. Generously apply SPF 30-50+ sunscreen, reapply every 2 hours, and wear UV-protective sunglasses and a hat.",
    });
  } else if (uv >= 6) {
    indexHealthTips.push({
      indexName: "UV Index",
      value: `${uv} (High)`,
      status: "warning",
      tip: "UV 6+ High: solar exposure is elevated. Apply SPF 30+ sunscreen, wear UV sunglasses, and avoid prolonged unshaded midday exposure.",
    });
  } else if (uv >= 3) {
    indexHealthTips.push({
      indexName: "UV Index",
      value: `${uv} (Moderate)`,
      status: "moderate",
      tip: "UV 3+ Moderate: recommend SPF 30+ sunscreen, protective eyewear, and shade during peak midday hours (11am-3pm) for skin health.",
    });
  } else {
    indexHealthTips.push({
      indexName: "UV Index",
      value: `${uv} (Low)`,
      status: "good",
      tip: "UV < 3 Low: minimal UV radiation. Safe to enjoy outdoor daytime activities without high sunburn risk.",
    });
  }

  if (aqi > 150) {
    indexHealthTips.push({
      indexName: "Air Quality",
      value: `AQI ${aqi} (Unhealthy)`,
      status: "alert",
      tip: "Everyone may experience health effects. Minimize prolonged outdoor exertion; wear an N95 mask and run indoor HEPA filtration.",
    });
  } else if (aqi > 100) {
    indexHealthTips.push({
      indexName: "Air Quality",
      value: `AQI ${aqi} (Sensitive Groups)`,
      status: "warning",
      tip: "Individuals with asthma or heart/lung conditions should reduce heavy outdoor exertion and monitor breathing.",
    });
  } else if (aqi > 50) {
    indexHealthTips.push({
      indexName: "Air Quality",
      value: `AQI ${aqi} (Moderate)`,
      status: "moderate",
      tip: "Air quality is acceptable; unusually sensitive individuals should watch for minor cough or respiratory irritation.",
    });
  } else {
    indexHealthTips.push({
      indexName: "Air Quality",
      value: `AQI ${aqi} (Good)`,
      status: "good",
      tip: "Clean, healthy air. Optimal for cardiovascular endurance, outdoor running, and deep aerobic breathing.",
    });
  }

  if (feelsLike >= 35) {
    indexHealthTips.push({
      indexName: "Thermal Comfort",
      value: `${feelsLike}°C (Extreme Heat)`,
      status: "alert",
      tip: "High risk of heat cramps, exhaustion, or stroke. Drink 500ml+ electrolyte fluids hourly, stay in air conditioning, and avoid peak exertion.",
    });
  } else if (feelsLike >= 28) {
    indexHealthTips.push({
      indexName: "Thermal Comfort",
      value: `${feelsLike}°C (High Heat)`,
      status: "warning",
      tip: "Elevated thermal strain. Drink 300-400ml water per hour outdoors, wear lightweight breathable clothes, and take shade breaks.",
    });
  } else if (feelsLike <= -5) {
    indexHealthTips.push({
      indexName: "Thermal Comfort",
      value: `${feelsLike}°C (Severe Cold)`,
      status: "alert",
      tip: "Frostbite risk on exposed skin in <30 min. Dress in windproof thermal layers, insulated gloves, and face covering.",
    });
  } else if (feelsLike <= 5) {
    indexHealthTips.push({
      indexName: "Thermal Comfort",
      value: `${feelsLike}°C (Cold Chill)`,
      status: "moderate",
      tip: "Chilly conditions constrict peripheral blood vessels. Wear a warm jacket, scarf, and insulated gloves.",
    });
  } else {
    indexHealthTips.push({
      indexName: "Thermal Comfort",
      value: `${temp}°C (Feels ${feelsLike}°C)`,
      status: "good",
      tip: "Comfortable thermal equilibrium. Low physiological strain for standard daily routines and fitness.",
    });
  }

  // 3. Focus-tailored headline, summary, and recommendations
  const highTemp = upcoming[0] ? Math.round(upcoming[0].high) : temp + 3;
  const lowTemp = upcoming[0] ? Math.round(upcoming[0].low) : temp - 4;
  const diurnalSwing = Math.max(0, highTemp - lowTemp);
  const dewPoint = Math.round(temp - (100 - current.humidity) / 5);
  const pm25 = Math.round(airQuality.pm2_5 * 10) / 10;
  const nextRainDay = upcoming.find((d) => d.precipitationProbability >= 45);
  const upcomingTrend =
    upcoming.length >= 2
      ? Math.round(upcoming[1].high) > highTemp + 2
        ? `Expect warming toward ${Math.round(upcoming[1].high)}°C tomorrow.`
        : Math.round(upcoming[1].high) < highTemp - 2
        ? `Cooler air arrives tomorrow with highs near ${Math.round(upcoming[1].high)}°C.`
        : `Temperatures remain steady near ${Math.round(upcoming[1].high)}°C tomorrow.`
      : "";

  const stationClause = stationDesc
    ? ` Ground station reports ${stationDesc}${
        stationVis != null ? ` (${stationVis} km visibility)` : ""
      }.`
    : "";

  let headline = "Pleasant and balanced conditions ahead";
  let summary = `Currently ${temp}°C (feels like ${feelsLike}°C) with ${Math.round(current.humidity)}% humidity, ${wind} km/h winds, and ${rain}% precipitation chance in ${data.location}. Expect a ${lowTemp}°C to ${highTemp}°C diurnal range today (${diurnalSwing}°C swing). ${upcomingTrend}${stationClause}`.trim();
  let recommendations: string[] = [];

  if (focus === "health" || focus === "wellness") {
    headline =
      uv >= 8
        ? "High UV Radiation: Sun Protection Essential"
        : aqi > 100
        ? "Sensitive Air Quality Advisory"
        : "Optimal Bioclimatic Wellness Index";
    summary = `Physiological telemetry for ${data.location} reports UV Index ${uv}, US AQI ${aqi} (PM2.5 ${pm25} µg/m³), and apparent thermal strain near ${feelsLike}°C with ${Math.round(current.humidity)}% humidity. Dew point sits near ${dewPoint}°C across a ${lowTemp}°C–${highTemp}°C daily temperature span.${stationClause}`;
    recommendations = [
      uv >= 3
        ? uv >= 8
          ? `UV ${uv} warning: seek shade between 10am–4pm, wear UV400 eyewear, and reapply broad-spectrum SPF 50+ every 2 hours.`
          : `UV ${uv} active: apply SPF 30+ sunscreen 15 minutes before midday outdoor exposure.`
        : `Low UV (${uv}) permits comfortable daytime outdoor light exposure with minimal burn risk.`,
      aqi > 100
        ? `Air quality is elevated (AQI ${aqi}, PM2.5 ${pm25} µg/m³); pace aerobic exertion and consider indoor filtered training.`
        : `Air quality is favorable (AQI ${aqi}, PM2.5 ${pm25} µg/m³); supportive of deep respiratory capacity and outdoor walking.`,
      feelsLike >= 28
        ? `Hydration protocol: ${feelsLike}°C thermal load increases fluid loss—drink 350ml cool water every 45 minutes outdoors.`
        : feelsLike <= 5
        ? `Cold air (${feelsLike}°C feels-like) constricts peripheral circulation; wear insulated thermal layers to preserve core warmth.`
        : `Balanced thermal load (${temp}°C, feels ${feelsLike}°C) with ${Math.round(current.humidity)}% RH supports steady comfort and normal hydration.`,
      weatherHealthTip,
    ];
  } else if (focus === "commute") {
    headline =
      rain > 40
        ? "Commuter Weather: Wet Road Hazards"
        : wind > 28
        ? "Commuter Weather: Gusty Transit Advisory"
        : "Commuter Weather: Clear Route Conditions";
    summary = `Transit conditions in ${data.location} show ${rain}% precipitation probability, ${wind} km/h surface winds${
      stationGust ? ` (gusting to ${Math.round(stationGust)} km/h)` : ""
    }, and ${temp}°C air temperature (${lowTemp}°C–${highTemp}°C range). ${
      rain > 40
        ? "Wet pavement, spray plumes, and longer braking distances are likely."
        : "Sightlines and road friction remain favorable across main corridors."
    }${stationClause}`;
    recommendations = [
      rain > 40 || (next3hPeakPop != null && next3hPeakPop >= 45)
        ? `Elevated rain risk (${Math.max(rain, next3hPeakPop ?? 0)}% next 12h): allow 5–10 extra minutes for wet-road braking distances and reduced visibility.`
        : `Low rain chance (${rain}%): dry roadway and rail corridors support normal commuter transit times.`,
      wind > 28
        ? `Crosswind alert (${wind} km/h): expect lateral gusts on bridges, elevated flyovers, and exposed cycling lanes.`
        : `Light ${wind} km/h winds ensure stable handling for cycling, motorcycles, and highway transit.`,
      uv >= 6
        ? `Elevated solar glare (UV ${uv}): keep polarized driving sunglasses handy during morning and afternoon glare windows.`
        : nextRainDay
        ? `Keep compact rain gear ready; next higher shower probability (${nextRainDay.precipitationProbability}%) arrives ${nextRainDay.date}.`
        : `Carry a light outer layer for the ${diurnalSwing}°C swing between ${lowTemp}°C morning lows and ${highTemp}°C afternoon highs.`,
      weatherHealthTip,
    ];
  } else if (focus === "outdoor" || focus === "runner") {
    headline = "Athletics & Runner's Performance Index";
    summary = `Cardiorespiratory conditions in ${data.location}: ${temp}°C (${feelsLike}°C feels-like), US AQI ${aqi} (PM2.5 ${pm25} µg/m³), ${Math.round(current.humidity)}% RH, and ${wind} km/h wind. ${
      temp > 28
        ? "Heat dissipation requires early or late pacing."
        : "Aerodynamic drag and thermal load are well-balanced for training."
    }${stationClause}`;
    recommendations = [
      temp > 28
        ? `Peak temperatures near ${highTemp}°C raise core strain; schedule tempo or long runs before 8am or after sunset.`
        : `Optimal workout conditions (${temp}°C, dew point ${dewPoint}°C) across morning and late-afternoon sessions.`,
      aqi <= 50
        ? `Clean air (AQI ${aqi}, PM2.5 ${pm25} µg/m³) supports peak VO2 max intervals and outdoor endurance blocks.`
        : `Moderate/elevated particulates (AQI ${aqi}, PM2.5 ${pm25} µg/m³); monitor breathing cadence during high-intensity efforts.`,
      uv >= 3
        ? `UV Index ${uv}: wear sweat-resistant SPF 30+ sunscreen, breathable moisture-wicking fabric, and sport sunglasses.`
        : `Mild UV (${uv}) and ${wind} km/h wind offer low solar strain—stay hydrated with 500ml water per 45 min of exercise.`,
      weatherHealthTip,
    ];
  } else if (focus === "detailed") {
    headline = "Meteorological Deep Dive & Synoptic Dynamics";
    summary = `Surface observations in ${data.location}: ${temp}°C (${feelsLike}°C apparent), ${Math.round(current.humidity)}% RH, estimated dew point ${dewPoint}°C, and ${wind} km/h boundary wind. Diurnal range spans ${lowTemp}°C to ${highTemp}°C with ${rain}% precipitation probability and PM2.5 at ${pm25} µg/m³.${stationClause}`;
    recommendations = [
      `Thermodynamic profile: ${temp - dewPoint}°C dew-point spread at ${Math.round(current.humidity)}% RH indicates ${
        current.humidity > 75
          ? "high boundary-layer moisture and elevated condensation/haze potential"
          : "well-mixed air column moisture with comfortable evaporative cooling"
      }.`,
      rain > 30
        ? `Convective forcing: ${rain}% precipitation chance signals moisture convergence and passing shower cells.`
        : `Boundary-layer flow: steady ${wind} km/h horizontal winds${
            stationGust ? ` (gusts ${Math.round(stationGust)} km/h)` : ""
          } with low (${rain}%) convective rainfall potential.`,
      `Diurnal & aerosol telemetry: ${diurnalSwing}°C daily range (${lowTemp}°C–${highTemp}°C), UV ${uv}, and PM2.5 ${pm25} µg/m³ (US AQI ${aqi}). ${upcomingTrend}`,
      weatherHealthTip,
    ];
  } else {
    headline =
      rain > 50
        ? "Showers Expected: Keep Rainwear Handy"
        : temp >= 28
        ? "Warm & Bright: Stay Cool Outdoors"
        : temp <= 5
        ? "Crisp & Cold: Layer Up Today"
        : "Pleasant & Balanced Atmospheric Outlook";
    summary = `Currently ${temp}°C (feels like ${feelsLike}°C) in ${data.location} with ${Math.round(current.humidity)}% humidity, ${wind} km/h winds, and ${rain}% rain chance. Expect a ${lowTemp}°C to ${highTemp}°C temperature range today with US AQI ${aqi}. ${upcomingTrend}${stationClause}`.trim();
    recommendations = [
      uv >= 3
        ? uv >= 8
          ? `UV ${uv} (Very High): seek shade between 10am–4pm, wear UV-blocking sunglasses, and reapply SPF 50+ sunscreen.`
          : `UV ${uv} (Moderate/High): apply SPF 30+ sunscreen and wear protective eyewear during peak midday hours.`
        : `Thermal layering: ${diurnalSwing}°C daily swing (${lowTemp}°C low to ${highTemp}°C high) at ${Math.round(current.humidity)}% humidity calls for light breathable layers.`,
      rain > 30
        ? `Precipitation outlook (${rain}%): pack an umbrella or water-resistant shell for passing showers.`
        : nextRainDay
        ? `Dry skies today (${rain}% rain chance); next notable shower probability (${nextRainDay.precipitationProbability}%) is forecast for ${nextRainDay.date}.`
        : `Dry atmospheric column (${rain}% rain chance, ${wind} km/h wind) keeps outdoor errands smooth all day.`,
      aqi > 100
        ? `Air quality is sensitive (AQI ${aqi}, PM2.5 ${pm25} µg/m³); keep strenuous outdoor activity measured.`
        : `Air quality is healthy (AQI ${aqi}, PM2.5 ${pm25} µg/m³) with clear breathing comfort across ${data.location}.`,
      weatherHealthTip,
    ];
  }

  return {
    headline,
    summary,
    recommendations: recommendations.slice(0, 4),
    weatherHealthTip,
    indexHealthTips,
    focus,
    generatedAt: new Date().toISOString(),
  };
}

function generateAlgorithmicLifestyle(data: {
  location: string;
  localTime: string;
  current: {
    temperature: number;
    apparentTemperature: number;
    weatherCode: number;
    humidity: number;
    windSpeed: number;
    precipitationProbability: number;
    uvIndex: number;
  };
  airQuality: { usAqi: number; pm2_5: number };
  upcoming: Array<{
    date: string;
    weatherCode: number;
    high: number;
    low: number;
    precipitationProbability: number;
  }>;
  customActivity?: string;
}) {
  const { current, airQuality, customActivity } = data;
  const temp = current.temperature;
  const rain = current.precipitationProbability;
  const wind = current.windSpeed;
  const uv = current.uvIndex;
  const aqi = airQuality.usAqi;

  let runningScore = 85;
  if (rain > 40) runningScore -= 30;
  if (temp > 30 || temp < 0) runningScore -= 25;
  if (aqi > 100) runningScore -= 35;
  if (wind > 25) runningScore -= 15;
  runningScore = Math.max(10, Math.min(100, runningScore));

  let cyclingScore = 80;
  if (wind > 30) cyclingScore -= 40;
  if (rain > 30) cyclingScore -= 35;
  if (temp > 33 || temp < -2) cyclingScore -= 25;
  cyclingScore = Math.max(10, Math.min(100, cyclingScore));

  let commuteHazardScore = 15;
  if (rain > 60) commuteHazardScore += 45;
  if (wind > 35) commuteHazardScore += 35;
  if (temp < 0) commuteHazardScore += 30;
  commuteHazardScore = Math.min(100, commuteHazardScore);

  const actName =
    customActivity && customActivity.trim() !== ""
      ? customActivity.trim()
      : "General Outdoor & Fitness";

  return {
    headline:
      temp > 28
        ? "Warm day suited for light outdoor activities"
        : rain > 50
        ? "Indoor-focused day with rain expected"
        : "Favorable conditions for outdoor routines",
    summary: `Current temperature is ${Math.round(temp)}°C with ${rain}% chance of precipitation and AQI ${aqi}. Live diagnostics are actively monitored.`,
    runningScore,
    runningAdvice:
      runningScore >= 75
        ? "Excellent conditions for a run or jog. Stay hydrated and enjoy the fresh air."
        : runningScore >= 40
        ? "Moderate running conditions. Watch out for wind or precipitation and keep intensity measured."
        : "Outdoor running is discouraged due to adverse weather or air quality. Consider indoor treadmill training.",
    cyclingScore,
    cyclingAdvice:
      cyclingScore >= 75
        ? "Great cycling conditions with favorable wind and dry road surfaces."
        : cyclingScore >= 40
        ? "Exercise caution on two wheels due to wind or damp conditions."
        : "High wind or precipitation make cycling hazardous. Use public transit or indoor trainer.",
    clothingAdvice:
      temp > 25
        ? "Wear breathable, lightweight cotton or athletic wear and sunglasses."
        : temp < 10
        ? "Wear layered thermal wear, a wind-resistant jacket, and warm gloves."
        : "Comfortable long sleeves or a light jacket will keep you comfortable.",
    outdoorDiningAdvice:
      rain > 30 || wind > 25
        ? "Terraces and outdoor seating may be breezy or wet; indoor seating recommended."
        : "Terraces and outdoor dining spaces are pleasant and comfortable right now.",
    petWalkingAdvice:
      temp > 28
        ? "Pavement can be hot on paws. Walk dogs early morning or late evening in shaded parks."
        : "Great weather for dog walking. Ensure fresh water is available on your route.",
    laundryAdvice:
      rain > 30
        ? "Air drying outdoors is not recommended due to high rain probability."
        : wind > 15 && temp > 15
        ? "Excellent outdoor drying conditions with good wind circulation and warmth."
        : "Standard outdoor drying conditions apply.",
    hydrationAdvice:
      temp > 26
        ? `High temperature (${Math.round(temp)}°C) increases fluid loss. Drink at least 300ml of water every hour outdoors.`
        : "Standard hydration needs apply. Keep a water bottle nearby.",
    commuteHazardScore,
    commuteAdvice:
      commuteHazardScore > 50
        ? "Commute conditions are disrupted by weather hazards. Allow extra travel time."
        : "Commute routes are clear with minimal weather interference.",
    customActivityAdvice: `Suitability for ${actName}: ${
      cyclingScore >= 70
        ? "Highly favorable right now."
        : "Proceed with caution and check hourly radar updates."
    }`,
    customAdvice: [
      `UV Index is ${Math.round(uv * 10) / 10} — ${
        uv >= 8
          ? "seek shade and apply SPF 50+ sunscreen."
          : uv >= 3
          ? "apply SPF 30+ sunscreen during midday."
          : "minimal sunburn danger."
      }`,
      `Air Quality Index (AQI ${aqi}) is ${
        aqi <= 50
          ? "clean and healthy for deep breathing."
          : aqi <= 100
          ? "acceptable for general routines."
          : "sensitive groups should limit outdoor exertion."
      }`,
      `Wind speed is ${Math.round(wind)} km/h with ${Math.round(current.humidity)}% humidity.`,
    ],
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Dual-Source OpenWeatherMap Telemetry & Air Pollution Proxy
 */
router.get("/weather/openweather", async (req, res) => {
  const lat = Number(req.query.latitude ?? req.query.lat);
  const lon = Number(req.query.longitude ?? req.query.lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    res.status(400).json({ error: "Valid latitude and longitude are required." });
    return;
  }

  if (!getOpenWeatherApiKey()) {
    res.json({ available: false, reason: "key_not_configured" });
    return;
  }

  const bundle = await fetchOpenWeatherBundle(lat, lon);
  if (!bundle) {
    res.json({ available: false, reason: "upstream_unavailable" });
    return;
  }

  res.setHeader("Cache-Control", "public, max-age=60");
  res.json(bundle);
});

/**
 * Proxied OpenWeatherMap Global Weather Layer Tiles for the 3D Globe
 */
router.get("/weather/tile/:layer/:z/:x/:y", async (req, res) => {
  const apiKey = getOpenWeatherApiKey();
  if (!apiKey) {
    res.status(204).end();
    return;
  }

  const { layer, z: zRaw, x: xRaw, y: yRaw } = req.params;
  const z = Number.parseInt(zRaw, 10);
  const x = Number.parseInt(xRaw, 10);
  const y = Number.parseInt(yRaw.replace(/\.png$/i, ""), 10);

  if (!ALLOWED_OWM_TILE_LAYERS.has(layer) || !Number.isInteger(z) || z < 0 || z > 5) {
    res.status(400).json({ error: "Invalid tile layer or zoom." });
    return;
  }

  const maxIndex = (1 << z) - 1;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x > maxIndex || y < 0 || y > maxIndex) {
    res.status(400).json({ error: "Tile coordinates out of range." });
    return;
  }

  try {
    const upstream = await withTimeout(
      fetch(`${OWM_TILE_BASE}/map/${layer}/${z}/${x}/${y}.png?appid=${apiKey}`, {
        headers: { "User-Agent": "AtmosWeather/1.0" },
      }),
      6000,
      "OpenWeatherTile"
    );
    if (!upstream.ok) {
      res.status(204).end();
      return;
    }
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=900");
    res.send(buf);
  } catch {
    res.status(204).end();
  }
});

/**
 * Combined City / Village Search (OpenWeather Geo 1.0 + Open-Meteo Geocoding)
 */
router.get("/weather/search", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) {
    res.json({ results: [] });
    return;
  }

  const apiKey = getOpenWeatherApiKey();
  const owmPromise = apiKey
    ? withTimeout(
        fetch(`${OWM_API_BASE}/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=6&appid=${apiKey}`).then(
          (r) => (r.ok ? (r.json() as Promise<any[]>) : [])
        ),
        3500,
        "OWMGeoSearch"
      ).catch(() => [])
    : Promise.resolve([]);

  const omPromise = withTimeout(
    fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        q
      )}&count=6&language=en&format=json`
    ).then((r) => (r.ok ? (r.json() as Promise<{ results?: any[] }>) : { results: [] })),
    3500,
    "OpenMeteoGeoSearch"
  ).catch(() => ({ results: [] }));

  const [owmResults, omData] = await Promise.all([owmPromise, omPromise]);

  const combined: Array<{
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    country?: string;
    admin1?: string;
    elevation?: number;
  }> = [];
  const seenKeys = new Set<string>();

  const pushUnique = (item: {
    id?: number;
    name: string;
    latitude: number;
    longitude: number;
    country?: string;
    admin1?: string;
    elevation?: number;
  }) => {
    const name = cleanCityOrVillage(item.name);
    const country = cleanCityOrVillage(cleanCountry(item.country));
    const admin1 = cleanCityOrVillage(item.admin1);
    if (!name || !Number.isFinite(item.latitude) || !Number.isFinite(item.longitude)) return;
    const dedupeKey = `${name.toLowerCase()}_${country.toLowerCase()}_${item.latitude.toFixed(1)}_${item.longitude.toFixed(1)}`;
    if (seenKeys.has(dedupeKey)) return;
    seenKeys.add(dedupeKey);
    combined.push({
      id: item.id || Math.round(Math.abs(item.latitude * 10000 + item.longitude * 100)),
      name,
      latitude: item.latitude,
      longitude: item.longitude,
      country,
      admin1,
      elevation: item.elevation,
    });
  };

  // Prefer Open-Meteo entries first when they include elevation, then supplement with OpenWeather Geo hits
  for (const r of omData.results ?? []) {
    pushUnique(r);
  }
  for (const r of owmResults) {
    pushUnique({
      name: r.name,
      latitude: r.lat,
      longitude: r.lon,
      country: resolveCountryCodeName(r.country),
      admin1: r.state || "",
    });
  }

  res.json({ results: combined.slice(0, 8) });
});

/**
 * AI Briefing powered by Google Gemini (gemini-4-hydrogen) + OpenWeatherMap + Open-Meteo fusion
 */
router.post("/weather/insight", async (req, res) => {
  const parsedBody = GenerateWeatherInsightBody.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({ error: "Weather context is incomplete." });
    return;
  }

  const {
    location,
    localTime,
    current,
    airQuality,
    upcoming,
    focus = "general",
    latitude,
    longitude,
  } = parsedBody.data;

  // Enrich with live OpenWeatherMap ground station observations & 3h trend when coordinates are available
  const owmBundle =
    typeof latitude === "number" && typeof longitude === "number"
      ? await fetchOpenWeatherBundle(latitude, longitude)
      : null;

  // 1. Try modern @google/genai SDK with gemini-4-hydrogen (integrating OpenWeather + Open-Meteo data)
  const ai = getGenAiClient();
  if (ai) {
    try {
      const owmContextBlock = owmBundle
        ? `\nLive OpenWeatherMap station observations (${owmBundle.stationName || location}): ${JSON.stringify({
            observedAt: owmBundle.observedAt,
            current: owmBundle.current,
            shortTerm3h: owmBundle.forecast3h.slice(0, 4),
            airPollution: owmBundle.airPollution,
          })}`
        : "";

      const prompt = `You are Atmos Briefing, an expert meteorological and environmental health advisor.
Location: ${location}.
Local time: ${localTime}.
Primary forecast & gridded conditions (Open-Meteo): ${JSON.stringify(current)}.
Air quality (Open-Meteo): ${JSON.stringify(airQuality)}.
Upcoming 5-day forecast: ${JSON.stringify(upcoming)}.${owmContextBlock}
User's Selected Focus Perspective: "${focus}" (e.g., 'general', 'health', 'commute', 'outdoor', 'detailed').

Synthesize BOTH the gridded forecast and any live OpenWeatherMap station observations into a cross-validated, actionable briefing adhering strictly to these instructions:
1. "headline": 3-7 words tailored directly to the selected focus ("${focus}").
2. "summary": 2 concise sentences providing an atmospheric overview through the lens of "${focus}" referencing real observed figures.
3. "weatherHealthTip": 1-2 actionable sentences of health/safety guidance specifically addressing the current weather condition (code ${current.weatherCode}: such as thunderstorm lightning/asthma, rain slip hazards/chills, freezing temperatures/bronchospasm/black ice, heat stroke/exhaustion, fog trapped particulates, or clear sky eye protection).
4. "indexHealthTips": An array of 3 structured objects ({ "indexName": string, "value": string, "status": "good" | "moderate" | "warning" | "alert", "tip": string }) for:
   - "UV Index": MUST provide actionable advice based on the value (e.g., recommend sunscreen SPF 30+ for UV 3+, seek shade between 10am-4pm and reapply SPF 50+ for UV 8+, extreme precautions for UV 11+). Current UV is ${current.uvIndex}.
   - "Air Quality": actionable respiratory advice based on US AQI (${airQuality.usAqi}) and particulate telemetry.
   - "Thermal Comfort": actionable advice for physiological strain based on temperature ${current.temperature}°C and feels-like ${current.apparentTemperature}°C (hydration, clothing layers, heat/cold protection).
5. "recommendations": 3-4 short, high-value practical tips as string array, specifically customized for the selected focus ("${focus}").
6. "focus": "${focus}".

Respond ONLY with valid JSON matching these exact keys:
{
  "headline": string,
  "summary": string,
  "weatherHealthTip": string,
  "indexHealthTips": [
    { "indexName": string, "value": string, "status": "good" | "moderate" | "warning" | "alert", "tip": string }
  ],
  "recommendations": string[],
  "focus": string
}
Do not include markdown fences, preambles, or conversational greetings.`;

      const response = await withTimeout(
        ai.models.generateContent({
          model: "gemini-4-hydrogen",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
          },
        }),
        7000,
        "Gemini"
      );

      const text = response.text;
      if (text) {
        const parsed = JSON.parse(text);
        const result = GenerateWeatherInsightResponse.safeParse({
          ...parsed,
          focus,
          generatedAt: new Date().toISOString(),
        });
        if (result.success) {
          res.json(result.data);
          return;
        }
      }
    } catch (_err) {
      logger.info("[Atmos] Insight served via meteorological health engine");
    }
  }

  // 2. Try OpenAI API if key is present
  const openAiKey = process.env.OPENAI_API_KEY;
  if (openAiKey) {
    try {
      const openAiPrompt = `You are Atmos Briefing, an expert meteorological and health advisor.
Location: ${location}. Local time: ${localTime}. Conditions: ${JSON.stringify(current)}. Air quality: ${JSON.stringify(airQuality)}.${
        owmBundle ? ` OpenWeather station: ${JSON.stringify(owmBundle.current)}.` : ""
      }
Focus: "${focus}". Provide actionable health tips based on current index values (UV 3+ sunscreen, UV 8+ seek shade, AQI, thermal strain) and weather condition health tips.
Return valid JSON only with keys: headline, summary, weatherHealthTip, indexHealthTips, recommendations, focus.`;

      const upstream = await withTimeout(
        fetch(OPENAI_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openAiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            temperature: 0.3,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content: "You are a precise weather and environmental health editor.",
              },
              { role: "user", content: openAiPrompt },
            ],
          }),
        }),
        5000,
        "OpenAI"
      );

      if (upstream.ok) {
        const payload = await upstream.json();
        const content = payload.choices?.[0]?.message?.content;
        if (content) {
          const candidate = JSON.parse(content);
          const result = GenerateWeatherInsightResponse.safeParse({
            ...candidate,
            focus,
            generatedAt: new Date().toISOString(),
          });
          if (result.success) {
            res.json(result.data);
            return;
          }
        }
      }
    } catch (_err) {
      logger.info("[Atmos] Insight fallback to meteorological health engine");
    }
  }

  // 3. Robust algorithmic meteorological and health briefing fallback (enriched with OWM station data if present)
  const fallbackResult = generateAlgorithmicInsight(parsedBody.data, owmBundle);
  res.json(fallbackResult);
});

router.post("/weather/lifestyle", async (req, res) => {
  const parsedBody = GenerateWeatherInsightBody.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({ error: "Weather context is incomplete." });
    return;
  }

  const {
    location,
    localTime,
    current,
    airQuality,
    upcoming,
    customActivity,
    latitude,
    longitude,
  } = parsedBody.data;

  const owmBundle =
    typeof latitude === "number" && typeof longitude === "number"
      ? await fetchOpenWeatherBundle(latitude, longitude)
      : null;

  const prompt = `Create real-time practical lifestyle and activity advice for ${location}.
Local time: ${localTime}.
Current conditions: ${JSON.stringify(current)}.
Air quality: ${JSON.stringify(airQuality)}.
Upcoming forecast: ${JSON.stringify(upcoming)}.${
    owmBundle
      ? `\nLive OpenWeatherMap station observations: ${JSON.stringify({
          current: owmBundle.current,
          shortTerm3h: owmBundle.forecast3h.slice(0, 4),
          airPollution: owmBundle.airPollution,
        })}`
      : ""
  }
Custom user activity to evaluate: ${customActivity || "General Outdoor & Fitness"}.
Return valid JSON only with exactly these keys:
- headline (string, 3-8 words)
- summary (string, 2 concise sentences)
- runningScore (number 0-100)
- runningAdvice (string)
- cyclingScore (number 0-100)
- cyclingAdvice (string)
- clothingAdvice (string)
- outdoorDiningAdvice (string)
- petWalkingAdvice (string)
- laundryAdvice (string)
- hydrationAdvice (string)
- commuteHazardScore (number 0-100)
- commuteAdvice (string)
- customActivityAdvice (string)
- customAdvice (array of 3-4 strings)
Use Celsius, km/h, and plain language. Do not mention being an AI.`;

  const ai = getGenAiClient();
  if (ai) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model: "gemini-4-hydrogen",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
          },
        }),
        7000,
        "Gemini Lifestyle"
      );

      const text = response.text;
      if (text) {
        const parsed = JSON.parse(text);
        const result = LifestyleAdvice.safeParse({
          ...parsed,
          generatedAt: new Date().toISOString(),
        });
        if (result.success) {
          res.json(result.data);
          return;
        }
      }
    } catch (_err) {
      logger.info("[Atmos] Lifestyle advice served via meteorological engine");
    }
  }

  const openAiKey = process.env.OPENAI_API_KEY;
  if (openAiKey) {
    try {
      const upstream = await withTimeout(
        fetch(OPENAI_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openAiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            temperature: 0.4,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content: "You are a precise lifestyle and meteorological activity advisor.",
              },
              { role: "user", content: prompt },
            ],
          }),
        }),
        5000,
        "OpenAI Lifestyle"
      );

      if (upstream.ok) {
        const payload = await upstream.json();
        const content = payload.choices?.[0]?.message?.content;
        if (content) {
          const candidate = JSON.parse(content);
          const result = LifestyleAdvice.safeParse({
            ...candidate,
            generatedAt: new Date().toISOString(),
          });
          if (result.success) {
            res.json(result.data);
            return;
          }
        }
      }
    } catch (_err) {
      logger.info("[Atmos] Lifestyle advice fallback to meteorological engine");
    }
  }

  const fallback = generateAlgorithmicLifestyle(parsedBody.data);
  res.json(fallback);
});

router.get("/weather/ip-location", async (req, res) => {
  try {
    const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const ipStr = typeof clientIp === "string" ? clientIp.split(",")[0].trim() : "";
    const url =
      ipStr && ipStr !== "127.0.0.1" && ipStr !== "::1" && !ipStr.startsWith("192.168.")
        ? `https://ipwho.is/${ipStr}`
        : "https://ipwho.is/";

    const ipRes = await fetch(url, { headers: { "User-Agent": "AtmosWeather/1.0" } });
    if (ipRes.ok) {
      const data = await ipRes.json();
      if (data?.success !== false && data?.city && data?.latitude && data?.longitude) {
        res.json({
          id: Math.round(Math.abs(data.latitude * 10000 + data.longitude * 100)),
          city: cleanCityOrVillage(data.city),
          latitude: data.latitude,
          longitude: data.longitude,
          country: cleanCountry(data.country),
          region: cleanCityOrVillage(data.region || ""),
        });
        return;
      }
    }
  } catch (_err) {
    logger.info("[Atmos] IP location detection bypassed");
  }

  res.status(503).json({ error: "Could not resolve IP location" });
});

router.get("/weather/reverse-geocode", async (req, res) => {
  const lat = Number(req.query.latitude ?? req.query.lat);
  const lon = Number(req.query.longitude ?? req.query.lon);

  if (isNaN(lat) || isNaN(lon)) {
    res.status(400).json({ error: "Valid latitude and longitude are required." });
    return;
  }

  let fallbackFromCounty: { name: string; country: string; admin1: string } | null = null;

  // 1. Try Photon Komoot (resolves village/neighbourhood cleanly)
  try {
    const photonRes = await withTimeout(
      fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}`),
      3000,
      "PhotonReverse"
    );
    if (photonRes.ok) {
      const data = await photonRes.json();
      const props = data?.features?.[0]?.properties;
      if (props) {
        const isPlaceFeature =
          props.osm_key === "place" &&
          ["city", "town", "village", "hamlet", "suburb", "quarter", "neighbourhood", "locality"].includes(
            props.osm_value || props.type || ""
          );

        const settlementName =
          (isPlaceFeature ? props.name : undefined) ||
          props.city ||
          props.town ||
          props.village ||
          props.hamlet ||
          props.suburb ||
          props.neighbourhood ||
          props.locality ||
          props.municipality ||
          (props.type !== "house" && props.type !== "amenity" && props.osm_key !== "highway"
            ? props.name
            : undefined);

        const cityName = cleanCityOrVillage(settlementName);
        if (cityName) {
          res.json({
            id: Math.round(Math.abs(lat * 10000 + lon * 100)),
            name: cityName,
            latitude: lat,
            longitude: lon,
            country: cleanCountry(props.country),
            admin1: cleanCityOrVillage(props.state || ""),
          });
          return;
        }

        const countyCleaned = cleanCityOrVillage(props.county || props.district);
        if (countyCleaned) {
          fallbackFromCounty = {
            name: countyCleaned,
            country: cleanCountry(props.country),
            admin1: cleanCityOrVillage(props.state || ""),
          };
        }
      }
    }
  } catch {
    // continue to fallback
  }

  // 2. Try OpenWeatherMap Geo 1.0 Reverse (ultra-reliable global city/town resolution)
  const owmKey = getOpenWeatherApiKey();
  if (owmKey) {
    try {
      const owmGeoRes = await withTimeout(
        fetch(`${OWM_API_BASE}/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${owmKey}`),
        3000,
        "OWMGeoReverse"
      );
      if (owmGeoRes.ok) {
        const list = (await owmGeoRes.json()) as Array<{
          name?: string;
          country?: string;
          state?: string;
        }>;
        const first = list?.[0];
        const cityName = cleanCityOrVillage(first?.name);
        if (cityName) {
          res.json({
            id: Math.round(Math.abs(lat * 10000 + lon * 100)),
            name: cityName,
            latitude: lat,
            longitude: lon,
            country: resolveCountryCodeName(first?.country),
            admin1: cleanCityOrVillage(first?.state || ""),
          });
          return;
        }
      }
    } catch {
      // continue to fallback
    }
  }

  // 3. Try Nominatim Reverse Geocode
  try {
    const nomRes = await withTimeout(
      fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, {
        headers: { "User-Agent": "AtmosWeatherApp/1.0", Accept: "application/json" },
      }),
      3500,
      "NominatimReverse"
    );
    if (nomRes.ok) {
      const data = (await nomRes.json()) as {
        address?: {
          city?: string;
          town?: string;
          village?: string;
          hamlet?: string;
          suburb?: string;
          locality?: string;
          municipality?: string;
          county?: string;
          state_district?: string;
          state?: string;
          country?: string;
        };
      };
      const addr = data.address;
      const rawCityName =
        addr?.city ||
        addr?.town ||
        addr?.village ||
        addr?.hamlet ||
        addr?.suburb ||
        addr?.locality ||
        addr?.municipality ||
        addr?.county ||
        addr?.state_district ||
        addr?.state;
      const cityName = cleanCityOrVillage(rawCityName);
      if (cityName) {
        res.json({
          id: Math.round(Math.abs(lat * 10000 + lon * 100)),
          name: cityName,
          latitude: lat,
          longitude: lon,
          country: cleanCountry(addr?.country),
          admin1: cleanCityOrVillage(addr?.state || ""),
        });
        return;
      }
    }
  } catch {
    // continue to fallback
  }

  if (fallbackFromCounty) {
    res.json({
      id: Math.round(Math.abs(lat * 10000 + lon * 100)),
      name: fallbackFromCounty.name,
      latitude: lat,
      longitude: lon,
      country: fallbackFromCounty.country,
      admin1: fallbackFromCounty.admin1,
    });
    return;
  }

  // 4. Fallback to coordinates
  res.json({
    id: Math.round(Math.abs(lat * 10000 + lon * 100)),
    name: "Detected Location",
    latitude: lat,
    longitude: lon,
    country: "",
    admin1: "",
  });
});

export default router;