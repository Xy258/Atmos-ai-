import React, { useEffect, useRef, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface AtmosphericStateWeatherAnimationProps {
  weatherCode: number;
  isDay?: boolean;
  windSpeed?: number;
  windDirection?: number;
  className?: string;
}

type WeatherAnimType = 'rain' | 'thunderstorm' | 'snow' | 'sunny' | 'clear-night' | 'cloudy' | 'fog';

function getAnimType(code: number, isDay = true): WeatherAnimType {
  if ([95, 96, 99].includes(code)) return 'thunderstorm';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'snow';
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'rain';
  if (code === 45 || code === 48) return 'fog';
  if (code === 3) return 'cloudy';
  return isDay ? 'sunny' : 'clear-night';
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
  wobble?: number;
  wobbleSpeed?: number;
}

export function AtmosphericStateWeatherAnimation({
  weatherCode,
  isDay = true,
  windSpeed = 12,
  windDirection = 210,
  className = '',
}: AtmosphericStateWeatherAnimationProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animType = useMemo(() => getAnimType(weatherCode, isDay), [weatherCode, isDay]);
  const [lightningFlash, setLightningFlash] = useState(false);

  // Thunderstorm periodic lightning flash contained inside Atmospheric card
  useEffect(() => {
    if (animType !== 'thunderstorm') {
      setLightningFlash(false);
      return;
    }

    let timer: number;
    const trigger = () => {
      setLightningFlash(true);
      window.setTimeout(() => setLightningFlash(false), 95);
      // Double flash occasionally
      if (Math.random() > 0.45) {
        window.setTimeout(() => {
          setLightningFlash(true);
          window.setTimeout(() => setLightningFlash(false), 70);
        }, 150);
      }
      const nextDelay = 3500 + Math.random() * 5500;
      timer = window.setTimeout(trigger, nextDelay);
    };

    timer = window.setTimeout(trigger, 2200);
    return () => clearTimeout(timer);
  }, [animType]);

  // Particle Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animId = 0;
    const parent = canvas.parentElement;
    let width = (canvas.width = parent?.clientWidth || 400);
    let height = (canvas.height = parent?.clientHeight || 320);

    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const handleResize = () => {
      if (!canvas || !parent) return;
      width = parent.clientWidth || 400;
      height = parent.clientHeight || 320;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };
    window.addEventListener('resize', handleResize);

    // Compute wind angle
    const windRad = (windDirection * Math.PI) / 180;
    const windSlant = Math.sin(windRad) * Math.min(2.2, windSpeed / 14);

    const particles: Particle[] = [];
    const count =
      animType === 'rain'
        ? 22
        : animType === 'thunderstorm'
        ? 30
        : animType === 'snow'
        ? 18
        : animType === 'sunny'
        ? 8
        : animType === 'clear-night'
        ? 14
        : 6;

    for (let i = 0; i < count; i++) {
      if (animType === 'rain' || animType === 'thunderstorm') {
        particles.push({
          x: Math.random() * (width + 60) - 30,
          y: Math.random() * height,
          vx: windSlant + (Math.random() - 0.5) * 0.4,
          vy: 9 + Math.random() * 8,
          size: 14 + Math.random() * 14,
          alpha: 0.28 + Math.random() * 0.35,
          color: animType === 'thunderstorm' ? '#c4b5fd' : '#7dd3fc',
        });
      } else if (animType === 'snow') {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: windSlant * 0.4 + (Math.random() - 0.5) * 0.6,
          vy: 1.1 + Math.random() * 1.8,
          size: 1.8 + Math.random() * 3.2,
          alpha: 0.35 + Math.random() * 0.45,
          color: '#ffffff',
          wobble: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.02 + Math.random() * 0.02,
        });
      } else if (animType === 'sunny') {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.35,
          vy: -0.25 - Math.random() * 0.4,
          size: 1.8 + Math.random() * 2.8,
          alpha: 0.18 + Math.random() * 0.32,
          color: '#fde047',
          wobble: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.02,
        });
      } else if (animType === 'clear-night') {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height * 0.85,
          vx: 0,
          vy: 0,
          size: 0.8 + Math.random() * 1.8,
          alpha: 0.25 + Math.random() * 0.65,
          color: Math.random() > 0.4 ? '#ffffff' : '#c7d2fe',
          wobble: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.03 + Math.random() * 0.03,
        });
      } else {
        // Misty cloud particles
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: 0.3 + Math.random() * 0.5,
          vy: (Math.random() - 0.5) * 0.1,
          size: 38 + Math.random() * 60,
          alpha: 0.04 + Math.random() * 0.07,
          color: '#ffffff',
          wobble: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.01,
        });
      }
    }

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        if (animType === 'rain' || animType === 'thunderstorm') {
          p.x += p.vx;
          p.y += p.vy;
          if (p.y > height) {
            p.y = -p.size;
            p.x = Math.random() * (width + 60) - 30;
          }
          if (p.x > width + 40) p.x = -20;
          if (p.x < -40) p.x = width + 20;

          ctx.beginPath();
          ctx.strokeStyle = p.color;
          ctx.globalAlpha = p.alpha;
          ctx.lineWidth = 1.3;
          ctx.lineCap = 'round';
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.vx * 1.6, p.y + p.size);
          ctx.stroke();
        } else if (animType === 'snow') {
          p.wobble = (p.wobble || 0) + (p.wobbleSpeed || 0.02);
          p.x += p.vx + Math.sin(p.wobble) * 0.45;
          p.y += p.vy;
          if (p.y > height + 6) {
            p.y = -6;
            p.x = Math.random() * width;
          }
          if (p.x > width) p.x = 0;
          if (p.x < 0) p.x = width;

          ctx.beginPath();
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha;
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (animType === 'sunny') {
          p.wobble = (p.wobble || 0) + (p.wobbleSpeed || 0.02);
          p.x += p.vx + Math.sin(p.wobble) * 0.25;
          p.y += p.vy;
          if (p.y < -8) {
            p.y = height + 8;
            p.x = Math.random() * width;
          }
          ctx.beginPath();
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha;
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (animType === 'clear-night') {
          p.wobble = (p.wobble || 0) + (p.wobbleSpeed || 0.03);
          const currentAlpha = Math.max(0.12, p.alpha + Math.sin(p.wobble) * 0.35);
          ctx.beginPath();
          ctx.fillStyle = p.color;
          ctx.globalAlpha = currentAlpha;
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Soft cloud / mist puffs
          p.x += p.vx;
          p.y += p.vy;
          if (p.x - p.size > width) {
            p.x = -p.size;
            p.y = Math.random() * height;
          }
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
          grad.addColorStop(0, `rgba(255, 255, 255, ${p.alpha})`);
          grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      ctx.globalAlpha = 1;
      animId = requestAnimationFrame(render);
    };

    let isPaused = false;
    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(animId);
        isPaused = true;
      } else if (isPaused) {
        isPaused = false;
        animId = requestAnimationFrame(render);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [animType, windSpeed, windDirection]);

  return (
    <div
      className={`absolute inset-0 w-full h-full pointer-events-none overflow-hidden rounded-[22px] select-none z-[1] ${className}`}
      aria-hidden="true"
    >
      {/* Dynamic weather canvas layer inside Atmospheric State card */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

      {/* Sunny Ray Ambient Flare in top corner of card */}
      {animType === 'sunny' && (
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-gradient-to-br from-amber-300/25 via-yellow-400/10 to-transparent blur-2xl pointer-events-none" />
      )}

      {/* Clear Night Lunar / Star Ambient Glow in card */}
      {animType === 'clear-night' && (
        <div className="absolute -top-10 -right-10 w-44 h-44 rounded-full bg-gradient-to-br from-indigo-300/20 via-sky-400/10 to-transparent blur-2xl pointer-events-none" />
      )}

      {/* Cloud mist wisp in card */}
      {(animType === 'cloudy' || animType === 'fog') && (
        <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-r from-transparent via-white/5 to-white/10 blur-xl pointer-events-none animate-pulse" style={{ animationDuration: '6s' }} />
      )}

      {/* Lightning Flash Overlay confined inside Atmospheric Card */}
      <AnimatePresence>
        {lightningFlash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.55 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.08 }}
            className="absolute inset-0 bg-white/55 backdrop-blur-[2px] z-10 pointer-events-none"
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default AtmosphericStateWeatherAnimation;
