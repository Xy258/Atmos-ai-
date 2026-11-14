import { Router, type IRouter } from "express";
import { GoogleGenAI } from "@google/genai";
import { logger } from "../lib/logger.ts";

const router: IRouter = Router();

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

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

export interface LiveWaterStation {
  id: string;
  name: string;
  agency: string;
  distanceKm: number;
  latitude: number;
  longitude: number;
  observedAt: string;
  metrics: {
    ph?: number;
    dissolvedOxygenMgL?: number;
    waterTempC?: number;
    turbidityFnu?: number;
    conductanceUsCm?: number;
    tdsEstimatedMgL?: number;
    nitrateMgL?: number;
    streamflowM3s?: number;
    gageHeightM?: number;
  };
}

export interface NearbyWaterBody {
  name: string;
  type: "lake" | "reservoir" | "river" | "canal" | "stream" | "water";
  distanceKm: number;
  latitude: number;
  longitude: number;
}

export interface WaterQualityResponse {
  area: {
    name: string;
    latitude: number;
    longitude: number;
  };
  fetchedAt: string;
  mode: "live_sensor" | "watershed_hydrology";
  overallScore: number;
  statusLabel: string;
  statusTone: "good" | "moderate" | "warning" | "alert";
  summary: string;
  guidance: string[];
  sources: string[];
  liveStations: LiveWaterStation[];
  hydrology: {
    riverDischargeM3s: number | null;
    riverDischargeMeanM3s: number | null;
    riverDischargeMedianM3s: number | null;
    dischargeRatio: number | null;
    dischargeStatus: string;
    dailyTrend: Array<{
      date: string;
      dischargeM3s: number;
      maxM3s: number;
    }>;
  };
  watershed: {
    soilMoistureTopPct: number | null;
    soilMoistureRootPct: number | null;
    recentRainMm: number | null;
    evapotranspirationMm: number | null;
    runoffRiskLabel: string;
    acidDepositionRisk: "Low" | "Moderate" | "Elevated";
    so2UgM3: number | null;
    no2UgM3: number | null;
    pm25UgM3: number | null;
  };
  marine: {
    isCoastal: boolean;
    seaSurfaceTempC: number | null;
    waveHeightM: number | null;
    currentSpeedKmh: number | null;
  };
  nearbyWaterBodies: NearbyWaterBody[];
  regionalReport: {
    summary: string;
    citations: Array<{ title: string; url: string }>;
  } | null;
}

const waterQualityCache = new Map<string, { expiresAt: number; data: WaterQualityResponse }>();
const WATER_CACHE_TTL_MS = 10 * 60_000; // 10 minutes

async function fetchUsgsStations(lat: number, lon: number): Promise<LiveWaterStation[]> {
  // USGS covers North America, US territories, Hawaii, Alaska, Puerto Rico
  const inUsgsCoverage = lat >= -15 && lat <= 72 && lon >= -180 && lon <= -64;
  if (!inUsgsCoverage) return [];

  try {
    const pad = 0.28;
    const bBox = `${(lon - pad).toFixed(4)},${(lat - pad).toFixed(4)},${(lon + pad).toFixed(4)},${(lat + pad).toFixed(4)}`;
    // Query chemical & physical water quality probes directly (pH, DO, Temp, Turbidity, Conductance, Nitrate)
    const url = `https://waterservices.usgs.gov/nwis/iv/?format=json&bBox=${bBox}&parameterCd=00010,00300,00400,63680,00095,99133&siteStatus=active`;
    const res = await withTimeout(
      fetch(url, {
        headers: {
          "User-Agent": "AtmosWeather/1.0",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
      }),
      8500,
      "USGS"
    );
    if (!res.ok) return [];
    const payload = (await withTimeout(res.json(), 3500, "USGS-JSON")) as any;
    const seriesList = Array.isArray(payload?.value?.timeSeries) ? payload.value.timeSeries : [];
    if (seriesList.length === 0) return [];

    const bySite = new Map<string, LiveWaterStation & { paramCount: number }>();

    for (const ts of seriesList) {
      const siteInfo = ts?.sourceInfo;
      const siteCode = String(siteInfo?.siteCode?.[0]?.value || "");
      const siteName = String(siteInfo?.siteName || "").trim();
      const geo = siteInfo?.geoLocation?.geogLocation;
      const sLat = Number(geo?.latitude);
      const sLon = Number(geo?.longitude);
      const paramCode = String(ts?.variable?.variableCode?.[0]?.value || "");
      const latestSample = ts?.values?.[0]?.value?.[0];
      const rawVal = Number(latestSample?.value);
      const observedAt = String(latestSample?.dateTime || "");

      if (!siteCode || !siteName || !Number.isFinite(rawVal) || rawVal <= -99999) continue;

      let entry = bySite.get(siteCode);
      if (!entry) {
        entry = {
          id: `usgs-${siteCode}`,
          name: siteName,
          agency: "USGS Water Services",
          distanceKm: Number.isFinite(sLat) && Number.isFinite(sLon) ? haversineKm(lat, lon, sLat, sLon) : 0,
          latitude: Number.isFinite(sLat) ? sLat : lat,
          longitude: Number.isFinite(sLon) ? sLon : lon,
          observedAt,
          metrics: {},
          paramCount: 0,
        };
        bySite.set(siteCode, entry);
      }

      if (observedAt && (!entry.observedAt || observedAt > entry.observedAt)) {
        entry.observedAt = observedAt;
      }

      switch (paramCode) {
        case "00400":
          entry.metrics.ph = Math.round(rawVal * 100) / 100;
          entry.paramCount += 3;
          break;
        case "00300":
          entry.metrics.dissolvedOxygenMgL = Math.round(rawVal * 10) / 10;
          entry.paramCount += 3;
          break;
        case "00010":
          entry.metrics.waterTempC = Math.round(rawVal * 10) / 10;
          entry.paramCount += 2;
          break;
        case "63680":
          entry.metrics.turbidityFnu = Math.round(rawVal * 10) / 10;
          entry.paramCount += 3;
          break;
        case "00095":
          entry.metrics.conductanceUsCm = Math.round(rawVal);
          entry.metrics.tdsEstimatedMgL = Math.round(rawVal * 0.65);
          entry.paramCount += 2;
          break;
        case "99133":
          entry.metrics.nitrateMgL = Math.round(rawVal * 100) / 100;
          entry.paramCount += 3;
          break;
        case "00060":
          entry.metrics.streamflowM3s = Math.round(rawVal * 0.0283168 * 100) / 100;
          entry.paramCount += 1;
          break;
        case "00065":
          entry.metrics.gageHeightM = Math.round(rawVal * 0.3048 * 100) / 100;
          entry.paramCount += 1;
          break;
      }
    }

    return Array.from(bySite.values())
      .filter((s) => s.paramCount > 0)
      .sort((a, b) => {
        if (b.paramCount !== a.paramCount) return b.paramCount - a.paramCount;
        return a.distanceKm - b.distanceKm;
      })
      .slice(0, 4)
      .map(({ paramCount: _p, ...station }) => station);
  } catch {
    return [];
  }
}

async function fetchUkEaStations(lat: number, lon: number): Promise<LiveWaterStation[]> {
  const inUkCoverage = lat >= 49.8 && lat <= 56.0 && lon >= -6.5 && lon <= 2.0;
  if (!inUkCoverage) return [];

  try {
    const url = `https://environment.data.gov.uk/flood-monitoring/id/stations?lat=${lat}&long=${lon}&dist=20&_limit=4`;
    const res = await withTimeout(fetch(url), 4000, "UK-EA");
    if (!res.ok) return [];
    const data = (await res.json()) as any;
    const items = Array.isArray(data?.items) ? data.items : [];

    const hydrated = await Promise.all(
      items.slice(0, 4).map(async (item: any, idx: number): Promise<LiveWaterStation | null> => {
        const ref = String(item.stationReference || item.notation || "").trim();
        if (!ref || !item.label) return null;
        const sLat = Number(item.lat);
        const sLon = Number(item.long);
        const metrics: LiveWaterStation["metrics"] = {};
        let observedAt = "";

        try {
          const mRes = await withTimeout(
            fetch(`https://environment.data.gov.uk/flood-monitoring/id/measures?stationReference=${encodeURIComponent(ref)}`),
            3500,
            "UK-EA-Measures"
          );
          if (mRes.ok) {
            const mData = (await mRes.json()) as any;
            const measures = Array.isArray(mData?.items) ? mData.items : [];
            for (const m of measures) {
              const param = String(m?.parameter || "").toLowerCase();
              const latestVal = Number(m?.latestReading?.value);
              if (!Number.isFinite(latestVal)) continue;
              if (m?.latestReading?.dateTime) observedAt = String(m.latestReading.dateTime);
              if (param === "level") {
                metrics.gageHeightM = Math.round(latestVal * 100) / 100;
              } else if (param === "flow") {
                metrics.streamflowM3s = Math.round(latestVal * 100) / 100;
              } else if (param === "temperature") {
                metrics.waterTempC = Math.round(latestVal * 10) / 10;
              }
            }
          }
        } catch {
          // ignore individual measure timeout
        }

        if (Object.keys(metrics).length === 0) return null;
        return {
          id: `ukea-${ref || idx}`,
          name: `${String(item.label)}${item.riverName ? ` (${String(item.riverName)})` : ""}`,
          agency: "UK Environment Agency",
          distanceKm: Number.isFinite(sLat) && Number.isFinite(sLon) ? haversineKm(lat, lon, sLat, sLon) : 0,
          latitude: Number.isFinite(sLat) ? sLat : lat,
          longitude: Number.isFinite(sLon) ? sLon : lon,
          observedAt: observedAt || new Date().toISOString(),
          metrics,
        };
      })
    );

    return hydrated.filter((s): s is LiveWaterStation => s !== null);
  } catch {
    return [];
  }
}

async function fetchNearbyWaterBodies(lat: number, lon: number): Promise<NearbyWaterBody[]> {
  const query = `[out:json][timeout:4];(way["natural"="water"]["name"](around:12000,${lat},${lon});way["waterway"~"river|canal|stream"]["name"](around:12000,${lat},${lon}););out center 12;`;
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
  ];

  const tryMirror = async (endpoint: string): Promise<NearbyWaterBody[]> => {
    const res = await withTimeout(
      fetch(endpoint, {
        method: "POST",
        headers: {
          "User-Agent": "AtmosWeather/1.0",
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ data: query }).toString(),
      }),
      4800,
      "OverpassWater"
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as any;
    const elements = Array.isArray(json?.elements) ? json.elements : [];
    const seen = new Set<string>();
    const bodies: NearbyWaterBody[] = [];

    for (const el of elements) {
      const name = String(el?.tags?.name || "").trim();
      const cLat = Number(el?.center?.lat);
      const cLon = Number(el?.center?.lon);
      if (!name || !Number.isFinite(cLat) || !Number.isFinite(cLon)) continue;
      const norm = name.toLowerCase();
      if (seen.has(norm)) continue;
      seen.add(norm);

      const rawWater = String(el?.tags?.water || el?.tags?.waterway || "water").toLowerCase();
      const type: NearbyWaterBody["type"] =
        rawWater === "reservoir"
          ? "reservoir"
          : rawWater === "river"
          ? "river"
          : rawWater === "canal"
          ? "canal"
          : rawWater === "stream"
          ? "stream"
          : el?.tags?.natural === "water"
          ? "lake"
          : "water";

      bodies.push({
        name,
        type,
        distanceKm: haversineKm(lat, lon, cLat, cLon),
        latitude: cLat,
        longitude: cLon,
      });
    }

    if (bodies.length === 0) throw new Error("Empty elements");
    return bodies.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 6);
  };

  try {
    return await Promise.any(endpoints.map((ep) => tryMirror(ep)));
  } catch {
    return [];
  }
}

async function fetchGroundedRegionalReport(
  areaName: string
): Promise<{ summary: string; citations: Array<{ title: string; url: string }> } | null> {
  const ai = getGenAiClient();
  if (!ai || !areaName || areaName === "Detected Location") return null;

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: `Provide a concise, factual 2-3 sentence summary of recent public surface water quality, river/lake monitoring, or municipal drinking water quality findings in ${areaName} based on official environmental or municipal reports. Stick strictly to verified facts found in search results.`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      }),
      5500,
      "GeminiWaterSearch"
    );

    const text = response.text?.trim();
    const rawChunks = (response as any)?.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const citations: Array<{ title: string; url: string }> = [];
    const seenUrls = new Set<string>();

    if (Array.isArray(rawChunks)) {
      for (const chunk of rawChunks) {
        const uri = chunk?.web?.uri;
        const title = chunk?.web?.title || "Public Water Report";
        if (typeof uri === "string" && uri.startsWith("http") && !seenUrls.has(uri)) {
          seenUrls.add(uri);
          citations.push({ title: String(title), url: uri });
        }
      }
    }

    if (text && citations.length > 0) {
      return { summary: text, citations: citations.slice(0, 4) };
    }
    return null;
  } catch {
    return null;
  }
}

router.get("/weather/water-quality", async (req, res) => {
  const lat = Number(req.query.latitude ?? req.query.lat);
  const lon = Number(req.query.longitude ?? req.query.lon);
  const areaName = String(req.query.name ?? "Selected Area").trim() || "Selected Area";

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    res.status(400).json({ error: "Valid latitude and longitude are required." });
    return;
  }

  const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)},${areaName.toLowerCase()}`;
  const cached = waterQualityCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json(cached.data);
    return;
  }

  // Query real environmental, hydrological, station, marine, and spatial sources in parallel
  const [usgsStations, ukStations, floodRes, hydroRes, airRes, marineRes, waterBodies, regionalReport] =
    await Promise.all([
      fetchUsgsStations(lat, lon),
      fetchUkEaStations(lat, lon),
      withTimeout(
        fetch(
          `https://flood-api.open-meteo.com/v1/flood?latitude=${lat}&longitude=${lon}&daily=river_discharge,river_discharge_mean,river_discharge_median,river_discharge_max&forecast_days=7&past_days=2`
        ).then((r) => (r.ok ? r.json() : null)),
        4000,
        "GloFAS"
      ).catch(() => null),
      withTimeout(
        fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=rain&hourly=soil_moisture_0_to_1cm,soil_moisture_1_to_3cm,et0_fao_evapotranspiration,rain&forecast_days=1&timezone=auto`
        ).then((r) => (r.ok ? r.json() : null)),
        3500,
        "OpenMeteoHydro"
      ).catch(() => null),
      withTimeout(
        fetch(
          `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm2_5,nitrogen_dioxide,sulphur_dioxide`
        ).then((r) => (r.ok ? r.json() : null)),
        3500,
        "OpenMeteoDeposition"
      ).catch(() => null),
      withTimeout(
        fetch(
          `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&current=sea_surface_temperature,wave_height,ocean_current_velocity`
        ).then((r) => (r.ok ? r.json() : null)),
        3500,
        "OpenMeteoMarine"
      ).catch(() => null),
      fetchNearbyWaterBodies(lat, lon),
      fetchGroundedRegionalReport(areaName),
    ]);

  const liveStations = [...usgsStations, ...ukStations];
  const primaryChemicalStation = liveStations.find(
    (s) =>
      s.metrics.ph != null ||
      s.metrics.dissolvedOxygenMgL != null ||
      s.metrics.turbidityFnu != null ||
      s.metrics.conductanceUsCm != null ||
      s.metrics.nitrateMgL != null
  );

  // Parse GloFAS River Discharge
  const floodDaily = (floodRes as any)?.daily;
  const times: string[] = Array.isArray(floodDaily?.time) ? floodDaily.time : [];
  const discharges: Array<number | null> = Array.isArray(floodDaily?.river_discharge)
    ? floodDaily.river_discharge
    : [];
  const means: Array<number | null> = Array.isArray(floodDaily?.river_discharge_mean)
    ? floodDaily.river_discharge_mean
    : [];
  const medians: Array<number | null> = Array.isArray(floodDaily?.river_discharge_median)
    ? floodDaily.river_discharge_median
    : [];
  const maxes: Array<number | null> = Array.isArray(floodDaily?.river_discharge_max)
    ? floodDaily.river_discharge_max
    : [];

  const todayIdx = Math.min(2, Math.max(0, times.length - 1));
  const riverDischargeM3s =
    typeof discharges[todayIdx] === "number" ? Math.round(discharges[todayIdx]! * 100) / 100 : null;
  const riverDischargeMeanM3s =
    typeof means[todayIdx] === "number" ? Math.round(means[todayIdx]! * 100) / 100 : null;
  const riverDischargeMedianM3s =
    typeof medians[todayIdx] === "number" ? Math.round(medians[todayIdx]! * 100) / 100 : null;

  const dischargeRatio =
    riverDischargeM3s != null && riverDischargeMedianM3s != null && riverDischargeMedianM3s > 0.05
      ? Math.round((riverDischargeM3s / riverDischargeMedianM3s) * 100) / 100
      : null;

  let dischargeStatus = "Normal Baseline Flow";
  if (dischargeRatio != null) {
    if (dischargeRatio >= 2.2) dischargeStatus = "High Runoff & Flood Surge";
    else if (dischargeRatio >= 1.4) dischargeStatus = "Elevated Runoff Flow";
    else if (dischargeRatio <= 0.45) dischargeStatus = "Low Flow / Reduced Dilution";
  }

  const dailyTrend = times.slice(todayIdx, todayIdx + 7).map((date, idx) => ({
    date,
    dischargeM3s: Math.round(Number(discharges[todayIdx + idx] ?? 0) * 100) / 100,
    maxM3s: Math.round(Number(maxes[todayIdx + idx] ?? discharges[todayIdx + idx] ?? 0) * 100) / 100,
  }));

  // Parse Soil Saturation & Runoff Chemistry
  const hCurrent = (hydroRes as any)?.current;
  const hHourly = (hydroRes as any)?.hourly;
  const sm0 = Array.isArray(hHourly?.soil_moisture_0_to_1cm)
    ? Number(hHourly.soil_moisture_0_to_1cm[0])
    : NaN;
  const sm1 = Array.isArray(hHourly?.soil_moisture_1_to_3cm)
    ? Number(hHourly.soil_moisture_1_to_3cm[0])
    : NaN;
  const et0 = Array.isArray(hHourly?.et0_fao_evapotranspiration)
    ? Number(hHourly.et0_fao_evapotranspiration[0])
    : NaN;
  const rainMm =
    typeof hCurrent?.rain === "number"
      ? Math.round(hCurrent.rain * 10) / 10
      : Array.isArray(hHourly?.rain)
      ? Math.round(Number(hHourly.rain[0] ?? 0) * 10) / 10
      : null;

  const soilMoistureTopPct = Number.isFinite(sm0) ? Math.round(sm0 * 100) : null;
  const soilMoistureRootPct = Number.isFinite(sm1) ? Math.round(sm1 * 100) : null;
  const evapotranspirationMm = Number.isFinite(et0) ? Math.round(et0 * 100) / 100 : null;

  const airCurr = (airRes as any)?.current;
  const so2UgM3 = typeof airCurr?.sulphur_dioxide === "number" ? Math.round(airCurr.sulphur_dioxide * 10) / 10 : null;
  const no2UgM3 = typeof airCurr?.nitrogen_dioxide === "number" ? Math.round(airCurr.nitrogen_dioxide * 10) / 10 : null;
  const pm25UgM3 = typeof airCurr?.pm2_5 === "number" ? Math.round(airCurr.pm2_5 * 10) / 10 : null;

  const acidScore = (so2UgM3 ?? 0) * 1.4 + (no2UgM3 ?? 0) * 0.5;
  const acidDepositionRisk: "Low" | "Moderate" | "Elevated" =
    acidScore >= 45 ? "Elevated" : acidScore >= 20 ? "Moderate" : "Low";

  let runoffRiskLabel = "Low Surface Runoff";
  if ((rainMm ?? 0) >= 3 || (soilMoistureTopPct ?? 0) >= 42) {
    runoffRiskLabel = "Active Stormwater Runoff";
  } else if ((rainMm ?? 0) > 0.2 || (soilMoistureTopPct ?? 0) >= 30) {
    runoffRiskLabel = "Moderate Drainage Runoff";
  }

  // Parse Coastal / Marine
  const mCurr = (marineRes as any)?.current;
  const seaSurfaceTempC =
    typeof mCurr?.sea_surface_temperature === "number"
      ? Math.round(mCurr.sea_surface_temperature * 10) / 10
      : null;
  const waveHeightM =
    typeof mCurr?.wave_height === "number" ? Math.round(mCurr.wave_height * 100) / 100 : null;
  const currentSpeedKmh =
    typeof mCurr?.ocean_current_velocity === "number"
      ? Math.round(mCurr.ocean_current_velocity * 10) / 10
      : null;
  const isCoastal = seaSurfaceTempC != null || waveHeightM != null;

  // Score calculation strictly derived from real observed measurements
  let score = 86;
  const guidance: string[] = [];

  if (primaryChemicalStation) {
    const m = primaryChemicalStation.metrics;
    if (m.ph != null) {
      if (m.ph < 6.0 || m.ph > 9.0) score -= 24;
      else if (m.ph < 6.5 || m.ph > 8.5) score -= 10;
    }
    if (m.dissolvedOxygenMgL != null) {
      if (m.dissolvedOxygenMgL < 4.0) score -= 28;
      else if (m.dissolvedOxygenMgL < 6.0) score -= 12;
    }
    if (m.turbidityFnu != null) {
      if (m.turbidityFnu > 50) score -= 25;
      else if (m.turbidityFnu > 15) score -= 12;
      else if (m.turbidityFnu > 5) score -= 5;
    }
    if (m.tdsEstimatedMgL != null) {
      if (m.tdsEstimatedMgL > 1000) score -= 20;
      else if (m.tdsEstimatedMgL > 500) score -= 8;
    }
    if (m.nitrateMgL != null && m.nitrateMgL > 10) {
      score -= 22;
    }
  } else {
    // Watershed & Runoff Quality Index from real hydrology & atmospheric chemistry
    if (dischargeRatio != null) {
      if (dischargeRatio >= 2.2) score -= 22;
      else if (dischargeRatio >= 1.4) score -= 10;
      else if (dischargeRatio <= 0.45) score -= 12;
    }
    if ((rainMm ?? 0) >= 3) score -= 14;
    else if ((rainMm ?? 0) > 0.3) score -= 6;
    if (acidDepositionRisk === "Elevated") score -= 15;
    else if (acidDepositionRisk === "Moderate") score -= 7;
    if ((pm25UgM3 ?? 0) > 35) score -= 6;
  }

  const overallScore = Math.max(15, Math.min(98, Math.round(score)));
  const statusTone: WaterQualityResponse["statusTone"] =
    overallScore >= 80
      ? "good"
      : overallScore >= 62
      ? "moderate"
      : overallScore >= 42
      ? "warning"
      : "alert";

  const statusLabel = primaryChemicalStation
    ? overallScore >= 80
      ? "Optimal Water Chemistry"
      : overallScore >= 62
      ? "Acceptable Water Baseline"
      : "Water Quality Watch"
    : overallScore >= 80
    ? "Low Runoff Stress"
    : overallScore >= 62
    ? "Moderate Runoff Watch"
    : "Elevated Turbidity & Runoff Risk";

  const sources: string[] = [];
  if (usgsStations.length > 0) sources.push("USGS Live Sensors");
  if (ukStations.length > 0) sources.push("UK Environment Agency");
  if (riverDischargeM3s != null) sources.push("GloFAS River Hydrology");
  if (isCoastal) sources.push("Open-Meteo Marine");
  sources.push("Open-Meteo Soil & Atmospheric Deposition");
  if (waterBodies.length > 0) sources.push("OpenStreetMap Hydrography");
  if (regionalReport) sources.push("Google Search Grounding");

  // Practical hydrological & drinking-water guidance
  if (primaryChemicalStation) {
    guidance.push(
      `Nearest live monitoring probe at ${primaryChemicalStation.name} (${primaryChemicalStation.distanceKm} km away) actively reports physical/chemical readings.`
    );
  } else {
    guidance.push(
      `Real-time open chemical probe streams (pH/DO/TDS) are unavailable via public APIs in ${areaName}; displaying live GloFAS river discharge, soil runoff saturation, and atmospheric deposition chemistry.`
    );
  }

  if (dischargeRatio != null && dischargeRatio >= 1.4) {
    guidance.push(
      `River flow is ${dischargeRatio}× above median baseline (${riverDischargeM3s} m³/s), increasing suspended sediment, turbidity, and stormwater runoff into local surface waters.`
    );
  } else if (dischargeRatio != null && dischargeRatio <= 0.5) {
    guidance.push(
      `Low river discharge (${riverDischargeM3s} m³/s, ${dischargeRatio}× median) reduces natural dilution; standing lakes and canals may show higher nutrient concentration.`
    );
  } else if (riverDischargeM3s != null) {
    guidance.push(
      `Basin river discharge sits near ${riverDischargeM3s} m³/s (${dischargeStatus.toLowerCase()}), supporting stable surface-water dilution.`
    );
  }

  if (acidDepositionRisk !== "Low") {
    guidance.push(
      `Atmospheric SO₂ (${so2UgM3 ?? 0} µg/m³) & NO₂ (${no2UgM3 ?? 0} µg/m³) raise wet-deposition acidity risk — flush first-flush rainwater before harvesting.`
    );
  } else {
    guidance.push(
      `Low atmospheric SO₂ (${so2UgM3 ?? 0} µg/m³) keeps rainwater acid-deposition risk minimal; standard filtration is advised for drinking use.`
    );
  }

  const summary = primaryChemicalStation
    ? `Live sensor telemetry near ${areaName} (${primaryChemicalStation.name}, ${primaryChemicalStation.distanceKm} km) records ${
        primaryChemicalStation.metrics.ph != null ? `pH ${primaryChemicalStation.metrics.ph}, ` : ""
      }${
        primaryChemicalStation.metrics.dissolvedOxygenMgL != null
          ? `Dissolved Oxygen ${primaryChemicalStation.metrics.dissolvedOxygenMgL} mg/L, `
          : ""
      }${
        primaryChemicalStation.metrics.waterTempC != null
          ? `Water Temp ${primaryChemicalStation.metrics.waterTempC}°C`
          : "active station parameters"
      }.`.replace(/,\s*\.$/, ".")
    : `Watershed diagnostics for ${areaName} show ${dischargeStatus.toLowerCase()}${
        riverDischargeM3s != null ? ` (${riverDischargeM3s} m³/s)` : ""
      }, ${runoffRiskLabel.toLowerCase()}${
        soilMoistureTopPct != null ? ` (${soilMoistureTopPct}% surface soil saturation)` : ""
      }, and ${acidDepositionRisk.toLowerCase()} rainwater acid-deposition risk.`;

  const result: WaterQualityResponse = {
    area: { name: areaName, latitude: lat, longitude: lon },
    fetchedAt: new Date().toISOString(),
    mode: primaryChemicalStation ? "live_sensor" : "watershed_hydrology",
    overallScore,
    statusLabel,
    statusTone,
    summary,
    guidance,
    sources,
    liveStations,
    hydrology: {
      riverDischargeM3s,
      riverDischargeMeanM3s,
      riverDischargeMedianM3s,
      dischargeRatio,
      dischargeStatus,
      dailyTrend,
    },
    watershed: {
      soilMoistureTopPct,
      soilMoistureRootPct,
      recentRainMm: rainMm,
      evapotranspirationMm,
      runoffRiskLabel,
      acidDepositionRisk,
      so2UgM3,
      no2UgM3,
      pm25UgM3,
    },
    marine: {
      isCoastal,
      seaSurfaceTempC,
      waveHeightM,
      currentSpeedKmh,
    },
    nearbyWaterBodies: waterBodies,
    regionalReport,
  };

  waterQualityCache.set(cacheKey, {
    expiresAt: Date.now() + WATER_CACHE_TTL_MS,
    data: result,
  });

  logger.info(`[Atmos] Water quality served for ${areaName} (${result.mode})`);
  res.setHeader("Cache-Control", "public, max-age=300");
  res.json(result);
});

export default router;
