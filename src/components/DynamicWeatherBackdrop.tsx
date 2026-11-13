import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface DynamicWeatherBackdropProps {
  weatherCode: number;
  isDay?: boolean;
  windSpeed?: number;
  windDirection?: number;
  cloudCover?: number;
}

type WeatherCategory =
  | 'sunny'
  | 'clear-night'
  | 'partly-cloudy'
  | 'cloudy'
  | 'drizzle'
  | 'rain'
  | 'sleet'
  | 'thunderstorm'
  | 'snow'
  | 'fog';

function getWeatherCategory(code: number, isDay = true): WeatherCategory {
  if (code === 0) return isDay ? 'sunny' : 'clear-night';
  if (code === 1 || code === 2) return 'partly-cloudy';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if ([56, 57, 66, 67].includes(code)) return 'sleet';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ([95, 96, 99].includes(code)) return 'thunderstorm';
  if ([51, 53, 55].includes(code)) return 'drizzle';
  if ([61, 63, 65, 80, 81, 82].includes(code)) return 'rain';
  return isDay ? 'sunny' : 'clear-night';
}

interface BgParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  wobble: number;
  wobbleSpeed: number;
  color: string;
}

export function DynamicWeatherBackdrop({
  weatherCode,
  isDay = true,
  windSpeed = 12,
  windDirection = 180,
  cloudCover = 20,
}: DynamicWeatherBackdropProps) {
  const category = useMemo(() => getWeatherCategory(weatherCode, isDay), [weatherCode, isDay]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ambientFlash, setAmbientFlash] = useState(false);

  // Subtle distant sheet-lightning ambient pulse in full-screen background for thunderstorms
  useEffect(() => {
    if (category !== 'thunderstorm') {
      setAmbientFlash(false);
      return;
    }
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;

    let timer = 0;
    const subTimers: number[] = [];
    const pulse = () => {
      setAmbientFlash(true);
      subTimers.push(window.setTimeout(() => setAmbientFlash(false), 110));
      timer = window.setTimeout(pulse, 4200 + Math.random() * 5200);
    };
    timer = window.setTimeout(pulse, 2600);
    return () => {
      window.clearTimeout(timer);
      subTimers.forEach((id) => window.clearTimeout(id));
    };
  }, [category]);

  // Serene, high-contrast full-viewport atmospheric gradient palettes (Day & Night)
  const backgroundStyle = useMemo(() => {
    switch (category) {
      case 'sunny':
        return {
          background: isDay
            ? `
              radial-gradient(circle at 85% 15%, rgba(254, 240, 138, 0.65) 0%, rgba(253, 224, 71, 0.28) 24%, transparent 60%),
              radial-gradient(circle at 18% 76%, rgba(186, 230, 253, 0.5) 0%, transparent 52%),
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
          background: isDay
            ? `
              radial-gradient(circle at 82% 16%, rgba(191, 219, 254, 0.5) 0%, transparent 55%),
              linear-gradient(160deg, #e0f2fe 0%, #bfdbfe 50%, #93c5fd 100%)
            `
            : `
              radial-gradient(circle at 80% 18%, rgba(199, 210, 254, 0.24) 0%, rgba(99, 102, 241, 0.12) 36%, transparent 68%),
              radial-gradient(circle at 20% 82%, rgba(56, 189, 248, 0.09) 0%, transparent 52%),
              linear-gradient(160deg, #020617 0%, #0b1329 45%, #050811 100%)
            `,
        };
      case 'partly-cloudy':
        return {
          background: isDay
            ? `
              radial-gradient(circle at 84% 14%, rgba(253, 224, 71, 0.55) 0%, rgba(245, 158, 11, 0.2) 28%, transparent 58%),
              radial-gradient(circle at 22% 48%, rgba(255, 255, 255, 0.52) 0%, transparent 48%),
              linear-gradient(160deg, #e0f2fe 0%, #bae6fd 35%, #7dd3fc 70%, #38bdf8 100%)
            `
            : `
              radial-gradient(circle at 80% 18%, rgba(165, 180, 252, 0.22) 0%, rgba(99, 102, 241, 0.11) 34%, transparent 62%),
              linear-gradient(160deg, #090d16 0%, #172554 45%, #050811 100%)
            `,
        };
      case 'cloudy':
        return {
          background: isDay
            ? `
              radial-gradient(circle at 50% 20%, rgba(255, 255, 255, 0.72) 0%, transparent 60%),
              linear-gradient(160deg, #f1f5f9 0%, #e2e8f0 40%, #cbd5e1 80%, #94a3b8 100%)
            `
            : `
              radial-gradient(circle at 50% 18%, rgba(148, 163, 184, 0.18) 0%, transparent 58%),
              linear-gradient(160deg, #090d16 0%, #1e293b 50%, #030712 100%)
            `,
        };
      case 'drizzle':
        return {
          background: isDay
            ? `
              radial-gradient(circle at 75% 20%, rgba(153, 246, 228, 0.35) 0%, transparent 62%),
              linear-gradient(160deg, #cbd5e1 0%, #94a3b8 50%, #64748b 100%)
            `
            : `
              radial-gradient(circle at 75% 20%, rgba(45, 212, 191, 0.14) 0%, rgba(14, 116, 144, 0.1) 40%, transparent 68%),
              linear-gradient(160deg, #04202e 0%, #0a1f2e 52%, #020617 100%)
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
              radial-gradient(circle at 75% 22%, rgba(56, 189, 248, 0.18) 0%, rgba(14, 116, 144, 0.12) 35%, transparent 65%),
              linear-gradient(160deg, #031e33 0%, #071929 50%, #020617 100%)
            `,
        };
      case 'sleet':
        return {
          background: isDay
            ? `
              radial-gradient(circle at 70% 18%, rgba(224, 242, 254, 0.55) 0%, transparent 62%),
              linear-gradient(160deg, #e2e8f0 0%, #bae6fd 45%, #7dd3fc 100%)
            `
            : `
              radial-gradient(circle at 70% 18%, rgba(125, 211, 252, 0.2) 0%, transparent 62%),
              linear-gradient(160deg, #0a1d31 0%, #102a43 50%, #020814 100%)
            `,
        };
      case 'thunderstorm':
        return {
          background: isDay
            ? `
              radial-gradient(circle at 62% 22%, rgba(192, 132, 252, 0.42) 0%, transparent 65%),
              linear-gradient(160deg, #64748b 0%, #475569 45%, #334155 100%)
            `
            : `
              radial-gradient(circle at 62% 22%, rgba(168, 85, 247, 0.32) 0%, rgba(99, 102, 241, 0.15) 35%, transparent 65%),
              linear-gradient(160deg, #1e1136 0%, #0f172a 50%, #05020c 100%)
            `,
        };
      case 'snow':
        return {
          background: isDay
            ? `
              radial-gradient(circle at 72% 18%, rgba(255, 255, 255, 0.85) 0%, transparent 60%),
              linear-gradient(160deg, #f0f9ff 0%, #e0f2fe 45%, #bae6fd 100%)
            `
            : `
              radial-gradient(circle at 72% 18%, rgba(186, 230, 253, 0.24) 0%, transparent 65%),
              linear-gradient(160deg, #0b1e36 0%, #06182c 50%, #020a14 100%)
            `,
        };
      case 'fog':
        return {
          background: isDay
            ? `
              radial-gradient(circle at 50% 38%, rgba(255, 255, 255, 0.72) 0%, transparent 60%),
              linear-gradient(160deg, #f8fafc 0%, #f1f5f9 45%, #e2e8f0 100%)
            `
            : `
              radial-gradient(circle at 50% 38%, rgba(226, 232, 240, 0.16) 0%, transparent 60%),
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

  // Dynamic ambient full-viewport weather particle canvas (rain streaks, snow flurries, sun motes, sleet)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let animId = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    let width = window.innerWidth;
    let height = window.innerHeight;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const windRad = (windDirection * Math.PI) / 180;
    const windSign = Math.sin(windRad) >= 0 ? 1 : -1;
    const slant = windSign * Math.min(2.6, Math.max(0.35, windSpeed / 16));

    const isRainLike =
      category === 'drizzle' ||
      category === 'rain' ||
      category === 'sleet' ||
      category === 'thunderstorm';

    const count =
      category === 'thunderstorm'
        ? 46
        : category === 'rain'
        ? 38
        : category === 'sleet'
        ? 36
        : category === 'drizzle'
        ? 26
        : category === 'snow'
        ? 34
        : category === 'sunny'
        ? 14
        : 0;

    const particles: BgParticle[] = [];
    for (let i = 0; i < count; i++) {
      if (isRainLike) {
        const isSleetPellet = category === 'sleet' && i % 3 === 0;
        particles.push({
          x: Math.random() * (width + 120) - 60,
          y: Math.random() * height,
          vx: slant * (isSleetPellet ? 0.9 : 1.1),
          vy:
            category === 'drizzle'
              ? 5.2 + Math.random() * 2.5
              : category === 'thunderstorm'
              ? 10.5 + Math.random() * 5.5
              : 7.8 + Math.random() * 4.5,
          size: isSleetPellet ? 1.8 + Math.random() * 1.4 : (category === 'drizzle' ? 11 : 18) + Math.random() * 16,
          alpha: isDay ? 0.18 + Math.random() * 0.18 : 0.16 + Math.random() * 0.22,
          wobble: 0,
          wobbleSpeed: 0,
          color:
            category === 'thunderstorm'
              ? isDay ? '#6d28d9' : '#c4b5fd'
              : category === 'drizzle'
              ? isDay ? '#0284c7' : '#5eead4'
              : isDay ? '#0369a1' : '#7dd3fc',
        });
      } else if (category === 'snow') {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: slant * 0.35 + (Math.random() - 0.5) * 0.35,
          vy: 0.7 + Math.random() * 1.2,
          size: 1.5 + Math.random() * 2.6,
          alpha: isDay ? 0.4 + Math.random() * 0.35 : 0.28 + Math.random() * 0.4,
          wobble: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.015 + Math.random() * 0.02,
          color: isDay ? '#ffffff' : '#e0f2fe',
        });
      } else if (category === 'sunny') {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.25,
          vy: -0.18 - Math.random() * 0.28,
          size: 2 + Math.random() * 3,
          alpha: isDay ? 0.22 + Math.random() * 0.22 : 0.12 + Math.random() * 0.18,
          wobble: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.015,
          color: isDay ? '#fef08a' : '#a5b4fc',
        });
      }
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      if (particles.length === 0) return;

      for (const p of particles) {
        if (isRainLike) {
          if (!reducedMotion) {
            p.x += p.vx;
            p.y += p.vy;
            if (p.y > height + 20) {
              p.y = -24;
              p.x = Math.random() * (width + 120) - 60;
            }
            if (p.x > width + 60) p.x = -40;
            if (p.x < -60) p.x = width + 40;
          }
          if (p.size < 4) {
            ctx.beginPath();
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.alpha;
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.strokeStyle = p.color;
            ctx.globalAlpha = p.alpha;
            ctx.lineWidth = 1.1;
            ctx.lineCap = 'round';
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x + p.vx * 1.4, p.y + p.size);
            ctx.stroke();
          }
        } else if (category === 'snow') {
          if (!reducedMotion) {
            p.wobble += p.wobbleSpeed;
            p.x += p.vx + Math.sin(p.wobble) * 0.45;
            p.y += p.vy;
            if (p.y > height + 8) {
              p.y = -8;
              p.x = Math.random() * width;
            }
          }
          ctx.beginPath();
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha;
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else {
          if (!reducedMotion) {
            p.wobble += p.wobbleSpeed;
            p.x += p.vx + Math.sin(p.wobble) * 0.2;
            p.y += p.vy;
            if (p.y < -10) {
              p.y = height + 10;
              p.x = Math.random() * width;
            }
          }
          ctx.beginPath();
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha;
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1;
      if (!reducedMotion) {
        animId = requestAnimationFrame(draw);
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(animId);
      } else if (!reducedMotion && particles.length > 0) {
        cancelAnimationFrame(animId);
        animId = requestAnimationFrame(draw);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    if (particles.length > 0) {
      if (reducedMotion) draw();
      else animId = requestAnimationFrame(draw);
    } else {
      ctx.clearRect(0, 0, width, height);
    }

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [category, isDay, windSpeed, windDirection]);

  // Wind-scaled cloud ribbon duration (faster in higher wind)
  const cloudDurationSec = Math.max(22, Math.round(56 - Math.min(30, windSpeed * 0.55)));
  const cloudIntensity = Math.max(0.18, Math.min(0.45, (cloudCover / 100) * 0.42));

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
          transition={{ duration: 1.3, ease: [0.4, 0, 0.2, 1] }}
          className="absolute inset-0 w-full h-full"
          style={backgroundStyle}
        />
      </AnimatePresence>

      {/* 2. Night Sky: Twinkling Stars, Aurora Band & Lunar Corona */}
      {!isDay && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <svg className="absolute inset-0 w-full h-full opacity-65" xmlns="http://www.w3.org/2000/svg">
            <g fill="#ffffff">
              <circle cx="10%" cy="12%" r="1.2" className="animate-pulse" style={{ animationDuration: '3.2s' }} />
              <circle cx="24%" cy="7%" r="1" className="animate-pulse" style={{ animationDuration: '4.5s', animationDelay: '1s' }} />
              <circle cx="42%" cy="20%" r="1.4" className="animate-pulse" style={{ animationDuration: '2.8s', animationDelay: '0.4s' }} />
              <circle cx="64%" cy="11%" r="1.1" className="animate-pulse" style={{ animationDuration: '3.9s', animationDelay: '1.8s' }} />
              <circle cx="81%" cy="17%" r="1.5" className="animate-pulse" style={{ animationDuration: '3.1s', animationDelay: '0.7s' }} />
              <circle cx="91%" cy="29%" r="1" className="animate-pulse" style={{ animationDuration: '5.0s', animationDelay: '2.2s' }} />
              <circle cx="17%" cy="38%" r="1" className="animate-pulse" style={{ animationDuration: '4.1s', animationDelay: '1.2s' }} />
              <circle cx="34%" cy="48%" r="1.3" className="animate-pulse" style={{ animationDuration: '3.6s', animationDelay: '2.5s' }} />
              <circle cx="74%" cy="42%" r="1" className="animate-pulse" style={{ animationDuration: '4.8s', animationDelay: '0.9s' }} />
              <circle cx="88%" cy="56%" r="1.2" className="animate-pulse" style={{ animationDuration: '3.4s', animationDelay: '1.5s' }} />
              <circle cx="15%" cy="72%" r="0.9" className="animate-pulse" style={{ animationDuration: '4.2s', animationDelay: '0.3s' }} />
              <circle cx="58%" cy="68%" r="1.4" className="animate-pulse" style={{ animationDuration: '3.8s', animationDelay: '1.7s' }} />
            </g>
          </svg>

          {(category === 'clear-night' || category === 'partly-cloudy') && (
            <div
              className="absolute top-[4%] left-[-10%] w-[120vw] h-52 opacity-40 pointer-events-none atmos-aurora-drift"
              style={{
                background:
                  'linear-gradient(100deg, transparent 10%, rgba(56, 189, 248, 0.14) 38%, rgba(168, 85, 247, 0.14) 68%, transparent 92%)',
                filter: 'blur(42px)',
              }}
            />
          )}

          <div
            className="absolute top-[8%] right-[15%] w-72 h-72 rounded-full pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgba(199, 210, 254, 0.18) 0%, rgba(99, 102, 241, 0.06) 40%, transparent 70%)',
              filter: 'blur(24px)',
            }}
          />
        </div>
      )}

      {/* 3. Daytime Sun Corona Flare & Rotating Sunrays */}
      {isDay && (category === 'sunny' || category === 'partly-cloudy') && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute -top-16 -right-16 w-96 h-96 rounded-full pointer-events-none opacity-80"
            style={{
              background:
                'radial-gradient(circle, rgba(254, 240, 138, 0.48) 0%, rgba(251, 191, 36, 0.22) 35%, rgba(56, 189, 248, 0.08) 65%, transparent 80%)',
              filter: 'blur(32px)',
            }}
          />
          <div
            className="absolute -top-32 -right-32 w-[620px] h-[620px] opacity-25 pointer-events-none atmos-sunray-spin"
            style={{
              background:
                'conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(255, 255, 255, 0.45) 20deg, transparent 40deg, rgba(254, 240, 138, 0.35) 80deg, transparent 105deg, rgba(255, 255, 255, 0.4) 140deg, transparent 165deg, rgba(254, 240, 138, 0.35) 220deg, transparent 245deg, rgba(255, 255, 255, 0.4) 300deg, transparent 325deg)',
            }}
          />
        </div>
      )}

      {/* 4. Wind-Driven Cloud / Fog / Storm Mist Ribbons */}
      {(category === 'cloudy' ||
        category === 'partly-cloudy' ||
        category === 'drizzle' ||
        category === 'rain' ||
        category === 'sleet' ||
        category === 'thunderstorm' ||
        category === 'fog') && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute top-[16%] -left-1/4 w-[150vw] h-64 pointer-events-none"
            style={{
              opacity: cloudIntensity,
              background: isDay
                ? 'radial-gradient(ellipse at 50% 50%, rgba(255, 255, 255, 0.65) 0%, rgba(224, 242, 254, 0.3) 45%, transparent 75%)'
                : 'radial-gradient(ellipse at 50% 50%, rgba(148, 163, 184, 0.22) 0%, rgba(30, 41, 59, 0.12) 45%, transparent 75%)',
              filter: 'blur(36px)',
              animation: `floatCloud ${cloudDurationSec}s ease-in-out infinite`,
            }}
          />
          <div
            className="absolute bottom-[18%] -right-1/4 w-[140vw] h-72 pointer-events-none"
            style={{
              opacity: Math.max(0.16, cloudIntensity * 0.85),
              background: isDay
                ? 'radial-gradient(ellipse at 50% 50%, rgba(240, 249, 255, 0.7) 0%, rgba(186, 230, 253, 0.25) 50%, transparent 80%)'
                : 'radial-gradient(ellipse at 50% 50%, rgba(51, 65, 85, 0.32) 0%, rgba(15, 23, 42, 0.15) 50%, transparent 80%)',
              filter: 'blur(42px)',
              animation: `floatCloud ${Math.round(cloudDurationSec * 1.25)}s ease-in-out infinite reverse`,
            }}
          />
        </div>
      )}

      {/* 5. Animated Full-Viewport Weather Particle Layer (Rain, Snow, Sleet, Sun Motes) */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block pointer-events-none" />

      {/* 6. Ambient Sheet-Lightning Illumination for Thunderstorm Background */}
      <AnimatePresence>
        {ambientFlash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.22 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="absolute inset-0 bg-violet-200/35 pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* 7. Ethereal Atmospheric Isobar Horizon Curve */}
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

      {/* 8. Gentle liquid vignette for foreground glass contrast */}
      <div className="absolute inset-0 bg-radial-gradient from-transparent via-transparent to-black/20 pointer-events-none z-[1]" />
    </div>
  );
}

export default DynamicWeatherBackdrop;
