import React, { useEffect, useRef, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface AtmosphericStateWeatherAnimationProps {
  weatherCode: number;
  isDay?: boolean;
  windSpeed?: number;
  windDirection?: number;
  cloudCover?: number;
  precipitation?: number;
  className?: string;
}

type WeatherAnimType =
  | 'sunny'
  | 'clear-night'
  | 'partly-cloudy-day'
  | 'partly-cloudy-night'
  | 'overcast'
  | 'fog'
  | 'rime-fog'
  | 'drizzle'
  | 'sleet'
  | 'rain'
  | 'heavy-rain'
  | 'snow'
  | 'heavy-snow'
  | 'thunderstorm'
  | 'hailstorm';

function getAnimType(code: number, isDay = true): WeatherAnimType {
  if (code === 96 || code === 99) return 'hailstorm';
  if (code === 95) return 'thunderstorm';
  if (code === 75 || code === 86) return 'heavy-snow';
  if ([71, 73, 77, 85].includes(code)) return 'snow';
  if ([56, 57, 66, 67].includes(code)) return 'sleet';
  if ([65, 82].includes(code)) return 'heavy-rain';
  if ([61, 63, 80, 81].includes(code)) return 'rain';
  if ([51, 53, 55].includes(code)) return 'drizzle';
  if (code === 48) return 'rime-fog';
  if (code === 45) return 'fog';
  if (code === 3) return 'overcast';
  if (code === 1 || code === 2) return isDay ? 'partly-cloudy-day' : 'partly-cloudy-night';
  return isDay ? 'sunny' : 'clear-night';
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  depth: number; // 0.45..1.25 parallax depth
  alpha: number;
  color: string;
  wobble: number;
  wobbleSpeed: number;
  kind?: 'drop' | 'hail' | 'flake' | 'star' | 'mote' | 'cloud' | 'mist' | 'wind';
}

interface SplashRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
}

interface LightningBolt {
  segments: Array<{ x1: number; y1: number; x2: number; y2: number; width: number }>;
  alpha: number;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  length: number;
  alpha: number;
}

function createLightningBolt(width: number, height: number): LightningBolt {
  const startX = width * (0.28 + Math.random() * 0.56);
  let curX = startX;
  let curY = 0;
  const segments: LightningBolt['segments'] = [];
  const steps = 6 + Math.floor(Math.random() * 4);
  const stepY = (height * 0.72) / steps;

  for (let i = 0; i < steps; i++) {
    const nextX = curX + (Math.random() - 0.48) * 34;
    const nextY = curY + stepY * (0.8 + Math.random() * 0.4);
    segments.push({ x1: curX, y1: curY, x2: nextX, y2: nextY, width: 2.2 - i * 0.16 });

    // Occasional secondary fork branch
    if (i > 0 && i < steps - 1 && Math.random() > 0.55) {
      let bx = nextX;
      let by = nextY;
      const dir = Math.random() > 0.5 ? 1 : -1;
      for (let b = 0; b < 3; b++) {
        const bnx = bx + dir * (10 + Math.random() * 18);
        const bny = by + stepY * 0.65;
        segments.push({ x1: bx, y1: by, x2: bnx, y2: bny, width: 1.0 - b * 0.25 });
        bx = bnx;
        by = bny;
      }
    }

    curX = nextX;
    curY = nextY;
  }

  return { segments, alpha: 1 };
}

export function AtmosphericStateWeatherAnimation({
  weatherCode,
  isDay = true,
  windSpeed = 12,
  windDirection = 210,
  cloudCover = 35,
  precipitation = 0,
  className = '',
}: AtmosphericStateWeatherAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animType = useMemo(() => getAnimType(weatherCode, isDay), [weatherCode, isDay]);
  const [lightningFlash, setLightningFlash] = useState(false);
  const lightningFlashRef = useRef(false);
  lightningFlashRef.current = lightningFlash;

  const isStorm = animType === 'thunderstorm' || animType === 'hailstorm';
  const isPrecip =
    animType === 'drizzle' ||
    animType === 'sleet' ||
    animType === 'rain' ||
    animType === 'heavy-rain' ||
    isStorm;
  const isSnow = animType === 'snow' || animType === 'heavy-snow';
  const isCloudy =
    animType === 'partly-cloudy-day' ||
    animType === 'partly-cloudy-night' ||
    animType === 'overcast' ||
    isPrecip;
  const isFoggy = animType === 'fog' || animType === 'rime-fog';
  const isNightSky = animType === 'clear-night' || animType === 'partly-cloudy-night';
  const isSunnyDay = animType === 'sunny' || animType === 'partly-cloudy-day';

  // Thunderstorm periodic lightning flash synchronized inside Atmospheric State card
  useEffect(() => {
    if (!isStorm) {
      setLightningFlash(false);
      return;
    }

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;

    let timer = 0;
    const subTimers: number[] = [];

    const trigger = () => {
      setLightningFlash(true);
      subTimers.push(window.setTimeout(() => setLightningFlash(false), 90));
      if (Math.random() > 0.4) {
        subTimers.push(
          window.setTimeout(() => {
            setLightningFlash(true);
            subTimers.push(window.setTimeout(() => setLightningFlash(false), 75));
          }, 145)
        );
      }
      timer = window.setTimeout(trigger, 3200 + Math.random() * 4800);
    };

    timer = window.setTimeout(trigger, 1800);
    return () => {
      window.clearTimeout(timer);
      subTimers.forEach((id) => window.clearTimeout(id));
    };
  }, [isStorm]);

  // Multi-condition Canvas Particle & Atmospheric Physics Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let animId = 0;
    let width = container.clientWidth || 440;
    let height = container.clientHeight || 320;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const syncCanvasSize = () => {
      width = Math.max(200, container.clientWidth || 440);
      height = Math.max(180, container.clientHeight || 320);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    syncCanvasSize();

    const resizeObserver = new ResizeObserver(syncCanvasSize);
    resizeObserver.observe(container);

    // Wind vector influence
    const windRad = (windDirection * Math.PI) / 180;
    const windDirSign = Math.sin(windRad) >= 0 ? 1 : -1;
    const windStrength = Math.min(3.4, Math.max(0.25, windSpeed / 14));
    const windSlant = windDirSign * windStrength * 0.95;

    const particles: Particle[] = [];
    const splashes: SplashRipple[] = [];
    const bolts: LightningBolt[] = [];
    let shootingStar: ShootingStar | null = null;
    let frameCount = 0;

    // 1. Precipitation (Drizzle / Rain / Heavy Rain / Sleet / Thunderstorm / Hail)
    if (isPrecip) {
      const precipBoost = Math.min(14, Math.round(precipitation * 1.5));
      const dropCount =
        animType === 'hailstorm' || animType === 'thunderstorm'
          ? 44 + precipBoost
          : animType === 'heavy-rain'
          ? 40 + precipBoost
          : animType === 'rain' || animType === 'sleet'
          ? 28 + Math.round(precipBoost * 0.6)
          : 20;

      for (let i = 0; i < dropCount; i++) {
        const depth = 0.5 + Math.random() * 0.8;
        const isHail =
          (animType === 'hailstorm' && i % 4 === 0) ||
          (animType === 'sleet' && i % 3 === 0);

        if (isHail) {
          particles.push({
            x: Math.random() * (width + 80) - 40,
            y: Math.random() * height,
            vx: windSlant * 1.15 + (Math.random() - 0.5) * 0.7,
            vy: (7.5 + Math.random() * 4.5) * depth,
            size: animType === 'hailstorm' ? 2.4 + Math.random() * 2.2 : 1.7 + Math.random() * 1.4,
            depth,
            alpha: 0.6 + Math.random() * 0.35,
            color: animType === 'hailstorm' ? '#f8fafc' : '#bae6fd',
            wobble: Math.random() * Math.PI * 2,
            wobbleSpeed: 0.04,
            kind: 'hail',
          });
        } else {
          const baseSpeed =
            animType === 'drizzle'
              ? 4.8 + Math.random() * 2.8
              : animType === 'heavy-rain' || isStorm
              ? 10.5 + Math.random() * 6.5
              : 8.0 + Math.random() * 4.5;

          const baseLen =
            animType === 'drizzle'
              ? 8 + Math.random() * 7
              : animType === 'heavy-rain' || isStorm
              ? 18 + Math.random() * 16
              : 13 + Math.random() * 12;

          particles.push({
            x: Math.random() * (width + 80) - 40,
            y: Math.random() * height,
            vx: (windSlant + (Math.random() - 0.5) * 0.35) * depth,
            vy: baseSpeed * depth,
            size: baseLen * depth,
            depth,
            alpha: (animType === 'drizzle' ? 0.22 : 0.32) + Math.random() * 0.32 * depth,
            color: isStorm ? '#ddd6fe' : animType === 'sleet' ? '#bae6fd' : '#7dd3fc',
            wobble: 0,
            wobbleSpeed: 0,
            kind: 'drop',
          });
        }
      }
    }

    // 2. Snow & Heavy Snow
    if (isSnow) {
      const flakeCount = animType === 'heavy-snow' ? 42 : 26;
      for (let i = 0; i < flakeCount; i++) {
        const depth = 0.45 + Math.random() * 0.85;
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: windSlant * 0.55 * depth + (Math.random() - 0.5) * 0.5,
          vy: (animType === 'heavy-snow' ? 1.55 : 0.95 + Math.random() * 1.15) * depth,
          size: (1.5 + Math.random() * 2.8) * depth,
          depth,
          alpha: 0.35 + Math.random() * 0.5 * depth,
          color: i % 5 === 0 ? '#bae6fd' : '#ffffff',
          wobble: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.018 + Math.random() * 0.025,
          kind: 'flake',
        });
      }
    }

    // 3. Stars (Clear Night & Partly Cloudy Night)
    if (isNightSky) {
      const starCount = animType === 'clear-night' ? 28 : 16;
      for (let i = 0; i < starCount; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height * 0.82,
          vx: 0,
          vy: 0,
          size: 0.7 + Math.random() * 1.7,
          depth: 1,
          alpha: 0.25 + Math.random() * 0.65,
          color: i % 3 === 0 ? '#c7d2fe' : i % 5 === 0 ? '#fef08a' : '#ffffff',
          wobble: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.022 + Math.random() * 0.032,
          kind: 'star',
        });
      }
    }

    // 4. Sunlit Motes (Clear Day & Partly Cloudy Day)
    if (isSunnyDay) {
      const moteCount = animType === 'sunny' ? 14 : 9;
      for (let i = 0; i < moteCount; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.3 + windSlant * 0.08,
          vy: -0.22 - Math.random() * 0.36,
          size: 1.6 + Math.random() * 3.0,
          depth: 1,
          alpha: 0.16 + Math.random() * 0.32,
          color: i % 2 === 0 ? '#fde047' : '#fef9c3',
          wobble: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.018 + Math.random() * 0.015,
          kind: 'mote',
        });
      }
    }

    // 5. Volumetric Drifting Clouds
    if (isCloudy) {
      const cloudCount =
        animType === 'overcast'
          ? 9
          : isStorm
          ? 8
          : animType === 'partly-cloudy-day' || animType === 'partly-cloudy-night'
          ? Math.max(4, Math.round((cloudCover / 100) * 6))
          : 5;

      for (let i = 0; i < cloudCount; i++) {
        const depth = 0.6 + (i / cloudCount) * 0.65;
        particles.push({
          x: (i / cloudCount) * (width + 140) - 70,
          y: 16 + Math.random() * (height * 0.48),
          vx: (0.16 + Math.random() * 0.28) * Math.max(0.7, windSpeed / 18) * depth,
          vy: (Math.random() - 0.5) * 0.04,
          size: (56 + Math.random() * 58) * depth,
          depth,
          alpha: isStorm
            ? 0.08 + Math.random() * 0.07
            : animType === 'overcast'
            ? 0.08 + Math.random() * 0.08
            : 0.05 + Math.random() * 0.07,
          color: isStorm ? '#c4b5fd' : isDay ? '#ffffff' : '#94a3b8',
          wobble: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.008,
          kind: 'cloud',
        });
      }
    }

    // 6. Layered Fog / Rime Mist Ribbons
    if (isFoggy) {
      const mistCount = 10;
      for (let i = 0; i < mistCount; i++) {
        particles.push({
          x: Math.random() * width,
          y: (i / mistCount) * height * 0.92 + 10,
          vx: (0.28 + Math.random() * 0.35) * (i % 2 === 0 ? 1 : -0.6),
          vy: 0,
          size: 70 + Math.random() * 70,
          depth: 1,
          alpha: 0.07 + Math.random() * 0.08,
          color: animType === 'rime-fog' ? '#e0f2fe' : '#f1f5f9',
          wobble: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.012,
          kind: 'mist',
        });
      }
      if (animType === 'rime-fog') {
        for (let i = 0; i < 16; i++) {
          particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: 0.12 + Math.random() * 0.15,
            vy: (Math.random() - 0.5) * 0.12,
            size: 1.0 + Math.random() * 1.4,
            depth: 1,
            alpha: 0.25 + Math.random() * 0.45,
            color: '#e0f2fe',
            wobble: Math.random() * Math.PI * 2,
            wobbleSpeed: 0.03,
            kind: 'star',
          });
        }
      }
    }

    // 7. Ambient Wind Streaks when breezy (>= 22 km/h)
    if (windSpeed >= 22) {
      const windLines = Math.min(8, Math.floor((windSpeed - 16) / 6) + 2);
      for (let i = 0; i < windLines; i++) {
        particles.push({
          x: Math.random() * width,
          y: 25 + Math.random() * (height - 50),
          vx: windDirSign * (2.6 + Math.random() * 2.2) * Math.min(2.2, windSpeed / 24),
          vy: (Math.random() - 0.5) * 0.2,
          size: 36 + Math.random() * 44,
          depth: 1,
          alpha: 0.08 + Math.random() * 0.1,
          color: '#ffffff',
          wobble: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.05,
          kind: 'wind',
        });
      }
    }

    const render = () => {
      frameCount++;
      ctx.clearRect(0, 0, width, height);

      // Subtle lightning bolt spawn inside canvas synchronized with storm cadence
      if (isStorm && !reducedMotion && lightningFlashRef.current && bolts.length === 0) {
        bolts.push(createLightningBolt(width, height));
      }

      // Rare shooting star on clear night
      if (animType === 'clear-night' && !reducedMotion && !shootingStar && frameCount % 260 === 90 && Math.random() > 0.35) {
        shootingStar = {
          x: width * (0.2 + Math.random() * 0.5),
          y: height * (0.06 + Math.random() * 0.22),
          vx: 5.5 + Math.random() * 2.5,
          vy: 2.2 + Math.random() * 1.4,
          length: 34 + Math.random() * 20,
          alpha: 0.9,
        };
      }

      for (const p of particles) {
        if (p.kind === 'cloud' || p.kind === 'mist') {
          if (!reducedMotion) {
            p.wobble += p.wobbleSpeed;
            p.x += p.vx;
            p.y += p.vy + Math.sin(p.wobble) * (p.kind === 'mist' ? 0.08 : 0.04);
            if (p.x - p.size * 1.4 > width) p.x = -p.size * 1.4;
            if (p.x + p.size * 1.4 < 0) p.x = width + p.size * 1.4;
          }
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.scale(p.kind === 'mist' ? 2.4 : 1.7, p.kind === 'mist' ? 0.52 : 0.72);
          const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, p.size);
          grad.addColorStop(0, p.color);
          grad.addColorStop(0.55, p.color);
          grad.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (p.kind === 'drop') {
          if (!reducedMotion) {
            p.x += p.vx;
            p.y += p.vy;
            if (p.y > height - 4) {
              if (p.depth > 0.82 && splashes.length < 12 && Math.random() > 0.45) {
                splashes.push({
                  x: p.x,
                  y: height - 3 - Math.random() * 5,
                  radius: 1.2,
                  maxRadius: 6 + Math.random() * 5,
                  alpha: 0.36,
                  color: p.color,
                });
              }
              p.y = -p.size - Math.random() * 20;
              p.x = Math.random() * (width + 80) - 40;
            }
            if (p.x > width + 50) p.x = -30;
            if (p.x < -50) p.x = width + 30;
          }
          ctx.beginPath();
          ctx.strokeStyle = p.color;
          ctx.globalAlpha = p.alpha;
          ctx.lineWidth = 1.15 * p.depth;
          ctx.lineCap = 'round';
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.vx * 1.5, p.y + p.size);
          ctx.stroke();
        } else if (p.kind === 'hail') {
          if (!reducedMotion) {
            p.x += p.vx;
            p.y += p.vy;
            if (p.y > height) {
              p.y = -8;
              p.x = Math.random() * (width + 60) - 30;
            }
          }
          ctx.beginPath();
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha;
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === 'flake') {
          if (!reducedMotion) {
            p.wobble += p.wobbleSpeed;
            p.x += p.vx + Math.sin(p.wobble) * 0.55 * p.depth;
            p.y += p.vy;
            if (p.y > height + 8) {
              p.y = -8;
              p.x = Math.random() * width;
            }
            if (p.x > width + 6) p.x = -4;
            if (p.x < -6) p.x = width + 4;
          }
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 1.4);
          grad.addColorStop(0, p.color);
          grad.addColorStop(0.6, p.color);
          grad.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 1.4, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === 'star') {
          if (!reducedMotion) p.wobble += p.wobbleSpeed;
          const twinkle = reducedMotion ? p.alpha : Math.max(0.1, p.alpha + Math.sin(p.wobble) * 0.34);
          ctx.beginPath();
          ctx.fillStyle = p.color;
          ctx.globalAlpha = twinkle;
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === 'mote') {
          if (!reducedMotion) {
            p.wobble += p.wobbleSpeed;
            p.x += p.vx + Math.sin(p.wobble) * 0.25;
            p.y += p.vy;
            if (p.y < -8) {
              p.y = height + 8;
              p.x = Math.random() * width;
            }
          }
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2.1);
          grad.addColorStop(0, p.color);
          grad.addColorStop(1, 'rgba(253,224,71,0)');
          ctx.globalAlpha = p.alpha;
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 2.1, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === 'wind') {
          if (!reducedMotion) {
            p.wobble += p.wobbleSpeed;
            p.x += p.vx;
            p.y += Math.sin(p.wobble) * 0.35;
            if (p.x > width + p.size) p.x = -p.size;
            if (p.x < -p.size) p.x = width + p.size;
          }
          const lineGrad = ctx.createLinearGradient(p.x, p.y, p.x + p.size * windDirSign, p.y);
          lineGrad.addColorStop(0, 'rgba(255,255,255,0)');
          lineGrad.addColorStop(0.5, 'rgba(255,255,255,0.65)');
          lineGrad.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.strokeStyle = lineGrad;
          ctx.globalAlpha = p.alpha;
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.size * windDirSign, p.y + Math.sin(p.wobble) * 2.5);
          ctx.stroke();
        }
      }

      // Rain splash ripples near card bottom
      for (let i = splashes.length - 1; i >= 0; i--) {
        const s = splashes[i];
        s.radius += 0.45;
        s.alpha -= 0.022;
        if (s.alpha <= 0 || s.radius >= s.maxRadius) {
          splashes.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.strokeStyle = s.color;
        ctx.globalAlpha = s.alpha;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, s.radius, s.radius * 0.35, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Forked lightning bolts
      for (let i = bolts.length - 1; i >= 0; i--) {
        const b = bolts[i];
        ctx.save();
        ctx.strokeStyle = '#f5f3ff';
        ctx.shadowColor = '#c084fc';
        ctx.shadowBlur = 12;
        ctx.lineCap = 'round';
        ctx.globalAlpha = b.alpha;
        for (const seg of b.segments) {
          ctx.lineWidth = Math.max(0.7, seg.width);
          ctx.beginPath();
          ctx.moveTo(seg.x1, seg.y1);
          ctx.lineTo(seg.x2, seg.y2);
          ctx.stroke();
        }
        ctx.restore();
        b.alpha -= 0.08;
        if (b.alpha <= 0) bolts.splice(i, 1);
      }

      // Shooting star streak
      if (shootingStar) {
        ctx.save();
        const sg = ctx.createLinearGradient(
          shootingStar.x,
          shootingStar.y,
          shootingStar.x - shootingStar.vx * 4,
          shootingStar.y - shootingStar.vy * 4
        );
        sg.addColorStop(0, '#ffffff');
        sg.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = sg;
        ctx.globalAlpha = shootingStar.alpha;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(shootingStar.x, shootingStar.y);
        ctx.lineTo(
          shootingStar.x - shootingStar.vx * 4,
          shootingStar.y - shootingStar.vy * 4
        );
        ctx.stroke();
        ctx.restore();

        shootingStar.x += shootingStar.vx;
        shootingStar.y += shootingStar.vy;
        shootingStar.alpha -= 0.025;
        if (shootingStar.alpha <= 0 || shootingStar.x > width + 30) {
          shootingStar = null;
        }
      }

      ctx.globalAlpha = 1;
      if (!reducedMotion) {
        animId = requestAnimationFrame(render);
      }
    };

    let isPaused = false;
    let isVisible = true;
    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(animId);
        isPaused = true;
      } else if (isPaused && isVisible && !reducedMotion) {
        isPaused = false;
        animId = requestAnimationFrame(render);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        isVisible = entry.isIntersecting;
        if (!isVisible) {
          cancelAnimationFrame(animId);
        } else if (!document.hidden && !reducedMotion) {
          cancelAnimationFrame(animId);
          animId = requestAnimationFrame(render);
        }
      },
      { threshold: 0.05 }
    );
    observer.observe(container);

    if (reducedMotion) {
      render();
    } else {
      animId = requestAnimationFrame(render);
    }

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      observer.disconnect();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [
    animType,
    isDay,
    windSpeed,
    windDirection,
    cloudCover,
    precipitation,
    isPrecip,
    isSnow,
    isCloudy,
    isFoggy,
    isNightSky,
    isSunnyDay,
    isStorm,
  ]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 w-full h-full pointer-events-none overflow-hidden rounded-[22px] select-none z-[1] ${className}`}
      aria-hidden="true"
    >
      {/* Dynamic weather particle & meteorology canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

      {/* Sunny / Partly-Cloudy Volumetric Solar Rays */}
      {isSunnyDay && (
        <>
          <div
            className="absolute -top-16 -right-16 w-56 h-56 rounded-full pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgba(254, 240, 138, 0.34) 0%, rgba(251, 191, 36, 0.14) 42%, transparent 72%)',
              filter: 'blur(18px)',
            }}
          />
          <div
            className="absolute -top-28 -right-28 w-[380px] h-[380px] opacity-25 pointer-events-none atmos-sunray-spin"
            style={{
              background:
                'conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(254, 240, 138, 0.45) 18deg, transparent 38deg, rgba(255, 255, 255, 0.35) 75deg, transparent 98deg, rgba(254, 240, 138, 0.4) 150deg, transparent 180deg, rgba(255, 255, 255, 0.3) 240deg, transparent 270deg)',
            }}
          />
        </>
      )}

      {/* Clear / Partly-Cloudy Night Aurora & Lunar Halo */}
      {isNightSky && (
        <>
          <div
            className="absolute -top-12 -right-12 w-52 h-52 rounded-full pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgba(199, 210, 254, 0.24) 0%, rgba(129, 140, 248, 0.1) 45%, transparent 75%)',
              filter: 'blur(20px)',
            }}
          />
          <div
            className="absolute -top-8 left-[-15%] w-[130%] h-36 opacity-35 pointer-events-none atmos-aurora-drift"
            style={{
              background:
                'linear-gradient(105deg, transparent 10%, rgba(56, 189, 248, 0.16) 35%, rgba(167, 139, 250, 0.18) 65%, transparent 90%)',
              filter: 'blur(24px)',
            }}
          />
        </>
      )}

      {/* Fog & Overcast Layered Drifting Veil */}
      {(isFoggy || animType === 'overcast') && (
        <div
          className="absolute inset-0 pointer-events-none atmos-mist-drift"
          style={{
            background:
              animType === 'rime-fog'
                ? 'linear-gradient(90deg, transparent 0%, rgba(224, 242, 254, 0.14) 50%, transparent 100%)'
                : 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)',
            filter: 'blur(18px)',
          }}
        />
      )}

      {/* Snow Frost Bottom Shimmer */}
      {isSnow && (
        <div
          className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
          style={{
            background:
              'linear-gradient(to top, rgba(224, 242, 254, 0.16) 0%, rgba(186, 230, 253, 0.05) 55%, transparent 100%)',
          }}
        />
      )}

      {/* Storm Dark Cloud Canopy */}
      {isStorm && (
        <div
          className="absolute top-0 left-0 right-0 h-28 pointer-events-none"
          style={{
            background:
              'linear-gradient(to bottom, rgba(15, 7, 30, 0.45) 0%, rgba(30, 16, 56, 0.18) 60%, transparent 100%)',
          }}
        />
      )}

      {/* Synchronized Electric Lightning Illumination Flash */}
      <AnimatePresence>
        {lightningFlash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.48 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.08 }}
            className="absolute inset-0 bg-violet-100/50 z-10 pointer-events-none"
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default AtmosphericStateWeatherAnimation;
