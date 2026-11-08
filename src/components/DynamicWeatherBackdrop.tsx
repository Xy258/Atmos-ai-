import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface DynamicWeatherBackdropProps {
  weatherCode: number;
  isDay?: boolean;
  windSpeed?: number;
  windDirection?: number;
  cloudCover?: number;
}

type WeatherCategory = 'sunny' | 'clear-night' | 'partly-cloudy' | 'cloudy' | 'rain' | 'thunderstorm' | 'snow' | 'fog';

function getWeatherCategory(code: number, isDay = true): WeatherCategory {
  if (code === 0) {
    return isDay ? 'sunny' : 'clear-night';
  }
  if (code === 1 || code === 2) {
    return 'partly-cloudy';
  }
  if (code === 3) {
    return 'cloudy';
  }
  if (code === 45 || code === 48) {
    return 'fog';
  }
  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return 'snow';
  }
  if ([95, 96, 99].includes(code)) {
    return 'thunderstorm';
  }
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return 'rain';
  }
  return isDay ? 'sunny' : 'clear-night';
}

export function DynamicWeatherBackdrop({
  weatherCode,
  isDay = true,
}: DynamicWeatherBackdropProps) {
  const category = useMemo(() => getWeatherCategory(weatherCode, isDay), [weatherCode, isDay]);

  // Serene, high-fidelity liquid atmosphere gradients (optimized for day/night mode & liquid glass contrast)
  const backgroundStyle = useMemo(() => {
    switch (category) {
      case 'sunny':
        return {
          background: isDay
            ? `
              radial-gradient(circle at 85% 15%, rgba(254, 240, 138, 0.65) 0%, rgba(253, 224, 71, 0.3) 24%, transparent 60%),
              radial-gradient(circle at 20% 75%, rgba(186, 230, 253, 0.5) 0%, transparent 50%),
              linear-gradient(160deg, #dbeafe 0%, #bfdbfe 30%, #93c5fd 65%, #60a5fa 100%)
            `
            : `
              radial-gradient(circle at 80% 18%, rgba(199, 210, 254, 0.22) 0%, rgba(99, 102, 241, 0.12) 36%, transparent 68%),
              radial-gradient(circle at 20% 82%, rgba(56, 189, 248, 0.08) 0%, transparent 52%),
              linear-gradient(160deg, #020617 0%, #0b1329 45%, #050811 100%)
            `,
        };
      case 'clear-night':
        return {
          background: `
            radial-gradient(circle at 80% 18%, rgba(199, 210, 254, 0.22) 0%, rgba(99, 102, 241, 0.12) 36%, transparent 68%),
            radial-gradient(circle at 20% 82%, rgba(56, 189, 248, 0.08) 0%, transparent 52%),
            linear-gradient(160deg, #020617 0%, #0b1329 45%, #050811 100%)
          `,
        };
      case 'partly-cloudy':
        return {
          background: isDay
            ? `
              radial-gradient(circle at 84% 14%, rgba(253, 224, 71, 0.55) 0%, rgba(245, 158, 11, 0.2) 28%, transparent 58%),
              radial-gradient(circle at 22% 48%, rgba(255, 255, 255, 0.5) 0%, transparent 48%),
              linear-gradient(160deg, #e0f2fe 0%, #bae6fd 35%, #7dd3fc 70%, #38bdf8 100%)
            `
            : `
              radial-gradient(circle at 80% 18%, rgba(165, 180, 252, 0.2) 0%, rgba(99, 102, 241, 0.1) 32%, transparent 62%),
              linear-gradient(160deg, #090d16 0%, #172554 45%, #050811 100%)
            `,
        };
      case 'cloudy':
        return {
          background: isDay
            ? `
              radial-gradient(circle at 50% 20%, rgba(255, 255, 255, 0.7) 0%, transparent 60%),
              linear-gradient(160deg, #f1f5f9 0%, #e2e8f0 40%, #cbd5e1 80%, #94a3b8 100%)
            `
            : `
              radial-gradient(circle at 50% 18%, rgba(148, 163, 184, 0.15) 0%, transparent 58%),
              linear-gradient(160deg, #090d16 0%, #1e293b 50%, #030712 100%)
            `,
        };
      case 'rain':
        return {
          background: isDay
            ? `
              radial-gradient(circle at 75% 22%, rgba(186, 230, 253, 0.45) 0%, transparent 65%),
              linear-gradient(160deg, #cbd5e1 0%, #94a3b8 45%, #64748b 100%)
            `
            : `
              radial-gradient(circle at 75% 22%, rgba(56, 189, 248, 0.16) 0%, rgba(14, 116, 144, 0.1) 35%, transparent 65%),
              linear-gradient(160deg, #031e33 0%, #071929 50%, #020617 100%)
            `,
        };
      case 'thunderstorm':
        return {
          background: isDay
            ? `
              radial-gradient(circle at 62% 22%, rgba(192, 132, 252, 0.45) 0%, transparent 65%),
              linear-gradient(160deg, #64748b 0%, #475569 45%, #334155 100%)
            `
            : `
              radial-gradient(circle at 62% 22%, rgba(168, 85, 247, 0.3) 0%, rgba(99, 102, 241, 0.14) 35%, transparent 65%),
              linear-gradient(160deg, #1e1136 0%, #0f172a 50%, #05020c 100%)
            `,
        };
      case 'snow':
        return {
          background: isDay
            ? `
              radial-gradient(circle at 72% 18%, rgba(255, 255, 255, 0.8) 0%, transparent 60%),
              linear-gradient(160deg, #f0f9ff 0%, #e0f2fe 45%, #bae6fd 100%)
            `
            : `
              radial-gradient(circle at 72% 18%, rgba(186, 230, 253, 0.22) 0%, transparent 65%),
              linear-gradient(160deg, #0b1e36 0%, #06182c 50%, #020a14 100%)
            `,
        };
      case 'fog':
        return {
          background: isDay
            ? `
              radial-gradient(circle at 50% 38%, rgba(255, 255, 255, 0.7) 0%, transparent 60%),
              linear-gradient(160deg, #f8fafc 0%, #f1f5f9 45%, #e2e8f0 100%)
            `
            : `
              radial-gradient(circle at 50% 38%, rgba(226, 232, 240, 0.15) 0%, transparent 60%),
              linear-gradient(160deg, #1e293b 0%, #0f172a 50%, #090d16 100%)
            `,
        };
      default:
        return {
          background: isDay
            ? 'linear-gradient(160deg, #e0f2fe 0%, #bae6fd 50%, #7dd3fc 100%)'
            : 'linear-gradient(160deg, #030712 0%, #0f172a 100%)',
        };
    }
  }, [category, isDay]);

  return (
    <div
      className="fixed inset-0 w-full h-full pointer-events-none overflow-hidden select-none z-0"
      aria-hidden="true"
    >
      {/* Smooth cross-fade animation between Day / Night themes & atmospheric states without busy background particles */}
      <AnimatePresence initial={false}>
        <motion.div
          key={`backdrop-gradient-${category}-${isDay ? 'day' : 'night'}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
          className="absolute inset-0 w-full h-full"
          style={backgroundStyle}
        />
      </AnimatePresence>

      {/* Gentle liquid vignette for depth */}
      <div className="absolute inset-0 bg-radial-gradient from-transparent via-transparent to-black/30 pointer-events-none z-[1]" />
    </div>
  );
}

export default DynamicWeatherBackdrop;
