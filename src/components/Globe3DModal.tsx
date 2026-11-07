import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import {
  X,
  RotateCcw,
  Wind,
  Cloud,
  Droplets,
  Sun,
  Thermometer,
  MapPin,
  Layers,
  Activity,
  Globe2,
  ChevronDown,
  ChevronUp,
  Radar,
  Gauge,
  Sliders,
  Sparkles,
} from 'lucide-react';
import type { Location, Forecast, AirQuality } from '../App';
import { getAqiDetails } from '../App';

export type AtmosphericLayer = 'clouds' | 'temperature' | 'wind' | 'precipitation';

interface Globe3DModalProps {
  location: Location;
  forecast: Forecast;
  airQuality?: AirQuality | null;
  onClose: () => void;
}

// Country code/name flag emoji or fallback
function getCountryBadge(country?: string): string {
  if (!country) return '🌐';
  const c = country.toLowerCase().trim();
  if (c.includes('united states') || c === 'usa' || c === 'us') return '🇺🇸';
  if (c.includes('united kingdom') || c === 'uk' || c === 'great britain') return '🇬🇧';
  if (c.includes('japan')) return '🇯🇵';
  if (c.includes('france')) return '🇫🇷';
  if (c.includes('germany')) return '🇩🇪';
  if (c.includes('italy')) return '🇮🇹';
  if (c.includes('spain')) return '🇪🇸';
  if (c.includes('canada')) return '🇨🇦';
  if (c.includes('australia')) return '🇦🇺';
  if (c.includes('india')) return '🇮🇳';
  if (c.includes('china')) return '🇨🇳';
  if (c.includes('brazil')) return '🇧🇷';
  if (c.includes('mexico')) return '🇲🇽';
  if (c.includes('korea')) return '🇰🇷';
  if (c.includes('netherlands')) return '🇳🇱';
  if (c.includes('switzerland')) return '🇨🇭';
  if (c.includes('sweden')) return '🇸🇪';
  if (c.includes('norway')) return '🇳🇴';
  return '📍';
}

// Convert Lat/Lon (degrees) to 3D Cartesian coordinates on sphere of radius R
function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

// Weather Code Helper
function getWeatherDescription(code: number): { label: string; icon: string } {
  if (code === 0) return { label: 'Clear Sky', icon: '☀️' };
  if (code === 1) return { label: 'Mainly Clear', icon: '🌤️' };
  if (code === 2) return { label: 'Partly Cloudy', icon: '⛅' };
  if (code === 3) return { label: 'Overcast', icon: '☁️' };
  if (code >= 45 && code <= 48) return { label: 'Atmospheric Fog', icon: '🌫️' };
  if (code >= 51 && code <= 55) return { label: 'Light Drizzle', icon: '🌦️' };
  if (code >= 61 && code <= 65) return { label: 'Rain Showers', icon: '🌧️' };
  if (code >= 71 && code <= 77) return { label: 'Snowfall', icon: '🌨️' };
  if (code >= 80 && code <= 82) return { label: 'Heavy Showers', icon: '🌧️' };
  if (code >= 95) return { label: 'Thunderstorm', icon: '⛈️' };
  return { label: 'Atmospheric Activity', icon: '⛅' };
}

// Procedural Equirectangular Earth Texture with Continental Outlines
function createProceduralEarthTexture(): THREE.CanvasTexture {
  const width = 2048;
  const height = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // 1. Deep Ocean Base with atmospheric depth
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, height);
  oceanGrad.addColorStop(0, '#041021'); // Arctic
  oceanGrad.addColorStop(0.3, '#071d3a'); // Temperate North
  oceanGrad.addColorStop(0.5, '#0a274c'); // Tropical Ocean
  oceanGrad.addColorStop(0.7, '#071d3a'); // Temperate South
  oceanGrad.addColorStop(1, '#041021'); // Antarctic
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle bathymetric glow
  ctx.fillStyle = 'rgba(14, 116, 144, 0.12)';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(0, height * (0.2 + i * 0.18), width, height * 0.08);
  }

  // 2. Graticule Lines (Latitude & Longitude)
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.07)';
  ctx.lineWidth = 1;

  for (let lat = -60; lat <= 60; lat += 30) {
    const y = ((90 - lat) / 180) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  for (let lon = -180; lon <= 180; lon += 30) {
    const x = ((lon + 180) / 360) * width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // Equator & Prime Meridian highlight
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
  ctx.lineWidth = 1.5;
  const eqY = (90 / 180) * height;
  ctx.beginPath();
  ctx.moveTo(0, eqY);
  ctx.lineTo(width, eqY);
  ctx.stroke();

  const pmX = (180 / 360) * width;
  ctx.beginPath();
  ctx.moveTo(pmX, 0);
  ctx.lineTo(pmX, height);
  ctx.stroke();

  const project = (lon: number, lat: number): [number, number] => [
    ((lon + 180) / 360) * width,
    ((90 - lat) / 180) * height,
  ];

  const drawPolygon = (
    pts: [number, number][],
    fillGradColors: [string, string],
    glowColor = 'rgba(56, 189, 248, 0.5)'
  ) => {
    if (pts.length < 3) return;
    const start = project(pts[0][0], pts[0][1]);

    let minY = start[1];
    let maxY = start[1];
    pts.forEach(([lon, lat]) => {
      const p = project(lon, lat);
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    });

    const grad = ctx.createLinearGradient(0, minY, 0, maxY);
    grad.addColorStop(0, fillGradColors[0]);
    grad.addColorStop(1, fillGradColors[1]);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(start[0], start[1]);
    for (let i = 1; i < pts.length; i++) {
      const p = project(pts[i][0], pts[i][1]);
      ctx.lineTo(p[0], p[1]);
    }
    ctx.closePath();

    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  };

  // Continents
  // North America
  drawPolygon(
    [
      [-168, 65], [-160, 71], [-140, 70], [-125, 74], [-115, 76],
      [-95, 72], [-85, 66], [-80, 58], [-65, 52], [-60, 46],
      [-72, 41], [-77, 34], [-81, 25], [-90, 29], [-97, 26],
      [-105, 21], [-92, 16], [-83, 9], [-77, 8], [-85, 13],
      [-97, 18], [-105, 23], [-115, 30], [-124, 40], [-125, 49],
      [-135, 58], [-148, 60], [-165, 60], [-168, 65],
    ],
    ['#1d4632', '#143826'],
    'rgba(56, 189, 248, 0.45)'
  );

  // Greenland
  drawPolygon(
    [
      [-52, 60], [-42, 64], [-22, 74], [-18, 81], [-32, 83],
      [-55, 82], [-62, 76], [-52, 60],
    ],
    ['#2c4f42', '#223e34'],
    'rgba(186, 230, 253, 0.5)'
  );

  // South America
  drawPolygon(
    [
      [-77, 8], [-60, 10], [-50, 0], [-35, -5], [-35, -12],
      [-40, -22], [-48, -28], [-55, -34], [-65, -45], [-68, -54],
      [-75, -50], [-72, -40], [-71, -30], [-76, -15], [-81, -4],
      [-77, 8],
    ],
    ['#1f4d36', '#173a28'],
    'rgba(52, 211, 153, 0.4)'
  );

  // Europe
  drawPolygon(
    [
      [-9, 36], [-1, 43], [-5, 48], [3, 51], [8, 54],
      [12, 58], [16, 61], [25, 71], [32, 70], [38, 60],
      [32, 46], [26, 40], [21, 38], [15, 37], [5, 44],
      [-2, 38], [-9, 36],
    ],
    ['#214a38', '#173729'],
    'rgba(56, 189, 248, 0.45)'
  );

  // UK & Ireland
  drawPolygon(
    [[-5, 50], [1, 51], [1, 56], [-3, 58], [-5, 55], [-6, 52], [-5, 50]],
    ['#23503b', '#183a2a'],
    'rgba(56, 189, 248, 0.5)'
  );
  drawPolygon(
    [[-10, 51], [-6, 52], [-6, 55], [-10, 54], [-10, 51]],
    ['#23503b', '#183a2a'],
    'rgba(56, 189, 248, 0.4)'
  );

  // Scandinavia
  drawPolygon(
    [[5, 58], [12, 56], [22, 60], [28, 70], [22, 71], [14, 66], [5, 62], [5, 58]],
    ['#244d3c', '#183a2c'],
    'rgba(56, 189, 248, 0.45)'
  );

  // Africa
  drawPolygon(
    [
      [-17, 30], [-9, 36], [10, 37], [25, 32], [32, 31],
      [36, 27], [43, 12], [51, 12], [42, 0], [40, -10],
      [35, -25], [28, -34], [18, -34], [12, -22], [10, -5],
      [0, 5], [-15, 12], [-17, 20], [-17, 30],
    ],
    ['#2b4a30', '#1c3622'],
    'rgba(234, 179, 8, 0.35)'
  );

  // Madagascar
  drawPolygon(
    [[43, -12], [50, -14], [47, -25], [43, -24], [43, -12]],
    ['#214a38', '#173729'],
    'rgba(52, 211, 153, 0.35)'
  );

  // Asia & Siberia
  drawPolygon(
    [
      [38, 60], [50, 70], [75, 73], [105, 78], [135, 74],
      [170, 66], [162, 54], [142, 50], [132, 42], [122, 30],
      [110, 20], [104, 10], [98, 2], [92, 22], [82, 12],
      [72, 22], [60, 25], [52, 30], [45, 40], [38, 42],
      [32, 46], [38, 60],
    ],
    ['#224734', '#153324'],
    'rgba(56, 189, 248, 0.45)'
  );

  // India
  drawPolygon(
    [[68, 24], [72, 21], [77, 8], [80, 10], [86, 22], [80, 28], [68, 24]],
    ['#2b4d36', '#1b3b27'],
    'rgba(52, 211, 153, 0.4)'
  );

  // Japan
  drawPolygon(
    [[129, 32], [135, 34], [140, 40], [145, 44], [142, 45], [137, 38], [129, 32]],
    ['#244d3c', '#183a2c'],
    'rgba(56, 189, 248, 0.5)'
  );

  // Australia & New Zealand
  drawPolygon(
    [
      [114, -22], [120, -14], [135, -12], [143, -11], [150, -22],
      [153, -28], [150, -37], [138, -35], [130, -32], [115, -35],
      [113, -25], [114, -22],
    ],
    ['#294a32', '#1a3723'],
    'rgba(234, 179, 8, 0.35)'
  );

  // Antarctica
  drawPolygon(
    [
      [-180, -70], [-120, -72], [-60, -65], [0, -68], [60, -66],
      [120, -65], [180, -70], [180, -90], [-180, -90],
    ],
    ['#2a4242', '#1a2a2a'],
    'rgba(186, 230, 253, 0.6)'
  );

  // City Lights
  const majorCities: [number, number][] = [
    [-122.42, 37.77], [-74.0, 40.71], [-0.13, 51.51], [2.35, 48.86],
    [13.4, 52.52], [139.69, 35.69], [121.47, 31.23], [72.88, 19.07],
    [116.4, 39.9], [151.2, -33.86], [-46.63, -23.55], [37.62, 55.75],
    [31.23, 30.04], [55.27, 25.2], [103.82, 1.35],
  ];

  ctx.fillStyle = '#fef08a';
  ctx.shadowColor = '#facc15';
  ctx.shadowBlur = 4;
  majorCities.forEach(([lon, lat]) => {
    const p = project(lon, lat);
    ctx.beginPath();
    ctx.arc(p[0], p[1], 2, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.shadowBlur = 0;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// 1. Procedural Clouds Texture
function createProceduralCloudTexture(cloudCoverPercentage: number): THREE.CanvasTexture {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, width, height);
  const density = Math.max(0.15, Math.min(1.0, cloudCoverPercentage / 100));
  const numCloudPuffs = Math.floor(180 * density) + 40;

  ctx.save();
  for (let i = 0; i < numCloudPuffs; i++) {
    const u = Math.random();
    const v = Math.random();
    const x = u * width;
    const y = v * height;
    const radius = (20 + Math.random() * 65) * (0.6 + density * 0.7);
    const alpha = (0.2 + Math.random() * 0.45) * Math.min(1, density * 1.3);

    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, `rgba(255, 255, 255, ${alpha.toFixed(2)})`);
    grad.addColorStop(0.5, `rgba(240, 249, 255, ${(alpha * 0.6).toFixed(2)})`);
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    if (x - radius < 0) {
      const gradWrap = ctx.createRadialGradient(x + width, y, 0, x + width, y, radius);
      gradWrap.addColorStop(0, `rgba(255, 255, 255, ${alpha.toFixed(2)})`);
      gradWrap.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradWrap;
      ctx.beginPath();
      ctx.arc(x + width, y, radius, 0, Math.PI * 2);
      ctx.fill();
    } else if (x + radius > width) {
      const gradWrap = ctx.createRadialGradient(x - width, y, 0, x - width, y, radius);
      gradWrap.addColorStop(0, `rgba(255, 255, 255, ${alpha.toFixed(2)})`);
      gradWrap.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradWrap;
      ctx.beginPath();
      ctx.arc(x - width, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// 2. Procedural Global Thermal Heatmap Layer (Temperature)
function createProceduralTemperatureTexture(currentTemp: number, activeLat: number, activeLon: number): THREE.CanvasTexture {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Map latitude to realistic Earth temperature curve:
  // Poles (-90, 90) ~ -25°C to -10°C, Equator (0) ~ +28°C to +34°C
  const tempGrad = ctx.createLinearGradient(0, 0, 0, height);
  tempGrad.addColorStop(0, 'rgba(59, 7, 100, 0.85)');    // North Pole: -25°C Deep Indigo
  tempGrad.addColorStop(0.15, 'rgba(6, 182, 212, 0.78)');  // Sub-Arctic: -10°C Cyan
  tempGrad.addColorStop(0.3, 'rgba(16, 185, 129, 0.72)');  // Mid-Latitudes: +10°C Emerald
  tempGrad.addColorStop(0.42, 'rgba(234, 179, 8, 0.75)');  // Subtropical: +22°C Amber
  tempGrad.addColorStop(0.5, 'rgba(239, 68, 68, 0.82)');   // Equator: +32°C Coral Red
  tempGrad.addColorStop(0.58, 'rgba(234, 179, 8, 0.75)');  // Southern Subtropics: +22°C Amber
  tempGrad.addColorStop(0.72, 'rgba(16, 185, 129, 0.72)'); // Southern Mid-Lat: +10°C Emerald
  tempGrad.addColorStop(0.85, 'rgba(6, 182, 212, 0.78)'); // Sub-Antarctic: -10°C Cyan
  tempGrad.addColorStop(1, 'rgba(30, 27, 75, 0.9)');      // South Pole: -35°C Violet Navy

  ctx.fillStyle = tempGrad;
  ctx.fillRect(0, 0, width, height);

  // Local temperature anchor around active location
  const locX = ((activeLon + 180) / 360) * width;
  const locY = ((90 - activeLat) / 180) * height;
  const locRadius = 140;

  // Determine local anchor color based on actual temperature
  let localColor = 'rgba(234, 179, 8, 0.7)';
  if (currentTemp <= -5) localColor = 'rgba(59, 7, 100, 0.8)';
  else if (currentTemp <= 8) localColor = 'rgba(6, 182, 212, 0.75)';
  else if (currentTemp <= 18) localColor = 'rgba(16, 185, 129, 0.75)';
  else if (currentTemp <= 28) localColor = 'rgba(245, 158, 11, 0.8)';
  else localColor = 'rgba(239, 68, 68, 0.85)';

  const localGrad = ctx.createRadialGradient(locX, locY, 0, locX, locY, locRadius);
  localGrad.addColorStop(0, localColor);
  localGrad.addColorStop(0.6, localColor.replace('0.8', '0.4').replace('0.75', '0.35'));
  localGrad.addColorStop(1, 'transparent');

  ctx.fillStyle = localGrad;
  ctx.beginPath();
  ctx.arc(locX, locY, locRadius, 0, Math.PI * 2);
  ctx.fill();

  // Subtle isotherm contours (white dashed lines every 15 degrees latitude)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.setLineDash([4, 6]);
  ctx.lineWidth = 1.2;
  for (let lat = -60; lat <= 60; lat += 20) {
    const y = ((90 - lat) / 180) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// 3. Procedural Meteorological Radar Layer (Precipitation)
function createProceduralPrecipitationTexture(
  weatherCode: number,
  activeLat: number,
  activeLon: number,
  precipitationMm = 0
): THREE.CanvasTexture {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, width, height);

  // Background atmospheric moisture tint (very faint blue)
  ctx.fillStyle = 'rgba(8, 47, 73, 0.25)';
  ctx.fillRect(0, 0, width, height);

  // Global ITCZ equatorial tropical precipitation belt
  const eqY = (90 / 180) * height;
  for (let b = 0; b < 16; b++) {
    const bx = (b / 16) * width + (Math.random() - 0.5) * 40;
    const by = eqY + (Math.random() - 0.5) * 35;
    const rad = 25 + Math.random() * 45;

    const radGrad = ctx.createRadialGradient(bx, by, 0, bx, by, rad);
    radGrad.addColorStop(0, 'rgba(34, 197, 94, 0.7)');   // Light green (25 dBZ)
    radGrad.addColorStop(0.5, 'rgba(14, 165, 233, 0.45)');
    radGrad.addColorStop(1, 'rgba(14, 165, 233, 0)');

    ctx.fillStyle = radGrad;
    ctx.beginPath();
    ctx.arc(bx, by, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // Mid-latitude oceanic rain bands (storm tracks)
  const tracks = [height * 0.28, height * 0.72];
  tracks.forEach((trackY) => {
    for (let i = 0; i < 8; i++) {
      const tx = (i / 8) * width + 30;
      const rad = 35 + Math.random() * 50;
      const grad = ctx.createRadialGradient(tx, trackY, 0, tx, trackY, rad);
      grad.addColorStop(0, 'rgba(234, 179, 8, 0.75)'); // Moderate yellow rain (35 dBZ)
      grad.addColorStop(0.6, 'rgba(34, 197, 94, 0.5)'); // Green rain (25 dBZ)
      grad.addColorStop(1, 'rgba(34, 197, 94, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(tx, trackY, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Active Location Radar Cell
  const locX = ((activeLon + 180) / 360) * width;
  const locY = ((90 - activeLat) / 180) * height;
  const isRaining = [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(weatherCode) || precipitationMm > 0;
  const isSnowing = [71, 73, 75, 77, 85, 86].includes(weatherCode);

  const cellRadius = isRaining ? 95 : 55;
  const cellGrad = ctx.createRadialGradient(locX, locY, 0, locX, locY, cellRadius);

  if (weatherCode >= 95) {
    // Severe Thunderstorm convective core (purple/red/orange dBZ)
    cellGrad.addColorStop(0, 'rgba(168, 85, 247, 0.95)'); // Heavy hail/lightning purple
    cellGrad.addColorStop(0.35, 'rgba(239, 68, 68, 0.9)'); // High reflectivity red
    cellGrad.addColorStop(0.65, 'rgba(245, 158, 11, 0.7)'); // Yellow
    cellGrad.addColorStop(1, 'rgba(34, 197, 94, 0)');
  } else if (isRaining) {
    // Normal Rain Showers / Drizzle
    cellGrad.addColorStop(0, 'rgba(239, 68, 68, 0.85)'); // Red core
    cellGrad.addColorStop(0.3, 'rgba(234, 179, 8, 0.8)'); // Yellow
    cellGrad.addColorStop(0.65, 'rgba(34, 197, 94, 0.65)'); // Green
    cellGrad.addColorStop(1, 'rgba(14, 165, 233, 0)');
  } else if (isSnowing) {
    // Snow radar reflectivity (Cyan/White)
    cellGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    cellGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.7)');
    cellGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
  } else {
    // Clear/Dry radar sweep return (very faint green boundary echo)
    cellGrad.addColorStop(0, 'rgba(34, 197, 94, 0.45)');
    cellGrad.addColorStop(0.5, 'rgba(14, 165, 233, 0.25)');
    cellGrad.addColorStop(1, 'rgba(14, 165, 233, 0)');
  }

  ctx.fillStyle = cellGrad;
  ctx.beginPath();
  ctx.arc(locX, locY, cellRadius, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// 4. Procedural Wind Vector Velocity Heatmap Layer
function createProceduralWindTexture(windSpeedKmh: number, activeLat: number, activeLon: number): THREE.CanvasTexture {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, width, height);

  // Base oceanic wind current background
  ctx.fillStyle = 'rgba(2, 44, 34, 0.3)';
  ctx.fillRect(0, 0, width, height);

  // Jet streams bands in mid-latitudes (35° to 55° N and S)
  const jetBands = [height * 0.28, height * 0.72];
  jetBands.forEach((jy) => {
    const jetGrad = ctx.createLinearGradient(0, jy - 35, 0, jy + 35);
    jetGrad.addColorStop(0, 'rgba(13, 148, 136, 0.1)');
    jetGrad.addColorStop(0.5, 'rgba(20, 184, 166, 0.55)');
    jetGrad.addColorStop(1, 'rgba(13, 148, 136, 0.1)');
    ctx.fillStyle = jetGrad;
    ctx.fillRect(0, jy - 35, width, 70);
  });

  // Equatorial Trade Winds (-20° to +20°)
  const eqY = height * 0.5;
  const eqGrad = ctx.createLinearGradient(0, eqY - 45, 0, eqY + 45);
  eqGrad.addColorStop(0, 'rgba(14, 116, 144, 0.1)');
  eqGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.45)');
  eqGrad.addColorStop(1, 'rgba(14, 116, 144, 0.1)');
  ctx.fillStyle = eqGrad;
  ctx.fillRect(0, eqY - 45, width, 90);

  // Localized wind vector vortex
  const locX = ((activeLon + 180) / 360) * width;
  const locY = ((90 - activeLat) / 180) * height;
  const vortexRadius = 110;
  const vortexGrad = ctx.createRadialGradient(locX, locY, 0, locX, locY, vortexRadius);

  const speedColor =
    windSpeedKmh > 50
      ? 'rgba(239, 68, 68, 0.8)'
      : windSpeedKmh > 25
      ? 'rgba(245, 158, 11, 0.75)'
      : 'rgba(20, 184, 166, 0.75)';

  vortexGrad.addColorStop(0, speedColor);
  vortexGrad.addColorStop(0.5, speedColor.replace('0.8', '0.4').replace('0.75', '0.35'));
  vortexGrad.addColorStop(1, 'transparent');

  ctx.fillStyle = vortexGrad;
  ctx.beginPath();
  ctx.arc(locX, locY, vortexRadius, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

export function Globe3DModal({
  location,
  forecast,
  airQuality,
  onClose,
}: Globe3DModalProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  // Atmospheric Layer state
  const [selectedLayer, setSelectedLayer] = useState<AtmosphericLayer>('temperature');
  const [layerOpacity, setLayerOpacity] = useState<number>(0.85);
  const [showWindStreams, setShowWindStreams] = useState<boolean>(true);
  const [cloudSpeedMultiplier, setCloudSpeedMultiplier] = useState<number>(1);
  const [isHudCollapsed, setIsHudCollapsed] = useState<boolean>(false);

  // Three.js References
  const targetRotationRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const currentRotationRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const earthGroupRef = useRef<THREE.Group | null>(null);
  const cloudMeshRef = useRef<THREE.Mesh | null>(null);
  const tempMeshRef = useRef<THREE.Mesh | null>(null);
  const precipMeshRef = useRef<THREE.Mesh | null>(null);
  const windMeshRef = useRef<THREE.Mesh | null>(null);
  const windParticlesRef = useRef<THREE.Points | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const previousPointerPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  const cloudCover = forecast.current.cloud_cover ?? 35;
  const currentTemp = forecast.current.temperature_2m ?? 20;
  const windSpeedKmh = forecast.current.wind_speed_10m ?? 12;
  const windDirDeg = forecast.current.wind_direction_10m ?? 180;
  const precipitationMm = forecast.current.precipitation ?? 0;
  const weatherDesc = getWeatherDescription(forecast.current.weather_code ?? 0);
  const aqiInfo = airQuality?.current?.us_aqi != null ? getAqiDetails(airQuality.current.us_aqi) : null;

  const countryDisplayName = location.country && location.country.trim() !== ''
    ? location.country.toUpperCase()
    : 'GLOBAL METEOROLOGICAL STATION';
  const countryBadge = getCountryBadge(location.country);

  // Calculate centered rotation for active location
  const getCenterRotation = useCallback((lat: number, lon: number) => {
    const rotY = -((lon * Math.PI) / 180) - Math.PI / 2;
    const rotX = (lat * Math.PI) / 180;
    return { x: rotX, y: rotY };
  }, []);

  const recenterActiveLocation = useCallback(() => {
    const center = getCenterRotation(location.latitude, location.longitude);
    targetRotationRef.current = { ...center };
    if (cameraRef.current) {
      cameraRef.current.position.set(0, 0, 5.2);
    }
  }, [location.latitude, location.longitude, getCenterRotation]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Initialize Three.js Scene with Atmospheric Layers
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060b14);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 5.2);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff6dd, 2.2);
    sunLight.position.set(8, 4, 8);
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
    rimLight.position.set(-8, -2, -6);
    scene.add(rimLight);

    // Starfield Background
    const starsGeo = new THREE.BufferGeometry();
    const starCount = 800;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 60;
      starPositions[i + 1] = (Math.random() - 0.5) * 60;
      starPositions[i + 2] = (Math.random() - 0.5) * 60;
    }
    starsGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starsMat = new THREE.PointsMaterial({
      color: 0x94a3b8,
      size: 0.14,
      transparent: true,
      opacity: 0.75,
    });
    const stars = new THREE.Points(starsGeo, starsMat);
    scene.add(stars);

    // Earth Hierarchy Group
    const earthGroup = new THREE.Group();
    earthGroupRef.current = earthGroup;
    scene.add(earthGroup);

    const earthRadius = 2.0;

    // 1. Earth Base Sphere
    const earthGeo = new THREE.SphereGeometry(earthRadius, 64, 64);
    const earthTexture = createProceduralEarthTexture();
    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTexture,
      roughness: 0.65,
      metalness: 0.12,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthGroup.add(earthMesh);

    // 2. Atmospheric Temperature Layer (Thermal Heatmap)
    const tempGeo = new THREE.SphereGeometry(earthRadius * 1.008, 64, 64);
    const tempTexture = createProceduralTemperatureTexture(currentTemp, location.latitude, location.longitude);
    const tempMat = new THREE.MeshStandardMaterial({
      map: tempTexture,
      transparent: true,
      opacity: selectedLayer === 'temperature' ? layerOpacity : 0,
      depthWrite: false,
      roughness: 0.8,
    });
    const tempMesh = new THREE.Mesh(tempGeo, tempMat);
    tempMeshRef.current = tempMesh;
    earthGroup.add(tempMesh);

    // 3. Atmospheric Precipitation Radar Layer
    const precipGeo = new THREE.SphereGeometry(earthRadius * 1.014, 64, 64);
    const precipTexture = createProceduralPrecipitationTexture(
      forecast.current.weather_code ?? 0,
      location.latitude,
      location.longitude,
      precipitationMm
    );
    const precipMat = new THREE.MeshStandardMaterial({
      map: precipTexture,
      transparent: true,
      opacity: selectedLayer === 'precipitation' ? layerOpacity : 0,
      depthWrite: false,
      roughness: 0.8,
    });
    const precipMesh = new THREE.Mesh(precipGeo, precipMat);
    precipMeshRef.current = precipMesh;
    earthGroup.add(precipMesh);

    // 4. Atmospheric Wind Velocity Heatmap Layer
    const windGeo = new THREE.SphereGeometry(earthRadius * 1.016, 64, 64);
    const windTexture = createProceduralWindTexture(windSpeedKmh, location.latitude, location.longitude);
    const windMat = new THREE.MeshStandardMaterial({
      map: windTexture,
      transparent: true,
      opacity: selectedLayer === 'wind' ? layerOpacity : 0,
      depthWrite: false,
      roughness: 0.8,
    });
    const windMesh = new THREE.Mesh(windGeo, windMat);
    windMeshRef.current = windMesh;
    earthGroup.add(windMesh);

    // 5. Passing Clouds Layer
    const cloudRadius = earthRadius * 1.022;
    const cloudGeo = new THREE.SphereGeometry(cloudRadius, 64, 64);
    const cloudTexture = createProceduralCloudTexture(cloudCover);
    const cloudMat = new THREE.MeshStandardMaterial({
      map: cloudTexture,
      transparent: true,
      opacity: selectedLayer === 'clouds' ? layerOpacity : 0.4,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });
    const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    cloudMeshRef.current = cloudMesh;
    earthGroup.add(cloudMesh);

    // 6. Dynamic Wind Streamline Particles (Circulation System)
    const streamCount = 900;
    const streamGeo = new THREE.BufferGeometry();
    const streamPositions = new Float32Array(streamCount * 3);
    const streamVelocities = new Float32Array(streamCount * 3);
    const streamColors = new Float32Array(streamCount * 3);

    for (let i = 0; i < streamCount; i++) {
      // Sample latitudes with concentration in Trade Winds and Westerlies
      const lat = (Math.random() - 0.5) * 150;
      const lon = (Math.random() - 0.5) * 360;
      const v = latLonToVector3(lat, lon, earthRadius * 1.026);
      streamPositions[i * 3] = v.x;
      streamPositions[i * 3 + 1] = v.y;
      streamPositions[i * 3 + 2] = v.z;

      // Speed and direction based on latitude belts
      const speed = (0.015 + Math.random() * 0.02) * (Math.abs(lat) < 25 ? -1 : 1);
      streamVelocities[i * 3] = lat;
      streamVelocities[i * 3 + 1] = lon;
      streamVelocities[i * 3 + 2] = speed;

      // Color from cyan to teal to amber
      const isFast = Math.abs(lat) > 30 && Math.abs(lat) < 60;
      streamColors[i * 3] = isFast ? 0.96 : 0.22;
      streamColors[i * 3 + 1] = isFast ? 0.75 : 0.78;
      streamColors[i * 3 + 2] = isFast ? 0.2 : 0.98;
    }

    streamGeo.setAttribute('position', new THREE.BufferAttribute(streamPositions, 3));
    streamGeo.setAttribute('color', new THREE.BufferAttribute(streamColors, 3));

    const streamMat = new THREE.PointsMaterial({
      size: 0.045,
      vertexColors: true,
      transparent: true,
      opacity: showWindStreams ? 0.85 : 0,
      depthWrite: false,
    });
    const windParticles = new THREE.Points(streamGeo, streamMat);
    windParticlesRef.current = windParticles;
    earthGroup.add(windParticles);

    // 7. Outer Atmosphere Glow
    const atmoRadius = earthRadius * 1.048;
    const atmoGeo = new THREE.SphereGeometry(atmoRadius, 48, 48);
    const atmoMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.68 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.2);
          gl_FragColor = vec4(0.22, 0.74, 0.97, 1.0) * intensity * 0.9;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
    const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
    scene.add(atmoMesh);

    // 8. Active Location Beacon & Marker
    const markerGroup = new THREE.Group();
    const locPos = latLonToVector3(location.latitude, location.longitude, earthRadius);
    markerGroup.position.copy(locPos);
    markerGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), locPos.clone().normalize());

    // Beacon cylinder (vertical beam)
    const beamGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.45, 16);
    beamGeo.translate(0, 0.225, 0);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.85,
    });
    const beamMesh = new THREE.Mesh(beamGeo, beamMat);
    markerGroup.add(beamMesh);

    // Pin head sphere
    const pinHeadGeo = new THREE.SphereGeometry(0.05, 16, 16);
    pinHeadGeo.translate(0, 0.45, 0);
    const pinHeadMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xfacc15,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.8,
    });
    const pinHeadMesh = new THREE.Mesh(pinHeadGeo, pinHeadMat);
    markerGroup.add(pinHeadMesh);

    // Pulsing ground ripple ring
    const ringGeo = new THREE.RingGeometry(0.04, 0.09, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    markerGroup.add(ringMesh);

    // Rotating radar scan line
    const sweepGeo = new THREE.RingGeometry(0.08, 0.22, 32, 1, 0, Math.PI / 3);
    sweepGeo.rotateX(-Math.PI / 2);
    const sweepMat = new THREE.MeshBasicMaterial({
      color: 0x4ade80,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    const sweepMesh = new THREE.Mesh(sweepGeo, sweepMat);
    markerGroup.add(sweepMesh);

    earthGroup.add(markerGroup);

    // Set initial rotation so Active Location is centered
    const initialCenter = getCenterRotation(location.latitude, location.longitude);
    currentRotationRef.current = { ...initialCenter };
    targetRotationRef.current = { ...initialCenter };
    earthGroup.rotation.x = initialCenter.x;
    earthGroup.rotation.y = initialCenter.y;

    // Interaction Handlers (drag to orbit)
    const handlePointerDown = (clientX: number, clientY: number) => {
      isDraggingRef.current = true;
      previousPointerPosRef.current = { x: clientX, y: clientY };
    };

    const handlePointerMove = (clientX: number, clientY: number) => {
      if (!isDraggingRef.current) return;
      const deltaX = clientX - previousPointerPosRef.current.x;
      const deltaY = clientY - previousPointerPosRef.current.y;
      previousPointerPosRef.current = { x: clientX, y: clientY };

      targetRotationRef.current.y += deltaX * 0.005;
      targetRotationRef.current.x = Math.max(
        -Math.PI / 2 + 0.1,
        Math.min(Math.PI / 2 - 0.1, targetRotationRef.current.x + deltaY * 0.005)
      );
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!cameraRef.current) return;
      const newZ = cameraRef.current.position.z + e.deltaY * 0.003;
      cameraRef.current.position.z = Math.max(3.2, Math.min(8.0, newZ));
    };

    const dom = renderer.domElement;
    const onMouseDown = (e: MouseEvent) => handlePointerDown(e.clientX, e.clientY);
    const onMouseMove = (e: MouseEvent) => handlePointerMove(e.clientX, e.clientY);
    const onMouseUp = () => handlePointerUp();
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches[0]) handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onTouchEnd = () => handlePointerUp();

    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    dom.addEventListener('wheel', handleWheel, { passive: false });

    // Window Resize Handler
    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Animation Loop
    let animId = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Smooth damping interpolation towards target rotation
      if (earthGroupRef.current) {
        currentRotationRef.current.x = THREE.MathUtils.damp(
          currentRotationRef.current.x,
          targetRotationRef.current.x,
          10,
          delta
        );
        currentRotationRef.current.y = THREE.MathUtils.damp(
          currentRotationRef.current.y,
          targetRotationRef.current.y,
          10,
          delta
        );
        earthGroupRef.current.rotation.x = currentRotationRef.current.x;
        earthGroupRef.current.rotation.y = currentRotationRef.current.y;
      }

      // Dynamic Cloud Passing Animation
      if (cloudMeshRef.current) {
        const cloudSpeed = 0.05 * cloudSpeedMultiplier;
        cloudMeshRef.current.rotation.y += cloudSpeed * delta;
      }

      // Dynamic Wind Streamline Particles Update
      if (windParticlesRef.current && showWindStreams) {
        const positions = streamGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < streamCount; i++) {
          let lon = streamVelocities[i * 3 + 1];
          const speed = streamVelocities[i * 3 + 2];
          lon += speed * 35 * delta;
          if (lon > 180) lon = -180;
          if (lon < -180) lon = 180;
          streamVelocities[i * 3 + 1] = lon;

          const lat = streamVelocities[i * 3];
          const v = latLonToVector3(lat, lon, earthRadius * 1.026);
          positions[i * 3] = v.x;
          positions[i * 3 + 1] = v.y;
          positions[i * 3 + 2] = v.z;
        }
        streamGeo.attributes.position.needsUpdate = true;
      }

      // Ring ripple & radar sweep animation
      if (ringMesh) {
        const scale = 1 + Math.sin(elapsed * 2.5) * 0.25;
        ringMesh.scale.set(scale, scale, scale);
        ringMat.opacity = 0.5 + Math.cos(elapsed * 2.5) * 0.3;
      }

      if (sweepMesh) {
        sweepMesh.rotation.z += 2.2 * delta;
      }

      stars.rotation.y += 0.015 * delta;

      renderer.render(scene, camera);
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);

    // Cleanup on unmount
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      dom.removeEventListener('wheel', handleWheel);

      earthGeo.dispose();
      earthTexture.dispose();
      earthMat.dispose();
      tempGeo.dispose();
      tempTexture.dispose();
      tempMat.dispose();
      precipGeo.dispose();
      precipTexture.dispose();
      precipMat.dispose();
      windGeo.dispose();
      windTexture.dispose();
      windMat.dispose();
      cloudGeo.dispose();
      cloudTexture.dispose();
      cloudMat.dispose();
      streamGeo.dispose();
      streamMat.dispose();
      atmoGeo.dispose();
      atmoMat.dispose();
      starsGeo.dispose();
      starsMat.dispose();
      beamGeo.dispose();
      beamMat.dispose();
      pinHeadGeo.dispose();
      pinHeadMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      sweepGeo.dispose();
      sweepMat.dispose();

      renderer.dispose();
      if (container.contains(dom)) {
        container.removeChild(dom);
      }
    };
  }, [
    location,
    cloudCover,
    currentTemp,
    windSpeedKmh,
    precipitationMm,
    getCenterRotation,
    cloudSpeedMultiplier,
  ]);

  // Synchronize dynamic layer visibility & opacities
  useEffect(() => {
    if (tempMeshRef.current) {
      const mat = tempMeshRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = selectedLayer === 'temperature' ? layerOpacity : 0;
      tempMeshRef.current.visible = selectedLayer === 'temperature';
    }
    if (precipMeshRef.current) {
      const mat = precipMeshRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = selectedLayer === 'precipitation' ? layerOpacity : 0;
      precipMeshRef.current.visible = selectedLayer === 'precipitation';
    }
    if (windMeshRef.current) {
      const mat = windMeshRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = selectedLayer === 'wind' ? layerOpacity : 0;
      windMeshRef.current.visible = selectedLayer === 'wind';
    }
    if (cloudMeshRef.current) {
      const mat = cloudMeshRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = selectedLayer === 'clouds' ? layerOpacity : 0.42;
      cloudMeshRef.current.visible = selectedLayer === 'clouds' || selectedLayer === 'precipitation';
    }
  }, [selectedLayer, layerOpacity]);

  // Synchronize wind streams visibility
  useEffect(() => {
    if (windParticlesRef.current) {
      const mat = windParticlesRef.current.material as THREE.PointsMaterial;
      mat.opacity = showWindStreams ? 0.85 : 0;
      windParticlesRef.current.visible = showWindStreams;
    }
  }, [showWindStreams]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-slate-100 select-none overflow-hidden animate-fade-in"
      data-testid="modal-3d-globe"
      role="dialog"
      aria-label="3D Earth Weather Globe"
    >
      {/* 3D Canvas Mount Container */}
      <div
        ref={mountRef}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing z-0"
        title="Drag to orbit the globe · Scroll to zoom"
      />

      {/* Top Header HUD (Country Prominence & Close) */}
      <header className="relative z-10 flex items-center justify-between p-4 md:px-8 bg-slate-950/75 border-b border-slate-800/80 pointer-events-auto backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-900 flex items-center justify-center font-bold shadow-lg shadow-amber-400/20">
            <Globe2 size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl" role="img" aria-label="Country Flag">
                {countryBadge}
              </span>
              <h1 className="text-lg md:text-xl font-bold tracking-tight text-white uppercase font-display">
                {countryDisplayName}
              </h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
                Active Location
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-400 font-medium flex items-center gap-2">
              <MapPin size={13} className="text-amber-400" />
              <span>{location.name}</span>
              {location.admin1 && <span>· {location.admin1}</span>}
              <span className="text-slate-500 font-data">
                ({location.latitude.toFixed(2)}°, {location.longitude.toFixed(2)}°)
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={recenterActiveLocation}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
            title="Re-center active location in 3D view"
            data-testid="button-recenter-globe"
          >
            <RotateCcw size={14} className="text-amber-400" />
            <span className="hidden sm:inline">Center Location</span>
          </button>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg bg-slate-800/90 hover:bg-rose-500 text-slate-200 hover:text-white flex items-center justify-center border border-slate-700 transition"
            aria-label="Close 3D Globe"
            data-testid="button-close-globe"
          >
            <X size={20} />
          </button>
        </div>
      </header>

      {/* Floating Center Overlay: Active Location Country Pill (Center Visibility Requirement) */}
      <div className="pointer-events-none absolute top-20 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center">
        <div className="px-4 py-1.5 rounded-full bg-slate-900/85 border border-amber-400/40 shadow-xl shadow-black/50 text-center flex items-center gap-2.5 backdrop-blur-md">
          <span className="text-base">{countryBadge}</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-300">
            {countryDisplayName}
          </span>
          <span className="text-slate-500 text-xs">|</span>
          <span className="text-xs text-slate-200 font-medium">{location.name}</span>
          <span className="text-xs text-sky-400 font-data">
            {cloudCover}% Clouds Passing
          </span>
        </div>
      </div>

      {/* Non-Occluding Bottom Dock HUD */}
      <footer className="relative z-10 mt-auto p-4 md:px-8 pointer-events-auto flex flex-col items-center">
        {/* Toggle Collapse Button */}
        <button
          onClick={() => setIsHudCollapsed(!isHudCollapsed)}
          className="mb-2 px-3 py-1 rounded-full bg-slate-900/90 hover:bg-slate-800 text-slate-300 text-xs border border-slate-700 flex items-center gap-1 transition shadow-md backdrop-blur-md"
          data-testid="button-toggle-globe-hud"
        >
          {isHudCollapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          <span>{isHudCollapsed ? 'Show Conditions Dock' : 'Hide Conditions Dock'}</span>
        </button>

        {!isHudCollapsed && (
          <div className="w-full max-w-5xl rounded-2xl bg-slate-900/90 border border-slate-800/90 p-4 shadow-2xl shadow-black/80 backdrop-blur-xl">
            {/* Atmospheric Layer Switcher Bar (Temperature, Wind, Precipitation, Clouds) */}
            <div className="mb-4 pb-3 border-b border-slate-800/80">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 text-xs text-slate-300">
                  <Layers size={14} className="text-amber-400" />
                  <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-400">
                    Atmospheric Layer:
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Temperature Layer Button */}
                  <button
                    onClick={() => setSelectedLayer('temperature')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                      selectedLayer === 'temperature'
                        ? 'bg-amber-500/25 text-amber-300 border-amber-400/50 shadow-md shadow-amber-500/10'
                        : 'bg-slate-800/70 text-slate-400 border-slate-700 hover:text-slate-200'
                    }`}
                    data-testid="layer-btn-temperature"
                  >
                    <Thermometer size={14} className="text-amber-400" />
                    <span>Temperature</span>
                    <span className="text-[10px] font-data px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-200">
                      {Math.round(currentTemp)}°C
                    </span>
                  </button>

                  {/* Wind Layer Button */}
                  <button
                    onClick={() => setSelectedLayer('wind')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                      selectedLayer === 'wind'
                        ? 'bg-teal-500/25 text-teal-300 border-teal-400/50 shadow-md shadow-teal-500/10'
                        : 'bg-slate-800/70 text-slate-400 border-slate-700 hover:text-slate-200'
                    }`}
                    data-testid="layer-btn-wind"
                  >
                    <Wind size={14} className="text-teal-400" />
                    <span>Wind Stream</span>
                    <span className="text-[10px] font-data px-1.5 py-0.2 rounded bg-teal-400/20 text-teal-200">
                      {Math.round(windSpeedKmh)} km/h
                    </span>
                  </button>

                  {/* Precipitation Radar Layer Button */}
                  <button
                    onClick={() => setSelectedLayer('precipitation')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                      selectedLayer === 'precipitation'
                        ? 'bg-emerald-500/25 text-emerald-300 border-emerald-400/50 shadow-md shadow-emerald-500/10'
                        : 'bg-slate-800/70 text-slate-400 border-slate-700 hover:text-slate-200'
                    }`}
                    data-testid="layer-btn-precipitation"
                  >
                    <Radar size={14} className="text-emerald-400" />
                    <span>Precipitation</span>
                    <span className="text-[10px] font-data px-1.5 py-0.2 rounded bg-emerald-400/20 text-emerald-200">
                      {precipitationMm > 0 ? `${precipitationMm} mm` : weatherDesc.label}
                    </span>
                  </button>

                  {/* Clouds Satellite Layer Button */}
                  <button
                    onClick={() => setSelectedLayer('clouds')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
                      selectedLayer === 'clouds'
                        ? 'bg-sky-500/25 text-sky-300 border-sky-400/50 shadow-md shadow-sky-500/10'
                        : 'bg-slate-800/70 text-slate-400 border-slate-700 hover:text-slate-200'
                    }`}
                    data-testid="layer-btn-clouds"
                  >
                    <Cloud size={14} className="text-sky-400" />
                    <span>Clouds</span>
                    <span className="text-[10px] font-data px-1.5 py-0.2 rounded bg-sky-400/20 text-sky-200">
                      {cloudCover}%
                    </span>
                  </button>

                  {/* Wind Particle Streamlines Overlay Toggle */}
                  <button
                    onClick={() => setShowWindStreams(!showWindStreams)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition ${
                      showWindStreams
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                        : 'bg-slate-800/50 text-slate-500 border-slate-700/60'
                    }`}
                    title="Toggle animated global wind circulation vectors"
                    data-testid="button-toggle-streamlines"
                  >
                    <Sparkles size={12} />
                    <span className="hidden sm:inline">Wind Vectors:</span>
                    <span>{showWindStreams ? 'ON' : 'OFF'}</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Atmospheric Legend Bar */}
              <div className="mt-3 pt-2.5 border-t border-slate-800/50 flex flex-wrap items-center justify-between gap-3 text-xs">
                {selectedLayer === 'temperature' && (
                  <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-slate-400 text-[11px] flex items-center gap-1">
                      <Thermometer size={12} className="text-amber-400" />
                      Global Surface Temperature Gradient:
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-data text-purple-400">-25°C</span>
                      <div className="h-2 w-48 sm:w-64 rounded-full bg-gradient-to-r from-purple-800 via-cyan-500 via-emerald-500 via-amber-400 to-rose-600 border border-slate-700 shadow-inner" />
                      <span className="text-[10px] font-data text-rose-400">+45°C</span>
                    </div>
                  </div>
                )}

                {selectedLayer === 'wind' && (
                  <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-slate-400 text-[11px] flex items-center gap-1">
                      <Wind size={12} className="text-teal-400" />
                      Global Atmospheric Circulation Velocity:
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-data text-sky-400">0 km/h</span>
                      <div className="h-2 w-48 sm:w-64 rounded-full bg-gradient-to-r from-slate-700 via-teal-500 via-cyan-400 via-amber-400 to-rose-600 border border-slate-700 shadow-inner" />
                      <span className="text-[10px] font-data text-rose-400">80+ km/h</span>
                    </div>
                  </div>
                )}

                {selectedLayer === 'precipitation' && (
                  <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-slate-400 text-[11px] flex items-center gap-1">
                      <Radar size={12} className="text-emerald-400" />
                      Doppler Radar Reflectivity (dBZ / mm/h):
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-data text-emerald-400">Light (20 dBZ)</span>
                      <div className="h-2 w-48 sm:w-64 rounded-full bg-gradient-to-r from-emerald-500 via-yellow-400 via-orange-500 via-rose-600 to-purple-600 border border-slate-700 shadow-inner" />
                      <span className="text-[10px] font-data text-purple-400">Severe (55+ dBZ)</span>
                    </div>
                  </div>
                )}

                {selectedLayer === 'clouds' && (
                  <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-slate-400 text-[11px] flex items-center gap-1">
                      <Cloud size={12} className="text-sky-400" />
                      Atmospheric Cloud Cover Density:
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-data text-slate-400">0% Clear</span>
                      <div className="h-2 w-48 sm:w-64 rounded-full bg-gradient-to-r from-transparent via-sky-300/40 to-white border border-slate-700 shadow-inner" />
                      <span className="text-[10px] font-data text-white">100% Dense</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Meteorological Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {/* Cloud Coverage */}
              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex flex-col">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium flex items-center gap-1.5 mb-1">
                  <Cloud size={13} className="text-sky-400" />
                  Cloud Condition
                </span>
                <span className="text-base font-bold text-white flex items-center gap-1.5">
                  <span>{cloudCover}% Covered</span>
                </span>
                <span className="text-[11px] text-sky-300 mt-0.5">
                  {cloudCover >= 70
                    ? 'Dense passing overcast'
                    : cloudCover >= 30
                    ? 'Scattered passing clouds'
                    : 'Clear atmospheric skies'}
                </span>
              </div>

              {/* Weather Status */}
              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex flex-col">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium flex items-center gap-1.5 mb-1">
                  <Sun size={13} className="text-amber-400" />
                  Live Condition
                </span>
                <span className="text-base font-bold text-white flex items-center gap-1.5">
                  <span>{weatherDesc.icon}</span>
                  <span className="truncate">{weatherDesc.label}</span>
                </span>
                <span className="text-[11px] text-amber-300 mt-0.5">
                  Temp: {Math.round(forecast.current.temperature_2m)}°C (Feels{' '}
                  {Math.round(forecast.current.apparent_temperature)}°C)
                </span>
              </div>

              {/* Air Quality (AQI) */}
              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex flex-col">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium flex items-center gap-1.5 mb-1">
                  <Activity size={13} className="text-emerald-400" />
                  Air Quality
                </span>
                <span className="text-base font-bold text-white flex items-center gap-1.5">
                  {aqiInfo ? (
                    <>
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block"
                        style={{ backgroundColor: aqiInfo.color }}
                      />
                      <span>AQI {airQuality?.current.us_aqi}</span>
                      <span className="text-xs font-normal text-slate-300">
                        ({aqiInfo.level})
                      </span>
                    </>
                  ) : (
                    <span>AQI --</span>
                  )}
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5">
                  PM2.5: {airQuality?.current.pm2_5 != null ? `${airQuality.current.pm2_5.toFixed(1)} µg/m³` : '--'}
                </span>
              </div>

              {/* Wind Speed & Direction */}
              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex flex-col">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium flex items-center gap-1.5 mb-1">
                  <Wind size={13} className="text-teal-400" />
                  Wind & Motion
                </span>
                <span className="text-base font-bold text-white">
                  {Math.round(forecast.current.wind_speed_10m)} km/h
                </span>
                <span className="text-[11px] text-teal-300 mt-0.5">
                  Direction: {Math.round(forecast.current.wind_direction_10m)}°
                  {forecast.current.wind_gusts_10m && ` · Gusts ${Math.round(forecast.current.wind_gusts_10m)} km/h`}
                </span>
              </div>
            </div>

            {/* Interactive 3D Controls Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800 text-xs">
              {/* Cloud Passing Speed Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-slate-400 flex items-center gap-1">
                  <Cloud size={13} className="text-sky-400" />
                  Passing Speed:
                </span>
                <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                  <button
                    onClick={() => setCloudSpeedMultiplier(0)}
                    className={`px-2 py-1 rounded-md transition ${
                      cloudSpeedMultiplier === 0
                        ? 'bg-amber-400 text-slate-900 font-semibold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Pause
                  </button>
                  <button
                    onClick={() => setCloudSpeedMultiplier(0.5)}
                    className={`px-2 py-1 rounded-md transition ${
                      cloudSpeedMultiplier === 0.5
                        ? 'bg-amber-400 text-slate-900 font-semibold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    0.5x
                  </button>
                  <button
                    onClick={() => setCloudSpeedMultiplier(1)}
                    className={`px-2 py-1 rounded-md transition ${
                      cloudSpeedMultiplier === 1
                        ? 'bg-amber-400 text-slate-900 font-semibold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    1.0x
                  </button>
                  <button
                    onClick={() => setCloudSpeedMultiplier(2)}
                    className={`px-2 py-1 rounded-md transition ${
                      cloudSpeedMultiplier === 2
                        ? 'bg-amber-400 text-slate-900 font-semibold'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    2.0x
                  </button>
                </div>
              </div>

              {/* Layer Opacity Slider & Focus Location */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Sliders size={12} />
                  <span>Layer Opacity:</span>
                  <input
                    type="range"
                    min="0.2"
                    max="1"
                    step="0.05"
                    value={layerOpacity}
                    onChange={(e) => setLayerOpacity(parseFloat(e.target.value))}
                    className="w-20 accent-amber-400 cursor-pointer"
                  />
                  <span className="font-data text-[10px] text-slate-300">{Math.round(layerOpacity * 100)}%</span>
                </div>

                <button
                  onClick={recenterActiveLocation}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/40 transition font-medium"
                  data-testid="button-center-active"
                >
                  <MapPin size={13} />
                  <span>Focus {location.name}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </footer>
    </div>
  );
}

export default Globe3DModal;
