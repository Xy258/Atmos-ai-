import React, { useEffect, useRef, useMemo, useState } from 'react';

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

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
  wobble?: number;
}

export function DynamicWeatherBackdrop({
  weatherCode,
  isDay = true,
  windSpeed = 12,
  windDirection = 210,
  cloudCover = 20,
}: DynamicWeatherBackdropProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const category = useMemo(() => getWeatherCategory(weatherCode, isDay), [weatherCode, isDay]);
  const [lightningFlash, setLightningFlash] = useState(false);

  // Background Gradient Configuration based on Weather Category & Daylight
  const backgroundStyle = useMemo(() => {
    switch (category) {
      case 'sunny':
        return {
          background: `
            radial-gradient(circle at 85% 15%, rgba(254, 240, 138, 0.45) 0%, rgba(251, 191, 36, 0.25) 25%, transparent 65%),
            radial-gradient(circle at 20% 80%, rgba(56, 189, 248, 0.2) 0%, transparent 50%),
            linear-gradient(135deg, #0284c7 0%, #0369a1 40%, #0f172a 100%)
          `,
        };
      case 'clear-night':
        return {
          background: `
            radial-gradient(circle at 80% 20%, rgba(199, 210, 254, 0.28) 0%, rgba(99, 102, 241, 0.15) 35%, transparent 65%),
            radial-gradient(circle at 25% 75%, rgba(56, 189, 248, 0.08) 0%, transparent 50%),
            linear-gradient(135deg, #030712 0%, #0f172a 45%, #090d16 100%)
          `,
        };
      case 'partly-cloudy':
        return {
          background: isDay
            ? `
              radial-gradient(circle at 85% 15%, rgba(253, 224, 71, 0.32) 0%, rgba(245, 158, 11, 0.15) 30%, transparent 60%),
              radial-gradient(circle at 25% 45%, rgba(241, 245, 249, 0.25) 0%, transparent 45%),
              linear-gradient(135deg, #0284c7 0%, #0f766e 45%, #0f172a 100%)
            `
            : `
              radial-gradient(circle at 80% 20%, rgba(165, 180, 252, 0.25) 0%, rgba(99, 102, 241, 0.12) 30%, transparent 60%),
              linear-gradient(135deg, #090d16 0%, #1e293b 45%, #0f172a 100%)
            `,
        };
      case 'cloudy':
        return {
          background: isDay
            ? `
              radial-gradient(circle at 50% 20%, rgba(203, 213, 225, 0.22) 0%, transparent 55%),
              linear-gradient(135deg, #334155 0%, #1e293b 50%, #0f172a 100%)
            `
            : `
              radial-gradient(circle at 50% 20%, rgba(148, 163, 184, 0.15) 0%, transparent 55%),
              linear-gradient(135deg, #0f172a 0%, #1e293b 45%, #090d16 100%)
            `,
        };
      case 'rain':
        return {
          background: `
            radial-gradient(circle at 75% 25%, rgba(56, 189, 248, 0.22) 0%, rgba(14, 116, 144, 0.12) 35%, transparent 65%),
            linear-gradient(135deg, #0c4a6e 0%, #0f2c4a 45%, #09131f 100%)
          `,
        };
      case 'thunderstorm':
        return {
          background: `
            radial-gradient(circle at 60% 25%, rgba(168, 85, 247, 0.3) 0%, rgba(99, 102, 241, 0.15) 35%, transparent 65%),
            linear-gradient(135deg, #1e1136 0%, #0f172a 50%, #090514 100%)
          `,
        };
      case 'snow':
        return {
          background: `
            radial-gradient(circle at 70% 20%, rgba(186, 230, 253, 0.35) 0%, rgba(56, 189, 248, 0.12) 35%, transparent 65%),
            linear-gradient(135deg, #075985 0%, #164e63 45%, #082f49 100%)
          `,
        };
      case 'fog':
        return {
          background: `
            radial-gradient(circle at 50% 40%, rgba(226, 232, 240, 0.25) 0%, transparent 60%),
            linear-gradient(135deg, #475569 0%, #334155 45%, #1e293b 100%)
          `,
        };
      default:
        return {
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        };
    }
  }, [category, isDay]);

  // Handle periodic lightning flash effect for thunderstorms
  useEffect(() => {
    if (category !== 'thunderstorm') {
      setLightningFlash(false);
      return;
    }

    let timeoutId: number;
    const triggerFlash = () => {
      setLightningFlash(true);
      window.setTimeout(() => setLightningFlash(false), 120);

      // Random delay between 4 and 10 seconds for next lightning
      const nextDelay = 4000 + Math.random() * 6000;
      timeoutId = window.setTimeout(triggerFlash, nextDelay);
    };

    timeoutId = window.setTimeout(triggerFlash, 2500);
    return () => clearTimeout(timeoutId);
  }, [category]);

  // Particle Engine: Rain, Snow, Solar Flares, Night Stars, Drifting Cloud Mist
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Calculate wind tilt
    const windRad = (windDirection * Math.PI) / 180;
    const windTilt = Math.sin(windRad) * Math.min(2.5, windSpeed / 12);

    // Initialize Particles according to category
    const particles: Particle[] = [];
    const count =
      category === 'rain'
        ? 75
        : category === 'thunderstorm'
        ? 110
        : category === 'snow'
        ? 65
        : category === 'clear-night'
        ? 90
        : category === 'sunny'
        ? 28
        : 18;

    for (let i = 0; i < count; i++) {
      if (category === 'rain' || category === 'thunderstorm') {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: windTilt + (Math.random() - 0.5) * 0.4,
          vy: 12 + Math.random() * 9,
          size: 14 + Math.random() * 12, // streak length
          alpha: 0.25 + Math.random() * 0.35,
          color: category === 'thunderstorm' ? '#c4b5fd' : '#7dd3fc',
        });
      } else if (category === 'snow') {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: windTilt * 0.4 + (Math.random() - 0.5) * 0.8,
          vy: 1.2 + Math.random() * 2.2,
          size: 2 + Math.random() * 3.5,
          alpha: 0.4 + Math.random() * 0.45,
          color: '#ffffff',
          wobble: Math.random() * Math.PI * 2,
        });
      } else if (category === 'clear-night') {
        // Twinkling stars
        particles.push({
          x: Math.random() * width,
          y: Math.random() * (height * 0.85),
          vx: 0,
          vy: 0,
          size: 0.8 + Math.random() * 1.8,
          alpha: 0.2 + Math.random() * 0.7,
          color: Math.random() > 0.4 ? '#ffffff' : '#c7d2fe',
          wobble: Math.random() * Math.PI * 2,
        });
      } else if (category === 'sunny') {
        // Gentle solar dust motes
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.4,
          vy: -0.3 - Math.random() * 0.5,
          size: 2 + Math.random() * 3,
          alpha: 0.15 + Math.random() * 0.3,
          color: '#fef08a',
          wobble: Math.random() * Math.PI * 2,
        });
      } else {
        // Soft drifting mist particles for clouds/fog
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: 0.3 + Math.random() * 0.6,
          vy: (Math.random() - 0.5) * 0.15,
          size: 50 + Math.random() * 90,
          alpha: 0.04 + Math.random() * 0.08,
          color: '#ffffff',
          wobble: Math.random() * Math.PI * 2,
        });
      }
    }

    let tick = 0;
    const render = () => {
      tick++;
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        if (category === 'rain' || category === 'thunderstorm') {
          p.x += p.vx;
          p.y += p.vy;
          if (p.y > height) {
            p.y = -p.size;
            p.x = Math.random() * width;
          }
          if (p.x > width) p.x = 0;
          if (p.x < 0) p.x = width;

          ctx.beginPath();
          ctx.strokeStyle = p.color;
          ctx.globalAlpha = p.alpha;
          ctx.lineWidth = 1.2;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.vx * 1.5, p.y + p.size);
          ctx.stroke();
        } else if (category === 'snow') {
          p.wobble = (p.wobble || 0) + 0.02;
          p.x += p.vx + Math.sin(p.wobble) * 0.5;
          p.y += p.vy;
          if (p.y > height) {
            p.y = -5;
            p.x = Math.random() * width;
          }
          if (p.x > width) p.x = 0;
          if (p.x < 0) p.x = width;

          ctx.beginPath();
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha;
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (category === 'clear-night') {
          p.wobble = (p.wobble || 0) + 0.03;
          const currentAlpha = Math.max(0.1, p.alpha + Math.sin(p.wobble) * 0.25);
          ctx.beginPath();
          ctx.fillStyle = p.color;
          ctx.globalAlpha = currentAlpha;
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (category === 'sunny') {
          p.wobble = (p.wobble || 0) + 0.02;
          p.x += p.vx + Math.sin(p.wobble) * 0.3;
          p.y += p.vy;
          if (p.y < -10) {
            p.y = height + 10;
            p.x = Math.random() * width;
          }
          ctx.beginPath();
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha;
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Drifting misty cloud puffs
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

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [category, windSpeed, windDirection]);

  return (
    <div
      className="fixed inset-0 w-full h-full pointer-events-none overflow-hidden select-none z-0 transition-colors duration-1000"
      style={backgroundStyle}
      aria-hidden="true"
    >
      {/* Canvas for dynamic particles (rain, snow, motes, stars, mist) */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

      {/* Atmospheric Cloud Drifting Layers (for partly cloudy, overcast, or high cloud cover) */}
      {(category === 'partly-cloudy' || category === 'cloudy' || cloudCover > 40) && (
        <div className="absolute inset-0 pointer-events-none opacity-40 overflow-hidden">
          <div
            className="absolute -top-10 -left-[20%] w-[140%] h-[320px] bg-gradient-to-r from-transparent via-white/10 to-transparent blur-3xl transform animate-pulse"
            style={{ animationDuration: '8s' }}
          />
          <div
            className="absolute top-1/4 -left-[10%] w-[120%] h-[260px] bg-gradient-to-r from-transparent via-sky-200/10 to-transparent blur-2xl transform"
            style={{ animation: 'floatCloud 24s linear infinite' }}
          />
        </div>
      )}

      {/* Dramatic Lightning Flash Overlay for Thunderstorms */}
      {lightningFlash && (
        <div className="absolute inset-0 bg-white/45 backdrop-blur-sm z-10 transition-opacity duration-75 pointer-events-none" />
      )}

      {/* Subtle vignette for depth */}
      <div className="absolute inset-0 bg-radial-gradient from-transparent via-transparent to-black/25 pointer-events-none" />
    </div>
  );
}

export default DynamicWeatherBackdrop;
