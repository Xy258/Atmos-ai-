import { Router, type IRouter } from "express";
import { GoogleGenAI } from "@google/genai";
import { logger } from "../lib/logger";
import {
  GenerateWeatherInsightBody,
  GenerateWeatherInsightResponse,
  GenerateLifestyleAdviceResponse as LifestyleAdvice,
} from "@workspace/api-zod";

const router: IRouter = Router();

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

let genAiClient: GoogleGenAI | null = null;
function getGenAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!genAiClient) {
    genAiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAiClient;
}

export interface IndexHealthTipItem {
  indexName: string;
  value: string;
  status: 'good' | 'moderate' | 'warning' | 'alert' | string;
  tip: string;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} deferred after ${ms}ms`)), ms)
    ),
  ]);
}

function generateAlgorithmicInsight(data: {
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
}) {
  const { current, airQuality, upcoming } = data;
  const temp = Math.round(current.temperature);
  const feelsLike = Math.round(current.apparentTemperature);
  const rain = current.precipitationProbability;
  const wind = Math.round(current.windSpeed);
  const uv = Math.round(current.uvIndex * 10) / 10;
  const aqi = airQuality.usAqi;
  const focus = (data.focus || 'general').toLowerCase();

  // 1. Weather condition health tip
  let weatherHealthTip = "Moderate atmospheric baseline. Standard daily outdoor precautions apply.";
  const code = current.weatherCode;
  if ([95, 96, 99].includes(code)) {
    weatherHealthTip = "Thunderstorm safety: seek enclosed shelter immediately. Rapid barometric pressure drops and airborne pollen fragmentation can trigger severe thunderstorm asthma.";
  } else if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    weatherHealthTip = "Rain hazard: wet surfaces increase slipping risk. Keep footwear and head dry to prevent rapid thermal loss and post-commute chills.";
  } else if ([71, 73, 75, 77, 85, 86].includes(code)) {
    weatherHealthTip = "Winter freeze hazard: inhaling sub-freezing air can constrict bronchial passages. Warm up gently indoors and wear high-traction treaded footwear for black ice.";
  } else if ([45, 48].includes(code)) {
    weatherHealthTip = "Fog caution: ground-level moisture traps fine vehicle particulates, which can irritate reactive airways; wear a light mask if sensitive.";
  } else if (wind >= 32) {
    weatherHealthTip = "High wind advisory: airborne particulates and allergens can cause ocular irritation; wrap-around protective lenses recommended.";
  } else if (code === 0) {
    weatherHealthTip = "Clear sky solar exposure: direct sunlight increases ocular strain; wear 100% UV-blocking sunglasses and maintain regular hydration.";
  } else {
    weatherHealthTip = "Overcast light: up to 80% of UV rays penetrate thin clouds; maintain skin awareness and hydration during midday hours.";
  }

  // 2. Index health tips (UV, AQI, Thermal Comfort)
  const indexHealthTips: IndexHealthTipItem[] = [];

  // UV Index Tip (actionable sunscreen for UV 3+, seek shade for UV 8+)
  if (uv >= 11) {
    indexHealthTips.push({
      indexName: 'UV Index',
      value: `${uv} (Extreme)`,
      status: 'alert',
      tip: 'UV 11+ Extreme: unprotected skin burns in <10 mins. Stay indoors or in dense shade during midday; apply SPF 50+ sunscreen, wear wide-brim hat & UV400 sunglasses.',
    });
  } else if (uv >= 8) {
    indexHealthTips.push({
      indexName: 'UV Index',
      value: `${uv} (Very High)`,
      status: 'warning',
      tip: 'UV 8+ Very High: seek shade between 10am-4pm. Generously apply SPF 30-50+ sunscreen, reapply every 2 hours, and wear UV-protective sunglasses and a hat.',
    });
  } else if (uv >= 6) {
    indexHealthTips.push({
      indexName: 'UV Index',
      value: `${uv} (High)`,
      status: 'warning',
      tip: 'UV 6+ High: solar exposure is elevated. Apply SPF 30+ sunscreen, wear UV sunglasses, and avoid prolonged unshaded midday exposure.',
    });
  } else if (uv >= 3) {
    indexHealthTips.push({
      indexName: 'UV Index',
      value: `${uv} (Moderate)`,
      status: 'moderate',
      tip: 'UV 3+ Moderate: recommend SPF 30+ sunscreen, protective eyewear, and shade during peak midday hours (11am-3pm) for skin health.',
    });
  } else {
    indexHealthTips.push({
      indexName: 'UV Index',
      value: `${uv} (Low)`,
      status: 'good',
      tip: 'UV < 3 Low: minimal UV radiation. Safe to enjoy outdoor daytime activities without high sunburn risk.',
    });
  }

  // Air Quality Tip
  if (aqi > 150) {
    indexHealthTips.push({
      indexName: 'Air Quality',
      value: `AQI ${aqi} (Unhealthy)`,
      status: 'alert',
      tip: 'Everyone may experience health effects. Minimize prolonged outdoor exertion; wear an N95 mask and run indoor HEPA filtration.',
    });
  } else if (aqi > 100) {
    indexHealthTips.push({
      indexName: 'Air Quality',
      value: `AQI ${aqi} (Sensitive Groups)`,
      status: 'warning',
      tip: 'Individuals with asthma or heart/lung conditions should reduce heavy outdoor exertion and monitor breathing.',
    });
  } else if (aqi > 50) {
    indexHealthTips.push({
      indexName: 'Air Quality',
      value: `AQI ${aqi} (Moderate)`,
      status: 'moderate',
      tip: 'Air quality is acceptable; unusually sensitive individuals should watch for minor cough or respiratory irritation.',
    });
  } else {
    indexHealthTips.push({
      indexName: 'Air Quality',
      value: `AQI ${aqi} (Good)`,
      status: 'good',
      tip: 'Clean, healthy air. Optimal for cardiovascular endurance, outdoor running, and deep aerobic breathing.',
    });
  }

  // Thermal Comfort & Strain Tip
  if (feelsLike >= 35) {
    indexHealthTips.push({
      indexName: 'Thermal Comfort',
      value: `${feelsLike}°C (Extreme Heat)`,
      status: 'alert',
      tip: 'High risk of heat cramps, exhaustion, or stroke. Drink 500ml+ electrolyte fluids hourly, stay in air conditioning, and avoid peak exertion.',
    });
  } else if (feelsLike >= 28) {
    indexHealthTips.push({
      indexName: 'Thermal Comfort',
      value: `${feelsLike}°C (High Heat)`,
      status: 'warning',
      tip: 'Elevated thermal strain. Drink 300-400ml water per hour outdoors, wear lightweight breathable clothes, and take shade breaks.',
    });
  } else if (feelsLike <= -5) {
    indexHealthTips.push({
      indexName: 'Thermal Comfort',
      value: `${feelsLike}°C (Severe Cold)`,
      status: 'alert',
      tip: 'Frostbite risk on exposed skin in <30 min. Dress in windproof thermal layers, insulated gloves, and face covering.',
    });
  } else if (feelsLike <= 5) {
    indexHealthTips.push({
      indexName: 'Thermal Comfort',
      value: `${feelsLike}°C (Cold Chill)`,
      status: 'moderate',
      tip: 'Chilly conditions constrict peripheral blood vessels. Wear a warm jacket, scarf, and insulated gloves.',
    });
  } else {
    indexHealthTips.push({
      indexName: 'Thermal Comfort',
      value: `${temp}°C (Feels ${feelsLike}°C)`,
      status: 'good',
      tip: 'Comfortable thermal equilibrium. Low physiological strain for standard daily routines and fitness.',
    });
  }

  // 3. Focus-tailored headline, summary, and recommendations
  let headline = "Pleasant and balanced conditions ahead";
  let summary = `Currently ${temp}°C (feels like ${feelsLike}°C) with ${current.humidity}% humidity and ${wind} km/h winds in ${data.location}.`;
  let recommendations: string[] = [];

  if (focus === 'health' || focus === 'wellness') {
    headline = uv >= 8 ? "High UV Radiation: Sun Protection Essential" : aqi > 100 ? "Sensitive Air Quality Advisory" : "Optimal Bioclimatic Wellness Index";
    summary = `Physiological telemetry for ${data.location} reports UV Index ${uv}, AQI ${aqi}, and thermal comfort near ${feelsLike}°C. Prioritize skin barriers and hydration.`;
    recommendations = [
      uv >= 3
        ? (uv >= 8 ? "UV 8+ warning: seek shade between 10am-4pm and reapply broad-spectrum SPF 50+ every 2 hours." : "UV 3+ active: apply SPF 30+ sunscreen before outdoor exposure.")
        : "Low UV index allows comfortable daytime light exposure without sunburn danger.",
      aqi > 100
        ? "Air quality is elevated; pace aerobic exertion and consider an indoor workout."
        : "Air quality is pristine; excellent for lung volume expansion and outdoor walking.",
      feelsLike >= 28
        ? "Hydration protocol: drink 350ml cool water every 45 min of outdoor exposure."
        : feelsLike <= 5
        ? "Cold air constricts peripheral blood vessels; wear thermal layers to conserve core temperature."
        : "Thermal equilibrium is balanced; standard hydration and clothing apply.",
      weatherHealthTip,
    ];
  } else if (focus === 'commute') {
    headline = rain > 40 ? "Commuter Weather: Wet Road Hazards" : wind > 28 ? "Commuter Weather: Gusty Transit Advisory" : "Commuter Weather: Clear Route Conditions";
    summary = `Transit conditions in ${data.location} indicate ${rain > 40 ? 'wet pavement, spray hazards, and reduced braking distances' : 'clean sightlines and standard road flow'}.`;
    recommendations = [
      rain > 40
        ? "Allow 5-10 extra minutes for road travel and wet pavement braking distances."
        : "Roadways and rail corridors are dry with standard travel times expected.",
      wind > 28
        ? "Expect cross-wind gusts on bridges, elevated highway flyovers, and bike paths."
        : "Light winds provide stable handling for cycling and two-wheeled transit.",
      uv >= 6 ? "Carry UV-rated driving sunglasses to mitigate low-angle sun glare." : "Pack an umbrella or light windbreaker for transitional evening conditions.",
      weatherHealthTip,
    ];
  } else if (focus === 'outdoor' || focus === 'runner') {
    headline = "Athletics & Runner's Performance Index";
    summary = `Cardiorespiratory conditions for ${data.location}: thermal strain is ${temp > 28 ? 'elevated' : 'moderate'} with AQI ${aqi} and ${rain}% precipitation chance.`;
    recommendations = [
      temp > 28
        ? "Schedule long runs for early dawn or dusk to avoid thermal accumulation."
        : "Workout windows are favorable throughout late morning and afternoon.",
      aqi <= 50
        ? "Particulate density is low: ideal for high VO2 max interval training."
        : "Pace threshold efforts carefully to minimize reactive airway stress.",
      uv >= 3 ? "Wear sweat-resistant SPF 30+ sunscreen and sport-polarized lenses." : "Standard athletic gear suitable for current cloud cover.",
      weatherHealthTip,
    ];
  } else if (focus === 'detailed') {
    headline = "Meteorological Deep Dive & Synoptic Dynamics";
    summary = `Surface observations in ${data.location}: ${temp}°C (${feelsLike}°C apparent) at ${current.humidity}% RH with boundary wind at ${wind} km/h.`;
    const dewPointEstimate = Math.round(temp - ((100 - current.humidity) / 5));
    recommendations = [
      `Dew point spread estimated at ${dewPointEstimate}°C with ${current.humidity}% relative humidity (${current.humidity > 75 ? 'high condensation probability' : 'moderate air column moisture'}).`,
      rain > 30 ? "Barometric moisture convergence indicates convective showers." : "Stable localized air mass with laminar horizontal wind flow.",
      upcoming.length > 0 ? `Diurnal outlook: maximums near ${Math.round(upcoming[0].high)}°C, minimums near ${Math.round(upcoming[0].low)}°C.` : "Steady diurnal oscillation expected.",
      weatherHealthTip,
    ];
  } else {
    // General Daily Focus
    headline = rain > 50 ? "Showers Expected: Keep Rainwear Handy" : temp >= 28 ? "Warm & Bright: Stay Cool Outdoors" : temp <= 5 ? "Crisp & Cold: Layer Up Today" : "Pleasant & Balanced Atmospheric Outlook";
    summary = `Currently ${temp}°C (feels like ${feelsLike}°C) with ${current.humidity}% humidity and ${wind} km/h winds in ${data.location}.`;
    recommendations = [
      uv >= 3
        ? (uv >= 8 ? "UV 8+: Seek shade between 10am-4pm and reapply broad-spectrum SPF sunscreen regularly." : "UV 3+: Recommend applying SPF 30+ sunscreen during peak midday hours.")
        : "Low UV exposure allows comfortable outdoor daytime strolls.",
      rain > 30 ? "Keep an umbrella or water-resistant jacket handy for intermittent showers." : "Minimal precipitation threat throughout the day.",
      aqi > 100 ? "Air quality is sensitive; consider lighter outdoor intensity." : "Air quality is clean and refreshing for standard daily activities.",
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

  const actName = customActivity && customActivity.trim() !== '' ? customActivity.trim() : 'General Outdoor & Fitness';

  return {
    headline: temp > 28 ? "Warm day suited for light outdoor activities" : rain > 50 ? "Indoor-focused day with rain expected" : "Favorable conditions for outdoor routines",
    summary: `Current temperature is ${Math.round(temp)}°C with ${rain}% chance of precipitation and AQI ${aqi}. Live diagnostics are actively monitored.`,
    runningScore,
    runningAdvice: runningScore >= 75 ? "Excellent conditions for a run or jog. Stay hydrated and enjoy the fresh air." : runningScore >= 40 ? "Moderate running conditions. Watch out for wind or precipitation and keep intensity measured." : "Outdoor running is discouraged due to adverse weather or air quality. Consider indoor treadmill training.",
    cyclingScore,
    cyclingAdvice: cyclingScore >= 75 ? "Great cycling conditions with favorable wind and dry road surfaces." : cyclingScore >= 40 ? "Exercise caution on two wheels due to wind or damp conditions." : "High wind or precipitation make cycling hazardous. Use public transit or indoor trainer.",
    clothingAdvice: temp > 25 ? "Wear breathable, lightweight cotton or athletic wear and sunglasses." : temp < 10 ? "Wear layered thermal wear, a wind-resistant jacket, and warm gloves." : "Comfortable long sleeves or a light jacket will keep you comfortable.",
    outdoorDiningAdvice: rain > 30 || wind > 25 ? "Terraces and outdoor seating may be breezy or wet; indoor seating recommended." : "Terraces and outdoor dining spaces are pleasant and comfortable right now.",
    petWalkingAdvice: temp > 28 ? "Pavement can be hot on paws. Walk dogs early morning or late evening in shaded parks." : "Great weather for dog walking. Ensure fresh water is available on your route.",
    laundryAdvice: rain > 30 ? "Air drying outdoors is not recommended due to high rain probability." : wind > 15 && temp > 15 ? "Excellent outdoor drying conditions with good wind circulation and warmth." : "Standard outdoor drying conditions apply.",
    hydrationAdvice: temp > 26 ? `High temperature (${Math.round(temp)}°C) increases fluid loss. Drink at least 300ml of water every hour outdoors.` : "Standard hydration needs apply. Keep a water bottle nearby.",
    commuteHazardScore,
    commuteAdvice: commuteHazardScore > 50 ? "Commute conditions are disrupted by weather hazards. Allow extra travel time." : "Commute routes are clear with minimal weather interference.",
    customActivityAdvice: `Suitability for ${actName}: ${cyclingScore >= 70 ? 'Highly favorable right now.' : 'Proceed with caution and check hourly radar updates.'}`,
    customAdvice: [
      `UV Index is ${Math.round(uv * 10) / 10} — ${uv >= 8 ? 'seek shade and apply SPF 50+ sunscreen.' : uv >= 3 ? 'apply SPF 30+ sunscreen during midday.' : 'minimal sunburn danger.'}`,
      `Air Quality Index (AQI ${aqi}) is ${aqi <= 50 ? 'clean and healthy for deep breathing.' : aqi <= 100 ? 'acceptable for general routines.' : 'sensitive groups should limit outdoor exertion.'}`,
      `Wind speed is ${Math.round(wind)} km/h with ${Math.round(current.humidity)}% humidity.`
    ],
    generatedAt: new Date().toISOString(),
  };
}

router.post("/weather/insight", async (req, res) => {
  const parsedBody = GenerateWeatherInsightBody.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({ error: "Weather context is incomplete." });
    return;
  }

  const { location, localTime, current, airQuality, upcoming, focus = 'general' } = parsedBody.data;

  // 1. Try modern @google/genai SDK with gemini-3.8-flash
  const ai = getGenAiClient();
  if (ai) {
    try {
      const prompt = `You are Atmos Briefing, an expert meteorological and health advisor.
Location: ${location}.
Local time: ${localTime}.
Current conditions: ${JSON.stringify(current)}.
Air quality: ${JSON.stringify(airQuality)}.
Upcoming forecast: ${JSON.stringify(upcoming)}.
User's Selected Focus Perspective: "${focus}" (e.g., 'general', 'health', 'commute', 'outdoor', 'detailed').

Generate a comprehensive, actionable briefing adhering strictly to the following instructions:
1. "headline": 3-7 words tailored directly to the selected focus ("${focus}").
2. "summary": 2 concise sentences providing an atmospheric overview through the lens of "${focus}".
3. "weatherHealthTip": 1-2 actionable sentences of health/safety guidance specifically addressing the current weather condition (code ${current.weatherCode}: such as thunderstorm lightning/asthma, rain slip hazards/chills, freezing temperatures/bronchospasm/black ice, heat stroke/exhaustion, fog trapped particulates, or clear sky eye protection).
4. "indexHealthTips": An array of 3 structured objects ({ "indexName": string, "value": string, "status": "good" | "moderate" | "warning" | "alert", "tip": string }) for:
   - "UV Index": MUST provide actionable advice based on the value (e.g., recommend sunscreen SPF 30+ for UV 3+, seek shade between 10am-4pm and reapply SPF 50+ for UV 8+, extreme precautions for UV 11+). Current UV is ${current.uvIndex}.
   - "Air Quality": actionable respiratory advice based on US AQI (${airQuality.usAqi}).
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
          model: "gemini-3.8-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
          },
        }),
        6000,
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
Location: ${location}. Local time: ${localTime}. Conditions: ${JSON.stringify(current)}. Air quality: ${JSON.stringify(airQuality)}.
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

  // 3. Robust algorithmic meteorological and health briefing fallback
  const fallbackResult = generateAlgorithmicInsight(parsedBody.data);
  res.json(fallbackResult);
});

router.post("/weather/lifestyle", async (req, res) => {
  const parsedBody = GenerateWeatherInsightBody.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({ error: "Weather context is incomplete." });
    return;
  }

  const { location, localTime, current, airQuality, upcoming, customActivity } = parsedBody.data as any;

  const prompt = `Create real-time practical lifestyle and activity advice for ${location}.
Local time: ${localTime}.
Current conditions: ${JSON.stringify(current)}.
Air quality: ${JSON.stringify(airQuality)}.
Upcoming forecast: ${JSON.stringify(upcoming)}.
Custom user activity to evaluate: ${customActivity || 'General Outdoor & Fitness'}.
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
          model: "gemini-3.8-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
          },
        }),
        6000,
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
  const cleanCountry = (name?: string) => {
    if (!name) return "";
    return name
      .replace(/\s*\(the\)$/i, "")
      .replace(/^United States of America$/i, "United States")
      .replace(/^United Kingdom of Great Britain and Northern Ireland$/i, "United Kingdom")
      .trim();
  };

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
          city: data.city,
          latitude: data.latitude,
          longitude: data.longitude,
          country: cleanCountry(data.country),
          region: data.region || "",
        });
        return;
      }
    }
  } catch (err) {
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

  // Helper to clean country names like "United States of America (the)" -> "United States"
  const cleanCountry = (name?: string) => {
    if (!name) return "";
    return name
      .replace(/\s*\(the\)$/i, "")
      .replace(/^United States of America$/i, "United States")
      .replace(/^United Kingdom of Great Britain and Northern Ireland$/i, "United Kingdom")
      .trim();
  };

  // 1. Try Photon Komoot (OpenStreetMap global data, ultra-fast and reliable on cloud hosts)
  try {
    const photonRes = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}`);
    if (photonRes.ok) {
      const data = await photonRes.json();
      const props = data?.features?.[0]?.properties;
      if (props) {
        const cityName =
          props.city ||
          props.town ||
          props.village ||
          props.county ||
          props.district ||
          props.locality ||
          props.name;
        if (cityName) {
          res.json({
            id: Math.round(Math.abs(lat * 10000 + lon * 100)),
            name: cityName,
            latitude: lat,
            longitude: lon,
            country: cleanCountry(props.country),
            admin1: props.state || "",
          });
          return;
        }
      }
    }
  } catch {
    // continue to fallback
  }

  // 2. Try Nominatim Reverse Geocode
  try {
    const nomRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { "User-Agent": "AtmosWeatherApp/1.0", Accept: "application/json" } }
    );
    if (nomRes.ok) {
      const data = (await nomRes.json()) as {
        address?: {
          city?: string;
          town?: string;
          village?: string;
          municipality?: string;
          county?: string;
          state_district?: string;
          state?: string;
          country?: string;
        };
      };
      const addr = data.address;
      const cityName =
        addr?.city ||
        addr?.town ||
        addr?.village ||
        addr?.municipality ||
        addr?.county ||
        addr?.state_district ||
        addr?.state;
      if (cityName) {
        res.json({
          id: Math.round(Math.abs(lat * 10000 + lon * 100)),
          name: cityName,
          latitude: lat,
          longitude: lon,
          country: cleanCountry(addr?.country),
          admin1: addr?.state || "",
        });
        return;
      }
    }
  } catch {
    // continue to fallback
  }

  // 3. Fallback to coordinates
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