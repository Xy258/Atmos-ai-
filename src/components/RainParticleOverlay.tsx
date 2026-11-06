import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

export interface RainParticleOverlayProps {
  /** Weather code from Open-Meteo */
  weatherCode: number;
  /** Wind speed in km/h to simulate wind tilt */
  windSpeed?: number;
  /** Wind direction in degrees */
  windDirection?: number;
  /** Custom particle density multiplier */
  densityMultiplier?: number;
  /** Custom className */
  className?: string;
}

interface DropParticle {
  x: number;
  y: number;
  length: number;
  speed: number;
  opacity: number;
  width: number;
  layer: number; // 0: background mist, 1: midground, 2: foreground
}

interface SplashParticle {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  opacity: number;
  vx: number;
  vy: number;
}

/**
 * Returns true if the WMO code represents any form of rain, drizzle, or showers.
 */
export function isRainOrShowers(code: number): boolean {
  return [
    51, 53, 55, // Drizzle (Light, Moderate, Heavy)
    56, 57,     // Freezing drizzle
    61, 63, 65, // Rain (Slight, Moderate, Heavy)
    66, 67,     // Freezing rain
    80, 81, 82, // Rain showers (Slight, Moderate, Violent)
    95, 96, 99, // Thunderstorms with rain/hail
  ].includes(code);
}

/**
 * Determines rainfall intensity configuration based on WMO weather code.
 */
function getRainIntensityConfig(code: number) {
  // Heavy rain or violent showers or thunderstorm
  if ([65, 82, 95, 96, 99].includes(code)) {
    return {
      particleCount: 85,
      speedBase: 13,
      speedVariance: 7,
      lengthBase: 24,
      lengthVariance: 12,
      opacityBase: 0.38,
      splashProbability: 0.45,
    };
  }
  // Moderate rain or showers
  if ([63, 81, 67, 57].includes(code)) {
    return {
      particleCount: 65,
      speedBase: 10,
      speedVariance: 5,
      lengthBase: 19,
      lengthVariance: 9,
      opacityBase: 0.32,
      splashProbability: 0.35,
    };
  }
  // Light rain or light showers
  if ([61, 80, 66].includes(code)) {
    return {
      particleCount: 45,
      speedBase: 8,
      speedVariance: 4,
      lengthBase: 15,
      lengthVariance: 7,
      opacityBase: 0.26,
      splashProbability: 0.25,
    };
  }
  // Drizzle (51, 53, 55, 56)
  return {
    particleCount: 35,
    speedBase: 6,
    speedVariance: 3,
    lengthBase: 11,
    lengthVariance: 5,
    opacityBase: 0.22,
    splashProbability: 0.15,
  };
}

export function RainParticleOverlay({
  weatherCode,
  windSpeed = 10,
  windDirection,
  densityMultiplier = 1,
  className = '',
}: RainParticleOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // Check for reduced motion preference
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let animationFrameId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 360);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 320);

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const config = getRainIntensityConfig(weatherCode);
    const count = Math.round(config.particleCount * densityMultiplier);

    // Calculate wind slant angle
    // Default gentle slant ~7-10 degrees, modified by wind speed
    let slantAngleDeg = 8;
    if (typeof windSpeed === 'number') {
      slantAngleDeg = Math.min(22, 5 + windSpeed * 0.35);
      if (typeof windDirection === 'number' && (windDirection > 180 && windDirection < 360)) {
        slantAngleDeg = -slantAngleDeg; // Blow from left to right or right to left
      }
    }
    const slantRad = (slantAngleDeg * Math.PI) / 180;
    const tanSlant = Math.tan(slantRad);

    // Create particles
    const drops: DropParticle[] = [];
    for (let i = 0; i < count; i++) {
      const layer = Math.random() < 0.35 ? 0 : Math.random() < 0.75 ? 1 : 2;
      const layerSpeedMult = layer === 0 ? 0.65 : layer === 1 ? 1.0 : 1.35;
      const layerLengthMult = layer === 0 ? 0.7 : layer === 1 ? 1.0 : 1.3;
      const layerOpacityMult = layer === 0 ? 0.55 : layer === 1 ? 0.85 : 1.15;

      drops.push({
        x: Math.random() * (width + Math.abs(tanSlant) * height) - Math.max(0, tanSlant * height),
        y: Math.random() * height,
        length: (config.lengthBase + Math.random() * config.lengthVariance) * layerLengthMult,
        speed: (config.speedBase + Math.random() * config.speedVariance) * layerSpeedMult,
        opacity: config.opacityBase * layerOpacityMult,
        width: layer === 0 ? 0.75 : layer === 1 ? 1.1 : 1.45,
        layer,
      });
    }

    const splashes: SplashParticle[] = [];

    // Handle container resize
    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.parentElement.clientWidth;
      height = canvas.parentElement.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.scale(dpr, dpr);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    let lastTime = performance.now();
    let isTabVisible = !document.hidden;

    const handleVisibilityChange = () => {
      isTabVisible = !document.hidden;
      if (isTabVisible) {
        lastTime = performance.now();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Animation Loop
    const render = (currentTime: number) => {
      animationFrameId = requestAnimationFrame(render);
      if (!isTabVisible) return;

      const delta = Math.min((currentTime - lastTime) / 16.67, 2.5); // Normalize to 60fps
      lastTime = currentTime;

      ctx.clearRect(0, 0, width, height);

      // If user prefers reduced motion, render a subtle atmospheric ambient tint and exit
      if (prefersReducedMotion) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.fillRect(0, 0, width, height);
        return;
      }

      // Update and draw raindrops
      for (let i = 0; i < drops.length; i++) {
        const d = drops[i];

        d.y += d.speed * delta;
        d.x += tanSlant * d.speed * delta;

        // When raindrop hits the bottom
        if (d.y >= height - 6) {
          // Trigger subtle splash ripple
          if (Math.random() < config.splashProbability && splashes.length < 25) {
            splashes.push({
              x: d.x,
              y: height - 4 + Math.random() * 3,
              radius: 0.8,
              maxRadius: 3.5 + Math.random() * 3,
              opacity: d.opacity * 0.75,
              vx: (Math.random() - 0.5) * 1.2,
              vy: -0.6 - Math.random() * 0.8,
            });
          }

          // Reset drop to above the viewport
          d.y = -d.length - Math.random() * 20;
          d.x = Math.random() * (width + Math.abs(tanSlant) * height) - Math.max(0, tanSlant * height);
        }

        // Draw raindrop streak with gradient fading at tail
        const headX = d.x;
        const headY = d.y;
        const tailX = headX - tanSlant * d.length;
        const tailY = headY - d.length;

        const grad = ctx.createLinearGradient(tailX, tailY, headX, headY);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.01)');
        grad.addColorStop(0.65, `rgba(224, 242, 254, ${d.opacity * 0.5})`);
        grad.addColorStop(1, `rgba(255, 255, 255, ${d.opacity})`);

        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(headX, headY);
        ctx.strokeStyle = grad;
        ctx.lineWidth = d.width;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      // Update and draw splash ripples
      for (let i = splashes.length - 1; i >= 0; i--) {
        const s = splashes[i];
        s.radius += 0.35 * delta;
        s.opacity -= 0.032 * delta;
        s.x += s.vx * delta;
        s.y += s.vy * delta;

        if (s.opacity <= 0 || s.radius >= s.maxRadius) {
          splashes.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        // Elliptical perspective splash
        ctx.ellipse(s.x, s.y, s.radius * 1.5, s.radius * 0.55, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${Math.max(0, s.opacity)})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [weatherCode, windSpeed, windDirection, densityMultiplier]);

  return (
    <motion.div
      className={`atmospheric-rain-overlay ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.7, ease: 'easeInOut' }}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        borderRadius: 'inherit',
        overflow: 'hidden',
        zIndex: 1,
        mixBlendMode: 'screen',
      }}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          borderRadius: 'inherit',
        }}
      />
    </motion.div>
  );
}

export default RainParticleOverlay;
