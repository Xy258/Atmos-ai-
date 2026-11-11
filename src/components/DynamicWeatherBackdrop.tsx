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
      {/* 1. Base Atmospheric Cross-Fade Gradient */}
      <AnimatePresence initial={false}>
        <motion.div
          key={`backdrop-gradient-${category}-${isDay ? 'day' : 'night'}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.4, ease: [0.4, 0, 0.2, 1] }}
          className="absolute inset-0 w-full h-full"
          style={backgroundStyle}
        />
      </AnimatePresence>

      {/* 2. Static / Animated Atmospheric Visual Elements */}

      {/* Night Sky: Twinkling Stars & Subtle Aurora */}
      {!isDay && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Constellation Star Layer */}
          <svg className="absolute inset-0 w-full h-full opacity-60" xmlns="http://www.w3.org/2000/svg">
            <g fill="#ffffff">
              <circle cx="12%" cy="14%" r="1.2" className="animate-pulse" style={{ animationDuration: '3.2s' }} />
              <circle cx="28%" cy="8%" r="1" className="animate-pulse" style={{ animationDuration: '4.5s', animationDelay: '1s' }} />
              <circle cx="45%" cy="22%" r="1.4" className="animate-pulse" style={{ animationDuration: '2.8s', animationDelay: '0.4s' }} />
              <circle cx="68%" cy="12%" r="1.1" className="animate-pulse" style={{ animationDuration: '3.9s', animationDelay: '1.8s' }} />
              <circle cx="82%" cy="18%" r="1.5" className="animate-pulse" style={{ animationDuration: '3.1s', animationDelay: '0.7s' }} />
              <circle cx="91%" cy="29%" r="1" className="animate-pulse" style={{ animationDuration: '5.0s', animationDelay: '2.2s' }} />
              <circle cx="18%" cy="38%" r="1" className="animate-pulse" style={{ animationDuration: '4.1s', animationDelay: '1.2s' }} />
              <circle cx="34%" cy="48%" r="1.3" className="animate-pulse" style={{ animationDuration: '3.6s', animationDelay: '2.5s' }} />
              <circle cx="74%" cy="42%" r="1" className="animate-pulse" style={{ animationDuration: '4.8s', animationDelay: '0.9s' }} />
              <circle cx="88%" cy="56%" r="1.2" className="animate-pulse" style={{ animationDuration: '3.4s', animationDelay: '1.5s' }} />
              <circle cx="15%" cy="72%" r="0.9" className="animate-pulse" style={{ animationDuration: '4.2s', animationDelay: '0.3s' }} />
              <circle cx="58%" cy="68%" r="1.4" className="animate-pulse" style={{ animationDuration: '3.8s', animationDelay: '1.7s' }} />
            </g>
          </svg>

          {/* Gentle Lunar Corona Glow */}
          <div
            className="absolute top-[8%] right-[15%] w-72 h-72 rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(199, 210, 254, 0.16) 0%, rgba(99, 102, 241, 0.06) 40%, transparent 70%)',
              filter: 'blur(24px)',
            }}
          />
        </div>
      )}

      {/* Daytime Sun Corona Flare */}
      {isDay && (category === 'sunny' || category === 'partly-cloudy') && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute -top-16 -right-16 w-96 h-96 rounded-full pointer-events-none opacity-80"
            style={{
              background: 'radial-gradient(circle, rgba(254, 240, 138, 0.45) 0%, rgba(251, 191, 36, 0.22) 35%, rgba(56, 189, 248, 0.08) 65%, transparent 80%)',
              filter: 'blur(32px)',
            }}
          />
          {/* Subtle slow rotating sunray dispersion */}
          <div
            className="absolute -top-32 -right-32 w-[600px] h-[600px] opacity-20 pointer-events-none"
            style={{
              background: 'conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(255, 255, 255, 0.4) 20deg, transparent 40deg, rgba(255, 255, 255, 0.3) 80deg, transparent 100deg, rgba(255, 255, 255, 0.4) 140deg, transparent 160deg, rgba(255, 255, 255, 0.3) 220deg, transparent 240deg, rgba(255, 255, 255, 0.4) 300deg, transparent 320deg)',
              animation: 'spin 180s linear infinite',
            }}
          />
        </div>
      )}

      {/* Floating Cloud Mist Layer for Cloudy, Partly-Cloudy, or Rainy conditions */}
      {(category === 'cloudy' || category === 'partly-cloudy' || category === 'rain' || category === 'fog') && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Primary Cloud Ribbon */}
          <div
            className="absolute top-1/4 -left-1/4 w-[150vw] h-64 opacity-30 pointer-events-none"
            style={{
              background: isDay
                ? 'radial-gradient(ellipse at 50% 50%, rgba(255, 255, 255, 0.6) 0%, rgba(224, 242, 254, 0.3) 45%, transparent 75%)'
                : 'radial-gradient(ellipse at 50% 50%, rgba(148, 163, 184, 0.2) 0%, rgba(30, 41, 59, 0.1) 45%, transparent 75%)',
              filter: 'blur(36px)',
              animation: 'floatCloud 48s ease-in-out infinite',
            }}
          />
          {/* Secondary Low Mist Ribbon */}
          <div
            className="absolute bottom-1/4 -right-1/4 w-[140vw] h-72 opacity-25 pointer-events-none"
            style={{
              background: isDay
                ? 'radial-gradient(ellipse at 50% 50%, rgba(240, 249, 255, 0.7) 0%, rgba(186, 230, 253, 0.25) 50%, transparent 80%)'
                : 'radial-gradient(ellipse at 50% 50%, rgba(51, 65, 85, 0.3) 0%, rgba(15, 23, 42, 0.15) 50%, transparent 80%)',
              filter: 'blur(42px)',
              animation: 'floatCloud 62s ease-in-out infinite reverse',
            }}
          />
        </div>
      )}

      {/* Ambient Rain Streaks for Rainy / Thunderstorm weather */}
      {(category === 'rain' || category === 'thunderstorm') && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-35">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="rainPattern" width="60" height="90" patternUnits="userSpaceOnUse" patternTransform="rotate(-15)">
                <line x1="10" y1="0" x2="10" y2="28" stroke="#38bdf8" strokeWidth="1.2" strokeOpacity="0.45" strokeLinecap="round" />
                <line x1="38" y1="35" x2="38" y2="65" stroke="#7dd3fc" strokeWidth="1.0" strokeOpacity="0.35" strokeLinecap="round" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#rainPattern)" />
          </svg>
        </div>
      )}

      {/* Ethereal Atmospheric Isobar Horizon Curve */}
      <div className="absolute bottom-0 left-0 right-0 h-48 pointer-events-none opacity-20">
        <svg viewBox="0 0 1440 220" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full" preserveAspectRatio="none">
          <path
            d="M0 120 C 320 80, 540 160, 820 100 C 1100 40, 1280 130, 1440 90 L 1440 220 L 0 220 Z"
            fill={isDay ? 'rgba(255, 255, 255, 0.25)' : 'rgba(56, 189, 248, 0.08)'}
          />
          <path
            d="M0 160 C 260 120, 600 200, 940 140 C 1220 90, 1360 160, 1440 130 L 1440 220 L 0 220 Z"
            fill={isDay ? 'rgba(255, 255, 255, 0.35)' : 'rgba(30, 41, 59, 0.2)'}
          />
        </svg>
      </div>

      {/* Gentle liquid vignette for contrast and depth */}
      <div className="absolute inset-0 bg-radial-gradient from-transparent via-transparent to-black/20 pointer-events-none z-[1]" />
    </div>
  );
}

export default DynamicWeatherBackdrop;
