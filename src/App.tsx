import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { HourlyTemperatureChart } from '@/components/HourlyTemperatureChart';
import { AndroidInstallButton } from '@/components/AndroidInstallModal';
import { UvIndexMiniChart } from '@/components/UvIndexMiniChart';
import { WindRoseVisualization } from '@/components/WindRoseVisualization';
import { RainParticleOverlay, isRainOrShowers } from '@/components/RainParticleOverlay';
import { SevereWeatherAlertBanner, evaluateSevereWeatherAlert } from '@/components/SevereWeatherAlertBanner';
import { Globe3DModal } from '@/components/Globe3DModal';
import { AirQualityNavButton } from '@/components/AirQualityNavButton';
import { AqiTrendChart } from '@/components/AqiTrendChart';
import { PollutantCard, type PollutantItem } from '@/components/PollutantCard';
import { DynamicWeatherBackdrop } from '@/components/DynamicWeatherBackdrop';
import { useGenerateWeatherInsight, useHealthCheck } from '@workspace/api-client-react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Compass,
  Copy,
  Droplets,
  Eye,
  Factory,
  Frown,
  Gauge,
  Globe2,
  HeartPulse,
  Info,
  LocateFixed,
  MapPin,
  Meh,
  Moon,
  Mountain,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Sliders,
  Smartphone,
  Smile,
  Sparkles,
  Sun,
  Sunrise,
  Sunset,
  Trash2,
  Trees,
  Umbrella,
  Volume2,
  VolumeX,
  Waves,
  Wind,
} from 'lucide-react';
import {
  Route,
  Switch,
  useLocation as useWouterLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

export type Location = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
  elevation?: number;
};

export type Forecast = {
  latitude: number;
  longitude: number;
  timezone: string;
  elevation?: number;
  current: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    is_day: number;
    precipitation: number;
    rain: number;
    weather_code: number;
    cloud_cover: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    wind_gusts_10m?: number;
    uv_index: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    apparent_temperature?: number[];
    precipitation_probability: number[];
    weather_code: number[];
    relative_humidity_2m: number[];
    wind_speed_10m: number[];
    wind_direction_10m?: number[];
    wind_gusts_10m?: number[];
    uv_index: number[];
    visibility: number[];
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: number[];
    sunrise: string[];
    sunset: string[];
    wind_speed_10m_max: number[];
    uv_index_max: number[];
  };
};

export type AirQuality = {
  current: {
    time?: string;
    us_aqi: number;
    pm2_5: number;
    pm10?: number;
    carbon_monoxide?: number;
    nitrogen_dioxide?: number;
    sulphur_dioxide?: number;
    ozone?: number;
    aerosol_optical_depth?: number;
    dust?: number;
    european_aqi?: number;
  };
  hourly?: {
    time: string[];
    us_aqi?: number[];
    pm2_5?: number[];
    pm10?: number[];
    ozone?: number[];
    nitrogen_dioxide?: number[];
    sulphur_dioxide?: number[];
    carbon_monoxide?: number[];
    european_aqi?: number[];
  };
};

export type AqiDetails = {
  level: string;
  category: 'good' | 'moderate' | 'sensitive' | 'unhealthy' | 'very_unhealthy' | 'hazardous';
  color: string;
  bgColor: string;
  borderColor: string;
  summary: string;
  healthAdvice: string;
  exerciseAdvice: string;
  ventilationAdvice: string;
  maskAdvice: string;
};

export function getAqiDetails(usAqi: number): AqiDetails {
  if (usAqi <= 50) {
    return {
      level: 'Good',
      category: 'good',
      color: '#48bb78',
      bgColor: 'rgba(72, 187, 120, 0.14)',
      borderColor: '#48bb78',
      summary: 'Air quality is satisfactory and atmospheric pollutants pose minimal risk.',
      healthAdvice: 'Ideal condition for all outdoor physical recreation and walks.',
      exerciseAdvice: 'Perfect time for outdoor sports, marathon runs, and cycling.',
      ventilationAdvice: 'Open windows to bring clean natural airflow indoors.',
      maskAdvice: 'No protective mask required outdoors.',
    };
  }
  if (usAqi <= 100) {
    return {
      level: 'Moderate',
      category: 'moderate',
      color: '#ecc94b',
      bgColor: 'rgba(236, 201, 75, 0.14)',
      borderColor: '#ecc94b',
      summary: 'Air quality is acceptable; unusually sensitive individuals should observe symptoms.',
      healthAdvice: 'People with acute respiratory sensitivities or asthma may notice mild throat irritation.',
      exerciseAdvice: 'Safe for general workouts; sensitive individuals should moderate intensity.',
      ventilationAdvice: 'Windows can be opened; keep shut if dust or pollen is elevated.',
      maskAdvice: 'Generally not needed unless sensitive to dust and pollen.',
    };
  }
  if (usAqi <= 150) {
    return {
      level: 'Unhealthy for Sensitive Groups',
      category: 'sensitive',
      color: '#ed8936',
      bgColor: 'rgba(237, 137, 54, 0.14)',
      borderColor: '#ed8936',
      summary: 'Members of sensitive groups (asthma, heart disease, elderly, children) may experience health effects.',
      healthAdvice: 'Active children and adults with respiratory diseases should limit prolonged outdoor exertion.',
      exerciseAdvice: 'Reduce intense outdoor exertion; shift endurance training indoors.',
      ventilationAdvice: 'Keep windows closed during peak traffic hours; use indoor air filtering.',
      maskAdvice: 'Sensitive individuals should consider wearing an N95/KN95 mask outdoors.',
    };
  }
  if (usAqi <= 200) {
    return {
      level: 'Unhealthy',
      category: 'unhealthy',
      color: '#e53e3e',
      bgColor: 'rgba(229, 62, 62, 0.14)',
      borderColor: '#e53e3e',
      summary: 'Everyone may begin to experience health effects; sensitive groups may feel serious effects.',
      healthAdvice: 'Avoid prolonged outdoor exertion; sensitive groups should remain indoors in clean environments.',
      exerciseAdvice: 'Avoid outdoor exercise completely; exercise in filtered indoor spaces.',
      ventilationAdvice: 'Keep all windows tightly closed. Run HEPA air purifiers continuously.',
      maskAdvice: 'Wear a certified N95 or KN95 mask if you must go outdoors.',
    };
  }
  if (usAqi <= 300) {
    return {
      level: 'Very Unhealthy',
      category: 'very_unhealthy',
      color: '#9f7aea',
      bgColor: 'rgba(159, 122, 234, 0.14)',
      borderColor: '#9f7aea',
      summary: 'Health alert: Increased risk of adverse health impacts for the entire population.',
      healthAdvice: 'The entire public should significantly limit all physical outdoor activity.',
      exerciseAdvice: 'Strictly avoid any outdoor exertion or endurance activity.',
      ventilationAdvice: 'Seal drafts and keep windows shut. Maintain air filtration.',
      maskAdvice: 'N95/KN95 respirator strongly recommended for any outdoor exposure.',
    };
  }
  return {
    level: 'Hazardous',
    category: 'hazardous',
    color: '#742a2a',
    bgColor: 'rgba(116, 42, 42, 0.18)',
    borderColor: '#742a2a',
    summary: 'Emergency health warning: High risk of serious adverse effects for the general population.',
    healthAdvice: 'Remain indoors, avoid physical exertion, and seek medical attention if symptoms arise.',
    exerciseAdvice: 'Cancel all outdoor activities and physical sports.',
    ventilationAdvice: 'Do not open windows. Keep indoor air sealed with active HEPA filtering.',
    maskAdvice: 'Do not go outside without an N95/P100 respirator.',
  };
}

export function getDominantPollutant(air?: AirQuality['current']): {
  name: string;
  formula: string;
  value: string;
  unit: string;
  status: string;
} {
  if (!air) return { name: 'Particulate Matter', formula: 'PM2.5', value: '--', unit: 'µg/m³', status: 'Good' };

  const candidates = [
    {
      name: 'Fine Particulate Matter',
      formula: 'PM2.5',
      ratio: (air.pm2_5 || 0) / 12,
      value: (air.pm2_5 || 0).toFixed(1),
      unit: 'µg/m³',
      status: (air.pm2_5 || 0) <= 12 ? 'Good' : (air.pm2_5 || 0) <= 35 ? 'Moderate' : 'Elevated',
    },
    {
      name: 'Coarse Inhalable Dust',
      formula: 'PM10',
      ratio: (air.pm10 || 0) / 54,
      value: (air.pm10 || 0).toFixed(1),
      unit: 'µg/m³',
      status: (air.pm10 || 0) <= 54 ? 'Good' : (air.pm10 || 0) <= 154 ? 'Moderate' : 'Elevated',
    },
    {
      name: 'Ground-level Ozone',
      formula: 'O₃',
      ratio: (air.ozone || 0) / 100,
      value: Math.round(air.ozone || 0).toString(),
      unit: 'µg/m³',
      status: (air.ozone || 0) <= 100 ? 'Good' : (air.ozone || 0) <= 160 ? 'Moderate' : 'Elevated',
    },
    {
      name: 'Nitrogen Dioxide',
      formula: 'NO₂',
      ratio: (air.nitrogen_dioxide || 0) / 40,
      value: (air.nitrogen_dioxide || 0).toFixed(1),
      unit: 'µg/m³',
      status: (air.nitrogen_dioxide || 0) <= 40 ? 'Good' : (air.nitrogen_dioxide || 0) <= 100 ? 'Moderate' : 'Elevated',
    },
    {
      name: 'Sulfur Dioxide',
      formula: 'SO₂',
      ratio: (air.sulphur_dioxide || 0) / 20,
      value: (air.sulphur_dioxide || 0).toFixed(1),
      unit: 'µg/m³',
      status: (air.sulphur_dioxide || 0) <= 20 ? 'Good' : 'Elevated',
    },
    {
      name: 'Carbon Monoxide',
      formula: 'CO',
      ratio: (air.carbon_monoxide || 0) / 4400,
      value: Math.round(air.carbon_monoxide || 0).toString(),
      unit: 'µg/m³',
      status: (air.carbon_monoxide || 0) <= 4400 ? 'Good' : 'Elevated',
    },
  ];

  candidates.sort((a, b) => b.ratio - a.ratio);
  return candidates[0];
}

export type AppTheme = 'auto' | 'day' | 'night' | 'light' | 'dark';

export type AppSettings = {
  tempUnit: 'C' | 'F';
  windUnit: 'km/h' | 'mph' | 'm/s' | 'kn';
  precipUnit: 'mm' | 'in';
  timeFormat: '12h' | '24h';
  briefingTone: 'general' | 'commute' | 'outdoor' | 'detailed';
  theme: AppTheme;
  simulateAlert?: boolean;
};

const DEFAULT_SETTINGS: AppSettings = {
  tempUnit: 'C',
  windUnit: 'km/h',
  precipUnit: 'mm',
  timeFormat: '12h',
  briefingTone: 'general',
  theme: 'auto',
  simulateAlert: false,
};

export function getEffectiveTheme(themeSetting: AppTheme, isDaylight: boolean): 'day' | 'night' {
  if (themeSetting === 'day' || themeSetting === 'light') return 'day';
  if (themeSetting === 'night' || themeSetting === 'dark') return 'night';
  // 'auto': sync with actual local solar/daylight weather conditions
  return isDaylight ? 'day' : 'night';
}

const DEFAULT_LOCATIONS: Location[] = [
  { id: 5391959, name: 'San Francisco', latitude: 37.7749, longitude: -122.4194, country: 'United States', admin1: 'California' },
  { id: 5128581, name: 'New York', latitude: 40.7128, longitude: -74.006, country: 'United States', admin1: 'New York' },
  { id: 2643743, name: 'London', latitude: 51.5072, longitude: -0.1276, country: 'United Kingdom', admin1: 'England' },
  { id: 1850147, name: 'Tokyo', latitude: 35.6895, longitude: 139.6917, country: 'Japan', admin1: 'Tokyo' },
  { id: 2988507, name: 'Paris', latitude: 48.8566, longitude: 2.3522, country: 'France', admin1: 'Île-de-France' },
];

const WEATHER_TEXT: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  80: 'Rain showers',
  81: 'Showers',
  82: 'Heavy showers',
  95: 'Thunderstorm',
  96: 'Storm with hail',
  99: 'Heavy thunderstorm',
};

function weatherIcon(code: number, isDay = true) {
  if (!isDay && code === 0) return Moon;
  if (!isDay && (code === 1 || code === 2)) return Moon;
  if (code === 0) return Sun;
  if (code === 1 || code === 2) return CloudSun;
  if (code === 3) return Cloud;
  if ([45, 48].includes(code)) return CloudFog;
  if ([51, 53, 55].includes(code)) return CloudDrizzle;
  if ([61, 63, 65, 80, 81, 82].includes(code)) return CloudRain;
  if ([71, 73, 75].includes(code)) return CloudSnow;
  if ([95, 96, 99].includes(code)) return CloudLightning;
  return Cloud;
}

export type WeatherArchetype =
  | 'sun'
  | 'moon'
  | 'cloud'
  | 'partly-cloudy'
  | 'rain'
  | 'snow'
  | 'thunderstorm'
  | 'fog';

export function getWeatherArchetype(code: number, isDay = true): WeatherArchetype {
  if (!isDay && code === 0) return 'moon';
  if (!isDay && (code === 1 || code === 2)) return 'moon';
  if (code === 0) return 'sun';
  if (code === 1 || code === 2) return 'partly-cloudy';
  if (code === 3) return 'cloud';
  if ([45, 48].includes(code)) return 'fog';
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return 'rain';
  if ([71, 73, 75].includes(code)) return 'snow';
  if ([95, 96, 99].includes(code)) return 'thunderstorm';
  return 'cloud';
}

export function AnimatedWeatherIcon({
  code,
  isDay = true,
  className = '',
  size,
  style,
  variant = 'compact',
  isSelected = false,
}: {
  code: number;
  isDay?: boolean;
  className?: string;
  size?: number;
  style?: React.CSSProperties;
  variant?: 'hero' | 'hourly' | 'forecast' | 'compact';
  isSelected?: boolean;
}) {
  const Icon = weatherIcon(code, isDay);
  const archetype = getWeatherArchetype(code, isDay);

  // Weather-specific entrance signature when condition updates
  const getEntryInitial = () => {
    switch (archetype) {
      case 'sun':
        return { opacity: 0, scale: 0.58, rotate: -35, y: 6 };
      case 'moon':
        return { opacity: 0, scale: 0.65, rotate: -15, y: -8 };
      case 'rain':
        return { opacity: 0, scale: 0.65, y: -14 };
      case 'thunderstorm':
        return { opacity: 0, scale: 0.45, rotate: -8 };
      case 'snow':
        return { opacity: 0, scale: 0.65, rotate: 18, y: -10 };
      case 'partly-cloudy':
        return { opacity: 0, scale: 0.65, x: -10, y: 4 };
      case 'cloud':
      case 'fog':
      default:
        return { opacity: 0, scale: 0.65, x: -12 };
    }
  };

  const getEntryAnimate = () => {
    return {
      opacity: 1,
      scale: isSelected ? 1.16 : 1,
      rotate: 0,
      x: 0,
      y: isSelected ? -2 : 0,
    };
  };

  const getExitAnimation = (): any => {
    switch (archetype) {
      case 'sun':
        return { opacity: 0, scale: 0.65, rotate: 30, y: -6, transition: { duration: 0.18, ease: 'easeIn' } };
      case 'rain':
        return { opacity: 0, scale: 0.65, y: 12, transition: { duration: 0.18, ease: 'easeIn' } };
      case 'thunderstorm':
        return { opacity: 0, scale: 0.7, rotate: 8, transition: { duration: 0.16, ease: 'easeIn' } };
      default:
        return { opacity: 0, scale: 0.68, y: -8, transition: { duration: 0.18, ease: 'easeIn' } };
    }
  };

  // Weather-specific hover state physics
  const getHoverAnimation = (): any => {
    switch (archetype) {
      case 'sun':
        return {
          scale: variant === 'hero' ? 1.18 : 1.25,
          rotate: 45,
          transition: { type: 'spring', stiffness: 380, damping: 14 },
        };
      case 'moon':
        return {
          scale: variant === 'hero' ? 1.16 : 1.22,
          rotate: -15,
          transition: { type: 'spring', stiffness: 380, damping: 14 },
        };
      case 'rain':
        return {
          scale: variant === 'hero' ? 1.16 : 1.22,
          y: -4,
          transition: { type: 'spring', stiffness: 420, damping: 12 },
        };
      case 'thunderstorm':
        return {
          scale: variant === 'hero' ? 1.2 : 1.25,
          rotate: [-4, 6, -3, 0],
          transition: { duration: 0.3, ease: 'easeInOut' },
        };
      case 'snow':
        return {
          scale: variant === 'hero' ? 1.16 : 1.22,
          rotate: 25,
          y: -3,
          transition: { type: 'spring', stiffness: 380, damping: 15 },
        };
      case 'partly-cloudy':
        return {
          scale: variant === 'hero' ? 1.16 : 1.22,
          x: 3,
          y: -2,
          transition: { type: 'spring', stiffness: 380, damping: 14 },
        };
      case 'cloud':
      case 'fog':
      default:
        return {
          scale: variant === 'hero' ? 1.15 : 1.2,
          y: -3,
          transition: { type: 'spring', stiffness: 380, damping: 14 },
        };
    }
  };

  const getAmbientAnimation = () => {
    if (variant !== 'hero') return undefined;

    switch (archetype) {
      case 'sun':
        return { rotate: [0, 8, -4, 0], scale: [1, 1.04, 1] };
      case 'moon':
        return { rotate: [-4, 5, -4], scale: [1, 1.03, 1] };
      case 'rain':
        return { y: [0, -3, 1, 0] };
      case 'thunderstorm':
        return { scale: [1, 1.06, 0.98, 1.03, 1] };
      case 'snow':
        return { y: [-2, 2, -2], rotate: [-4, 4, -4] };
      case 'partly-cloudy':
        return { y: [-2, 2, -2], x: [-1, 2, -1] };
      case 'cloud':
      case 'fog':
      default:
        return { x: [-3, 3, -3], y: [-1, 1, -1] };
    }
  };

  const getAmbientTransition = (): any => {
    if (variant !== 'hero') return undefined;
    switch (archetype) {
      case 'sun':
        return { duration: 7, repeat: Infinity, ease: 'easeInOut' };
      case 'moon':
        return { duration: 6.5, repeat: Infinity, ease: 'easeInOut' };
      case 'rain':
        return { duration: 2.2, repeat: Infinity, ease: 'easeInOut' };
      case 'thunderstorm':
        return { duration: 3.2, repeat: Infinity, times: [0, 0.08, 0.16, 0.24, 1] };
      case 'snow':
        return { duration: 4.8, repeat: Infinity, ease: 'easeInOut' };
      case 'partly-cloudy':
        return { duration: 5, repeat: Infinity, ease: 'easeInOut' };
      case 'cloud':
      case 'fog':
      default:
        return { duration: 5.5, repeat: Infinity, ease: 'easeInOut' };
    }
  };

  if (variant === 'hero') {
    return (
      <div className="relative inline-flex items-center justify-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`hero-${code}-${isDay}`}
            className="inline-flex items-center justify-center cursor-pointer select-none"
            initial={getEntryInitial()}
            animate={getEntryAnimate()}
            exit={getExitAnimation()}
            whileHover={getHoverAnimation()}
            whileTap={{ scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 360, damping: 22, mass: 0.75 }}
            style={{ transformOrigin: 'center center', position: 'relative', zIndex: 2 }}
          >
            <motion.div
              animate={getAmbientAnimation()}
              transition={getAmbientTransition()}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Icon className={className} size={size ?? 68} style={style} />
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  if (variant === 'hourly') {
    return (
      <div className="relative inline-flex items-center justify-center select-none">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`hourly-${code}-${isDay}`}
            className="inline-flex items-center justify-center select-none"
            initial={getEntryInitial()}
            animate={getEntryAnimate()}
            exit={getExitAnimation()}
            whileHover={getHoverAnimation()}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 420, damping: 20 }}
            style={{ transformOrigin: 'center center' }}
          >
            <Icon className={className} size={size} style={style} />
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  // Forecast row or compact variant
  return (
    <div className="relative inline-flex items-center justify-center select-none">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`compact-${code}-${isDay}`}
          className="inline-flex items-center justify-center select-none"
          initial={getEntryInitial()}
          animate={getEntryAnimate()}
          exit={getExitAnimation()}
          whileHover={getHoverAnimation()}
          whileTap={{ scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 380, damping: 19 }}
          style={{ transformOrigin: 'center center' }}
        >
          <Icon className={className} size={size} style={style} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export interface AtmosphericTheme {
  id: string;
  conditionText: string;
  bgGradient: string;
  haloGradient: string;
  glowColor: string;
  glowSpread: string;
  iconColor: string;
  accentColor: string;
  ringColor: string;
  timePhase: string;
}

export function isHourDaylight(timeStr?: string, sunriseStr?: string, sunsetStr?: string): boolean {
  if (!timeStr || !sunriseStr || !sunsetStr) return true;
  const hourMins = clockMinutes(timeStr);
  const sunriseMins = clockMinutes(sunriseStr);
  const sunsetMins = clockMinutes(sunsetStr);
  return hourMins >= sunriseMins && hourMins <= sunsetMins;
}

export function getAtmosphericTheme(code: number, isDay = true): AtmosphericTheme {
  const conditionText = WEATHER_TEXT[code] ?? 'Changing skies';

  // 1. Drizzle / Light Rain (51, 53, 55, 61, 80) -> Rich deep ocean teal/cyan with radiant golden rain glow
  if ([51, 53, 55, 61, 80].includes(code)) {
    return {
      id: 'drizzle',
      conditionText,
      bgGradient: 'linear-gradient(135deg, #134e5e 0%, #1c5f6e 42%, #144955 100%)',
      haloGradient: 'radial-gradient(circle, rgba(250, 204, 21, 0.94) 0%, rgba(234, 179, 8, 0.45) 36%, rgba(20, 184, 166, 0.16) 62%, transparent 80%)',
      glowColor: 'rgba(250, 204, 21, 0.78)',
      glowSpread: '0 0 44px rgba(250, 204, 21, 0.38)',
      iconColor: '#facc15',
      accentColor: '#facc15',
      ringColor: 'rgba(246, 240, 213, 0.14)',
      timePhase: isDay ? 'Daylight' : 'Night time',
    };
  }

  // 2. Heavy Rain / Showers (63, 65, 81, 82) -> Atmospheric dark stormy ocean
  if ([63, 65, 81, 82].includes(code)) {
    return {
      id: 'rain',
      conditionText,
      bgGradient: 'linear-gradient(135deg, #0f2b38 0%, #164353 45%, #0e2733 100%)',
      haloGradient: 'radial-gradient(circle, rgba(56, 189, 248, 0.92) 0%, rgba(14, 165, 233, 0.42) 40%, transparent 75%)',
      glowColor: 'rgba(56, 189, 248, 0.85)',
      glowSpread: '0 0 45px rgba(56, 189, 248, 0.42)',
      iconColor: '#38bdf8',
      accentColor: '#38bdf8',
      ringColor: 'rgba(56, 189, 248, 0.15)',
      timePhase: isDay ? 'Daylight' : 'Night time',
    };
  }

  // 3. Thunderstorm (95, 96, 99) -> Electric tempest plum/violet
  if ([95, 96, 99].includes(code)) {
    return {
      id: 'thunderstorm',
      conditionText,
      bgGradient: 'linear-gradient(135deg, #1e112a 0%, #2e1045 45%, #180d24 100%)',
      haloGradient: 'radial-gradient(circle, rgba(216, 180, 254, 0.94) 0%, rgba(168, 85, 247, 0.48) 36%, rgba(234, 179, 8, 0.28) 55%, transparent 75%)',
      glowColor: 'rgba(216, 180, 254, 0.92)',
      glowSpread: '0 0 52px rgba(168, 85, 247, 0.48)',
      iconColor: '#e9d5ff',
      accentColor: '#e9d5ff',
      ringColor: 'rgba(216, 180, 254, 0.15)',
      timePhase: isDay ? 'Daylight' : 'Night time',
    };
  }

  // 4. Snow / Sleet (71, 73, 75) -> Glacial alpine cyan/frost
  if ([71, 73, 75].includes(code)) {
    return {
      id: 'snow',
      conditionText,
      bgGradient: 'linear-gradient(135deg, #0c4a6e 0%, #0369a1 45%, #1e3a8a 100%)',
      haloGradient: 'radial-gradient(circle, rgba(224, 242, 254, 0.94) 0%, rgba(186, 230, 253, 0.48) 40%, transparent 75%)',
      glowColor: 'rgba(224, 242, 254, 0.92)',
      glowSpread: '0 0 45px rgba(186, 230, 253, 0.42)',
      iconColor: '#e0f2fe',
      accentColor: '#bae6fd',
      ringColor: 'rgba(224, 242, 254, 0.16)',
      timePhase: isDay ? 'Daylight' : 'Night time',
    };
  }

  // 5. Fog / Mist (45, 48) -> Vaporous silver mist
  if ([45, 48].includes(code)) {
    return {
      id: 'fog',
      conditionText,
      bgGradient: 'linear-gradient(135deg, #27272a 0%, #3f3f46 50%, #1c1917 100%)',
      haloGradient: 'radial-gradient(circle, rgba(212, 212, 216, 0.78) 0%, rgba(161, 161, 170, 0.38) 40%, transparent 75%)',
      glowColor: 'rgba(212, 212, 216, 0.72)',
      glowSpread: '0 0 36px rgba(161, 161, 170, 0.32)',
      iconColor: '#d4d4d8',
      accentColor: '#e4e4e7',
      ringColor: 'rgba(255, 255, 255, 0.11)',
      timePhase: isDay ? 'Daylight' : 'Night time',
    };
  }

  // 6. Overcast (3) -> Atmospheric slate silver
  if (code === 3) {
    return {
      id: 'overcast',
      conditionText,
      bgGradient: 'linear-gradient(135deg, #334155 0%, #475569 50%, #1e293b 100%)',
      haloGradient: 'radial-gradient(circle, rgba(226, 232, 240, 0.72) 0%, rgba(148, 163, 184, 0.3) 40%, transparent 75%)',
      glowColor: 'rgba(226, 232, 240, 0.65)',
      glowSpread: '0 0 36px rgba(203, 213, 225, 0.28)',
      iconColor: '#e2e8f0',
      accentColor: '#cbd5e1',
      ringColor: 'rgba(255, 255, 255, 0.1)',
      timePhase: isDay ? 'Daylight' : 'Night time',
    };
  }

  // 7. Partly Cloudy (1, 2)
  if (code === 1 || code === 2) {
    if (isDay) {
      return {
        id: 'partly-cloudy-day',
        conditionText,
        bgGradient: 'linear-gradient(135deg, #155e75 0%, #1e6b7b 45%, #164e63 100%)',
        haloGradient: 'radial-gradient(circle, rgba(251, 191, 36, 0.94) 0%, rgba(245, 158, 11, 0.45) 36%, transparent 75%)',
        glowColor: 'rgba(251, 191, 36, 0.9)',
        glowSpread: '0 0 46px rgba(245, 158, 11, 0.42)',
        iconColor: '#fbbf24',
        accentColor: '#fbbf24',
        ringColor: 'rgba(255, 255, 255, 0.12)',
        timePhase: 'Daylight',
      };
    }
    return {
      id: 'partly-cloudy-night',
      conditionText,
      bgGradient: 'linear-gradient(135deg, #0b1329 0%, #151d38 50%, #0d152b 100%)',
      haloGradient: 'radial-gradient(circle, rgba(165, 180, 252, 0.78) 0%, rgba(99, 102, 241, 0.3) 40%, transparent 75%)',
      glowColor: 'rgba(165, 180, 252, 0.72)',
      glowSpread: '0 0 36px rgba(129, 140, 248, 0.32)',
      iconColor: '#c7d2fe',
      accentColor: '#818cf8',
      ringColor: 'rgba(165, 180, 252, 0.1)',
      timePhase: 'Night time',
    };
  }

  // 8. Clear Sky (0) - Day
  if (isDay) {
    return {
      id: 'clear-day',
      conditionText,
      bgGradient: 'linear-gradient(135deg, #0369a1 0%, #0284c7 40%, #075985 100%)',
      haloGradient: 'radial-gradient(circle, rgba(253, 224, 71, 0.98) 0%, rgba(251, 191, 36, 0.6) 30%, rgba(56, 189, 248, 0.25) 55%, transparent 75%)',
      glowColor: 'rgba(253, 224, 71, 0.98)',
      glowSpread: '0 0 52px rgba(251, 191, 36, 0.62)',
      iconColor: '#fbbf24',
      accentColor: '#fbbf24',
      ringColor: 'rgba(255, 255, 255, 0.14)',
      timePhase: 'Daylight',
    };
  }

  // 9. Clear Sky (0) - Night
  return {
    id: 'clear-night',
    conditionText,
    bgGradient: 'linear-gradient(135deg, #090d16 0%, #111827 45%, #0f172a 100%)',
    haloGradient: 'radial-gradient(circle, rgba(199, 210, 254, 0.84) 0%, rgba(129, 140, 248, 0.35) 35%, transparent 70%)',
    glowColor: 'rgba(199, 210, 254, 0.78)',
    glowSpread: '0 0 42px rgba(165, 180, 252, 0.38)',
    iconColor: '#c7d2fe',
    accentColor: '#a5b4fc',
    ringColor: 'rgba(165, 180, 252, 0.1)',
    timePhase: 'Night time',
  };
}

export function getAtmosphericAmbientGradient(code: number, isDay = true): string {
  // Clear Day
  if (isDay && code === 0) {
    return 'radial-gradient(circle at 80% -5%, rgba(251, 191, 36, 0.22) 0%, rgba(245, 158, 11, 0.08) 35%, transparent 65%)';
  }
  // Clear Night
  if (!isDay && code === 0) {
    return 'radial-gradient(circle at 80% -5%, rgba(129, 140, 248, 0.20) 0%, rgba(99, 102, 241, 0.07) 35%, transparent 65%)';
  }
  // Partly Cloudy Day
  if (isDay && (code === 1 || code === 2)) {
    return 'radial-gradient(circle at 80% -5%, rgba(245, 158, 11, 0.18) 0%, rgba(20, 184, 166, 0.07) 38%, transparent 65%)';
  }
  // Partly Cloudy Night
  if (!isDay && (code === 1 || code === 2)) {
    return 'radial-gradient(circle at 80% -5%, rgba(99, 102, 241, 0.16) 0%, rgba(56, 189, 248, 0.06) 38%, transparent 65%)';
  }
  // Drizzle & Rain
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) {
    return 'radial-gradient(circle at 80% -5%, rgba(20, 184, 166, 0.20) 0%, rgba(56, 189, 248, 0.08) 40%, transparent 65%)';
  }
  // Thunderstorm
  if ([95, 96, 99].includes(code)) {
    return 'radial-gradient(circle at 80% -5%, rgba(168, 85, 247, 0.22) 0%, rgba(129, 140, 248, 0.09) 40%, transparent 65%)';
  }
  // Snow
  if ([71, 73, 75].includes(code)) {
    return 'radial-gradient(circle at 80% -5%, rgba(56, 189, 248, 0.20) 0%, rgba(186, 230, 253, 0.08) 40%, transparent 65%)';
  }
  // Overcast & Fog
  return 'radial-gradient(circle at 80% -5%, rgba(148, 163, 184, 0.17) 0%, rgba(203, 213, 225, 0.06) 40%, transparent 65%)';
}

export function AtmosphericGradientCrossfade({
  gradient,
  themeKey,
}: {
  gradient: string;
  themeKey: string;
}) {
  return (
    <div className="atmospheric-card-bg-container pointer-events-none" aria-hidden="true">
      <div
        key={themeKey}
        className="atmospheric-card-bg-layer"
        style={{
          background: gradient,
          transition: 'background 0.85s ease',
        }}
      />
    </div>
  );
}

export function AtmosphericAmbientBackdrop({
  code,
  isDay = true,
}: {
  code: number;
  isDay?: boolean;
}) {
  const gradient = getAtmosphericAmbientGradient(code, isDay);
  const themeKey = `ambient-${code}-${isDay ? 'day' : 'night'}`;

  return (
    <div
      className="pointer-events-none fixed top-0 right-0 w-[55vw] max-w-[850px] h-[450px] overflow-hidden"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      <div
        key={themeKey}
        className="absolute inset-0"
        style={{
          background: gradient,
          transition: 'background 1s ease',
        }}
      />
    </div>
  );
}

// Unit conversion helpers
function convertTemp(celsius: number, unit: 'C' | 'F'): number {
  return unit === 'F' ? (celsius * 9) / 5 + 32 : celsius;
}

function formatTempDisplay(celsius: number, unit: 'C' | 'F'): string {
  return `${Math.round(convertTemp(celsius, unit))}°`;
}

function convertWind(kmh: number, unit: 'km/h' | 'mph' | 'm/s' | 'kn'): { value: string; unit: string } {
  switch (unit) {
    case 'mph':
      return { value: `${Math.round(kmh * 0.621371)}`, unit: 'mph' };
    case 'm/s':
      return { value: (kmh / 3.6).toFixed(1), unit: 'm/s' };
    case 'kn':
      return { value: `${Math.round(kmh * 0.539957)}`, unit: 'kn' };
    case 'km/h':
    default:
      return { value: `${Math.round(kmh)}`, unit: 'km/h' };
  }
}

function formatPrecipDisplay(mm: number, unit: 'mm' | 'in'): string {
  if (unit === 'in') {
    return `${(mm * 0.0393701).toFixed(2)} in`;
  }
  return `${mm.toFixed(1)} mm`;
}

function formatTime(value: string, timezone?: string, format: '12h' | '24h' = '12h') {
  if (!value) return '';
  const timePart = value.split('T')[1]?.slice(0, 5);
  if (timePart) {
    const [hours, minutes] = timePart.split(':').map(Number);
    if (format === '24h') {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    const suffix = hours >= 12 ? 'PM' : 'AM';
    const hour = hours % 12 || 12;
    return `${hour}:${String(minutes).padStart(2, '0')} ${suffix}`;
  }
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: format === '12h',
    timeZone: timezone,
  }).format(new Date(value));
}

function shortDay(value: string) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date(`${value}T12:00:00`));
}

function fullDay(value: string) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

function localLabel(timezone: string, format: '12h' | '24h' = '12h') {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: format === '12h',
    timeZone: timezone,
  }).format(new Date());
}

function clockMinutes(value: string) {
  const match = value.match(/T(\d{2}):(\d{2})/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
}

function formatClockMinutes(value: number, format: '12h' | '24h' = '12h') {
  const minutes = ((Math.round(value) % 1440) + 1440) % 1440;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (format === '24h') {
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hourNumber = hours % 12 || 12;
  return `${hourNumber}:${String(mins).padStart(2, '0')} ${suffix}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function windDirection(degrees: number) {
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(degrees / 45) % 8];
}

function uvLabel(value: number) {
  return value < 3 ? 'Low exposure' : value < 6 ? 'Moderate' : value < 8 ? 'High exposure' : 'Very high';
}

const jsonCache = new Map<string, { timestamp: number; data: unknown }>();

let lastFetchServedFromCache = false;

async function getJson<T>(url: string, signal?: AbortSignal, skipCache = false): Promise<T> {
  const cached = jsonCache.get(url);
  // If browser is offline and we have a cached copy, use it immediately
  if (typeof navigator !== 'undefined' && !navigator.onLine && cached) {
    lastFetchServedFromCache = true;
    return cached.data as T;
  }

  // Serve from cache if fresh and skipCache is false
  if (!skipCache && cached && Date.now() - cached.timestamp < 50000) {
    return cached.data as T;
  }

  try {
    const response = await fetch(url, { signal });
    if (response.status === 429 && cached) {
      // Use stale cache on rate limit
      lastFetchServedFromCache = true;
      return cached.data as T;
    }
    if (response.status === 429) {
      // Wait 1.2s and retry once
      await new Promise((r) => setTimeout(r, 1200));
      const retryResponse = await fetch(url, { signal });
      if (retryResponse.ok) {
        const data = (await retryResponse.json()) as T;
        jsonCache.set(url, { timestamp: Date.now(), data });
        lastFetchServedFromCache = false;
        return data;
      }
    }
    if (!response.ok) {
      if (cached) {
        lastFetchServedFromCache = true;
        return cached.data as T;
      }
      throw new Error('The weather service is having trouble right now.');
    }
    const data = (await response.json()) as T;
    jsonCache.set(url, { timestamp: Date.now(), data });
    lastFetchServedFromCache = false;
    return data;
  } catch (err) {
    if (cached) {
      lastFetchServedFromCache = true;
      return cached.data as T;
    }
    throw err;
  }
}

function cleanCountryName(name?: string): string {
  if (!name) return '';
  return name
    .replace(/\s*\(the\)$/i, '')
    .replace(/^United States of America$/i, 'United States')
    .replace(/^United Kingdom of Great Britain and Northern Ireland$/i, 'United Kingdom')
    .trim();
}

async function reverseGeocodeCoordinates(latitude: number, longitude: number): Promise<Location> {
  const locationId = Math.round(Math.abs(latitude * 10000 + longitude * 100));

  // 1. Try our backend proxy endpoint
  try {
    const res = await fetch(`/api/weather/reverse-geocode?latitude=${latitude}&longitude=${longitude}`);
    if (res.ok) {
      const data = (await res.json()) as {
        id?: number;
        name?: string;
        country?: string;
        admin1?: string;
      };
      if (data?.name && data.name !== 'Detected City' && data.name !== 'My Location') {
        return {
          id: data.id || locationId,
          name: data.name,
          latitude,
          longitude,
          country: cleanCountryName(data.country),
          admin1: data.admin1 || '',
        };
      }
    }
  } catch {
    // Continue to client-side reverse geocoding
  }

  // 2. Try BigDataCloud reverse geocode client
  try {
    const bdcRes = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
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
        return {
          id: locationId,
          name: cityName,
          latitude,
          longitude,
          country: cleanCountryName(data.countryName),
          admin1: data.principalSubdivision || '',
        };
      }
    }
  } catch {
    // Continue to Nominatim fallback
  }

  // 3. Try OpenStreetMap Nominatim reverse geocode
  try {
    const nomRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
      { headers: { 'User-Agent': 'AtmosWeather/1.0' } }
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
        return {
          id: locationId,
          name: cityName,
          latitude,
          longitude,
          country: cleanCountryName(addr?.country),
          admin1: addr?.state || '',
        };
      }
    }
  } catch {
    // Continue to fallback
  }

  return {
    id: locationId,
    name: 'Detected Location',
    latitude,
    longitude,
  };
}

export type TabType = 'Today' | 'Week' | 'Air Quality' | 'Saved' | 'Settings';

export const TAB_HASHES: Record<TabType, string> = {
  Today: 'today',
  Week: 'week',
  'Air Quality': 'air-quality',
  Saved: 'saved',
  Settings: 'settings',
};

export const HASH_TO_TAB: Record<string, TabType> = {
  today: 'Today',
  week: 'Week',
  'air-quality': 'Air Quality',
  air: 'Air Quality',
  saved: 'Saved',
  settings: 'Settings',
};

function Home() {
  // Load saved settings
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const stored = localStorage.getItem('atmos_settings');
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // Load saved locations list
  const [savedList, setSavedList] = useState<Location[]>(() => {
    try {
      const stored = localStorage.getItem('atmos_saved_locations');
      if (stored) {
        const parsed = JSON.parse(stored) as Location[];
        return parsed.map((item) => (item.name === 'My Location' ? DEFAULT_LOCATIONS[0] : item));
      }
      return DEFAULT_LOCATIONS;
    } catch {
      return DEFAULT_LOCATIONS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('atmos_saved_locations', JSON.stringify(savedList));
    } catch {
      // ignore
    }
  }, [savedList]);

  // Current active location
  const [location, setLocation] = useState<Location>(() => {
    try {
      const stored = localStorage.getItem('atmos_current_location');
      if (stored) {
        const parsed = JSON.parse(stored) as Location;
        if (parsed.name && parsed.name !== 'My Location') return parsed;
      }
      return savedList[0] || DEFAULT_LOCATIONS[0];
    } catch {
      return DEFAULT_LOCATIONS[0];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('atmos_current_location', JSON.stringify(location));
    } catch {
      // ignore
    }
  }, [location]);

  // Individual page support with hash routing and instant scroll restoration
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    if (typeof window !== 'undefined') {
      const cleanHash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
      if (cleanHash && HASH_TO_TAB[cleanHash]) {
        return HASH_TO_TAB[cleanHash];
      }
    }
    return 'Today';
  });

  // Whenever activeTab changes: scroll to top and update URL hash
  useEffect(() => {
    const targetHash = TAB_HASHES[activeTab] || 'today';
    const currentHash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
    if (currentHash !== targetHash) {
      window.history.replaceState(null, '', `#/${targetHash}`);
    }
    // Always start newly opened tab at the top
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    const mainFrame = document.querySelector('.main-frame');
    if (mainFrame) {
      mainFrame.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, [activeTab]);

  // Support browser back/forward buttons and direct bookmark navigation
  useEffect(() => {
    const handleHashChange = () => {
      const cleanHash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
      if (cleanHash && HASH_TO_TAB[cleanHash] && HASH_TO_TAB[cleanHash] !== activeTab) {
        setActiveTab(HASH_TO_TAB[cleanHash]);
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [activeTab]);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Location[]>([]);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [air, setAir] = useState<AirQuality | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [permission, setPermission] = useState<'idle' | 'requesting' | 'denied'>('idle');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [isViewingCached, setIsViewingCached] = useState(false);
  const [isGlobeModalOpen, setIsGlobeModalOpen] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Determine if it is daylight right now at the active location based on actual local weather
  const isActualDaylight = forecast?.current ? forecast.current.is_day === 1 : true;
  const effectiveTheme = getEffectiveTheme(settings.theme, isActualDaylight);

  // Synchronize effective theme (Day/Night) with document root class & localStorage
  useEffect(() => {
    try {
      localStorage.setItem('atmos_settings', JSON.stringify(settings));
      if (effectiveTheme === 'night') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch {
      // ignore
    }
  }, [settings, effectiveTheme]);

  // Quick theme cycler: Auto (local weather sync) -> Day Lock -> Night Lock -> Auto
  const cycleTheme = useCallback(() => {
    setSettings((prev) => {
      let nextTheme: AppTheme = 'auto';
      if (prev.theme === 'auto') {
        nextTheme = 'day';
      } else if (prev.theme === 'day' || prev.theme === 'light') {
        nextTheme = 'night';
      } else {
        nextTheme = 'auto';
      }

      const nextEffective = getEffectiveTheme(nextTheme, isActualDaylight);
      const msg =
        nextTheme === 'auto'
          ? `Auto Theme (locked to ${nextEffective === 'day' ? 'Day' : 'Night'} from actual local weather)`
          : nextTheme === 'day'
          ? 'Day Theme Locked'
          : 'Night Theme Locked';
      showToast(msg);
      return { ...prev, theme: nextTheme };
    });
  }, [isActualDaylight]);

  const health = useHealthCheck();
  const insight = useGenerateWeatherInsight();

  // Keyboard shortcut Ctrl+K
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        document.querySelector<HTMLInputElement>('[data-testid="input-search-city"]')?.focus();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const lastFetchedTimeRef = useRef<number>(Date.now());

  const loadWeather = useCallback(async (next: Location, isRefresh = false) => {
    setError('');
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      lastFetchServedFromCache = false;
      const isDeviceOffline = typeof navigator !== 'undefined' && !navigator.onLine;

      const params = `latitude=${next.latitude}&longitude=${next.longitude}&timezone=auto`;
      const forecastUrl = `https://api.open-meteo.com/v1/forecast?${params}&forecast_days=7&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,visibility&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,wind_speed_10m_max,uv_index_max`;
      const airQualityUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?${params}&current=us_aqi,pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,aerosol_optical_depth,dust,european_aqi&hourly=us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide,european_aqi`;
      const [nextForecast, nextAir] = await Promise.all([
        getJson<Forecast>(forecastUrl, undefined, isRefresh),
        getJson<AirQuality>(airQualityUrl, undefined, isRefresh),
      ]);

      lastFetchedTimeRef.current = Date.now();
      setIsViewingCached(isDeviceOffline || lastFetchServedFromCache);

      // If location name is generic, resolve the city name from timezone
      let finalName = next.name;
      if (
        next.name === 'My Location' ||
        next.name === 'Detected Location' ||
        next.name === 'Current Location'
      ) {
        const timezoneCity = nextForecast.timezone?.split('/')[1]?.replace(/_/g, ' ');
        if (timezoneCity) {
          finalName = timezoneCity;
        }
      }

      if (finalName !== next.name || (nextForecast.elevation != null && next.elevation !== nextForecast.elevation)) {
        setLocation((prev) => {
          if (prev.latitude === next.latitude && prev.longitude === next.longitude) {
            return {
              ...prev,
              name: finalName,
              elevation: nextForecast.elevation ?? prev.elevation,
            };
          }
          return prev;
        });
      }

      setForecast(nextForecast);
      setAir(nextAir);
    } catch (err) {
      if (forecast) {
        setIsViewingCached(true);
      }
      setError(err instanceof Error ? err.message : 'Unable to load weather data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [forecast]);

  // Monitor online / offline network status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showToast('Internet restored · Re-syncing live weather...');
      void loadWeather(location, true);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsViewingCached(true);
      showToast('You are offline · Displaying cached weather data');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [location, loadWeather]);

  useEffect(() => {
    void loadWeather(location);
  }, [location.latitude, location.longitude, loadWeather]);

  // Background refresh interval of 1 minute (60,000ms) when the browser tab is focused
  useEffect(() => {
    const REFRESH_INTERVAL_MS = 60 * 1000; // 1 minute

    const checkAndRefresh = () => {
      // Only refresh when the document tab is visible to avoid unnecessary background battery & bandwidth use
      if (document.visibilityState !== 'visible') return;

      const elapsed = Date.now() - lastFetchedTimeRef.current;
      if (elapsed >= REFRESH_INTERVAL_MS) {
        void loadWeather(location, true);
      }
    };

    // 1-minute recurring interval
    const intervalId = window.setInterval(checkAndRefresh, REFRESH_INTERVAL_MS);

    // Refresh immediately when tab regains focus or visibility if 1 minute has elapsed
    const handleFocusOrVisible = () => {
      checkAndRefresh();
    };

    document.addEventListener('visibilitychange', handleFocusOrVisible);
    window.addEventListener('focus', handleFocusOrVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
      window.removeEventListener('focus', handleFocusOrVisible);
    };
  }, [location, loadWeather]);

  // Geocoding search
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void getJson<{ results?: Location[] }>(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          query
        )}&count=6&language=en&format=json`,
        controller.signal
      )
        .then((data) => setResults(data.results ?? []))
        .catch(() => setResults([]));
    }, 280);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  const pickLocation = (next: Location) => {
    setQuery('');
    setResults([]);
    setLocation(next);
    setActiveTab('Today');
    showToast(`Switched location to ${next.name}`);
  };

  const addSavedLocation = (loc: Location) => {
    if (!savedList.some((item) => item.id === loc.id || (item.name === loc.name && item.country === loc.country))) {
      setSavedList((prev) => [loc, ...prev]);
      showToast(`Added ${loc.name} to saved locations`);
    } else {
      showToast(`${loc.name} is already in your saved list`);
    }
  };

  const removeSavedLocation = (id: number, name: string) => {
    setSavedList((prev) => prev.filter((item) => item.id !== id));
    showToast(`Removed ${name} from saved locations`);
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setPermission('denied');
      showToast('Geolocation is not supported by your browser');
      return;
    }
    setPermission('requesting');
    showToast('Detecting your city location...');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, altitude } = position.coords;
        try {
          const resolvedLocation = await reverseGeocodeCoordinates(latitude, longitude);
          if (altitude !== null && altitude !== undefined && resolvedLocation.elevation == null) {
            resolvedLocation.elevation = Math.round(altitude);
          }
          pickLocation(resolvedLocation);
        } catch {
          // Fallback if network fails
          pickLocation({
            id: Math.round(Math.abs(latitude * 10000 + longitude * 100)),
            name: 'Detected Location',
            latitude,
            longitude,
            elevation: altitude !== null && altitude !== undefined ? Math.round(altitude) : undefined,
          });
        } finally {
          setPermission('idle');
        }
      },
      () => {
        setPermission('denied');
        showToast('Location permission was denied');
      },
      { timeout: 9000, enableHighAccuracy: true }
    );
  };

  const hourlyStart = useMemo(() => {
    if (!forecast) return 0;
    const currentHour = `${forecast.current.time.slice(0, 13)}:00`;
    const index = forecast.hourly.time.findIndex((item) => item === currentHour);
    return index >= 0 ? index : 0;
  }, [forecast]);

  const current = forecast?.current;
  const daily = forecast?.daily;
  const airQuality = air?.current;
  const altitudeValue = forecast?.elevation ?? location.elevation;
  const visibilityKm = forecast?.hourly.visibility[hourlyStart]
    ? forecast.hourly.visibility[hourlyStart] / 1000
    : 0;
  const aqiLabel = airQuality
    ? airQuality.us_aqi <= 50
      ? 'Good'
      : airQuality.us_aqi <= 100
      ? 'Moderate'
      : 'Unhealthy'
    : 'Loading';

  const requestedInsightRef = useRef<string>('');

  const generateInsight = useCallback(() => {
    if (!forecast || !air || !current || !daily) return;
    insight.mutate({
      data: {
        location: `${location.name}, ${location.country ?? ''}`,
        localTime: localLabel(forecast.timezone, settings.timeFormat),
        current: {
          temperature: current.temperature_2m,
          apparentTemperature: current.apparent_temperature,
          weatherCode: current.weather_code,
          humidity: current.relative_humidity_2m,
          windSpeed: current.wind_speed_10m,
          precipitationProbability: forecast.hourly.precipitation_probability[hourlyStart] ?? 0,
          uvIndex: current.uv_index,
        },
        airQuality: { usAqi: air.current.us_aqi, pm2_5: air.current.pm2_5 },
        upcoming: daily.time.slice(0, 5).map((date, index) => ({
          date,
          weatherCode: daily.weather_code[index],
          high: daily.temperature_2m_max[index],
          low: daily.temperature_2m_min[index],
          precipitationProbability: daily.precipitation_probability_max[index],
        })),
      },
    });
  }, [forecast, air, location.name, location.country, settings.timeFormat, current, hourlyStart, daily, insight.mutate]);

  useEffect(() => {
    if (forecast && air && current && daily && !insight.isPending) {
      const key = `${location.latitude}_${location.longitude}_${current.time}`;
      if (requestedInsightRef.current !== key) {
        requestedInsightRef.current = key;
        generateInsight();
      }
    }
  }, [forecast, air, current, daily, location.latitude, location.longitude, insight.isPending, generateInsight]);

  if (permission === 'denied' && !forecast) return <PermissionState onRetry={useCurrentLocation} />;

  return (
    <div className="atmos-app">
      <DynamicWeatherBackdrop
        weatherCode={current?.weather_code ?? 0}
        isDay={current ? current.is_day === 1 : true}
        windSpeed={current?.wind_speed_10m ?? 12}
        windDirection={current?.wind_direction_10m ?? 180}
        cloudCover={current?.cloud_cover ?? 20}
      />
      <div className="atmos-shell">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          location={location}
          savedList={savedList}
          pickLocation={pickLocation}
          healthOk={health.isSuccess}
          isOnline={isOnline}
          isViewingCached={isViewingCached}
          onOpenGlobe={() => setIsGlobeModalOpen(true)}
        />
        <main className="main-frame">
          <header className="topbar">
            <div className="mobile-brand">
              <div className="brand-symbol">
                <CloudSun size={18} />
              </div>
              <span className="brand-name">atmos</span>
            </div>
            <div className="search-wrap">
              <Search size={16} />
              <input
                className="search-input"
                data-testid="input-search-city"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search a city (e.g. Kyoto, Chicago, Madrid)..."
                aria-label="Search a city"
              />
              <span className="search-hint">Ctrl K</span>
              {results.length > 0 && (
                <div className="search-results">
                  {results.map((result) => (
                    <button
                      className="search-result"
                      data-testid={`button-result-${result.id}`}
                      key={result.id}
                      onClick={() => pickLocation(result)}
                    >
                      {result.name}
                      <small>
                        {result.admin1 ? `${result.admin1}, ` : ''}
                        {result.country}
                      </small>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="top-actions">
              <button
                className="icon-btn theme-toggle-btn"
                data-testid="button-toggle-theme"
                onClick={cycleTheme}
                aria-label={`Current theme: ${settings.theme}`}
                title={`Theme: ${
                  settings.theme === 'auto'
                    ? `Auto (${effectiveTheme === 'day' ? 'Daylight' : 'Night'} from local weather)`
                    : settings.theme === 'day' || settings.theme === 'light'
                    ? 'Day Lock'
                    : 'Night Lock'
                } · Click to cycle Auto / Day / Night`}
              >
                {settings.theme === 'auto' ? (
                  <Sparkles size={16} />
                ) : effectiveTheme === 'day' ? (
                  <Sun size={16} />
                ) : (
                  <Moon size={16} />
                )}
              </button>
              <button
                className={`icon-btn ${refreshing ? 'refreshing' : ''}`}
                data-testid="button-refresh-weather"
                onClick={() => void loadWeather(location, true)}
                aria-label="Refresh weather"
                title="Refresh live data"
              >
                <RefreshCw size={16} />
              </button>
              <button
                className="locate-btn"
                data-testid="button-use-location"
                onClick={useCurrentLocation}
                title="Detect weather at my coordinates"
              >
                <LocateFixed size={15} />
                <span>Use my location</span>
              </button>
              <AndroidInstallButton iconOnly />
            </div>
          </header>

          <div className="content">
            <div className="heading-row animate-rise">
              <div>
                <div className="eyebrow flex items-center flex-wrap gap-2" data-testid="text-conditions-eyebrow">
                  <span>Live conditions / {forecast?.timezone?.replace('_', ' ') ?? 'Local time'}</span>
                  {altitudeValue != null && (
                    <span
                      className="altitude-badge"
                      data-testid="badge-location-altitude"
                      style={{ transform: 'translateX(-40px)' }}
                      title={`Physical Altitude / Terrain Elevation: ${Math.round(altitudeValue)} m (${Math.round(altitudeValue * 3.28084)} ft) above sea level`}
                    >
                      <Mountain size={11} className="shrink-0 opacity-80 text-emerald-500 dark:text-emerald-400" />
                      <span>my altitude: {Math.round(altitudeValue)} m</span>
                      {settings.tempUnit === 'F' && (
                        <span className="opacity-70 text-[9px]">({Math.round(altitudeValue * 3.28084)} ft)</span>
                      )}
                    </span>
                  )}
                </div>
                <h1 className="location-title" data-testid="text-location-name">
                  {location.name}
                  {(location.admin1 || location.country) ? (
                    <span style={{ fontSize: '0.45em', opacity: 0.65, marginLeft: 12, fontWeight: 400 }}>
                      {[location.admin1, location.country].filter(Boolean).join(', ')}
                    </span>
                  ) : null}
                </h1>
                <div className="local-time" data-testid="text-local-time">
                  {forecast
                    ? localLabel(forecast.timezone, settings.timeFormat)
                    : 'Connecting to the sky...'}
                </div>
              </div>
              <div
                className={`updated-note ${!isOnline || isViewingCached ? 'is-cached' : 'is-live'}`}
                data-testid="status-feed-indicator"
                title={
                  !isOnline
                    ? 'Offline: You are viewing cached weather and air quality records from your previous sync.'
                    : isViewingCached
                    ? 'Live feed unreachable: Viewing cached weather data.'
                    : 'Online: Live high-resolution meteorological feed active from Open-Meteo.'
                }
              >
                <span
                  className={`signal-dot ${
                    !isOnline
                      ? 'signal-dot-offline'
                      : isViewingCached
                      ? 'signal-dot-cached'
                      : 'signal-dot-live'
                  }`}
                  data-testid="signal-dot-indicator"
                  aria-label={
                    !isOnline
                      ? 'Offline - cached data'
                      : isViewingCached
                      ? 'Viewing cached data'
                      : 'Live weather feed'
                  }
                />
                <span className="feed-source-name font-medium">
                  Open-Meteo {!isOnline ? '(Cached)' : isViewingCached ? '(Cached)' : 'High-Resolution Feed'}
                </span>
                <br />
                <span
                  className={`feed-status-subtext ${
                    !isOnline || isViewingCached ? 'text-amber-600 dark:text-amber-400 font-medium' : ''
                  }`}
                >
                  {refreshing
                    ? 'Refreshing now...'
                    : !isOnline
                    ? 'Offline · Viewing cached data'
                    : isViewingCached
                    ? 'Feed unreachable · Using cache'
                    : 'Live meteorological radar'}
                </span>
              </div>
            </div>

            {error && (
              <div className="error-card" data-testid="status-weather-error">
                <span>{error}</span>
                <button data-testid="button-retry-weather" onClick={() => void loadWeather(location)}>
                  Try again
                </button>
              </div>
            )}

            {loading && !forecast ? (
              <LoadingState />
            ) : forecast && current && daily ? (
              <div key={activeTab} className="tab-page-container animate-fade-in" style={{ width: '100%' }}>
                {activeTab === 'Today' ? (
                  <TodayView
                    forecast={forecast}
                    daily={daily}
                    current={current}
                    air={airQuality}
                    visibilityKm={visibilityKm}
                    aqiLabel={aqiLabel}
                    hourlyStart={hourlyStart}
                    insight={insight}
                    onGenerateInsight={generateInsight}
                    onNavigateToAirQuality={() => setActiveTab('Air Quality')}
                    settings={settings}
                    location={location}
                    onCycleTheme={cycleTheme}
                  />
                ) : activeTab === 'Week' ? (
                  <WeekView
                    forecast={forecast}
                    daily={daily}
                    settings={settings}
                    locationName={location.name}
                  />
                ) : activeTab === 'Air Quality' ? (
                  <AirQualityView
                    air={air}
                    location={location}
                    forecast={forecast}
                    visibilityKm={visibilityKm}
                    settings={settings}
                    onUseCurrentLocation={useCurrentLocation}
                    onOpenGlobe={() => setIsGlobeModalOpen(true)}
                  />
                ) : activeTab === 'Saved' ? (
                  <SavedLocationsView
                    savedList={savedList}
                    activeLocation={location}
                    onSelectLocation={pickLocation}
                    onRemoveLocation={removeSavedLocation}
                    onAddLocation={addSavedLocation}
                    onUseCurrentLocation={useCurrentLocation}
                    settings={settings}
                  />
                ) : (
                  <SettingsView
                    settings={settings}
                    setSettings={setSettings}
                    effectiveTheme={effectiveTheme}
                    locationName={location.name}
                    onReset={() => {
                      setSettings(DEFAULT_SETTINGS);
                      setSavedList(DEFAULT_LOCATIONS);
                      showToast('Settings and saved locations reset to default');
                    }}
                  />
                )}
              </div>
            ) : !error ? (
              <EmptyState
                onSearch={() =>
                  document.querySelector<HTMLInputElement>('[data-testid="input-search-city"]')?.focus()
                }
              />
            ) : null}
          </div>
        </main>
      </div>

      {/* Bottom mobile navigation matching Image 2 */}
      <nav className="mobile-nav" data-testid="mobile-bottom-navigation" aria-label="Mobile Navigation">
        {(
          [
            { label: 'Today', Icon: Sun, isBigYellow: false },
            { label: 'Week', Icon: CalendarDays, isBigYellow: false },
            { label: 'Air Quality', Icon: Activity, isBigYellow: true },
            { label: 'Saved', Icon: MapPin, isBigYellow: false },
            { label: 'Settings', Icon: Settings2, isBigYellow: false },
          ] as const
        ).map(({ label, Icon, isBigYellow }) =>
          label === 'Air Quality' ? (
            <AirQualityNavButton
              key={label}
              isMobile={true}
              isActive={activeTab === 'Air Quality'}
              onClick={() => setActiveTab('Air Quality')}
              onOpenGlobe={() => setIsGlobeModalOpen(true)}
            />
          ) : (
            <button
              className={`${activeTab === label ? 'active' : ''} ${isBigYellow ? 'mobile-nav-air-yellow' : ''}`}
              data-testid={`mobile-nav-${label.toLowerCase().replace(/\s+/g, '-')}`}
              key={label}
              onClick={() => setActiveTab(label)}
              aria-label={`Go to ${label} tab`}
            >
              <div className={isBigYellow ? 'air-big-round-icon-mobile' : ''}>
                <Icon size={isBigYellow ? 22 : 19} />
              </div>
              <span>{label}</span>
            </button>
          )
        )}
      </nav>

      {/* 3D Atmospheric Weather Globe Modal */}
      {isGlobeModalOpen && forecast && (
        <Globe3DModal
          location={location}
          forecast={forecast}
          airQuality={air}
          onClose={() => setIsGlobeModalOpen(false)}
        />
      )}

      {toastMessage && (
        <div className="toast-popup" data-testid="toast-notification">
          <Sparkles size={14} color="hsl(var(--accent))" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar Component (Desktop)
// ---------------------------------------------------------------------------
function Sidebar({
  activeTab,
  setActiveTab,
  location,
  savedList,
  pickLocation,
  healthOk,
  isOnline = true,
  isViewingCached = false,
  onOpenGlobe,
}: {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  location: Location;
  savedList: Location[];
  pickLocation: (location: Location) => void;
  healthOk: boolean;
  isOnline?: boolean;
  isViewingCached?: boolean;
  onOpenGlobe: () => void;
}) {
  return (
    <aside className="atmos-sidebar">
      <div className="brand-mark">
        <div className="brand-symbol">
          <CloudSun size={19} />
        </div>
        <span className="brand-name">atmos</span>
      </div>

      <div className="side-label">Workspace</div>
      <nav className="side-nav">
        {(
          [
            { Icon: Sun, label: 'Today', isBigYellow: false },
            { Icon: CalendarDays, label: 'Week', isBigYellow: false },
            { Icon: Activity, label: 'Air Quality', isBigYellow: true },
            { Icon: MapPin, label: 'Saved', isBigYellow: false },
            { Icon: Settings2, label: 'Settings', isBigYellow: false },
          ] as const
        ).map(({ Icon, label, isBigYellow }) =>
          label === 'Air Quality' ? (
            <AirQualityNavButton
              key={label}
              isMobile={false}
              isActive={activeTab === 'Air Quality'}
              onClick={() => setActiveTab('Air Quality')}
              onOpenGlobe={onOpenGlobe}
            />
          ) : (
            <button
              className={`${activeTab === label ? 'active' : ''} ${isBigYellow ? 'side-nav-air-yellow' : ''}`}
              data-testid={`nav-${label.toLowerCase().replace(/\s+/g, '-')}`}
              key={label}
              onClick={() => setActiveTab(label)}
            >
              <div className={isBigYellow ? 'air-big-round-icon' : ''}>
                <Icon size={isBigYellow ? 22 : 17} />
              </div>
              {label === 'Saved' ? 'Saved locations' : label}
            </button>
          )
        )}
      </nav>

      <div className="saved-locations">
        <div className="side-label">Quick switch</div>
        {savedList.slice(0, 5).map((item) => (
          <button
            className={`saved-location ${location.id === item.id || location.name === item.name ? 'active' : ''}`}
            data-testid={`button-saved-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
            key={item.id}
            onClick={() => pickLocation(item)}
          >
            <span>{item.name}</span>
            <span>{item.name === location.name ? 'ACTIVE' : '→'}</span>
          </button>
        ))}
      </div>

      <div className="sidebar-footer">
        <span
          className={`signal-dot ${
            !isOnline
              ? 'signal-dot-offline'
              : isViewingCached
              ? 'signal-dot-cached'
              : 'signal-dot-live'
          }`}
        />
        {!isOnline
          ? 'Offline · Cached mode'
          : isViewingCached
          ? 'Viewing cached data'
          : healthOk
          ? 'Atmos systems online'
          : 'Connected to sky'}
        <br />
        <span style={{ paddingLeft: 12 }}>Open-Meteo & AI Briefings</span>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// TAB 1: Today View
// ---------------------------------------------------------------------------
function TodayView({
  forecast,
  daily,
  current,
  air,
  visibilityKm,
  aqiLabel,
  hourlyStart,
  insight,
  onGenerateInsight,
  onNavigateToAirQuality,
  settings,
  location,
  onCycleTheme,
}: {
  forecast: Forecast;
  daily: Forecast['daily'];
  current: Forecast['current'];
  air?: AirQuality['current'];
  visibilityKm: number;
  aqiLabel: string;
  hourlyStart: number;
  insight: ReturnType<typeof useGenerateWeatherInsight>;
  onGenerateInsight: () => void;
  onNavigateToAirQuality: () => void;
  settings: AppSettings;
  location: Location;
  onCycleTheme?: () => void;
}) {
  const [selectedHour, setSelectedHour] = useState(hourlyStart);

  useEffect(() => {
    setSelectedHour(hourlyStart);
  }, [hourlyStart, current.time]);

  const isViewingSelectedHour = selectedHour !== hourlyStart;
  const activeWeatherCode = isViewingSelectedHour
    ? (forecast.hourly.weather_code[selectedHour] ?? current.weather_code)
    : current.weather_code;

  // Actual local daylight condition based on local solar cycle
  const localIsDay = isViewingSelectedHour
    ? isHourDaylight(forecast.hourly.time[selectedHour], daily.sunrise[0], daily.sunset[0])
    : current.is_day === 1;

  // In auto mode, the Atmospheric card is dynamically driven by actual local solar conditions.
  // In manual lock, it stays locked to Day or Night while keeping real local weather conditions (rain, temp, wind, etc.)
  const activeIsDay =
    settings.theme === 'day' || settings.theme === 'light'
      ? true
      : settings.theme === 'night' || settings.theme === 'dark'
      ? false
      : localIsDay;

  const activeTemp = isViewingSelectedHour
    ? (forecast.hourly.temperature_2m[selectedHour] ?? current.temperature_2m)
    : current.temperature_2m;
  const activeApparentTemp = isViewingSelectedHour
    ? activeTemp
    : current.apparent_temperature;
  const activeHumidity = isViewingSelectedHour
    ? (forecast.hourly.relative_humidity_2m[selectedHour] ?? current.relative_humidity_2m)
    : current.relative_humidity_2m;
  const activeRainChance = isViewingSelectedHour
    ? (forecast.hourly.precipitation_probability[selectedHour] ?? 0)
    : (forecast.hourly.precipitation_probability[hourlyStart] ?? 0);
  const activeWindSpeed = isViewingSelectedHour
    ? (forecast.hourly.wind_speed_10m[selectedHour] ?? current.wind_speed_10m)
    : current.wind_speed_10m;

  const activeWindInfo = convertWind(activeWindSpeed, settings.windUnit);
  const atmosphericTheme = getAtmosphericTheme(activeWeatherCode, activeIsDay);
  const ActiveHeroIcon = weatherIcon(activeWeatherCode, activeIsDay);

  const currentWindInfo = convertWind(current.wind_speed_10m, settings.windUnit);
  const selectedWindInfo = convertWind(forecast.hourly.wind_speed_10m[selectedHour] || 0, settings.windUnit);

  // Real-time severe weather alert evaluation
  const activeAlert = useMemo(() => {
    return evaluateSevereWeatherAlert({
      weatherCode: activeWeatherCode,
      windSpeedKmh: activeWindSpeed,
      windGustsKmh: current.wind_gusts_10m ?? (forecast.daily.wind_speed_10m_max?.[0] ? forecast.daily.wind_speed_10m_max[0] * 1.15 : undefined),
      locationName: location.name,
      simulated: settings.simulateAlert,
    });
  }, [activeWeatherCode, activeWindSpeed, current.wind_gusts_10m, forecast.daily, location.name, settings.simulateAlert]);

  return (
    <div className="animate-rise">
      {/* Real-time Severe Weather Alert Banner */}
      <AnimatePresence>
        {activeAlert && (
          <SevereWeatherAlertBanner
            key={activeAlert.id}
            alert={activeAlert}
          />
        )}
      </AnimatePresence>

      <div className="hero-grid">
        {/* Dynamic Atmospheric State Weather Card */}
        <section
          className="atmospheric-card"
          data-testid="card-current-conditions"
        >
          {/* Framer Motion Cross-fade Background Gradient */}
          <AtmosphericGradientCrossfade
            gradient={atmosphericTheme.bgGradient}
            themeKey={`${atmosphericTheme.id}-${activeWeatherCode}-${activeIsDay ? 'day' : 'night'}`}
          />

          {/* Subtle Particle-based Rainfall Animation Overlay */}
          <AnimatePresence>
            {isRainOrShowers(activeWeatherCode) && (
              <RainParticleOverlay
                key={`rain-overlay-${activeWeatherCode}`}
                weatherCode={activeWeatherCode}
                windSpeed={activeWindSpeed}
                windDirection={current.wind_direction_10m}
              />
            )}
          </AnimatePresence>

          {/* Radar / Atmospheric Wave Geometry Arcs */}
          <AnimatePresence initial={false}>
            <motion.svg
              key={`arcs-${atmosphericTheme.id}-${activeIsDay ? 'day' : 'night'}`}
              className="atmospheric-arcs-svg"
              viewBox="0 0 400 320"
              fill="none"
              preserveAspectRatio="none"
              aria-hidden="true"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.95 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: 'easeInOut' }}
            >
              <circle cx="340" cy="50" r="70" stroke={atmosphericTheme.ringColor} strokeWidth="1.2" strokeDasharray="3 3" />
              <circle cx="340" cy="50" r="140" stroke={atmosphericTheme.ringColor} strokeWidth="1.2" />
              <circle cx="340" cy="50" r="220" stroke={atmosphericTheme.ringColor} strokeWidth="1.2" />
              <circle cx="340" cy="50" r="310" stroke={atmosphericTheme.ringColor} strokeWidth="1.2" />
              <circle cx="340" cy="50" r="410" stroke={atmosphericTheme.ringColor} strokeWidth="1.2" />
            </motion.svg>
          </AnimatePresence>

          {/* Header Row: Eyebrow + Dynamic Condition Name & Glowing Beacon */}
          <div className="atmospheric-top-row">
            <div>
              <div className="atmospheric-kicker-row">
                <span className="atmospheric-kicker">Atmospheric state</span>
                <button
                  type="button"
                  className="atmospheric-theme-pill"
                  onClick={onCycleTheme}
                  data-testid="button-cycle-theme-atmospheric"
                  title={`Theme: ${
                    settings.theme === 'auto'
                      ? `Auto (locked to ${activeIsDay ? 'Day' : 'Night'} from actual local weather)`
                      : settings.theme === 'day' || settings.theme === 'light'
                      ? 'Locked Day'
                      : 'Locked Night'
                  } · Click to cycle Auto / Day / Night`}
                >
                  {settings.theme === 'auto' ? (
                    <>
                      <Sparkles size={10} />
                      <span>Auto · {activeIsDay ? 'Day' : 'Night'}</span>
                    </>
                  ) : activeIsDay ? (
                    <>
                      <Sun size={10} />
                      <span>Day lock</span>
                    </>
                  ) : (
                    <>
                      <Moon size={10} />
                      <span>Night lock</span>
                    </>
                  )}
                </button>
                {isViewingSelectedHour && (
                  <button
                    type="button"
                    className="atmospheric-reset-pill"
                    onClick={() => setSelectedHour(hourlyStart)}
                    title="Reset to live current conditions"
                  >
                    <span>
                      {formatTime(forecast.hourly.time[selectedHour], forecast.timezone, settings.timeFormat)} · Reset
                    </span>
                    <RefreshCw size={10} />
                  </button>
                )}
              </div>
              <AnimatePresence mode="wait">
                <motion.h2
                  key={`condition-${activeWeatherCode}`}
                  className="atmospheric-condition-title"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                >
                  {WEATHER_TEXT[activeWeatherCode] ?? 'Changing skies'}
                </motion.h2>
              </AnimatePresence>
            </div>

            {/* Glowing Weather Icon Beacon with Framer Motion reactions */}
            <div
              className="atmospheric-beacon-wrap"
              title={`${WEATHER_TEXT[activeWeatherCode]} (${activeIsDay ? 'Daylight' : 'Night'})`}
            >
              <motion.div
                className="atmospheric-glow-halo"
                style={{
                  background: atmosphericTheme.haloGradient,
                  boxShadow: atmosphericTheme.glowSpread,
                }}
                animate={{
                  scale: [0.93, 1.15, 0.93],
                  opacity: [0.8, 1, 0.8],
                }}
                transition={{
                  duration: 4.2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
              <AnimatedWeatherIcon
                code={activeWeatherCode}
                isDay={activeIsDay}
                variant="hero"
                className="atmospheric-beacon-icon"
                style={{
                  color: atmosphericTheme.iconColor,
                  filter: `drop-shadow(0 0 16px ${atmosphericTheme.glowColor})`,
                }}
              />
            </div>
          </div>

          {/* Temperature & State Subtitle */}
          <div className="atmospheric-temp-section">
            <div className="atmospheric-temp-val-wrap">
              <AnimatePresence mode="wait">
                <motion.span
                  key={`temp-${Math.round(convertTemp(activeTemp, settings.tempUnit))}`}
                  className="atmospheric-temp-number"
                  data-testid="text-current-temperature"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                >
                  {Math.round(convertTemp(activeTemp, settings.tempUnit))}°
                </motion.span>
              </AnimatePresence>
              <span className="atmospheric-temp-unit">{settings.tempUnit}</span>
            </div>

            <div className="atmospheric-feels-line">
              Feels like {formatTempDisplay(activeApparentTemp, settings.tempUnit)} ·{' '}
              {activeIsDay ? 'Daylight' : 'Night time'} · Humidity {activeHumidity}%
            </div>
          </div>

          {/* Bottom Meta Pill Row */}
          <div className="atmospheric-meta-row">
            <div className="atmospheric-meta-chip">
              <Wind size={16} style={{ color: atmosphericTheme.accentColor }} />
              <span>{activeWindInfo.value} {activeWindInfo.unit}</span>
            </div>
            <div className="atmospheric-meta-chip">
              <Droplets size={16} style={{ color: atmosphericTheme.accentColor }} />
              <span>{activeHumidity}% humidity</span>
            </div>
            <div className="atmospheric-meta-chip">
              <Umbrella size={16} style={{ color: atmosphericTheme.accentColor }} />
              <span>{activeRainChance}% rain chance</span>
            </div>
          </div>
        </section>

        <DaylightArc
          sunrise={daily.sunrise[0]}
          sunset={daily.sunset[0]}
          currentTime={current.time}
          timeFormat={settings.timeFormat}
        />
      </div>

      <motion.div
        className="data-grid"
        key={`data-grid-${location.latitude}-${location.longitude}`}
        variants={dataGridContainerVariants}
        initial="hidden"
        animate="visible"
      >
        <DataCard
          icon={Wind}
          label="Wind"
          value={currentWindInfo.value}
          unit={currentWindInfo.unit}
          caption={`${windDirection(current.wind_direction_10m)} direction (${current.wind_direction_10m}°)`}
        >
          <WindRoseVisualization
            direction={current.wind_direction_10m}
            speed={current.wind_speed_10m}
            unit={settings.windUnit}
            gusts={current.wind_gusts_10m ?? (forecast.daily.wind_speed_10m_max?.[0] ? forecast.daily.wind_speed_10m_max[0] * 1.15 : undefined)}
            hourlyDirections={forecast.hourly.wind_direction_10m}
            hourlySpeeds={forecast.hourly.wind_speed_10m}
            startIndex={hourlyStart}
          />
        </DataCard>
        <DataCard
          icon={Umbrella}
          label="Precipitation"
          value={`${forecast.hourly.precipitation_probability[hourlyStart] ?? 0}`}
          unit="%"
          caption={
            current.precipitation > 0
              ? `${formatPrecipDisplay(current.precipitation, settings.precipUnit)} fallen`
              : 'Probability this hour'
          }
        />
        <DataCard
          icon={Sun}
          label="UV index"
          value={`${Math.round(current.uv_index)}`}
          unit={`/ 11`}
          caption={uvLabel(current.uv_index)}
        >
          <UvIndexMiniChart
            hourlyTimes={forecast.hourly.time}
            hourlyUv={forecast.hourly.uv_index}
            startIndex={hourlyStart}
            timezone={forecast.timezone}
            timeFormat={settings.timeFormat}
          />
        </DataCard>
        <DataCard
          icon={Gauge}
          label="Visibility"
          value={
            settings.windUnit === 'mph'
              ? (visibilityKm * 0.621371).toFixed(1)
              : visibilityKm.toFixed(1)
          }
          unit={settings.windUnit === 'mph' ? 'mi' : 'km'}
          caption="Horizon optical clarity"
        />
      </motion.div>

      {/* Hourly Timeline */}
      <div className="section-block">
        <div className="section-heading">
          <h2 className="section-title">Next 12 hours</h2>
          <span className="section-note">Tap any time slot to inspect details</span>
        </div>
        <div className="hourly-card" data-testid="card-hourly-forecast">
          {forecast.hourly.time.slice(hourlyStart, hourlyStart + 12).map((time, index) => {
            const i = hourlyStart + index;
            const isHourDay = isHourDaylight(time, daily.sunrise[0], daily.sunset[0]);
            return (
              <motion.button
                type="button"
                className={`hour ${index === 0 ? 'current' : ''} ${i === selectedHour ? 'selected' : ''}`}
                key={time}
                onClick={() => setSelectedHour(i)}
                whileHover={{ y: -3, transition: { duration: 0.18 } }}
                whileTap={{ scale: 0.96 }}
                aria-label={`Show weather for ${index === 0 ? 'now' : formatTime(time, forecast.timezone, settings.timeFormat)}`}
              >
                <div className="hour-time">
                  {index === 0 ? 'Now' : formatTime(time, forecast.timezone, settings.timeFormat)}
                </div>
                <AnimatedWeatherIcon
                  code={forecast.hourly.weather_code[i]}
                  isDay={isHourDay}
                  variant="hourly"
                  isSelected={i === selectedHour}
                  className="weather-icon"
                />
                <div className="hour-temp">
                  {formatTempDisplay(forecast.hourly.temperature_2m[i], settings.tempUnit)}
                </div>
                <div className="rain-chance">
                  {forecast.hourly.precipitation_probability[i]}%
                </div>
                {i === selectedHour && (
                  <motion.div
                    layoutId="activeHourIndicatorPill"
                    className="hour-active-indicator-bar"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Recharts 12-Hour Temperature Trend Line Chart */}
        <HourlyTemperatureChart
          times={forecast.hourly.time}
          temperatures={forecast.hourly.temperature_2m}
          apparentTemps={forecast.hourly.apparent_temperature}
          precipProbabilities={forecast.hourly.precipitation_probability}
          weatherCodes={forecast.hourly.weather_code}
          hourlyStart={hourlyStart}
          sunrise={daily.sunrise[0]}
          sunset={daily.sunset[0]}
          timezone={forecast.timezone}
          tempUnit={settings.tempUnit}
          timeFormat={settings.timeFormat}
          selectedHour={selectedHour}
          onSelectHour={setSelectedHour}
        />

        <div className="hourly-focus" data-testid="card-selected-hour">
          <div>
            <span>Selected time slot</span>
            <strong>
              {selectedHour === hourlyStart
                ? 'Current conditions'
                : formatTime(forecast.hourly.time[selectedHour], forecast.timezone, settings.timeFormat)}
            </strong>
          </div>
          <div>
            <strong>
              {formatTempDisplay(forecast.hourly.temperature_2m[selectedHour], settings.tempUnit)}
            </strong>
            <span>{WEATHER_TEXT[forecast.hourly.weather_code[selectedHour]] ?? 'Scattered'}</span>
          </div>
          <div>
            <strong>{forecast.hourly.precipitation_probability[selectedHour]}%</strong>
            <span>rain likelihood</span>
          </div>
          <div>
            <strong>
              {selectedWindInfo.value} {selectedWindInfo.unit}
            </strong>
            <span>wind speed</span>
          </div>
        </div>
      </div>

      {/* Bottom Grid: 7-day mini + AI Briefing Card + Air Quality */}
      <div className="section-block">
        <div className="section-heading">
          <h2 className="section-title">Atmospheric analysis & week glance</h2>
          <span className="section-note">Practical AI briefing and clean metrics</span>
        </div>
        <div className="bottom-grid">
          <div className="forecast-card" data-testid="card-seven-day-forecast">
            {daily.time.map((date, index) => {
              return (
                <motion.div
                  className="forecast-row"
                  key={date}
                  whileHover={{ x: 2, transition: { duration: 0.15 } }}
                >
                  <div className="forecast-day">
                    {index === 0 ? 'Today' : shortDay(date)}
                    <span className="forecast-date">{date.slice(5).replace('-', ' / ')}</span>
                  </div>
                  <AnimatedWeatherIcon
                    code={daily.weather_code[index]}
                    isDay={true}
                    variant="forecast"
                    className="weather-icon"
                  />
                  <div className="forecast-desc">{WEATHER_TEXT[daily.weather_code[index]]}</div>
                  <div className="temp-range">
                    <span className="temp-high">
                      {formatTempDisplay(daily.temperature_2m_max[index], settings.tempUnit)}
                    </span>
                    <span className="temp-low">
                      {formatTempDisplay(daily.temperature_2m_min[index], settings.tempUnit)}
                    </span>
                  </div>
                  <div className="forecast-rain">
                    {daily.precipitation_probability_max[index]}%{' '}
                    <Droplets size={11} style={{ display: 'inline', verticalAlign: '-1px' }} />
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div>
            {/* Atmos AI Briefing Card - exact match to Image 1 */}
            <AtmosBriefingCard
              insight={insight}
              onGenerate={onGenerateInsight}
            />

            {/* Air Quality Card */}
            <div
              className="air-card air-card-interactive"
              data-testid="card-air-quality"
              onClick={onNavigateToAirQuality}
              role="button"
              tabIndex={0}
              title={`Click to view comprehensive air quality report for ${location.name}`}
            >
              <div
                className="aqi-ring"
                style={{
                  borderColor:
                    (air?.us_aqi ?? 0) <= 50
                      ? '#48bb78'
                      : (air?.us_aqi ?? 0) <= 100
                      ? '#ecc94b'
                      : (air?.us_aqi ?? 0) <= 150
                      ? '#ed8936'
                      : '#e53e3e',
                  boxShadow:
                    (air?.us_aqi ?? 0) <= 50
                      ? '0 0 12px rgba(72, 187, 120, 0.25)'
                      : (air?.us_aqi ?? 0) <= 100
                      ? '0 0 12px rgba(236, 201, 75, 0.25)'
                      : '0 0 12px rgba(229, 62, 62, 0.25)',
                }}
              >
                {air?.us_aqi ?? '--'}
              </div>
              <div className="aqi-copy" style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3>Air Quality · {aqiLabel}</h3>
                  <span className="air-view-btn">
                    Full analysis <ArrowRight size={11} />
                  </span>
                </div>
                <p>
                  Local AQI {air?.us_aqi ?? '--'} · PM2.5 {air?.pm2_5?.toFixed(1) ?? '--'} µg/m³ · Live for {location.name}
                </p>
                <div className="air-card-mini-pollutants">
                  <span className="air-mini-pill">PM2.5: {air?.pm2_5?.toFixed(1) ?? '--'}</span>
                  <span className="air-mini-pill">PM10: {air?.pm10?.toFixed(1) ?? '--'}</span>
                  <span className="air-mini-pill">O₃: {air?.ozone != null ? Math.round(air.ozone) : '--'}</span>
                  <span className="air-mini-pill">NO₂: {air?.nitrogen_dioxide?.toFixed(1) ?? '--'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Atmos AI Briefing Card (Image 1 replica & functional generator)
// ---------------------------------------------------------------------------
function AtmosBriefingCard({
  insight,
  onGenerate,
}: {
  insight: ReturnType<typeof useGenerateWeatherInsight>;
  onGenerate: () => void;
}) {
  const data = insight.data;
  const [speaking, setSpeaking] = useState(false);
  const [copied, setCopied] = useState(false);

  const activeData = data || {
    headline: 'Current Weather Briefing',
    summary: 'Live atmospheric conditions are active and operating normally. Reviewing current temperature, humidity, wind, and air quality.',
    recommendations: [
      'Stay hydrated and monitor local weather updates.',
      'Check air quality index before outdoor activities.',
    ],
  };

  const handleCopy = () => {
    const text = `${activeData.headline}\n\n${activeData.summary}\n\nRecommendations:\n${activeData.recommendations
      .map((r) => `• ${r}`)
      .join('\n')}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  };

  const fallbackCopy = (text: string) => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.top = '0';
      textarea.style.left = '0';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // ignore
    }
  };

  const handleSpeak = () => {
    if (!('speechSynthesis' in window)) return;
    try {
      if (speaking) {
        window.speechSynthesis.cancel();
        setSpeaking(false);
        return;
      }
      window.speechSynthesis.cancel();
      const text = `${activeData.headline}. ${activeData.summary}. ${activeData.recommendations.join('. ')}`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      setSpeaking(true);
      window.speechSynthesis.speak(utterance);
    } catch {
      setSpeaking(false);
    }
  };

  return (
    <section className="insight-card" data-testid="card-ai-briefing">
      <div className="briefing-header-row">
        <div className="briefing-badge">
          <Activity size={14} className="briefing-pulse-icon" />
          ATMOS BRIEFING
        </div>
        <div className="briefing-actions-top">
          <button
            className="briefing-icon-btn"
            onClick={handleSpeak}
            title={speaking ? 'Stop speech' : 'Read briefing aloud'}
            aria-label="Read briefing aloud"
          >
            {speaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          <button
            className="briefing-icon-btn"
            onClick={handleCopy}
            title={copied ? 'Copied!' : 'Copy briefing text'}
            aria-label="Copy briefing text"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
      </div>

      {insight.isPending ? (
        <>
          <div
            className="skeleton"
            style={{ height: 26, width: '75%', marginTop: 20, background: 'rgba(255,255,255,.16)' }}
          />
          <div
            className="skeleton"
            style={{ height: 50, width: '94%', marginTop: 13, background: 'rgba(255,255,255,.11)' }}
          />
          <div
            className="skeleton"
            style={{ height: 60, width: '90%', marginTop: 14, background: 'rgba(255,255,255,.08)' }}
          />
        </>
      ) : insight.isError ? (
        <>
          <h3 className="insight-title">{activeData.headline}</h3>
          <p className="insight-summary">{activeData.summary}</p>
          <div className="recommendations">
            {activeData.recommendations.map((recommendation, index) => (
              <div
                className="recommendation"
                data-testid={`text-recommendation-${index}`}
                key={`${recommendation}-${index}`}
              >
                {recommendation}
              </div>
            ))}
          </div>
        </>
      ) : data ? (
        <>
          <h3 className="insight-title">{data.headline}</h3>
          <p className="insight-summary">{data.summary}</p>
          <div className="recommendations">
            {data.recommendations.map((recommendation, index) => (
              <div
                className="recommendation"
                data-testid={`text-recommendation-${index}`}
                key={`${recommendation}-${index}`}
              >
                {recommendation}
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <h3 className="insight-title">{activeData.headline}</h3>
          <p className="insight-summary">{activeData.summary}</p>
          <div className="recommendations">
            {activeData.recommendations.map((recommendation, index) => (
              <div
                className="recommendation"
                data-testid={`text-recommendation-${index}`}
                key={`${recommendation}-${index}`}
              >
                {recommendation}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="briefing-footer-row">
        <button
          className="insight-button"
          data-testid="button-generate-insight"
          onClick={onGenerate}
          disabled={insight.isPending}
        >
          {insight.isPending
            ? 'Reading the atmosphere…'
            : data
            ? 'Refresh briefing'
            : 'Generate my briefing'}
        </button>

        {data?.generatedAt && (
          <span className="briefing-timestamp">
            Updated {new Date(data.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </section>
  );
}



// ---------------------------------------------------------------------------
// TAB: Comprehensive Air Quality & Atmospheric View
// ---------------------------------------------------------------------------
function AirQualityView({
  air,
  location,
  forecast,
  visibilityKm,
  settings,
  onUseCurrentLocation,
  onOpenGlobe,
}: {
  air: AirQuality | null;
  location: Location;
  forecast: Forecast;
  visibilityKm: number;
  settings: AppSettings;
  onUseCurrentLocation: () => void;
  onOpenGlobe?: () => void;
}) {
  const currentAir = air?.current;
  const usAqi = currentAir?.us_aqi ?? 0;
  const aqiInfo = getAqiDetails(usAqi);
  const dominant = getDominantPollutant(currentAir);

  // Scale pointer position (0 to 300 AQI -> 0% to 100%)
  const pointerPercent = clamp((usAqi / 300) * 100, 3, 97);

  const pollutants: PollutantItem[] = [
    {
      id: 'pm2_5',
      name: 'Fine Particles',
      formula: 'PM2.5',
      value: currentAir?.pm2_5 != null ? currentAir.pm2_5.toFixed(1) : '--',
      unit: 'µg/m³',
      raw: currentAir?.pm2_5 ?? 0,
      safeMax: 12.0,
      status: (currentAir?.pm2_5 ?? 0) <= 12 ? 'Good' : (currentAir?.pm2_5 ?? 0) <= 35.4 ? 'Moderate' : 'Elevated',
      statusColor: (currentAir?.pm2_5 ?? 0) <= 12 ? '#48bb78' : (currentAir?.pm2_5 ?? 0) <= 35.4 ? '#ecc94b' : '#e53e3e',
      progress: clamp(((currentAir?.pm2_5 ?? 0) / 60) * 100, 5, 100),
      desc: 'Microscopic particles under 2.5 µm from motor exhausts, heating combustion, and wildfire smoke.',
      sources: [
        'Automotive combustion (diesel engines, exhaust tailpipe emissions, and brake soot)',
        'Fossil fuel power generation and industrial chemical plants',
        'Residential wood stoves, fireplaces, and biomass heating',
        'Wildfires, agricultural field burning, and regional smoke plumes',
      ],
      healthRisks: [
        'Penetrates deeply past upper airways into terminal pulmonary alveoli',
        'Crosses alveolar-capillary barrier directly into blood circulation',
        'Triggers acute asthma attacks, wheezing, and reduced lung capacity',
        'Linked to cardiovascular inflammation, arterial stiffness, and cardiac events',
      ],
      guideline: 'Safe threshold: ≤ 12.0 µg/m³ (WHO target: ≤ 5 µg/m³ annual)',
    },
    {
      id: 'pm10',
      name: 'Coarse Dust',
      formula: 'PM10',
      value: currentAir?.pm10 != null ? currentAir.pm10.toFixed(1) : '--',
      unit: 'µg/m³',
      raw: currentAir?.pm10 ?? 0,
      safeMax: 54.0,
      status: (currentAir?.pm10 ?? 0) <= 54 ? 'Good' : (currentAir?.pm10 ?? 0) <= 154 ? 'Moderate' : 'Elevated',
      statusColor: (currentAir?.pm10 ?? 0) <= 54 ? '#48bb78' : (currentAir?.pm10 ?? 0) <= 154 ? '#ecc94b' : '#e53e3e',
      progress: clamp(((currentAir?.pm10 ?? 0) / 150) * 100, 5, 100),
      desc: 'Inhalable airborne dust, pollen, road grit, and mechanical soil particles up to 10 µm.',
      sources: [
        'Resuspended road surface dust and tire-wear fragments',
        'Construction, excavation, and demolition worksites',
        'Agricultural harvesting, land clearing, and topsoil tilling',
        'Crushed rock quarries, cement processing, and windblown desert dust',
      ],
      healthRisks: [
        'Deposits along nasal passages, pharynx, trachea, and bronchial tubes',
        'Induces persistent coughing, throat burning, and ocular irritation',
        'Severely aggravates Chronic Obstructive Pulmonary Disease (COPD)',
        'Elevates respiratory infection susceptibility and childhood wheezing',
      ],
      guideline: 'Safe threshold: ≤ 54.0 µg/m³ (WHO target: ≤ 15 µg/m³ annual)',
    },
    {
      id: 'ozone',
      name: 'Ground-level Ozone',
      formula: 'O₃',
      value: currentAir?.ozone != null ? Math.round(currentAir.ozone).toString() : '--',
      unit: 'µg/m³',
      raw: currentAir?.ozone ?? 0,
      safeMax: 100,
      status: (currentAir?.ozone ?? 0) <= 100 ? 'Good' : (currentAir?.ozone ?? 0) <= 160 ? 'Moderate' : 'Elevated',
      statusColor: (currentAir?.ozone ?? 0) <= 100 ? '#48bb78' : (currentAir?.ozone ?? 0) <= 160 ? '#ecc94b' : '#e53e3e',
      progress: clamp(((currentAir?.ozone ?? 0) / 200) * 100, 5, 100),
      desc: 'Secondary gas created when sunlight reacts with industrial nitrogen oxides and organic vapors.',
      sources: [
        'Photochemical reaction between sunlight and vehicular nitrogen oxides (NOx)',
        'Volatile organic compounds (VOCs) evaporating from paints and solvents',
        'Gasoline vapor emissions from fueling depots and industrial refineries',
        'Chemical plant discharges baking under hot stagnant summer sunshine',
      ],
      healthRisks: [
        'Potent oxidant that inflames respiratory epithelial tissues like a sunburn',
        'Causes acute airway constriction, chest tightness, and painful breathing',
        'Substantially worsens asthma attacks in active adults and children outdoors',
        'Reduces overall pulmonary vital capacity and athletic stamina',
      ],
      guideline: 'Safe threshold: ≤ 100 µg/m³ (8-hour maximum mean)',
    },
    {
      id: 'no2',
      name: 'Nitrogen Dioxide',
      formula: 'NO₂',
      value: currentAir?.nitrogen_dioxide != null ? currentAir.nitrogen_dioxide.toFixed(1) : '--',
      unit: 'µg/m³',
      raw: currentAir?.nitrogen_dioxide ?? 0,
      safeMax: 40.0,
      status: (currentAir?.nitrogen_dioxide ?? 0) <= 40 ? 'Good' : (currentAir?.nitrogen_dioxide ?? 0) <= 100 ? 'Moderate' : 'Elevated',
      statusColor: (currentAir?.nitrogen_dioxide ?? 0) <= 40 ? '#48bb78' : (currentAir?.nitrogen_dioxide ?? 0) <= 100 ? '#ecc94b' : '#e53e3e',
      progress: clamp(((currentAir?.nitrogen_dioxide ?? 0) / 100) * 100, 5, 100),
      desc: 'Toxic gas emitted primarily from automotive combustion engines and thermal power generation.',
      sources: [
        'High-temperature internal combustion in cars, buses, and diesel trucks',
        'Natural gas and coal-fired electricity generation stations',
        'Commercial boilers, incinerators, and petrochemical manufacturing',
        'Indoor unvented gas cookers, ovens, and space heaters',
      ],
      healthRisks: [
        'Corrodes bronchial mucous membranes and induces airway inflammation',
        'Exacerbates pediatric asthma and increases bronchitis incidence',
        'Inhibits lung growth and vital capacity development in young children',
        'Heightens pulmonary sensitivity to allergens and viral infections',
      ],
      guideline: 'Safe threshold: ≤ 40.0 µg/m³ (WHO target: ≤ 10 µg/m³ annual)',
    },
    {
      id: 'so2',
      name: 'Sulfur Dioxide',
      formula: 'SO₂',
      value: currentAir?.sulphur_dioxide != null ? currentAir.sulphur_dioxide.toFixed(1) : '--',
      unit: 'µg/m³',
      raw: currentAir?.sulphur_dioxide ?? 0,
      safeMax: 20.0,
      status: (currentAir?.sulphur_dioxide ?? 0) <= 20 ? 'Good' : 'Elevated',
      statusColor: (currentAir?.sulphur_dioxide ?? 0) <= 20 ? '#48bb78' : '#e53e3e',
      progress: clamp(((currentAir?.sulphur_dioxide ?? 0) / 60) * 100, 5, 100),
      desc: 'Pungent gas produced from burning high-sulfur fossil fuels, refineries, and metal processing.',
      sources: [
        'Combustion of sulfur-rich coal and heavy bunker oil in power stations',
        'Smelting of sulfide-containing mineral ores (copper, zinc, and iron)',
        'Maritime container vessels burning residual heavy fuel oil',
        'Petroleum refining and natural geothermal/volcanic emissions',
      ],
      healthRisks: [
        'Hydrolyzes into sulfurous acid on moist lung mucosal surfaces',
        'Triggers rapid reflex bronchospasm and wheezing within 5 minutes',
        'Induces throat burning, severe coughing, and rhinorrhea',
        'Contributes to atmospheric sulfate aerosol formation and acid rain',
      ],
      guideline: 'Safe threshold: ≤ 20.0 µg/m³ (24-hour mean guideline)',
    },
    {
      id: 'co',
      name: 'Carbon Monoxide',
      formula: 'CO',
      value: currentAir?.carbon_monoxide != null ? Math.round(currentAir.carbon_monoxide).toString() : '--',
      unit: 'µg/m³',
      raw: currentAir?.carbon_monoxide ?? 0,
      safeMax: 4400,
      status: (currentAir?.carbon_monoxide ?? 0) <= 4400 ? 'Good' : 'Elevated',
      statusColor: (currentAir?.carbon_monoxide ?? 0) <= 4400 ? '#48bb78' : '#e53e3e',
      progress: clamp(((currentAir?.carbon_monoxide ?? 0) / 9000) * 100, 5, 100),
      desc: 'Colorless, odorless gas generated from incomplete combustion of gasoline, gas, and biomass.',
      sources: [
        'Incomplete combustion in gasoline engine exhausts and idling vehicles',
        'Malfunctioning residential gas furnaces, water boilers, and heaters',
        'Indoor wood fireplaces, charcoal grills, and tobacco smoke',
        'Portable fuel generators and enclosed small combustion tools',
      ],
      healthRisks: [
        'Binds to blood hemoglobin with 200× affinity over oxygen, forming COHb',
        'Starves vital organs (myocardium and cerebral cortex) of oxygen',
        'Triggers dizziness, headaches, nausea, confusion, and visual impairment',
        'Aggravates myocardial ischemia and angina pectoris in cardiac patients',
      ],
      guideline: 'Safe threshold: ≤ 4,400 µg/m³ (8-hour standard)',
    },
  ];

  // Hourly air forecast: next 12 hours
  const hourlyTimes = air?.hourly?.time || [];
  const hourlyAqi = air?.hourly?.us_aqi || [];
  const hourlyPm25 = air?.hourly?.pm2_5 || [];
  
  let currentHourlyIdx = hourlyTimes.findIndex((t) => t.startsWith(forecast.current.time.slice(0, 13)));
  if (currentHourlyIdx < 0) currentHourlyIdx = 0;
  const nextHours = hourlyTimes.slice(currentHourlyIdx, currentHourlyIdx + 12);

  return (
    <div className="aqi-view-container animate-rise" data-testid="container-air-quality-view">
      {/* Top Banner with Location and Controls */}
      <div className="section-heading flex items-center justify-between flex-wrap gap-3" style={{ marginBottom: 0 }}>
        <div>
          <div className="eyebrow">Atmospheric Chemistry & Sensors</div>
          <h2 className="section-title" style={{ fontSize: 24, marginTop: 4 }}>
            Air Quality at {location.name}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>
              {[location.admin1, location.country].filter(Boolean).join(', ')}
            </span>
            <span
              style={{
                fontSize: 11,
                fontFamily: 'var(--app-font-mono)',
                background: 'hsl(var(--muted)/0.8)',
                padding: '2px 8px',
                borderRadius: 999,
                border: '1px solid hsl(var(--border))',
                color: 'hsl(var(--muted-foreground))',
              }}
            >
              📍 GPS: {location.latitude.toFixed(3)}°, {location.longitude.toFixed(3)}°
            </span>
          </div>
        </div>

        {onOpenGlobe && (
          <button
            onClick={onOpenGlobe}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 font-semibold text-xs transition shadow-md shadow-amber-400/25 border border-amber-300/40"
            title="Open interactive 3D Globe with active location & passing clouds (Or long-press the Air Quality tab anytime)"
            data-testid="button-open-3d-globe-from-aqi"
          >
            <Globe2 size={16} />
            <span>Open 3D Earth Globe</span>
            <span className="hidden sm:inline text-[10px] bg-slate-900/15 px-1.5 py-0.5 rounded font-mono font-normal">
              Long press tab
            </span>
          </button>
        )}
      </div>

      {/* Hero AQI Dial Card */}
      <section className="aqi-hero-card" data-testid="card-aqi-hero">
        <div className="aqi-hero-main-group">
          <div
            className="aqi-hero-dial"
            style={{
              border: `3px solid ${aqiInfo.borderColor}`,
              boxShadow: `0 0 16px ${aqiInfo.bgColor}`,
            }}
          >
            <div className="aqi-hero-dial-inner">
              <div className="aqi-dial-number" style={{ color: aqiInfo.color }}>
                {usAqi || '--'}
              </div>
              <div className="aqi-dial-scale">Local AQI</div>
            </div>
          </div>

          <div className="aqi-hero-info">
            <div className="aqi-hero-meta-row">
              <div
                className="aqi-badge-pill"
                style={{
                  backgroundColor: aqiInfo.bgColor,
                  color: aqiInfo.color,
                  border: `1px solid ${aqiInfo.borderColor}`,
                }}
              >
                <Activity size={12} />
                <span>{aqiInfo.level}</span>
              </div>
              <div className="aqi-dominant-pill">
                <span className="aqi-dominant-label">Dominant:</span>
                <span className="aqi-dominant-value">
                  {dominant.name} ({dominant.formula}) · {dominant.value} {dominant.unit}
                </span>
              </div>
            </div>

            <h3 className="aqi-hero-title">
              {usAqi <= 50
                ? `Clean, fresh breathing conditions in ${location.name}`
                : usAqi <= 100
                ? `Acceptable air with low background pollutants in ${location.name}`
                : usAqi <= 150
                ? `Elevated particulates — sensitivity alert in ${location.name}`
                : `Unfavorable air quality conditions in ${location.name}`}
            </h3>
            <p className="aqi-hero-desc">{aqiInfo.summary}</p>
          </div>
        </div>

        <div className="aqi-hero-sub-stats">
          <div className="aqi-sub-stat-item">
            <span className="aqi-sub-stat-label">Air Purity</span>
            <span className="aqi-sub-stat-value">
              {Math.max(5, Math.min(100, Math.round(100 - (usAqi / 300) * 80)))}%
            </span>
          </div>
          <div className="aqi-sub-stat-item">
            <span className="aqi-sub-stat-label">Visibility</span>
            <span className="aqi-sub-stat-value">
              {settings.windUnit === 'mph'
                ? `${(visibilityKm * 0.621371).toFixed(1)} mi`
                : `${visibilityKm.toFixed(1)} km`}
            </span>
          </div>
          <div className="aqi-sub-stat-item">
            <span className="aqi-sub-stat-label">Aerosol Depth</span>
            <span className="aqi-sub-stat-value">
              {currentAir?.aerosol_optical_depth != null
                ? currentAir.aerosol_optical_depth.toFixed(2)
                : '0.08'}
            </span>
          </div>
        </div>
      </section>

      {/* EPA Scale Spectrum */}
      <section className="aqi-spectrum-card" data-testid="card-aqi-spectrum">
        <div className="section-heading" style={{ marginBottom: 4 }}>
          <span className="eyebrow">Air Quality Index (AQI) Reference Scale (0 – 300+)</span>
          <span className="section-note">Local reading at {location.name}: AQI {usAqi} ({aqiInfo.level})</span>
        </div>

        <div className="aqi-spectrum-bar-wrap">
          <div className="aqi-spectrum-bar" />
          <div className="aqi-spectrum-pointer" style={{ left: `${pointerPercent}%` }}>
            <span className="aqi-pointer-tag" style={{ color: aqiInfo.color }}>
              AQI {usAqi} · {aqiInfo.level}
            </span>
            <div className="aqi-pointer-arrow" />
          </div>
        </div>

        <div className="aqi-spectrum-labels">
          <span>0 (Good)</span>
          <span>50 (Moderate)</span>
          <span>100 (Sensitive)</span>
          <span>150 (Unhealthy)</span>
          <span>200 (Very Unhealthy)</span>
          <span>300+ (Hazardous)</span>
        </div>
      </section>

      {/* 6 Key Pollutants Grid with Interactive Tooltips */}
      <div className="section-block">
        <div className="section-heading flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="eyebrow">Atmospheric Contaminants</div>
            <h2 className="section-title">Individual Pollutant Concentrations at {location.name}</h2>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/70 px-3 py-1.5 rounded-full border border-border">
            <Info size={13} className="text-primary" />
            <span>Hover or tap any pollutant card for sources & specific health risks</span>
          </div>
        </div>

        <div className="aqi-pollutants-grid">
          {pollutants.map((item) => (
            <PollutantCard key={item.id} item={item} />
          ))}
        </div>
      </div>

      {/* 12-Hour AQI Trend Visualization using Recharts (Spike & Improvement Identification) */}
      {nextHours.length > 0 && (
        <div className="section-block space-y-4">
          <AqiTrendChart
            times={nextHours}
            hourlyAqi={nextHours.map((_, idx) => hourlyAqi[currentHourlyIdx + idx] ?? usAqi)}
            hourlyPm25={nextHours.map((_, idx) => hourlyPm25[currentHourlyIdx + idx] ?? (currentAir?.pm2_5 ?? 0))}
            currentAqi={usAqi}
            timezone={forecast.timezone}
            timeFormat={settings.timeFormat}
            locationName={location.name}
          />

          <div className="aqi-forecast-strip" data-testid="strip-aqi-forecast">
            {nextHours.map((time, idx) => {
              const hourIndex = currentHourlyIdx + idx;
              const val = hourlyAqi[hourIndex] ?? usAqi;
              const pm = hourlyPm25[hourIndex]?.toFixed(1) ?? '--';
              const details = getAqiDetails(val);

              return (
                <div className="aqi-forecast-item" key={time}>
                  <span className="aqi-forecast-time">
                    {idx === 0 ? 'Now' : formatTime(time, forecast.timezone, settings.timeFormat)}
                  </span>
                  <span className="aqi-forecast-val" style={{ color: details.color }}>
                    {val}
                  </span>
                  <span
                    className="aqi-forecast-badge"
                    style={{
                      color: details.color,
                      backgroundColor: details.bgColor,
                    }}
                  >
                    {details.level.split(' ')[0]}
                  </span>
                  <span style={{ fontSize: 9, fontFamily: 'var(--app-font-mono)', color: 'hsl(var(--muted-foreground))' }}>
                    {pm} µg
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TAB 2: Week Extended Forecast View
// ---------------------------------------------------------------------------
function WeekView({
  forecast,
  daily,
  settings,
  locationName,
}: {
  forecast: Forecast;
  daily: Forecast['daily'];
  settings: AppSettings;
  locationName: string;
}) {
  const [expandedDay, setExpandedDay] = useState<number | null>(0);

  // Calculate week summary stats
  const maxTemp = Math.max(...daily.temperature_2m_max);
  const minTemp = Math.min(...daily.temperature_2m_min);
  const maxRainDayIndex = daily.precipitation_probability_max.indexOf(
    Math.max(...daily.precipitation_probability_max)
  );

  return (
    <div className="week-view-container animate-rise">
      <div className="week-summary-card">
        <div className="section-heading" style={{ marginBottom: 0 }}>
          <div>
            <div className="eyebrow">7-Day Extended Outlook</div>
            <h2 className="section-title" style={{ fontSize: 24, marginTop: 4 }}>
              {locationName} Weekly Forecast
            </h2>
          </div>
          <span className="section-note">Continuous 168-hour radar model</span>
        </div>

        <div className="week-stats-grid">
          <div className="week-stat-box">
            <div className="week-stat-label">Warmest peak</div>
            <div className="week-stat-value">{formatTempDisplay(maxTemp, settings.tempUnit)}</div>
            <div className="week-stat-sub">Peak daytime high</div>
          </div>
          <div className="week-stat-box">
            <div className="week-stat-label">Coolest dip</div>
            <div className="week-stat-value">{formatTempDisplay(minTemp, settings.tempUnit)}</div>
            <div className="week-stat-sub">Overnight low</div>
          </div>
          <div className="week-stat-box">
            <div className="week-stat-label">Highest rain chance</div>
            <div className="week-stat-value">
              {daily.precipitation_probability_max[maxRainDayIndex]}%
            </div>
            <div className="week-stat-sub">
              {maxRainDayIndex === 0 ? 'Today' : shortDay(daily.time[maxRainDayIndex])}
            </div>
          </div>
        </div>
      </div>

      <div className="week-days-list">
        {daily.time.map((date, index) => {
          const Icon = weatherIcon(daily.weather_code[index]);
          const isExpanded = expandedDay === index;
          const dayHourlyOffset = index * 24;
          const dayHours = forecast.hourly.time.slice(dayHourlyOffset, dayHourlyOffset + 24);

          return (
            <div
              className={`day-card ${isExpanded ? 'active' : ''}`}
              key={date}
              data-testid={`card-day-${index}`}
            >
              <div
                className="day-card-main"
                onClick={() => setExpandedDay(isExpanded ? null : index)}
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
              >
                <div>
                  <div className="day-card-title">{index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : shortDay(date)}</div>
                  <div className="day-card-date">{fullDay(date)}</div>
                </div>

                <AnimatedWeatherIcon
                  code={daily.weather_code[index]}
                  isDay={true}
                  variant="forecast"
                  size={26}
                  style={{ color: 'hsl(var(--primary))' }}
                />

                <div className="day-card-desc">{WEATHER_TEXT[daily.weather_code[index]] ?? 'Partly cloudy'}</div>

                <div className="day-temp-bar-wrap">
                  <span className="temp-low">{formatTempDisplay(daily.temperature_2m_min[index], settings.tempUnit)}</span>
                  <div className="day-temp-bar" />
                  <span className="temp-high" style={{ fontWeight: 700 }}>
                    {formatTempDisplay(daily.temperature_2m_max[index], settings.tempUnit)}
                  </span>
                </div>

                <div className="day-meta-chips">
                  <span style={{ color: 'hsl(var(--primary))' }}>
                    <Droplets size={12} style={{ display: 'inline', verticalAlign: '-2px' }} />{' '}
                    {daily.precipitation_probability_max[index]}%
                  </span>
                  <span>UV {Math.round(daily.uv_index_max[index])}</span>
                </div>

                <button
                  className="day-expand-btn"
                  aria-label={isExpanded ? 'Collapse hourly details' : 'Expand hourly details'}
                >
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>

              {isExpanded && (
                <div className="day-accordion animate-rise">
                  <div className="section-heading" style={{ marginBottom: 10 }}>
                    <span className="eyebrow">Hourly Progression · {fullDay(date)}</span>
                    <span className="section-note">
                      Sunrise {formatTime(daily.sunrise[index], forecast.timezone, settings.timeFormat)} · Sunset{' '}
                      {formatTime(daily.sunset[index], forecast.timezone, settings.timeFormat)}
                    </span>
                  </div>
                  <div className="day-hourly-strip">
                    {dayHours.filter((_, i) => i % 3 === 0).map((time, hIdx) => {
                      const absoluteIdx = dayHourlyOffset + hIdx * 3;
                      return (
                        <div className="day-hourly-item" key={time}>
                          <div className="day-hourly-time">
                            {formatTime(time, forecast.timezone, settings.timeFormat)}
                          </div>
                          <AnimatedWeatherIcon
                            code={forecast.hourly.weather_code[absoluteIdx]}
                            isDay={true}
                            variant="compact"
                            size={18}
                            style={{ margin: '6px auto', color: 'hsl(var(--primary))' }}
                          />
                          <div className="day-hourly-temp">
                            {formatTempDisplay(forecast.hourly.temperature_2m[absoluteIdx], settings.tempUnit)}
                          </div>
                          <div className="day-hourly-rain">
                            {forecast.hourly.precipitation_probability[absoluteIdx]}% rain
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TAB 3: Saved Locations Management View
// ---------------------------------------------------------------------------
function SavedLocationsView({
  savedList,
  activeLocation,
  onSelectLocation,
  onRemoveLocation,
  onAddLocation,
  onUseCurrentLocation,
  settings,
}: {
  savedList: Location[];
  activeLocation: Location;
  onSelectLocation: (loc: Location) => void;
  onRemoveLocation: (id: number, name: string) => void;
  onAddLocation: (loc: Location) => void;
  onUseCurrentLocation: () => void;
  settings: AppSettings;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Location[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void getJson<{ results?: Location[] }>(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          searchQuery
        )}&count=5&language=en&format=json`,
        controller.signal
      )
        .then((d) => setSearchResults(d.results ?? []))
        .catch(() => setSearchResults([]))
        .finally(() => setIsSearching(false));
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

  const quickCities: Location[] = [
    { id: 2988507, name: 'Paris', latitude: 48.8566, longitude: 2.3522, country: 'France' },
    { id: 1850147, name: 'Tokyo', latitude: 35.6895, longitude: 139.6917, country: 'Japan' },
    { id: 3169070, name: 'Rome', latitude: 41.8919, longitude: 12.5113, country: 'Italy' },
    { id: 2147714, name: 'Sydney', latitude: -33.8688, longitude: 151.2093, country: 'Australia' },
    { id: 5368361, name: 'Los Angeles', latitude: 34.0522, longitude: -118.2437, country: 'United States' },
    { id: 292223, name: 'Dubai', latitude: 25.2048, longitude: 55.2708, country: 'United Arab Emirates' },
  ];

  return (
    <div className="saved-view-container animate-rise">
      <div className="saved-search-panel">
        <div className="section-heading" style={{ marginBottom: 12 }}>
          <div>
            <div className="eyebrow">Location Directory</div>
            <h2 className="section-title" style={{ fontSize: 22, marginTop: 4 }}>
              Add & Manage Saved Cities
            </h2>
          </div>
        </div>

        <div className="saved-search-row">
          <div className="saved-search-input-wrap">
            <Search size={16} />
            <input
              className="saved-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search world cities to add to your workspace..."
              aria-label="Search city to save"
            />
            {searchResults.length > 0 && (
              <div className="search-results" style={{ top: 50 }}>
                {searchResults.map((item) => (
                  <button
                    className="search-result"
                    key={item.id}
                    onClick={() => {
                      onAddLocation(item);
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{item.name}</span>
                      <Plus size={14} color="hsl(var(--primary))" />
                    </div>
                    <small>
                      {item.admin1 ? `${item.admin1}, ` : ''}
                      {item.country}
                    </small>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="quick-suggestions">
          <span className="quick-suggestions-label">Popular cities:</span>
          {quickCities.map((city) => (
            <button
              className="quick-pill"
              key={city.name}
              onClick={() => onAddLocation(city)}
            >
              + {city.name}
            </button>
          ))}
        </div>
      </div>

      <div className="section-heading">
        <h2 className="section-title">Your Saved Cities ({savedList.length})</h2>
        <span className="section-note">Click any city to switch forecast</span>
      </div>

      <div className="saved-grid">
        {savedList.map((loc) => {
          const isActive = loc.id === activeLocation.id || loc.name === activeLocation.name;
          return (
            <SavedCityCard
              key={loc.id}
              location={loc}
              isActive={isActive}
              onSelect={() => onSelectLocation(loc)}
              onRemove={() => onRemoveLocation(loc.id, loc.name)}
              settings={settings}
            />
          );
        })}
      </div>
    </div>
  );
}

function SavedCityCard({
  location,
  isActive,
  onSelect,
  onRemove,
  settings,
}: {
  location: Location;
  isActive: boolean;
  onSelect: () => void;
  onRemove: () => void;
  settings: AppSettings;
}) {
  const [data, setData] = useState<{ temp: number; code: number; humidity: number; isDay: boolean } | null>(null);

  useEffect(() => {
    let unmounted = false;
    void getJson<{ current: { temperature_2m: number; weather_code: number; relative_humidity_2m: number; is_day: number } }>(
      `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,weather_code,relative_humidity_2m,is_day`
    ).then((res) => {
      if (!unmounted && res?.current) {
        setData({
          temp: res.current.temperature_2m,
          code: res.current.weather_code,
          humidity: res.current.relative_humidity_2m,
          isDay: res.current.is_day === 1,
        });
      }
    }).catch(() => null);
    return () => {
      unmounted = true;
    };
  }, [location.latitude, location.longitude]);

  const Icon = data ? weatherIcon(data.code, data.isDay) : Sun;

  return (
    <div className={`saved-card ${isActive ? 'active-location' : ''}`} data-testid={`card-saved-city-${location.id}`}>
      <div className="saved-card-header">
        <div>
          <div className="saved-city-name">{location.name}</div>
          <div className="saved-city-sub">
            {location.admin1 ? `${location.admin1}, ` : ''}
            {location.country ?? 'World'}
          </div>
        </div>
      </div>

      <div className="saved-card-body">
        <div className="saved-temp-large">
          {data ? formatTempDisplay(data.temp, settings.tempUnit) : '--°'}
        </div>
        <div className="saved-condition-box">
          <Icon size={32} color="hsl(var(--primary))" />
          <span>{data ? WEATHER_TEXT[data.code] ?? 'Clear' : 'Updating'}</span>
        </div>
      </div>

      <div className="saved-card-footer">
        <button className="saved-btn-select" onClick={onSelect} data-testid={`button-select-city-${location.id}`}>
          {isActive ? 'Currently Viewing' : 'View Forecast'}
        </button>
        <button
          className="saved-btn-delete"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title="Remove from saved"
          aria-label={`Remove ${location.name}`}
        >
          <Trash2 size={13} />
          <span>Remove</span>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TAB 4: Settings View
// ---------------------------------------------------------------------------
function SettingsView({
  settings,
  setSettings,
  onReset,
  effectiveTheme = 'day',
  locationName,
}: {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  onReset: () => void;
  effectiveTheme?: 'day' | 'night';
  locationName?: string;
}) {
  return (
    <div className="settings-view-container animate-rise">
      {/* Unit Preferences */}
      <section className="settings-section-card" data-testid="card-settings-units">
        <div className="settings-section-header">
          <div className="settings-section-icon">
            <Sliders size={18} />
          </div>
          <div>
            <h3 className="settings-section-title">Measurement Units</h3>
            <div className="settings-section-desc">Customize temperature, wind speed, and precipitation units</div>
          </div>
        </div>

        <div className="settings-rows">
          <div className="settings-row">
            <div>
              <div className="settings-row-label">Temperature Scale</div>
              <div className="settings-row-sub">Celsius (°C) or Fahrenheit (°F)</div>
            </div>
            <div className="segmented-group">
              <button
                className={`segmented-btn ${settings.tempUnit === 'C' ? 'active' : ''}`}
                onClick={() => setSettings((s) => ({ ...s, tempUnit: 'C' }))}
              >
                Celsius (°C)
              </button>
              <button
                className={`segmented-btn ${settings.tempUnit === 'F' ? 'active' : ''}`}
                onClick={() => setSettings((s) => ({ ...s, tempUnit: 'F' }))}
              >
                Fahrenheit (°F)
              </button>
            </div>
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-row-label">Wind Speed</div>
              <div className="settings-row-sub">Unit for velocities and gusts</div>
            </div>
            <div className="segmented-group">
              {(['km/h', 'mph', 'm/s', 'kn'] as const).map((unit) => (
                <button
                  key={unit}
                  className={`segmented-btn ${settings.windUnit === unit ? 'active' : ''}`}
                  onClick={() => setSettings((s) => ({ ...s, windUnit: unit }))}
                >
                  {unit}
                </button>
              ))}
            </div>
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-row-label">Precipitation Volume</div>
              <div className="settings-row-sub">Rainfall and snowfall metrics</div>
            </div>
            <div className="segmented-group">
              <button
                className={`segmented-btn ${settings.precipUnit === 'mm' ? 'active' : ''}`}
                onClick={() => setSettings((s) => ({ ...s, precipUnit: 'mm' }))}
              >
                Millimeters (mm)
              </button>
              <button
                className={`segmented-btn ${settings.precipUnit === 'in' ? 'active' : ''}`}
                onClick={() => setSettings((s) => ({ ...s, precipUnit: 'in' }))}
              >
                Inches (in)
              </button>
            </div>
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-row-label">Time Format</div>
              <div className="settings-row-sub">Display for hourly timelines and sun position</div>
            </div>
            <div className="segmented-group">
              <button
                className={`segmented-btn ${settings.timeFormat === '12h' ? 'active' : ''}`}
                onClick={() => setSettings((s) => ({ ...s, timeFormat: '12h' }))}
              >
                12-Hour (AM/PM)
              </button>
              <button
                className={`segmented-btn ${settings.timeFormat === '24h' ? 'active' : ''}`}
                onClick={() => setSettings((s) => ({ ...s, timeFormat: '24h' }))}
              >
                24-Hour (13:00)
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* AI Briefing Persona */}
      <section className="settings-section-card" data-testid="card-settings-persona">
        <div className="settings-section-header">
          <div className="settings-section-icon">
            <Sparkles size={18} />
          </div>
          <div>
            <h3 className="settings-section-title">Atmos AI Briefing Focus</h3>
            <div className="settings-section-desc">Choose how the AI assistant tailors advice for your day</div>
          </div>
        </div>

        <div className="persona-grid">
          {(
            [
              {
                id: 'general',
                title: 'Balanced & Practical',
                desc: 'Everyday life advice covering commute, comfort, clothing, and UV protection.',
              },
              {
                id: 'commute',
                title: 'Transit & Commuter',
                desc: 'Emphasis on precipitation timing, road delays, wind gusts, and travel visibility.',
              },
              {
                id: 'outdoor',
                title: 'Athletics & Runner',
                desc: 'Focus on air quality, optimal training windows, humidity, and heat stress.',
              },
              {
                id: 'detailed',
                title: 'Meteorological Deep Dive',
                desc: 'Technical analysis of barometric changes, dew points, and frontal passages.',
              },
            ] as const
          ).map((item) => (
            <div
              key={item.id}
              className={`persona-card ${settings.briefingTone === item.id ? 'active' : ''}`}
              onClick={() => setSettings((s) => ({ ...s, briefingTone: item.id }))}
              role="button"
              tabIndex={0}
            >
              <div className="persona-title">
                <span>{item.title}</span>
                {settings.briefingTone === item.id && <Check size={15} color="hsl(var(--accent))" />}
              </div>
              <div className="persona-desc">{item.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Theme Appearance */}
      <section className="settings-section-card" data-testid="card-settings-theme">
        <div className="settings-section-header">
          <div className="settings-section-icon">
            <Sun size={18} />
          </div>
          <div>
            <h3 className="settings-section-title">Visual Appearance & Day/Night Mode</h3>
            <div className="settings-section-desc">Experience auto-sync with actual local weather, or lock into Day or Night</div>
          </div>
        </div>

        <div className="settings-rows">
          <div className="settings-row">
            <div>
              <div className="settings-row-label">App Theme Lock</div>
              <div className="settings-row-sub">
                {settings.theme === 'auto'
                  ? `Auto-locked to ${effectiveTheme === 'day' ? 'Day' : 'Night'} theme based on actual solar conditions at ${locationName ?? 'viewing location'}`
                  : settings.theme === 'day' || settings.theme === 'light'
                  ? 'Locked into Day theme across all views'
                  : 'Locked into Night theme across all views'}
              </div>
            </div>
            <div className="segmented-group">
              <button
                type="button"
                className={`segmented-btn ${settings.theme === 'auto' ? 'active' : ''}`}
                onClick={() => setSettings((s) => ({ ...s, theme: 'auto' }))}
                title="Automatically lock into Day or Night using actual local solar conditions"
              >
                <Sparkles size={13} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />
                Auto (Local Weather)
              </button>
              <button
                type="button"
                className={`segmented-btn ${settings.theme === 'day' || settings.theme === 'light' ? 'active' : ''}`}
                onClick={() => setSettings((s) => ({ ...s, theme: 'day' }))}
                title="Lock into Day theme"
              >
                <Sun size={13} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />
                Day Lock
              </button>
              <button
                type="button"
                className={`segmented-btn ${settings.theme === 'night' || settings.theme === 'dark' ? 'active' : ''}`}
                onClick={() => setSettings((s) => ({ ...s, theme: 'night' }))}
                title="Lock into Night theme"
              >
                <Moon size={13} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />
                Night Lock
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Severe Weather Alerts & Safety */}
      <section className="settings-section-card" data-testid="card-settings-alerts">
        <div className="settings-section-header">
          <div className="settings-section-icon" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
            <AlertTriangle size={18} />
          </div>
          <div>
            <h3 className="settings-section-title">Severe Weather Alerts & Warnings</h3>
            <div className="settings-section-desc">Real-time banners for thunderstorms, flash floods, gales, and blizzard conditions</div>
          </div>
        </div>

        <div className="settings-rows">
          <div className="settings-row">
            <div>
              <div className="settings-row-label">Severe Weather Alert Mode</div>
              <div className="settings-row-sub">
                {settings.simulateAlert
                  ? 'Simulated Severe Warning is active on the Today view for demonstration'
                  : 'Automatically triggers banner when live weather code indicates active warnings'}
              </div>
            </div>
            <div className="segmented-group">
              <button
                type="button"
                className={`segmented-btn ${!settings.simulateAlert ? 'active' : ''}`}
                onClick={() => setSettings((s) => ({ ...s, simulateAlert: false }))}
              >
                Live Detection
              </button>
              <button
                type="button"
                className={`segmented-btn ${settings.simulateAlert ? 'active' : ''}`}
                onClick={() => setSettings((s) => ({ ...s, simulateAlert: true }))}
              >
                <AlertTriangle size={12} style={{ display: 'inline', marginRight: 4 }} />
                Test Alert Banner
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Android App & Mobile Installation */}
      <section className="settings-section-card" data-testid="card-settings-android">
        <div className="settings-section-header">
          <div className="settings-section-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
            <Smartphone size={18} />
          </div>
          <div>
            <h3 className="settings-section-title">Android & Mobile App</h3>
            <div className="settings-section-desc">Run Atmos as a standalone mobile application on your phone</div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'hsl(var(--foreground))' }}>
              Standalone Android App / PWA
            </div>
            <div style={{ fontSize: 11.5, color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>
              Install on your Android home screen with offline caching, high-res squircle icon, and fullscreen display.
            </div>
          </div>
          <AndroidInstallButton />
        </div>
      </section>

      {/* Data and Reset */}
      <section className="settings-section-card" data-testid="card-settings-reset">
        <div className="settings-section-header">
          <div className="settings-section-icon">
            <Trash2 size={18} />
          </div>
          <div>
            <h3 className="settings-section-title">Reset & Storage</h3>
            <div className="settings-section-desc">Clear local cache and restore default workspace settings</div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <p style={{ margin: 0, fontSize: 12, color: 'hsl(var(--muted-foreground))' }}>
            All settings and saved locations are stored locally in your browser session.
          </p>
          <button className="saved-btn-delete" onClick={onReset} style={{ padding: '8px 16px' }}>
            <Trash2 size={14} />
            <span>Reset All Settings</span>
          </button>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Enhanced Dynamic & Interactive Daylight Arc Component
// ---------------------------------------------------------------------------
function DaylightArc({
  sunrise,
  sunset,
  currentTime,
  timeFormat = '12h',
}: {
  sunrise: string;
  sunset: string;
  currentTime: string;
  timeFormat?: '12h' | '24h';
}) {
  const sunriseMinutes = clockMinutes(sunrise);
  const sunsetMinutes = clockMinutes(sunset);
  const currentMinutes = clockMinutes(currentTime);

  const [selectedMinutes, setSelectedMinutes] = useState(currentMinutes);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    setSelectedMinutes(currentMinutes);
  }, [currentMinutes, sunrise, sunset]);

  const dayLengthMinutes = Math.max(sunsetMinutes - sunriseMinutes, 60);
  const solarNoonMinutes = Math.round((sunriseMinutes + sunsetMinutes) / 2);
  const rangeMin = Math.max(0, sunriseMinutes - 120);
  const rangeMax = Math.min(1439, sunsetMinutes + 120);

  // Auto-play animation cycle across the day
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setSelectedMinutes((prev) => {
        const next = prev + 6;
        if (next > rangeMax) {
          setIsPlaying(false);
          return rangeMax;
        }
        return next;
      });
    }, 45);
    return () => clearInterval(interval);
  }, [isPlaying, rangeMax]);

  // Normalized progress values
  const progress = (selectedMinutes - sunriseMinutes) / dayLengthMinutes;
  const currentProgress = (currentMinutes - sunriseMinutes) / dayLengthMinutes;

  const isDaylight = selectedMinutes >= sunriseMinutes && selectedMinutes <= sunsetMinutes;
  const isDaylightNow = currentMinutes >= sunriseMinutes && currentMinutes <= sunsetMinutes;
  const isViewingLive = Math.abs(selectedMinutes - currentMinutes) <= 2;

  // Phase computation
  let phase = 'Daylight';
  let badgeClass = 'is-up';
  let badgeText = 'Sun is up';

  if (selectedMinutes < sunriseMinutes - 35) {
    phase = 'Night sky';
    badgeClass = 'is-night';
    badgeText = isDaylightNow ? 'Sun is up' : 'Night sky';
  } else if (selectedMinutes < sunriseMinutes) {
    phase = 'Dawn twilight';
    badgeClass = 'is-golden';
    badgeText = isDaylightNow ? 'Sun is up' : 'Dawn twilight';
  } else if (selectedMinutes <= sunriseMinutes + 35) {
    phase = 'Golden hour';
    badgeClass = 'is-golden';
    badgeText = isDaylightNow ? 'Sun is up' : 'Golden hour';
  } else if (Math.abs(selectedMinutes - solarNoonMinutes) <= 30) {
    phase = 'Solar noon';
    badgeClass = 'is-up';
    badgeText = isDaylightNow ? 'Sun is up' : 'Solar noon';
  } else if (selectedMinutes >= sunsetMinutes - 35 && selectedMinutes <= sunsetMinutes) {
    phase = 'Golden hour';
    badgeClass = 'is-golden';
    badgeText = isDaylightNow ? 'Sun is up' : 'Golden hour';
  } else if (selectedMinutes <= sunsetMinutes + 35) {
    phase = 'Dusk twilight';
    badgeClass = 'is-golden';
    badgeText = isDaylightNow ? 'Sun is up' : 'Dusk twilight';
  } else {
    phase = 'Night time';
    badgeClass = 'is-night';
    badgeText = isDaylightNow ? 'Sun is up' : 'Night sky';
  }

  // Solar Altitude calculation
  const solarAltitude =
    progress >= 0 && progress <= 1
      ? Math.round(Math.sin(progress * Math.PI) * 66)
      : Math.round(Math.sin(progress * Math.PI) * 18);

  // Sunlight remaining / until sunrise calculation
  let remainingText = '';
  if (progress >= 0 && progress <= 1) {
    const remainingMins = sunsetMinutes - selectedMinutes;
    const hrs = Math.floor(remainingMins / 60);
    const mins = remainingMins % 60;
    remainingText = `${hrs}h ${mins}m daylight left`;
  } else if (selectedMinutes < sunriseMinutes) {
    const untilRise = sunriseMinutes - selectedMinutes;
    const hrs = Math.floor(untilRise / 60);
    const mins = untilRise % 60;
    remainingText = `Sunrise in ${hrs}h ${mins}m`;
  } else {
    const untilNextRise = 1440 - selectedMinutes + sunriseMinutes;
    const hrs = Math.floor(untilNextRise / 60);
    const mins = untilNextRise % 60;
    remainingText = `Next sunrise in ${hrs}h ${mins}m`;
  }

  // SVG Mathematical Geometry: width=360, height=136, horizonY=106
  const horizonY = 106;
  const startX = 40;
  const endX = 320;
  const centerX = 180;
  const arcRadiusX = 140;
  const arcRadiusY = 84;

  // Celestial Orb (Sun / Moon) position
  let sunX = centerX;
  let sunY = horizonY;

  if (progress >= 0 && progress <= 1) {
    const angle = progress * Math.PI;
    sunX = centerX - arcRadiusX * Math.cos(angle);
    sunY = horizonY - arcRadiusY * Math.sin(angle);
  } else if (progress < 0) {
    sunX = Math.max(14, startX + progress * 100);
    sunY = Math.min(130, horizonY - progress * 24);
  } else {
    sunX = Math.min(346, endX + (progress - 1) * 100);
    sunY = Math.min(130, horizonY + (progress - 1) * 24);
  }

  // "Now" vertical indicator line position
  let nowX = centerX;
  const showNowMarker = currentProgress >= -0.05 && currentProgress <= 1.05;
  if (currentProgress >= 0 && currentProgress <= 1) {
    const nowAngle = currentProgress * Math.PI;
    nowX = centerX - arcRadiusX * Math.cos(nowAngle);
  } else if (currentProgress < 0) {
    nowX = Math.max(14, startX + currentProgress * 100);
  } else {
    nowX = Math.min(346, endX + (currentProgress - 1) * 100);
  }

  // Handle direct pointer interaction on the SVG arc
  const handleSvgPointer = (e: React.PointerEvent<HTMLElement>) => {
    if (e.buttons !== 1 && e.type !== 'pointerdown') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = clamp(clickX / rect.width, 0, 1);
    const targetMin = rangeMin + ratio * (rangeMax - rangeMin);
    setSelectedMinutes(Math.round(targetMin));
    setIsPlaying(false);
  };

  // Dawn & Dusk twilight approx
  const dawnMinutes = Math.max(0, sunriseMinutes - 28);
  const duskMinutes = Math.min(1439, sunsetMinutes + 28);

  return (
    <section className="metric-card daylight-card" data-testid="card-sun-position">
      {/* Header: Title & Dynamic Status Badge with Auto-Play */}
      <div className="daylight-heading">
        <div>
          <h3>Daylight arc</h3>
          <div className="metric-sub">The shape of today</div>
        </div>

        <div className="daylight-header-actions">
          <button
            type="button"
            className="daylight-play-btn"
            onClick={() => {
              if (isPlaying) {
                setIsPlaying(false);
              } else {
                if (selectedMinutes >= rangeMax - 10) setSelectedMinutes(rangeMin);
                setIsPlaying(true);
              }
            }}
            title={isPlaying ? 'Pause simulation' : 'Play day cycle simulation'}
          >
            {isPlaying ? <Pause size={11} /> : <Play size={11} />}
            <span>{isPlaying ? 'Pause' : 'Play day'}</span>
          </button>

          <div className={`daylight-live-badge ${badgeClass}`}>
            <span className="daylight-live-dot" />
            <span>{badgeText}</span>
          </div>
        </div>
      </div>

      {/* Interactive SVG Arc Canvas Stage */}
      <div
        className="daylight-stage-wrap"
        title="Click or drag anywhere on the sky arc to explore solar trajectory"
        onPointerDown={handleSvgPointer}
        onPointerMove={handleSvgPointer}
      >
        <svg
          className="daylight-svg"
          viewBox="0 0 360 136"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label={`Sun trajectory at ${formatClockMinutes(selectedMinutes, timeFormat)}`}
        >
          <defs>
            {/* Soft Warm Sun Arc Area Fill */}
            <linearGradient id="daylightArcFill" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.16" />
              <stop offset="70%" stopColor="#f59e0b" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.00" />
            </linearGradient>

            {/* Glowing Sun Halo Gradient */}
            <radialGradient id="sunHaloGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.8" />
              <stop offset="45%" stopColor="#f59e0b" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
            </radialGradient>

            {/* Glowing Moon Halo Gradient */}
            <radialGradient id="moonHaloGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.75" />
              <stop offset="50%" stopColor="#6366f1" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </radialGradient>

            {/* Sun Core Disc Gradient */}
            <linearGradient id="sunCoreGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          </defs>

          {/* Daylight Area Shading under Arc */}
          <path
            d={`M ${startX} ${horizonY} A ${arcRadiusX} ${arcRadiusY} 0 0 1 ${endX} ${horizonY} Z`}
            fill="url(#daylightArcFill)"
          />

          {/* Dotted Solar Trajectory Curve */}
          <path
            d={`M ${startX} ${horizonY} A ${arcRadiusX} ${arcRadiusY} 0 0 1 ${endX} ${horizonY}`}
            className={`arc-trajectory-line ${isDaylight ? '' : 'is-night'}`}
            fill="none"
          />

          {/* Horizon Line with End Caps */}
          <line x1="16" y1={horizonY} x2="344" y2={horizonY} className="arc-horizon-line" />
          <circle cx={startX} cy={horizonY} r="2.5" fill="hsl(var(--muted-foreground))" opacity="0.6" />
          <circle cx={endX} cy={horizonY} r="2.5" fill="hsl(var(--muted-foreground))" opacity="0.6" />

          {/* Live "now" reference line */}
          {showNowMarker && (
            <g className="arc-now-group">
              <line x1={nowX} y1="16" x2={nowX} y2={horizonY} className="arc-now-line" />
              <text x={nowX} y="11" textAnchor="middle" className="arc-now-text">
                now
              </text>
            </g>
          )}

          {/* Dynamic Celestial Sun / Moon Orb */}
          <g className="arc-sun-orb-group" transform={`translate(${sunX}, ${sunY})`}>
            {isDaylight ? (
              <>
                {/* Outer pulsing solar glow */}
                <circle cx="0" cy="0" r="22" fill="url(#sunHaloGlow)" className="arc-sun-halo" />
                {/* Mid solar disc */}
                <circle
                  cx="0"
                  cy="0"
                  r="10.5"
                  fill="url(#sunCoreGrad)"
                  stroke="#ffffff"
                  strokeWidth="2.2"
                  className="arc-sun-core"
                />
                {/* Inner glint */}
                <circle cx="-2.5" cy="-2.5" r="2" fill="#ffffff" opacity="0.75" />
              </>
            ) : (
              <>
                {/* Twilight / Moon glow */}
                <circle cx="0" cy="0" r="18" fill="url(#moonHaloGlow)" className="arc-sun-halo" />
                {/* Moon disc */}
                <circle
                  cx="0"
                  cy="0"
                  r="9"
                  fill="#818cf8"
                  stroke="#ffffff"
                  strokeWidth="1.8"
                  className="arc-sun-core"
                />
                <circle cx="-2" cy="-2" r="1.5" fill="#ffffff" opacity="0.6" />
              </>
            )}
          </g>
        </svg>
      </div>

      {/* Interactive Time Slider */}
      <div className="sun-slider-wrap">
        <input
          className="sun-slider"
          data-testid="input-daylight-scrubber"
          type="range"
          min={rangeMin}
          max={rangeMax}
          value={selectedMinutes}
          onChange={(event) => {
            setSelectedMinutes(Number(event.currentTarget.value));
            setIsPlaying(false);
          }}
          aria-label="Explore daylight by time"
        />
      </div>

      {/* Scrub Readout Row */}
      <div className="sun-scrub-row">
        <span>Drag to explore the day</span>
        <strong>
          {formatClockMinutes(selectedMinutes, timeFormat)} · {phase}
        </strong>
      </div>

      {/* Quick Solar Anchor Jump Presets */}
      <div className="daylight-preset-row">
        <button
          type="button"
          className={`daylight-preset-btn ${selectedMinutes === dawnMinutes ? 'active' : ''}`}
          onClick={() => {
            setSelectedMinutes(dawnMinutes);
            setIsPlaying(false);
          }}
        >
          Dawn
        </button>
        <button
          type="button"
          className={`daylight-preset-btn ${selectedMinutes === sunriseMinutes ? 'active' : ''}`}
          onClick={() => {
            setSelectedMinutes(sunriseMinutes);
            setIsPlaying(false);
          }}
        >
          Rise
        </button>
        <button
          type="button"
          className={`daylight-preset-btn ${selectedMinutes === solarNoonMinutes ? 'active' : ''}`}
          onClick={() => {
            setSelectedMinutes(solarNoonMinutes);
            setIsPlaying(false);
          }}
        >
          Noon
        </button>
        <button
          type="button"
          className={`daylight-preset-btn ${selectedMinutes === sunsetMinutes ? 'active' : ''}`}
          onClick={() => {
            setSelectedMinutes(sunsetMinutes);
            setIsPlaying(false);
          }}
        >
          Set
        </button>
        <button
          type="button"
          className={`daylight-preset-btn ${selectedMinutes === duskMinutes ? 'active' : ''}`}
          onClick={() => {
            setSelectedMinutes(duskMinutes);
            setIsPlaying(false);
          }}
        >
          Dusk
        </button>
        <button
          type="button"
          className={`daylight-preset-btn ${isViewingLive ? 'active' : ''}`}
          onClick={() => {
            setSelectedMinutes(currentMinutes);
            setIsPlaying(false);
          }}
          title="Snap back to current live time"
        >
          Live / Now
        </button>
      </div>

      {/* Detailed Solar Telemetry strip */}
      <div className="daylight-telemetry-strip">
        <div className="daylight-telemetry-item">
          <Compass size={12} style={{ color: 'hsl(var(--primary))' }} />
          <span>Altitude:</span>
          <span className="daylight-telemetry-val">
            {solarAltitude > 0 ? `+${solarAltitude}°` : `${solarAltitude}°`}
          </span>
        </div>
        <div className="daylight-telemetry-item">
          <Clock size={12} style={{ color: 'hsl(var(--accent))' }} />
          <span>{remainingText}</span>
        </div>
      </div>

      {/* Sunrise & Sunset Times */}
      <div className="sun-times">
        <div className="sun-time-block">
          <div className="sun-time-label">
            <Sunrise size={15} color="#f59e0b" />
            <span>Rise</span>
          </div>
          <strong>{formatTime(sunrise, undefined, timeFormat)}</strong>
          <span className="sun-time-sub">Dawn {formatClockMinutes(dawnMinutes, timeFormat)}</span>
        </div>

        <div className="sun-time-block right">
          <div className="sun-time-label">
            <span>Set</span>
            <Sunset size={15} color="#ef4444" />
          </div>
          <strong>{formatTime(sunset, undefined, timeFormat)}</strong>
          <span className="sun-time-sub">Dusk {formatClockMinutes(duskMinutes, timeFormat)}</span>
        </div>
      </div>
    </section>
  );
}

const dataGridContainerVariants: any = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.09,
      delayChildren: 0.12,
    },
  },
};

const dataCardItemVariants: any = {
  hidden: {
    opacity: 0,
    y: 18,
    scale: 0.96,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

// ---------------------------------------------------------------------------
// Atmospheric Data Card
// ---------------------------------------------------------------------------
function DataCard({
  icon: Icon,
  label,
  value,
  unit,
  caption,
  variants = dataCardItemVariants,
  children,
}: {
  icon: typeof Wind;
  label: string;
  value: string;
  unit: string;
  caption: string;
  variants?: any;
  children?: ReactNode;
}) {
  return (
    <motion.div
      className={`data-card ${children ? 'has-custom-content' : ''}`}
      data-testid={`card-${label.toLowerCase().replace(/\s+/g, '-')}`}
      variants={variants}
      whileHover={{ y: -3, transition: { duration: 0.18 } }}
    >
      <div className="data-head">
        <span>{label}</span>
        <motion.div
          whileHover={{
            scale: 1.25,
            rotate:
              label === 'Wind'
                ? 30
                : label === 'UV index'
                ? 90
                : label === 'Precipitation'
                ? -16
                : 25,
            transition: { type: 'spring', stiffness: 450, damping: 15 },
          }}
          style={{ display: 'inline-flex' }}
        >
          <Icon />
        </motion.div>
      </div>
      <div className="data-value">
        {value}
        <span className="data-unit">{unit}</span>
      </div>
      <div className="data-caption">{caption}</div>
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Loading & Empty States
// ---------------------------------------------------------------------------
function LoadingState() {
  return (
    <div className="loading-grid" aria-label="Loading weather">
      <div>
        <div className="skeleton loading-hero" />
        <div className="data-grid">
          <div className="skeleton loading-row" />
          <div className="skeleton loading-row" />
        </div>
      </div>
      <div className="skeleton loading-side" />
    </div>
  );
}

function EmptyState({ onSearch }: { onSearch: () => void }) {
  return (
    <div className="permission-card">
      <Globe2 />
      <h2>Choose a place to begin.</h2>
      <p>Search for a city above or use your location. Atmos will turn the live sky into a calm, useful read.</p>
      <button data-testid="button-empty-search" onClick={onSearch}>
        Search for a city
      </button>
    </div>
  );
}

function PermissionState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="atmos-app">
      <div className="permission-card">
        <LocateFixed />
        <h2>Location access is off.</h2>
        <p>
          Atmos needs your location to show local conditions. You can enable it in your browser settings, then
          try again.
        </p>
        <button data-testid="button-retry-location" onClick={onRetry}>
          Try location again
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App Router & Entry point
// ---------------------------------------------------------------------------
function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useWouterLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
