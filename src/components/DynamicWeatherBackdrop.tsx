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

  // Serene, high-fidelity liquid atmosphere gradients (optimized for day/night mode & liquid glass)
  const backgroundStyle = useMemo(() => {
    switch (category) {
      case 'sunny':
        return {
          background: `
            radial-gradient(circle at 82% 12%, rgba(254, 240, 138, 0.4) 0%, rgba(56, 189, 248, 0.2) 32%, transparent 70%),
            radial-gradient(circle at 18% 78%, rgba(251, 191, 36, 0.15) 0%, transparent 55%),
            linear-gradient(145deg, #0284c7 0%, #0369a1 42%, #0f172a 100%)
          `,
        };
      case 'clear-night':
        return {
          background: `
            radial-gradient(circle at 80% 18%, rgba(199, 210, 254, 0.24) 0%, rgba(99, 102, 241, 0.12) 36%, transparent 68%),
            radial-gradient(circle at 20% 82%, rgba(56, 189, 248, 0.08) 0%, transparent 52%),
            linear-gradient(145deg, #030712 0%, #090e1a 45%, #050811 100%)
          `,
        };
      case 'partly-cloudy':
        return {
          background: isDay
            ? `
              radial-gradient(circle at 84% 14%, rgba(253, 224, 71, 0.3) 0%, rgba(245, 158, 11, 0.12) 30%, transparent 62%),
              radial-gradient(circle at 22% 48%, rgba(224, 242, 254, 0.25) 0%, transparent 48%),
              linear-gradient(145deg, #0284c7 0%, #0d9488 42%, #0f172a 100%)
            `
            : `
              radial-gradient(circle at 80% 18%, rgba(165, 180, 252, 0.22) 0%, rgba(99, 102, 241, 0.1) 32%, transparent 62%),
              linear-gradient(145deg, #090d16 0%, #1e293b 45%, #0b0f19 100%)
            `,
        };
      case 'cloudy':
        return {
          background: isDay
            ? `
              radial-gradient(circle at 50% 18%, rgba(226, 232, 240, 0.25) 0%, transparent 58%),
              linear-gradient(145deg, #334155 0%, #1e293b 50%, #0f172a 100%)
            `
            : `
              radial-gradient(circle at 50% 18%, rgba(148, 163, 184, 0.15) 0%, transparent 58%),
              linear-gradient(145deg, #0f172a 0%, #1e293b 45%, #090d16 100%)
            `,
        };
      case 'rain':
        return {
          background: isDay
            ? `
              radial-gradient(circle at 75% 22%, rgba(56, 189, 248, 0.22) 0%, rgba(14, 116, 144, 0.15) 35%, transparent 65%),
              linear-gradient(145deg, #0c4a6e 0%, #0f2c4a 45%, #081a2e 100%)
            `
            : `
              radial-gradient(circle at 75% 22%, rgba(56, 189, 248, 0.16) 0%, rgba(14, 116, 144, 0.1) 35%, transparent 65%),
              linear-gradient(145deg, #06263b 0%, #091a2b 45%, #040c14 100%)
            `,
        };
      case 'thunderstorm':
        return {
          background: `
            radial-gradient(circle at 62% 22%, rgba(168, 85, 247, 0.28) 0%, rgba(99, 102, 241, 0.14) 35%, transparent 65%),
            linear-gradient(145deg, #1e1136 0%, #0f172a 50%, #090514 100%)
          `,
        };
      case 'snow':
        return {
          background: `
            radial-gradient(circle at 72% 18%, rgba(186, 230, 253, 0.32) 0%, rgba(56, 189, 248, 0.12) 35%, transparent 65%),
            linear-gradient(145deg, #075985 0%, #164e63 45%, #082f49 100%)
          `,
        };
      case 'fog':
        return {
          background: `
            radial-gradient(circle at 50% 38%, rgba(226, 232, 240, 0.22) 0%, transparent 60%),
            linear-gradient(145deg, #475569 0%, #334155 45%, #1e293b 100%)
          `,
        };
      default:
        return {
          background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 100%)',
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
