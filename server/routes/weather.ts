import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";
import {
  GenerateWeatherInsightBody,
  GenerateWeatherInsightResponse,
  GenerateLifestyleAdviceResponse as LifestyleAdvice,
} from "@workspace/api-zod";

const router: IRouter = Router();

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

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
}) {
  const { current, airQuality, upcoming } = data;
  const temp = Math.round(current.temperature);
  const rain = current.precipitationProbability;
  const wind = Math.round(current.windSpeed);
  const uv = Math.round(current.uvIndex);
  const aqi = airQuality.usAqi;

  let headline = "Pleasant and balanced conditions ahead";
  const tips: string[] = [];

  if (rain > 50) {
    headline = "Rain showers expected today";
    tips.push("Keep an umbrella handy and allow extra time for commuting.");
  } else if (temp >= 28) {
    headline = "Warm and bright conditions today";
    tips.push("Stay hydrated and seek shade during peak midday hours.");
  } else if (temp <= 5) {
    headline = "Crisp and cold conditions";
    tips.push("Bundle up with warm layers, gloves, and insulated footwear.");
  } else if (wind >= 30) {
    headline = "Breezy with gusty winds";
    tips.push("Secure loose outdoor items and take care with lightweight gear.");
  }

  if (uv >= 6) {
    tips.push(`High UV index (${uv}) — apply SPF 30+ sunscreen and wear sunglasses.`);
  } else if (uv >= 3) {
    tips.push("Moderate UV exposure during midday hours.");
  }

  if (aqi > 100) {
    tips.push(`Air quality is moderate-to-sensitive (AQI ${aqi}) — consider reducing prolonged outdoor exertion.`);
  } else {
    tips.push("Clean air quality makes it a great time for outdoor exercise and walking.");
  }

  if (upcoming.length > 0 && upcoming[0].precipitationProbability > 40) {
    tips.push(`Tomorrow has a ${upcoming[0].precipitationProbability}% chance of precipitation with highs around ${Math.round(upcoming[0].high)}°C.`);
  } else if (upcoming.length > 0) {
    tips.push(`Tomorrow's forecast looks steady with highs near ${Math.round(upcoming[0].high)}°C and lows of ${Math.round(upcoming[0].low)}°C.`);
  }

  const summary = `Currently ${temp}°C (feels like ${Math.round(current.apparentTemperature)}°C) with ${current.humidity}% humidity and ${wind} km/h winds. Expected precipitation chance is ${rain}%.`;

  return {
    headline,
    summary,
    recommendations: tips.slice(0, 4),
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
      `UV Index is ${Math.round(uv)} — ${uv >= 6 ? 'apply sunscreen SPF 30+.' : 'moderate protection recommended.'}`,
      `Air Quality Index (AQI ${aqi}) is ${aqi <= 50 ? 'clean and healthy.' : 'acceptable for most people.'}`,
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

  const geminiKey = process.env.GEMINI_API_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;

  const { location, localTime, current, airQuality, upcoming } =
    parsedBody.data;

  const prompt = `Create a practical weather briefing for ${location}.
Local time: ${localTime}.
Current conditions: ${JSON.stringify(current)}.
Air quality: ${JSON.stringify(airQuality)}.
Upcoming forecast: ${JSON.stringify(upcoming)}.
Return valid JSON only with exactly these keys:
headline (short, 3-7 words), summary (2 concise sentences), recommendations (3-4 short practical tips as string array).
Use Celsius, km/h, and plain language. Do not mention being an AI. Be specific about rain, heat, wind, UV, and air quality when relevant.`;

  // 1. Try Gemini API if key is present
  if (geminiKey) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
      const response = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.3,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const parsed = JSON.parse(text);
          const result = GenerateWeatherInsightResponse.safeParse({
            ...parsed,
            generatedAt: new Date().toISOString(),
          });
          if (result.success) {
            res.json(result.data);
            return;
          }
        }
      }
    } catch (err) {
      logger.warn({ err }, "Gemini API failed, falling back");
    }
  }

  // 2. Try OpenAI API if key is present
  if (openAiKey) {
    try {
      const upstream = await fetch(OPENAI_ENDPOINT, {
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
              content:
                "You are a precise weather editor who turns forecast data into calm, useful planning advice.",
            },
            { role: "user", content: prompt },
          ],
        }),
      });

      if (upstream.ok) {
        const payload = await upstream.json();
        const content = payload.choices?.[0]?.message?.content;
        if (content) {
          const candidate = JSON.parse(content);
          const result = GenerateWeatherInsightResponse.safeParse({
            ...candidate,
            generatedAt: new Date().toISOString(),
          });
          if (result.success) {
            res.json(result.data);
            return;
          }
        }
      }
    } catch (err) {
      logger.warn({ err }, "OpenAI API failed, falling back");
    }
  }

  // 3. Robust algorithmic meteorological briefing fallback
  const fallbackResult = generateAlgorithmicInsight(parsedBody.data);
  res.json(fallbackResult);
});

router.post("/weather/lifestyle", async (req, res) => {
  const parsedBody = GenerateWeatherInsightBody.safeParse(req.body);

  if (!parsedBody.success) {
    res.status(400).json({ error: "Weather context is incomplete." });
    return;
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const openAiKey = process.env.OPENAI_API_KEY;
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

  if (geminiKey) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
      const response = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.3,
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
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
      }
    } catch (err) {
      logger.warn({ err }, "Gemini API failed for lifestyle advice, falling back");
    }
  }

  if (openAiKey) {
    try {
      const upstream = await fetch(OPENAI_ENDPOINT, {
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
      });

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
    } catch (err) {
      logger.warn({ err }, "OpenAI API failed for lifestyle advice, falling back");
    }
  }

  const fallback = generateAlgorithmicLifestyle(parsedBody.data);
  res.json(fallback);
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

  // 1. Try BigDataCloud Client Reverse Geocode
  try {
    const bdcRes = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
    );
    if (bdcRes.ok) {
      const data = (await bdcRes.json()) as {
        city?: string;
        locality?: string;
        principalSubdivision?: string;
        countryName?: string;
      };
      const cityName = data.city || data.locality || data.principalSubdivision;
      if (cityName) {
        res.json({
          id: Math.round(Math.abs(lat * 10000 + lon * 100)),
          name: cityName,
          latitude: lat,
          longitude: lon,
          country: cleanCountry(data.countryName),
          admin1: data.principalSubdivision || "",
        });
        return;
      }
    }
  } catch {
    // continue to fallback
  }

  // 2. Try Nominatim Reverse Geocode
  try {
    const nomRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { headers: { "User-Agent": "AtmosWeatherApp/1.0" } }
    );
    if (nomRes.ok) {
      const data = (await nomRes.json()) as {
        address?: {
          city?: string;
          town?: string;
          village?: string;
          municipality?: string;
          county?: string;
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
    name: "Detected City",
    latitude: lat,
    longitude: lon,
    country: "",
    admin1: "",
  });
});

export default router;