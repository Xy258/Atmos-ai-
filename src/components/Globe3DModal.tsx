import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  X,
  RotateCcw,
  Wind,
  Cloud,
  Sun,
  Thermometer,
  MapPin,
  Globe2,
  ChevronDown,
  ChevronUp,
  Radar,
  Sliders,
  Sparkles,
  Plus,
  Minus,
  Play,
  Pause,
  Compass,
  Moon,
  Satellite,
  Layers,
} from 'lucide-react';
import type { Location, Forecast, AirQuality } from '../App';
import { getAqiDetails } from '../App';
import { cleanCityOrVillageName, cleanCountryName } from '@/lib/locationUtils';

export type AtmosphericLayer = 'none' | 'clouds' | 'temperature' | 'wind' | 'precipitation';
export type GlobeMapMode = 'satellite' | 'night';

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

// Weather Code Description Helper
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

// Safe check to determine if WebGL context can be created without crashing or context loss
function isWebGLAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (!window.WebGLRenderingContext) return false;
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) ||
      canvas.getContext('webgl', { failIfMajorPerformanceCaveat: false });
    return !!(gl && !(gl as any).isContextLost?.());
  } catch {
    return false;
  }
}

// Cached GeoJSON country borders
let cachedCountryGeoJson: any = null;

// ============================================================================
// HIGH-FIDELITY PROCEDURAL FALLBACK EARTH TEXTURE (WebGL Mode)
// ============================================================================
function createProceduralEarthTexture(): THREE.CanvasTexture {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const oceanGrad = ctx.createLinearGradient(0, 0, 0, height);
  oceanGrad.addColorStop(0, '#102a45');
  oceanGrad.addColorStop(0.5, '#0b1d3a');
  oceanGrad.addColorStop(1, '#0e243d');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#2d5a37';
  const drawLand = (cx: number, cy: number, rx: number, ry: number) => {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  };

  drawLand(width * 0.62, height * 0.32, 140, 75);
  drawLand(width * 0.54, height * 0.55, 65, 95);
  drawLand(width * 0.26, height * 0.32, 85, 70);
  drawLand(width * 0.32, height * 0.65, 55, 90);
  drawLand(width * 0.82, height * 0.72, 55, 45);
  drawLand(width * 0.67, height * 0.44, 38, 38);

  ctx.fillStyle = '#8c7853';
  drawLand(width * 0.53, height * 0.45, 45, 25);
  drawLand(width * 0.62, height * 0.42, 35, 20);

  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(0, 0, width, 25);
  ctx.fillRect(0, height - 35, width, 35);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Country borders canvas texture for WebGL 3D
function createCountryBordersTexture(geoJsonData: any): THREE.CanvasTexture {
  const width = 2048;
  const height = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, width, height);

  const project = (lon: number, lat: number): [number, number] => [
    ((lon + 180) / 360) * width,
    ((90 - lat) / 180) * height,
  ];

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
  ctx.lineWidth = 1;
  for (let lat = -75; lat <= 75; lat += 30) {
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

  if (geoJsonData && Array.isArray(geoJsonData.features)) {
    ctx.save();
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.85)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 2]);

    const drawRing = (coords: number[][]) => {
      if (!coords || coords.length < 2) return;
      let isDrawing = false;
      for (let i = 0; i < coords.length; i++) {
        const [lon, lat] = coords[i];
        const p = project(lon, lat);
        if (i === 0) {
          ctx.beginPath();
          ctx.moveTo(p[0], p[1]);
          isDrawing = true;
        } else {
          const prevLon = coords[i - 1][0];
          if (Math.abs(lon - prevLon) > 180) {
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(p[0], p[1]);
          } else {
            ctx.lineTo(p[0], p[1]);
          }
        }
      }
      if (isDrawing) ctx.stroke();
    };

    geoJsonData.features.forEach((feature: any) => {
      const geom = feature.geometry;
      if (!geom) return;
      if (geom.type === 'Polygon') {
        geom.coordinates.forEach((ring: number[][]) => drawRing(ring));
      } else if (geom.type === 'MultiPolygon') {
        geom.coordinates.forEach((poly: number[][][]) => {
          poly.forEach((ring: number[][]) => drawRing(ring));
        });
      }
    });

    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// Procedural Clouds Texture
function createProceduralCloudTexture(cloudCoverPercentage: number): THREE.CanvasTexture {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, width, height);
  const density = Math.max(0.15, Math.min(0.68, (cloudCoverPercentage / 100) * 0.65));
  const numCloudPuffs = Math.floor(75 * density) + 20;

  ctx.save();
  const eqY = height * 0.5;
  for (let i = 0; i < 28; i++) {
    const x = (i / 28) * width + (Math.random() - 0.5) * 30;
    const y = eqY + Math.sin(i * 0.4) * 22 + (Math.random() - 0.5) * 16;
    const rad = 24 + Math.random() * 32;
    const alpha = 0.22 + Math.random() * 0.28;

    const grad = ctx.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, `rgba(255, 255, 255, ${alpha.toFixed(2)})`);
    grad.addColorStop(0.6, `rgba(240, 248, 255, ${(alpha * 0.45).toFixed(2)})`);
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < numCloudPuffs; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const radius = 18 + Math.random() * 38;
    const alpha = 0.12 + Math.random() * 0.25;

    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, `rgba(255, 255, 255, ${alpha.toFixed(2)})`);
    grad.addColorStop(0.5, `rgba(240, 248, 255, ${(alpha * 0.4).toFixed(2)})`);
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// Procedural Temperature Texture
function createProceduralTemperatureTexture(currentTemp: number, activeLat: number, activeLon: number): THREE.CanvasTexture {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, width, height);

  const tempGrad = ctx.createLinearGradient(0, 0, 0, height);
  tempGrad.addColorStop(0, 'rgba(59, 7, 100, 0.45)');
  tempGrad.addColorStop(0.18, 'rgba(6, 182, 212, 0.42)');
  tempGrad.addColorStop(0.35, 'rgba(16, 185, 129, 0.40)');
  tempGrad.addColorStop(0.48, 'rgba(245, 158, 11, 0.45)');
  tempGrad.addColorStop(0.52, 'rgba(239, 68, 68, 0.48)');
  tempGrad.addColorStop(0.65, 'rgba(245, 158, 11, 0.45)');
  tempGrad.addColorStop(0.82, 'rgba(16, 185, 129, 0.40)');
  tempGrad.addColorStop(1, 'rgba(30, 27, 75, 0.50)');

  ctx.fillStyle = tempGrad;
  ctx.fillRect(0, 0, width, height);

  const locX = ((activeLon + 180) / 360) * width;
  const locY = ((90 - activeLat) / 180) * height;
  const locRadius = 120;

  let localColor = 'rgba(245, 158, 11, 0.65)';
  if (currentTemp <= -5) localColor = 'rgba(59, 7, 100, 0.65)';
  else if (currentTemp <= 8) localColor = 'rgba(6, 182, 212, 0.65)';
  else if (currentTemp <= 18) localColor = 'rgba(16, 185, 129, 0.65)';
  else if (currentTemp <= 28) localColor = 'rgba(245, 158, 11, 0.65)';
  else localColor = 'rgba(239, 68, 68, 0.70)';

  const localGrad = ctx.createRadialGradient(locX, locY, 0, locX, locY, locRadius);
  localGrad.addColorStop(0, localColor);
  localGrad.addColorStop(0.6, localColor.replace(/0\.\d+/, '0.25'));
  localGrad.addColorStop(1, 'transparent');

  ctx.fillStyle = localGrad;
  ctx.beginPath();
  ctx.arc(locX, locY, locRadius, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// Procedural Precipitation Texture
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

  const locX = ((activeLon + 180) / 360) * width;
  const locY = ((90 - activeLat) / 180) * height;
  const isRaining = [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(weatherCode) || precipitationMm > 0;
  const isSnowing = [71, 73, 75, 77, 85, 86].includes(weatherCode);

  const cellRadius = isRaining ? 85 : 45;
  const cellGrad = ctx.createRadialGradient(locX, locY, 0, locX, locY, cellRadius);

  if (weatherCode >= 95) {
    cellGrad.addColorStop(0, 'rgba(168, 85, 247, 0.90)');
    cellGrad.addColorStop(0.35, 'rgba(239, 68, 68, 0.85)');
    cellGrad.addColorStop(0.65, 'rgba(245, 158, 11, 0.65)');
    cellGrad.addColorStop(1, 'rgba(34, 197, 94, 0)');
  } else if (isRaining) {
    cellGrad.addColorStop(0, 'rgba(239, 68, 68, 0.80)');
    cellGrad.addColorStop(0.35, 'rgba(234, 179, 8, 0.75)');
    cellGrad.addColorStop(0.7, 'rgba(34, 197, 94, 0.60)');
    cellGrad.addColorStop(1, 'rgba(14, 165, 233, 0)');
  } else if (isSnowing) {
    cellGrad.addColorStop(0, 'rgba(255, 255, 255, 0.90)');
    cellGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.65)');
    cellGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
  } else {
    cellGrad.addColorStop(0, 'rgba(34, 197, 94, 0.35)');
    cellGrad.addColorStop(0.5, 'rgba(14, 165, 233, 0.18)');
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

// Procedural Wind Texture
function createProceduralWindTexture(windSpeedKmh: number, activeLat: number, activeLon: number): THREE.CanvasTexture {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, width, height);

  const locX = ((activeLon + 180) / 360) * width;
  const locY = ((90 - activeLat) / 180) * height;
  const vortexRadius = 95;
  const vortexGrad = ctx.createRadialGradient(locX, locY, 0, locX, locY, vortexRadius);

  const speedColor =
    windSpeedKmh > 50
      ? 'rgba(239, 68, 68, 0.75)'
      : windSpeedKmh > 25
      ? 'rgba(245, 158, 11, 0.70)'
      : 'rgba(20, 184, 166, 0.70)';

  vortexGrad.addColorStop(0, speedColor);
  vortexGrad.addColorStop(0.5, speedColor.replace(/0\.\d+/, '0.35'));
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

// ============================================================================
// 2D ORTHOGRAPHIC PROJECTION MATHEMATICS
// Converts geographic [longitude, latitude] into 2D screen coordinates on spinning sphere
// ============================================================================
interface OrthoPoint {
  x: number;
  y: number;
  z: number;
  visible: boolean;
}

function projectOrthographic(
  lon: number,
  lat: number,
  rotX: number,
  rotY: number,
  radius: number,
  cx: number,
  cy: number
): OrthoPoint {
  const lambda = (lon * Math.PI) / 180;
  const phi = (lat * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  // 3D Cartesian coordinates on unit sphere
  const x0 = cosPhi * Math.sin(lambda);
  const y0 = sinPhi;
  const z0 = cosPhi * Math.cos(lambda);

  // Rotate around Y axis (longitude rotation)
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const x1 = x0 * cosY + z0 * sinY;
  const y1 = y0;
  const z1 = -x0 * sinY + z0 * cosY;

  // Rotate around X axis (latitude tilt)
  const cosX = Math.cos(rotX);
  const sinX = Math.sin(rotX);
  const x2 = x1;
  const y2 = y1 * cosX - z1 * sinX;
  const z2 = y1 * sinX + z1 * cosX;

  return {
    x: cx + x2 * radius,
    y: cy - y2 * radius,
    z: z2,
    visible: z2 > -0.05,
  };
}

// ============================================================================
// MAIN GLOBE 3D / 2D HYBRID MODAL
// ============================================================================
export function Globe3DModal({
  location,
  forecast,
  airQuality,
  onClose,
}: Globe3DModalProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const canvas2DRef = useRef<HTMLCanvasElement>(null);

  // Mode: 3D WebGL (if supported & hardware accelerated) vs 2D Precision Canvas (failsafe fallback)
  const [use2DFallback, setUse2DFallback] = useState<boolean>(() => !isWebGLAvailable());
  const [mapMode, setMapMode] = useState<GlobeMapMode>('satellite');
  const [selectedLayer, setSelectedLayer] = useState<AtmosphericLayer>('temperature');
  const [layerOpacity, setLayerOpacity] = useState<number>(0.85);
  const [showWindStreams, setShowWindStreams] = useState<boolean>(true);
  const [showBorders, setShowBorders] = useState<boolean>(true);
  const [isAutoRotating, setIsAutoRotating] = useState<boolean>(true);
  const [isStationCardCollapsed, setIsStationCardCollapsed] = useState<boolean>(true);
  const [geoJsonData, setGeoJsonData] = useState<any>(cachedCountryGeoJson);
  const [zoomScale, setZoomScale] = useState<number>(1.0);

  // Shared Rotation Target & Current Refs
  const targetRotationRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const currentRotationRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRef = useRef<boolean>(false);
  const previousPointerPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // WebGL Specific Refs
  const earthGroupRef = useRef<THREE.Group | null>(null);
  const earthMeshRef = useRef<THREE.Mesh | null>(null);
  const bordersMeshRef = useRef<THREE.Mesh | null>(null);
  const cloudMeshRef = useRef<THREE.Mesh | null>(null);
  const tempMeshRef = useRef<THREE.Mesh | null>(null);
  const precipMeshRef = useRef<THREE.Mesh | null>(null);
  const windMeshRef = useRef<THREE.Mesh | null>(null);
  const windParticlesRef = useRef<THREE.Points | null>(null);
  const markerGroupRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const texturesRef = useRef<{
    satellite?: THREE.Texture;
    night?: THREE.Texture;
    topology?: THREE.Texture;
    water?: THREE.Texture;
    procedural?: THREE.Texture;
  }>({});

  // Dynamic state sync refs for animation loop (prevents scene re-creation!)
  const showWindStreamsRef = useRef(showWindStreams);
  showWindStreamsRef.current = showWindStreams;
  const isAutoRotatingRef = useRef(isAutoRotating);
  isAutoRotatingRef.current = isAutoRotating;
  const selectedLayerRef = useRef(selectedLayer);
  selectedLayerRef.current = selectedLayer;
  const layerOpacityRef = useRef(layerOpacity);
  layerOpacityRef.current = layerOpacity;
  const showBordersRef = useRef(showBorders);
  showBordersRef.current = showBorders;
  const mapModeRef = useRef(mapMode);
  mapModeRef.current = mapMode;

  const cloudCover = forecast.current.cloud_cover ?? 35;
  const currentTemp = forecast.current.temperature_2m ?? 20;
  const windSpeedKmh = forecast.current.wind_speed_10m ?? 12;
  const precipitationMm = forecast.current.precipitation ?? 0;
  const weatherDesc = getWeatherDescription(forecast.current.weather_code ?? 0);
  const aqiInfo = airQuality?.current?.us_aqi != null ? getAqiDetails(airQuality.current.us_aqi) : null;

  const cleanedCountry = cleanCityOrVillageName(cleanCountryName(location.country));
  const countryDisplayName =
    cleanedCountry !== '' ? cleanedCountry.toUpperCase() : 'GLOBAL STATION';
  const countryBadge = getCountryBadge(cleanedCountry);

  // Fetch Natural Earth 110m countries GeoJSON
  useEffect(() => {
    if (cachedCountryGeoJson) {
      setGeoJsonData(cachedCountryGeoJson);
      return;
    }
    fetch('/assets/world-countries.geojson')
      .then((res) => res.json())
      .then((data) => {
        cachedCountryGeoJson = data;
        setGeoJsonData(data);
      })
      .catch((err) => {
        console.warn('Could not load world-countries.geojson:', err);
      });
  }, []);

  // Compute rotation angle to place (lat, lon) in center of front view
  const getCenterRotation = useCallback((lat: number, lon: number) => {
    const rotY = -((lon * Math.PI) / 180) - Math.PI / 2;
    const rotX = (lat * Math.PI) / 180;
    return { x: rotX, y: rotY };
  }, []);

  const recenterActiveLocation = useCallback(() => {
    const center = getCenterRotation(location.latitude, location.longitude);
    targetRotationRef.current = { ...center };
    setZoomScale(1.0);
    if (cameraRef.current) {
      cameraRef.current.position.set(0, 0, 5.0);
    }
  }, [location.latitude, location.longitude, getCenterRotation]);

  const handleZoom = (delta: number) => {
    if (use2DFallback) {
      setZoomScale((prev) => Math.max(0.65, Math.min(2.2, prev - delta * 0.2)));
    } else if (cameraRef.current) {
      const newZ = cameraRef.current.position.z + delta;
      cameraRef.current.position.z = Math.max(3.0, Math.min(7.5, newZ));
    }
  };

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Sync active location position to marker
  useEffect(() => {
    recenterActiveLocation();
  }, [location.latitude, location.longitude, recenterActiveLocation]);

  // ==========================================================================
  // WEBGL 3D LIFECYCLE (Singleton, created once on mount, zero context leaks)
  // ==========================================================================
  useEffect(() => {
    if (use2DFallback) return;
    const container = mountRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const width = rect.width > 0 ? rect.width : window.innerWidth;
    const height = rect.height > 0 ? rect.height : window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030712);

    const camera = new THREE.PerspectiveCamera(45, Math.max(0.1, width / height), 0.1, 1000);
    camera.position.set(0, 0, 5.0);
    cameraRef.current = camera;

    const canvas = document.createElement('canvas');
    let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;

    // Suppress console.error during context probe to prevent browser context-loss notices from bubbling
    const origError = console.error;
    console.error = (...args: any[]) => {
      const msg = typeof args[0] === 'string' ? args[0] : '';
      if (msg.includes('THREE.WebGLRenderer') || msg.includes('WebGL') || msg.includes('context loss')) {
        return;
      }
      origError.apply(console, args);
    };

    try {
      gl =
        canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) ||
        (canvas.getContext('webgl', { failIfMajorPerformanceCaveat: false }) as any);
    } catch {
      gl = null;
    }

    if (!gl || (gl as any).isContextLost?.()) {
      console.error = origError;
      setUse2DFallback(true);
      return;
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        context: gl,
        antialias: true,
        powerPreference: 'default',
        alpha: false,
      });
    } catch {
      console.error = origError;
      setUse2DFallback(true);
      return;
    } finally {
      console.error = origError;
    }

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.touchAction = 'none';

    // Failsafe context loss handler
    const onContextLost = (e: Event) => {
      e.preventDefault();
      console.warn('WebGL context lost, switching to 2D canvas fallback');
      setUse2DFallback(true);
    };
    canvas.addEventListener('webglcontextlost', onContextLost, false);

    container.appendChild(canvas);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);
    const sunLight = new THREE.DirectionalLight(0xfff5ea, 1.6);
    sunLight.position.set(7, 5, 8);
    scene.add(sunLight);
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.65);
    rimLight.position.set(-8, -2, -6);
    scene.add(rimLight);

    // Deep space stars
    const starsGeo = new THREE.BufferGeometry();
    const starCount = 1000;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 80;
      starPositions[i + 1] = (Math.random() - 0.5) * 80;
      starPositions[i + 2] = (Math.random() - 0.5) * 80;
    }
    starsGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starsMat = new THREE.PointsMaterial({
      color: 0x94a3b8,
      size: 0.12,
      transparent: true,
      opacity: 0.75,
    });
    const stars = new THREE.Points(starsGeo, starsMat);
    scene.add(stars);

    // Earth group
    const earthGroup = new THREE.Group();
    earthGroupRef.current = earthGroup;
    scene.add(earthGroup);

    const earthRadius = 2.0;
    const proceduralTexture = createProceduralEarthTexture();
    const textureLoader = new THREE.TextureLoader();

    const satelliteTexture = textureLoader.load('/assets/earth-blue-marble.jpg', (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      if (earthMeshRef.current && mapModeRef.current === 'satellite') {
        (earthMeshRef.current.material as THREE.MeshStandardMaterial).map = tex;
        (earthMeshRef.current.material as THREE.MeshStandardMaterial).needsUpdate = true;
      }
    });
    satelliteTexture.colorSpace = THREE.SRGBColorSpace;

    const nightTexture = textureLoader.load('/assets/earth-night.jpg', (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      if (earthMeshRef.current && mapModeRef.current === 'night') {
        (earthMeshRef.current.material as THREE.MeshStandardMaterial).map = tex;
        (earthMeshRef.current.material as THREE.MeshStandardMaterial).needsUpdate = true;
      }
    });
    nightTexture.colorSpace = THREE.SRGBColorSpace;

    const topologyTexture = textureLoader.load('/assets/earth-topology.png');
    const waterTexture = textureLoader.load('/assets/earth-water.png');

    texturesRef.current = {
      satellite: satelliteTexture,
      night: nightTexture,
      topology: topologyTexture,
      water: waterTexture,
      procedural: proceduralTexture,
    };

    // Earth Sphere
    const earthGeo = new THREE.SphereGeometry(earthRadius, 64, 64);
    const initialMap = mapModeRef.current === 'night' ? nightTexture : satelliteTexture;
    const earthMat = new THREE.MeshStandardMaterial({
      map: initialMap,
      bumpMap: topologyTexture,
      bumpScale: 0.04,
      roughnessMap: waterTexture,
      roughness: 0.65,
      metalness: 0.08,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthMeshRef.current = earthMesh;
    earthGroup.add(earthMesh);

    // Country Borders
    const bordersGeo = new THREE.SphereGeometry(earthRadius * 1.002, 64, 64);
    const bordersTexture = createCountryBordersTexture(geoJsonData);
    const bordersMat = new THREE.MeshBasicMaterial({
      map: bordersTexture,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      visible: showBordersRef.current,
    });
    const bordersMesh = new THREE.Mesh(bordersGeo, bordersMat);
    bordersMeshRef.current = bordersMesh;
    earthGroup.add(bordersMesh);

    // Layers
    const tempGeo = new THREE.SphereGeometry(earthRadius * 1.008, 64, 64);
    const tempTexture = createProceduralTemperatureTexture(currentTemp, location.latitude, location.longitude);
    const tempMat = new THREE.MeshStandardMaterial({
      map: tempTexture,
      transparent: true,
      opacity: selectedLayerRef.current === 'temperature' ? layerOpacityRef.current * 0.75 : 0,
      depthWrite: false,
      roughness: 0.7,
    });
    const tempMesh = new THREE.Mesh(tempGeo, tempMat);
    tempMeshRef.current = tempMesh;
    earthGroup.add(tempMesh);

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
      opacity: selectedLayerRef.current === 'precipitation' ? layerOpacityRef.current : 0,
      depthWrite: false,
      roughness: 0.7,
    });
    const precipMesh = new THREE.Mesh(precipGeo, precipMat);
    precipMeshRef.current = precipMesh;
    earthGroup.add(precipMesh);

    const windGeo = new THREE.SphereGeometry(earthRadius * 1.016, 64, 64);
    const windTexture = createProceduralWindTexture(windSpeedKmh, location.latitude, location.longitude);
    const windMat = new THREE.MeshStandardMaterial({
      map: windTexture,
      transparent: true,
      opacity: selectedLayerRef.current === 'wind' ? layerOpacityRef.current : 0,
      depthWrite: false,
      roughness: 0.7,
    });
    const windMesh = new THREE.Mesh(windGeo, windMat);
    windMeshRef.current = windMesh;
    earthGroup.add(windMesh);

    const cloudRadius = earthRadius * 1.024;
    const cloudGeo = new THREE.SphereGeometry(cloudRadius, 64, 64);
    const cloudTexture = createProceduralCloudTexture(cloudCover);
    const cloudMat = new THREE.MeshStandardMaterial({
      map: cloudTexture,
      transparent: true,
      opacity: selectedLayerRef.current === 'clouds' ? layerOpacityRef.current : 0.22,
      depthWrite: false,
      roughness: 0.9,
    });
    const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    cloudMeshRef.current = cloudMesh;
    earthGroup.add(cloudMesh);

    // Wind Streams
    const streamCount = 800;
    const streamGeo = new THREE.BufferGeometry();
    const streamPositions = new Float32Array(streamCount * 3);
    const streamVelocities = new Float32Array(streamCount * 3);
    const streamColors = new Float32Array(streamCount * 3);

    for (let i = 0; i < streamCount; i++) {
      const lat = (Math.random() - 0.5) * 150;
      const lon = (Math.random() - 0.5) * 360;
      const v = latLonToVector3(lat, lon, earthRadius * 1.028);
      streamPositions[i * 3] = v.x;
      streamPositions[i * 3 + 1] = v.y;
      streamPositions[i * 3 + 2] = v.z;

      const speed = (0.012 + Math.random() * 0.02) * (Math.abs(lat) < 25 ? -1 : 1);
      streamVelocities[i * 3] = lat;
      streamVelocities[i * 3 + 1] = lon;
      streamVelocities[i * 3 + 2] = speed;

      const isFast = Math.abs(lat) > 30 && Math.abs(lat) < 60;
      streamColors[i * 3] = isFast ? 0.98 : 0.22;
      streamColors[i * 3 + 1] = isFast ? 0.75 : 0.78;
      streamColors[i * 3 + 2] = isFast ? 0.2 : 0.98;
    }
    streamGeo.setAttribute('position', new THREE.BufferAttribute(streamPositions, 3));
    streamGeo.setAttribute('color', new THREE.BufferAttribute(streamColors, 3));

    const streamMat = new THREE.PointsMaterial({
      size: 0.042,
      vertexColors: true,
      transparent: true,
      opacity: showWindStreamsRef.current ? 0.85 : 0,
      depthWrite: false,
    });
    const windParticles = new THREE.Points(streamGeo, streamMat);
    windParticlesRef.current = windParticles;
    earthGroup.add(windParticles);

    // Rayleigh Glow
    const atmoRadius = earthRadius * 1.045;
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
          float intensity = pow(0.68 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.6);
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

    // Active Location Marker
    const markerGroup = new THREE.Group();
    markerGroupRef.current = markerGroup;
    const locPos = latLonToVector3(location.latitude, location.longitude, earthRadius);
    markerGroup.position.copy(locPos);
    markerGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), locPos.clone().normalize());

    const ringGeo = new THREE.RingGeometry(0.03, 0.08, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    markerGroup.add(ringMesh);

    const beamGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.38, 16);
    beamGeo.translate(0, 0.19, 0);
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.9 });
    const beamMesh = new THREE.Mesh(beamGeo, beamMat);
    markerGroup.add(beamMesh);

    const pinHeadGeo = new THREE.SphereGeometry(0.045, 16, 16);
    pinHeadGeo.translate(0, 0.38, 0);
    const pinHeadMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xfacc15,
      emissiveIntensity: 0.8,
      roughness: 0.1,
      metalness: 0.9,
    });
    const pinHeadMesh = new THREE.Mesh(pinHeadGeo, pinHeadMat);
    markerGroup.add(pinHeadMesh);
    earthGroup.add(markerGroup);

    // Initial center
    const initialCenter = getCenterRotation(location.latitude, location.longitude);
    currentRotationRef.current = { ...initialCenter };
    targetRotationRef.current = { ...initialCenter };
    earthGroup.rotation.x = initialCenter.x;
    earthGroup.rotation.y = initialCenter.y;

    // Pointer events
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
      handleZoom(e.deltaY * 0.003);
    };

    const onMouseDown = (e: MouseEvent) => handlePointerDown(e.clientX, e.clientY);
    const onMouseMove = (e: MouseEvent) => handlePointerMove(e.clientX, e.clientY);
    const onMouseUp = () => handlePointerUp();

    let initialPinchDist = 0;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
      } else if (e.touches.length === 2) {
        initialPinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
      } else if (e.touches.length === 2 && initialPinchDist > 0) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const diff = initialPinchDist - dist;
        handleZoom(diff * 0.005);
        initialPinchDist = dist;
      }
    };

    const onTouchEnd = () => handlePointerUp();

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w > 0 && h > 0 && cameraRef.current && rendererRef.current) {
          cameraRef.current.aspect = w / h;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    let animId = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      if (isAutoRotatingRef.current && !isDraggingRef.current) {
        targetRotationRef.current.y += 0.035 * delta;
      }

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

      if (cloudMeshRef.current) {
        cloudMeshRef.current.rotation.y += 0.025 * delta;
      }

      ringMesh.scale.setScalar(1 + Math.sin(elapsed * 4) * 0.3);

      if (windParticlesRef.current && showWindStreamsRef.current) {
        const positions = streamGeo.attributes.position.array as Float32Array;
        for (let i = 0; i < streamCount; i++) {
          let lon = streamVelocities[i * 3 + 1];
          const speed = streamVelocities[i * 3 + 2];
          lon += speed * 35 * delta;
          if (lon > 180) lon = -180;
          if (lon < -180) lon = 180;
          streamVelocities[i * 3 + 1] = lon;

          const lat = streamVelocities[i * 3];
          const v = latLonToVector3(lat, lon, earthRadius * 1.028);
          positions[i * 3] = v.x;
          positions[i * 3 + 1] = v.y;
          positions[i * 3 + 2] = v.z;
        }
        streamGeo.attributes.position.needsUpdate = true;
      }

      renderer.render(scene, camera);
      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('webglcontextlost', onContextLost);

      // Clean up all resources
      earthGeo.dispose();
      earthMat.dispose();
      satelliteTexture.dispose();
      nightTexture.dispose();
      topologyTexture.dispose();
      waterTexture.dispose();
      proceduralTexture.dispose();
      bordersGeo.dispose();
      bordersMat.dispose();
      bordersTexture.dispose();
      tempGeo.dispose();
      tempMat.dispose();
      tempTexture.dispose();
      precipGeo.dispose();
      precipMat.dispose();
      precipTexture.dispose();
      windGeo.dispose();
      windMat.dispose();
      windTexture.dispose();
      cloudGeo.dispose();
      cloudMat.dispose();
      cloudTexture.dispose();
      streamGeo.dispose();
      streamMat.dispose();
      atmoGeo.dispose();
      atmoMat.dispose();
      starsGeo.dispose();
      starsMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      beamGeo.dispose();
      beamMat.dispose();
      pinHeadGeo.dispose();
      pinHeadMat.dispose();

      if (container.contains(canvas)) {
        container.removeChild(canvas);
      }

      // Cleanly dispose renderer without provoking browser context-loss penalties
      renderer.dispose();
    };
  }, [use2DFallback]);

  // Update WebGL base texture on mapMode switch
  useEffect(() => {
    if (use2DFallback || !earthMeshRef.current) return;
    const mat = earthMeshRef.current.material as THREE.MeshStandardMaterial;
    if (mapMode === 'satellite' && texturesRef.current.satellite) {
      mat.map = texturesRef.current.satellite;
      mat.bumpMap = texturesRef.current.topology || null;
      mat.roughnessMap = texturesRef.current.water || null;
      mat.roughness = 0.65;
      mat.needsUpdate = true;
    } else if (mapMode === 'night' && texturesRef.current.night) {
      mat.map = texturesRef.current.night;
      mat.bumpMap = texturesRef.current.topology || null;
      mat.roughnessMap = null;
      mat.roughness = 0.75;
      mat.needsUpdate = true;
    }
  }, [mapMode, use2DFallback]);

  // Update WebGL layers opacities
  useEffect(() => {
    if (use2DFallback) return;
    if (tempMeshRef.current) {
      const mat = tempMeshRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = selectedLayer === 'temperature' ? layerOpacity * 0.75 : 0;
    }
    if (precipMeshRef.current) {
      const mat = precipMeshRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = selectedLayer === 'precipitation' ? layerOpacity : 0;
    }
    if (windMeshRef.current) {
      const mat = windMeshRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = selectedLayer === 'wind' ? layerOpacity : 0;
    }
    if (cloudMeshRef.current) {
      const mat = cloudMeshRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = selectedLayer === 'clouds' ? layerOpacity : 0.22;
    }
  }, [selectedLayer, layerOpacity, use2DFallback]);

  // Update WebGL streams visibility
  useEffect(() => {
    if (use2DFallback || !windParticlesRef.current) return;
    const mat = windParticlesRef.current.material as THREE.PointsMaterial;
    mat.opacity = showWindStreams ? 0.85 : 0;
  }, [showWindStreams, use2DFallback]);

  // Update WebGL borders visibility
  useEffect(() => {
    if (use2DFallback || !bordersMeshRef.current) return;
    const mat = bordersMeshRef.current.material as THREE.MeshBasicMaterial;
    mat.visible = showBorders;
  }, [showBorders, use2DFallback]);

  // ==========================================================================
  // 2D HIGH-FIDELITY INTERACTIVE ORTHOGRAPHIC CANVAS GLOBE (100% Reliable)
  // Renders vector continents, country borders, dynamic atmosphere, and station pin
  // ==========================================================================
  useEffect(() => {
    if (!use2DFallback) return;
    const canvas = canvas2DRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let lastTime = performance.now();

    // 2D Wind Particles
    const windCount = 280;
    const particles = Array.from({ length: windCount }, () => ({
      lat: (Math.random() - 0.5) * 140,
      lon: (Math.random() - 0.5) * 360,
      speed: (0.15 + Math.random() * 0.35) * (Math.random() > 0.5 ? 1 : -1),
      alpha: 0.25 + Math.random() * 0.5,
    }));

    // 2D Starfield
    const stars = Array.from({ length: 180 }, () => ({
      x: Math.random(),
      y: Math.random(),
      size: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.7 + 0.3,
    }));

    const render = (time: number) => {
      const dt = Math.min(0.1, (time - lastTime) / 1000);
      lastTime = time;

      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = rect.width;
      const height = rect.height;

      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      // Deep space background
      ctx.fillStyle = '#030712';
      ctx.fillRect(0, 0, width, height);

      // Stars
      stars.forEach((s) => {
        ctx.fillStyle = `rgba(226, 232, 240, ${s.alpha})`;
        ctx.fillRect(s.x * width, s.y * height, s.size, s.size);
      });

      // Auto rotation & inertia damping
      if (isAutoRotatingRef.current && !isDraggingRef.current) {
        targetRotationRef.current.y += 0.035 * dt;
      }
      currentRotationRef.current.x += (targetRotationRef.current.x - currentRotationRef.current.x) * Math.min(1, 10 * dt);
      currentRotationRef.current.y += (targetRotationRef.current.y - currentRotationRef.current.y) * Math.min(1, 10 * dt);

      const rotX = currentRotationRef.current.x;
      const rotY = currentRotationRef.current.y;
      const cx = width / 2;
      const cy = height / 2;
      const baseRadius = Math.min(width, height) * 0.34 * zoomScale;

      // Outer Atmospheric Rim Glow
      const glowGrad = ctx.createRadialGradient(cx, cy, baseRadius * 0.95, cx, cy, baseRadius * 1.14);
      glowGrad.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
      glowGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.15)');
      glowGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius * 1.14, 0, Math.PI * 2);
      ctx.fill();

      // Clip Earth sphere for oceans, continents, and weather
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
      ctx.clip();

      // Ocean volumetric depth gradient
      const sunOffsetX = cx - baseRadius * 0.28;
      const sunOffsetY = cy - baseRadius * 0.28;
      const oceanGrad = ctx.createRadialGradient(sunOffsetX, sunOffsetY, 0, cx, cy, baseRadius);

      if (mapModeRef.current === 'satellite') {
        oceanGrad.addColorStop(0, '#1d4ed8');
        oceanGrad.addColorStop(0.65, '#0c224a');
        oceanGrad.addColorStop(1, '#050c1a');
      } else {
        oceanGrad.addColorStop(0, '#0f1f38');
        oceanGrad.addColorStop(0.7, '#070d18');
        oceanGrad.addColorStop(1, '#02050b');
      }
      ctx.fillStyle = oceanGrad;
      ctx.fill();

      // Graticule longitude/latitude lines
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.09)';
      ctx.lineWidth = 0.8;
      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath();
        let started = false;
        for (let lon = -180; lon <= 180; lon += 5) {
          const pt = projectOrthographic(lon, lat, rotX, rotY, baseRadius, cx, cy);
          if (pt.visible) {
            if (!started) {
              ctx.moveTo(pt.x, pt.y);
              started = true;
            } else {
              ctx.lineTo(pt.x, pt.y);
            }
          } else {
            started = false;
          }
        }
        ctx.stroke();
      }

      // Draw Land & Country Borders from GeoJSON
      if (geoJsonData && Array.isArray(geoJsonData.features)) {
        const isNight = mapModeRef.current === 'night';
        const landFill = isNight ? '#0a1626' : '#22543d';
        const landArid = isNight ? '#121e2e' : '#6b5434';
        const borderStroke = isNight ? 'rgba(250, 204, 21, 0.55)' : 'rgba(224, 242, 254, 0.65)';

        geoJsonData.features.forEach((feature: any) => {
          const geom = feature.geometry;
          if (!geom) return;

          const isDesert = ['Egypt', 'Saudi Arabia', 'Algeria', 'Libya', 'Chad', 'Mali', 'Niger', 'Iraq'].includes(
            feature.properties?.NAME
          );
          ctx.fillStyle = isDesert ? landArid : landFill;
          ctx.strokeStyle = borderStroke;
          ctx.lineWidth = 1;

          const drawPolygon = (coords: number[][]) => {
            if (!coords || coords.length < 3) return;
            let visibleCount = 0;
            const pts = coords.map(([lon, lat]) => {
              const p = projectOrthographic(lon, lat, rotX, rotY, baseRadius, cx, cy);
              if (p.visible) visibleCount++;
              return p;
            });

            // Cull if completely on back hemisphere
            if (visibleCount === 0) return;

            ctx.beginPath();
            let isDrawing = false;
            for (let i = 0; i < pts.length; i++) {
              const p = pts[i];
              if (p.visible) {
                if (!isDrawing) {
                  ctx.moveTo(p.x, p.y);
                  isDrawing = true;
                } else {
                  ctx.lineTo(p.x, p.y);
                }
              } else {
                isDrawing = false;
              }
            }
            ctx.fill();

            if (showBordersRef.current) {
              ctx.stroke();
            }
          };

          if (geom.type === 'Polygon') {
            geom.coordinates.forEach((ring: number[][]) => drawPolygon(ring));
          } else if (geom.type === 'MultiPolygon') {
            geom.coordinates.forEach((poly: number[][][]) => {
              poly.forEach((ring: number[][]) => drawPolygon(ring));
            });
          }
        });
      } else {
        // High quality procedural continent shapes if geojson is pending
        ctx.fillStyle = '#22543d';
        const drawContinents = [
          { lon: 20, lat: 50, rx: 60, ry: 40 },
          { lon: 20, lat: 10, rx: 45, ry: 65 },
          { lon: 80, lat: 40, rx: 70, ry: 45 },
          { lon: -100, lat: 45, rx: 60, ry: 50 },
          { lon: -60, lat: -15, rx: 40, ry: 60 },
          { lon: 135, lat: -25, rx: 40, ry: 35 },
        ];
        drawContinents.forEach((c) => {
          const pt = projectOrthographic(c.lon, c.lat, rotX, rotY, baseRadius, cx, cy);
          if (pt.visible) {
            ctx.beginPath();
            ctx.ellipse(pt.x, pt.y, c.rx * (baseRadius / 150), c.ry * (baseRadius / 150), 0, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      }

      // Weather Layer Overlays
      const curLayer = selectedLayerRef.current;
      const curOpacity = layerOpacityRef.current;

      // 1. Thermal Layer
      if (curLayer === 'temperature') {
        const thermalGrad = ctx.createLinearGradient(0, cy - baseRadius, 0, cy + baseRadius);
        thermalGrad.addColorStop(0, `rgba(59, 7, 100, ${curOpacity * 0.45})`);
        thermalGrad.addColorStop(0.2, `rgba(6, 182, 212, ${curOpacity * 0.40})`);
        thermalGrad.addColorStop(0.5, `rgba(239, 68, 68, ${curOpacity * 0.48})`);
        thermalGrad.addColorStop(0.8, `rgba(16, 185, 129, ${curOpacity * 0.40})`);
        thermalGrad.addColorStop(1, `rgba(30, 27, 75, ${curOpacity * 0.50})`);
        ctx.fillStyle = thermalGrad;
        ctx.fillRect(cx - baseRadius, cy - baseRadius, baseRadius * 2, baseRadius * 2);

        // Active localized station thermal anomaly
        const locPt = projectOrthographic(location.longitude, location.latitude, rotX, rotY, baseRadius, cx, cy);
        if (locPt.visible) {
          const localGrad = ctx.createRadialGradient(locPt.x, locPt.y, 0, locPt.x, locPt.y, baseRadius * 0.35);
          localGrad.addColorStop(0, `rgba(245, 158, 11, ${curOpacity * 0.7})`);
          localGrad.addColorStop(1, 'transparent');
          ctx.fillStyle = localGrad;
          ctx.beginPath();
          ctx.arc(locPt.x, locPt.y, baseRadius * 0.35, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 2. Precipitation Radar Layer
      if (curLayer === 'precipitation') {
        const locPt = projectOrthographic(location.longitude, location.latitude, rotX, rotY, baseRadius, cx, cy);
        if (locPt.visible) {
          const radarGrad = ctx.createRadialGradient(locPt.x, locPt.y, 0, locPt.x, locPt.y, baseRadius * 0.3);
          radarGrad.addColorStop(0, `rgba(239, 68, 68, ${curOpacity * 0.85})`);
          radarGrad.addColorStop(0.4, `rgba(234, 179, 8, ${curOpacity * 0.75})`);
          radarGrad.addColorStop(0.7, `rgba(34, 197, 94, ${curOpacity * 0.6})`);
          radarGrad.addColorStop(1, 'transparent');
          ctx.fillStyle = radarGrad;
          ctx.beginPath();
          ctx.arc(locPt.x, locPt.y, baseRadius * 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 3. Clouds Layer
      if (curLayer === 'clouds') {
        ctx.fillStyle = `rgba(248, 250, 252, ${curOpacity * 0.45})`;
        for (let i = 0; i < 35; i++) {
          const cLon = (i * 37 + (time * 0.005) % 360) - 180;
          const cLat = Math.sin(i) * 55;
          const pt = projectOrthographic(cLon, cLat, rotX, rotY, baseRadius, cx, cy);
          if (pt.visible) {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, baseRadius * 0.08, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // 4. Wind Vectors Streamlines
      if (showWindStreamsRef.current || curLayer === 'wind') {
        particles.forEach((p) => {
          p.lon += p.speed * 40 * dt;
          if (p.lon > 180) p.lon = -180;
          if (p.lon < -180) p.lon = 180;

          const pt = projectOrthographic(p.lon, p.lat, rotX, rotY, baseRadius * 1.01, cx, cy);
          if (pt.visible) {
            ctx.fillStyle = `rgba(34, 211, 238, ${p.alpha})`;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      }

      // 3D Sphere Surface Shading (Terminator shadow for realistic volume)
      const shadowGrad = ctx.createRadialGradient(
        sunOffsetX,
        sunOffsetY,
        baseRadius * 0.3,
        sunOffsetX,
        sunOffsetY,
        baseRadius * 1.3
      );
      shadowGrad.addColorStop(0, 'rgba(255, 255, 255, 0.06)');
      shadowGrad.addColorStop(0.65, 'rgba(0, 0, 0, 0.25)');
      shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
      ctx.fillStyle = shadowGrad;
      ctx.fillRect(cx - baseRadius, cy - baseRadius, baseRadius * 2, baseRadius * 2);

      ctx.restore(); // End Earth Sphere Clip

      // Active Station Pin & Radar Beacon (Drawn above sphere)
      const pinPt = projectOrthographic(location.longitude, location.latitude, rotX, rotY, baseRadius, cx, cy);
      if (pinPt.visible) {
        const pulse = 1 + Math.sin(time * 0.005) * 0.3;

        // Radar ground ripple ring
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.85)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(pinPt.x, pinPt.y, 8 * pulse, 0, Math.PI * 2);
        ctx.stroke();

        // Glowing center dot
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(pinPt.x, pinPt.y, 3, 0, Math.PI * 2);
        ctx.fill();

        // Laser pin stem
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pinPt.x, pinPt.y);
        ctx.lineTo(pinPt.x, pinPt.y - 20);
        ctx.stroke();

        // Pin head orb
        ctx.fillStyle = '#f59e0b';
        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(pinPt.x, pinPt.y - 20, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Small location callout pill
        const tagText = `${cleanCityOrVillageName(location.name)} · ${Math.round(currentTemp)}°C`;
        ctx.font = 'bold 11px system-ui, sans-serif';
        const tagWidth = ctx.measureText(tagText).width + 16;
        const tagX = pinPt.x - tagWidth / 2;
        const tagY = pinPt.y - 42;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(tagX, tagY, tagWidth, 18, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#f8fafc';
        ctx.fillText(tagText, tagX + 8, tagY + 13);
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    // Canvas gesture listeners
    const handlePointerDown = (clientX: number, clientY: number) => {
      isDraggingRef.current = true;
      previousPointerPosRef.current = { x: clientX, y: clientY };
    };

    const handlePointerMove = (clientX: number, clientY: number) => {
      if (!isDraggingRef.current) return;
      const deltaX = clientX - previousPointerPosRef.current.x;
      const deltaY = clientY - previousPointerPosRef.current.y;
      previousPointerPosRef.current = { x: clientX, y: clientY };

      targetRotationRef.current.y += deltaX * (0.005 / zoomScale);
      targetRotationRef.current.x = Math.max(
        -Math.PI / 2 + 0.1,
        Math.min(Math.PI / 2 - 0.1, targetRotationRef.current.x + deltaY * (0.005 / zoomScale))
      );
    };

    const handlePointerUp = () => {
      isDraggingRef.current = false;
    };

    const onMouseDown = (e: MouseEvent) => handlePointerDown(e.clientX, e.clientY);
    const onMouseMove = (e: MouseEvent) => handlePointerMove(e.clientX, e.clientY);
    const onMouseUp = () => handlePointerUp();

    let initialPinchDist = 0;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
      } else if (e.touches.length === 2) {
        initialPinchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
      } else if (e.touches.length === 2 && initialPinchDist > 0) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const diff = initialPinchDist - dist;
        handleZoom(diff * 0.005);
        initialPinchDist = dist;
      }
    };

    const onTouchEnd = () => handlePointerUp();
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      handleZoom(e.deltaY * 0.003);
    };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [use2DFallback, zoomScale, geoJsonData, location.latitude, location.longitude]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col select-none overflow-hidden"
      style={{ backgroundColor: '#030712' }}
      data-testid="modal-3d-globe"
      role="dialog"
      aria-label="Interactive Earth Weather Globe"
    >
      {/* 3D WebGL Canvas Container */}
      {!use2DFallback && (
        <div
          ref={mountRef}
          className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing z-0"
          style={{ backgroundColor: '#030712' }}
          title="Drag to spin the globe · Scroll to zoom"
        />
      )}

      {/* 2D Canvas Fallback Viewport */}
      {use2DFallback && (
        <canvas
          ref={canvas2DRef}
          className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing z-0"
          style={{ backgroundColor: '#030712', touchAction: 'none' }}
          title="Drag to spin the globe · Scroll to zoom"
        />
      )}

      {/* TOP COMMAND BAR */}
      <header className="relative z-20 flex items-center justify-between p-3 sm:px-5 pointer-events-none">
        {/* Left: Location & Active Weather Badge */}
        <div className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-slate-900/90 border border-slate-700/70 shadow-xl backdrop-blur-md">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-500 text-white flex items-center justify-center font-bold shadow-md shadow-sky-500/20 shrink-0">
            <Globe2 size={16} />
          </div>
          <div>
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-xs">{countryBadge}</span>
              <span className="text-xs font-bold text-white tracking-wide uppercase font-display">
                {countryDisplayName}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 font-semibold ml-0.5">
                {Math.round(currentTemp)}°C
              </span>
            </div>
            <p className="text-[10.5px] text-slate-300 font-medium mt-0.5 flex items-center gap-1 leading-none">
              <MapPin size={10} className="text-amber-400 shrink-0" />
              <span className="truncate max-w-[140px] sm:max-w-none">{cleanCityOrVillageName(location.name)}</span>
              {location.admin1 && (
                <span className="text-slate-400 hidden xs:inline">· {cleanCityOrVillageName(location.admin1)}</span>
              )}
            </p>
          </div>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="pointer-events-auto flex items-center gap-1 sm:gap-1.5">
          {/* Base Map Style Switcher (Satellite vs Night Lights) */}
          <div className="flex items-center rounded-xl bg-slate-900/90 border border-slate-700/70 p-0.5 shadow-lg backdrop-blur-md">
            <button
              onClick={() => setMapMode('satellite')}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition ${
                mapMode === 'satellite'
                  ? 'bg-sky-500/25 text-sky-300 border border-sky-400/40'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="NASA Satellite Map"
              data-testid="btn-mode-satellite"
            >
              <Satellite size={13} className="text-sky-400" />
              <span className="hidden sm:inline">Satellite</span>
            </button>
            <button
              onClick={() => setMapMode('night')}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition ${
                mapMode === 'night'
                  ? 'bg-amber-500/25 text-amber-300 border border-amber-400/40'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Global Night City Lights Map"
              data-testid="btn-mode-night"
            >
              <Moon size={13} className="text-amber-400" />
              <span className="hidden sm:inline">Night</span>
            </button>
          </div>

          {/* Engine Mode Toggle (3D WebGL vs 2D Precision) */}
          {isWebGLAvailable() && (
            <button
              onClick={() => setUse2DFallback(!use2DFallback)}
              className={`hidden sm:flex items-center gap-1 px-2 py-1.5 rounded-xl border text-xs font-medium shadow-lg backdrop-blur-md transition ${
                use2DFallback
                  ? 'bg-sky-500/20 text-sky-300 border-sky-400/40'
                  : 'bg-slate-900/90 text-slate-400 border-slate-700/70 hover:text-white'
              }`}
              title="Toggle between 3D Hardware and 2D Orthographic Engine"
            >
              <Layers size={13} className={use2DFallback ? 'text-sky-400' : 'text-slate-400'} />
              <span>{use2DFallback ? '2D Ortho' : '3D WebGL'}</span>
            </button>
          )}

          {/* Zoom Buttons */}
          <div className="hidden md:flex items-center rounded-xl bg-slate-900/90 border border-slate-700/70 p-0.5 shadow-lg backdrop-blur-md">
            <button
              onClick={() => handleZoom(-0.5)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 transition"
              title="Zoom In"
              aria-label="Zoom In"
            >
              <Plus size={14} />
            </button>
            <button
              onClick={() => handleZoom(0.5)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 transition"
              title="Zoom Out"
              aria-label="Zoom Out"
            >
              <Minus size={14} />
            </button>
          </div>

          {/* Auto Rotation Toggle */}
          <button
            onClick={() => setIsAutoRotating(!isAutoRotating)}
            className={`w-8 h-8 rounded-xl flex items-center justify-center border shadow-lg backdrop-blur-md transition ${
              isAutoRotating
                ? 'bg-sky-500/20 text-sky-300 border-sky-400/40'
                : 'bg-slate-900/90 text-slate-400 border-slate-700/70 hover:text-white'
            }`}
            title={isAutoRotating ? 'Pause Orbit Rotation' : 'Start Orbit Rotation'}
            data-testid="button-auto-rotate"
          >
            {isAutoRotating ? <Pause size={14} /> : <Play size={14} />}
          </button>

          {/* Recenter Location Button */}
          <button
            onClick={recenterActiveLocation}
            className="w-8 h-8 sm:w-auto sm:px-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40 shadow-lg backdrop-blur-md text-xs font-semibold flex items-center justify-center gap-1 transition"
            title="Focus and Center Active Location"
            data-testid="button-recenter-globe"
          >
            <RotateCcw size={13} className="text-amber-400" />
            <span className="hidden sm:inline">Center</span>
          </button>

          {/* Close Modal Button */}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-900/90 hover:bg-rose-500 text-slate-300 hover:text-white flex items-center justify-center border border-slate-700/70 shadow-lg backdrop-blur-md transition"
            aria-label="Close Globe"
            data-testid="button-close-globe"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      {/* BOTTOM CONTROL DOCK */}
      <footer className="relative z-10 mt-auto p-2 sm:p-4 pointer-events-none flex flex-col items-center gap-2">
        {/* Layer Selector & Controls Pill */}
        <div className="pointer-events-auto w-full max-w-2xl p-1.5 rounded-2xl bg-slate-900/90 border border-slate-700/70 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-start sm:justify-center gap-1 overflow-x-auto no-scrollbar py-0.5 px-0.5">
            {/* Surface Temperature */}
            <button
              onClick={() => setSelectedLayer(selectedLayer === 'temperature' ? 'none' : 'temperature')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition shrink-0 ${
                selectedLayer === 'temperature'
                  ? 'bg-amber-500/25 text-amber-300 border border-amber-400/50 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
              data-testid="layer-btn-temperature"
            >
              <Thermometer size={13} className="text-amber-400 shrink-0" />
              <span>Thermal</span>
              <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-amber-400/20 text-amber-200 hidden xs:inline">
                {Math.round(currentTemp)}°C
              </span>
            </button>

            {/* Wind Velocity */}
            <button
              onClick={() => setSelectedLayer(selectedLayer === 'wind' ? 'none' : 'wind')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition shrink-0 ${
                selectedLayer === 'wind'
                  ? 'bg-teal-500/25 text-teal-300 border border-teal-400/50 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
              data-testid="layer-btn-wind"
            >
              <Wind size={13} className="text-teal-400 shrink-0" />
              <span>Wind</span>
              <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-teal-400/20 text-teal-200 hidden xs:inline">
                {Math.round(windSpeedKmh)} km/h
              </span>
            </button>

            {/* Precipitation Radar */}
            <button
              onClick={() => setSelectedLayer(selectedLayer === 'precipitation' ? 'none' : 'precipitation')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition shrink-0 ${
                selectedLayer === 'precipitation'
                  ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/50 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
              data-testid="layer-btn-precipitation"
            >
              <Radar size={13} className="text-emerald-400 shrink-0" />
              <span>Radar</span>
              <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-emerald-400/20 text-emerald-200 hidden xs:inline">
                {precipitationMm > 0 ? `${precipitationMm} mm` : 'Dry'}
              </span>
            </button>

            {/* Satellite Clouds */}
            <button
              onClick={() => setSelectedLayer(selectedLayer === 'clouds' ? 'none' : 'clouds')}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition shrink-0 ${
                selectedLayer === 'clouds'
                  ? 'bg-sky-500/25 text-sky-300 border border-sky-400/50 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
              data-testid="layer-btn-clouds"
            >
              <Cloud size={13} className="text-sky-400 shrink-0" />
              <span>Clouds</span>
              <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-sky-400/20 text-sky-200 hidden xs:inline">
                {cloudCover}%
              </span>
            </button>

            <div className="h-4 w-px bg-slate-700/60 mx-0.5 shrink-0" />

            {/* Country Borders Toggle */}
            <button
              onClick={() => setShowBorders(!showBorders)}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-medium transition border shrink-0 ${
                showBorders
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-400/40'
                  : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}
              title="Toggle international country borders"
              data-testid="button-toggle-borders"
            >
              <Compass size={12} className={showBorders ? 'text-indigo-400' : 'text-slate-500'} />
              <span>Borders</span>
            </button>

            {/* Wind Vector Streams Toggle */}
            <button
              onClick={() => setShowWindStreams(!showWindStreams)}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-medium transition border shrink-0 ${
                showWindStreams
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40'
                  : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}
              title="Toggle animated wind vector circulation streams"
              data-testid="button-toggle-streamlines"
            >
              <Sparkles size={12} className={showWindStreams ? 'text-cyan-400' : 'text-slate-500'} />
              <span>Vectors</span>
            </button>
          </div>

          {/* Opacity Slider */}
          {selectedLayer !== 'none' && (
            <div className="flex items-center justify-between px-2 pt-1.5 mt-1 border-t border-slate-800/80 text-xs text-slate-300">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <Sliders size={11} className="text-amber-400 shrink-0" />
                <span>Layer Opacity</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.2"
                  max="1"
                  step="0.05"
                  value={layerOpacity}
                  onChange={(e) => setLayerOpacity(parseFloat(e.target.value))}
                  className="w-24 sm:w-36 accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  aria-label="Layer opacity"
                />
                <span className="font-mono text-[10px] text-amber-300 w-8 text-right font-semibold">
                  {Math.round(layerOpacity * 100)}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Collapsible Station Telemetry Drawer */}
        <div className="pointer-events-auto w-full max-w-2xl rounded-2xl bg-slate-900/90 border border-slate-700/70 shadow-2xl backdrop-blur-xl overflow-hidden">
          <button
            onClick={() => setIsStationCardCollapsed(!isStationCardCollapsed)}
            className="w-full flex items-center justify-between px-3.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition"
            aria-expanded={!isStationCardCollapsed}
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold text-white uppercase text-[11px] tracking-wider font-display">
                {cleanCityOrVillageName(location.name)} Telemetry
              </span>
              <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                {Math.round(currentTemp)}°C · AQI {airQuality?.current.us_aqi ?? '--'} · {Math.round(windSpeedKmh)} km/h · {cloudCover}% Cloud
              </span>
            </div>
            <div className="flex items-center gap-1 text-slate-400 text-[10.5px]">
              <span>{isStationCardCollapsed ? 'Expand' : 'Hide'}</span>
              {isStationCardCollapsed ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </div>
          </button>

          {!isStationCardCollapsed && (
            <div className="p-2.5 pt-1.5 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
              {/* Thermal State */}
              <div className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <span className="text-[9.5px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Sun size={10} className="text-amber-400" />
                  Thermal
                </span>
                <div className="text-xs font-bold text-white mt-0.5">
                  {Math.round(currentTemp)}°C
                  <span className="text-[9.5px] text-slate-400 font-normal ml-1">
                    (Feels {Math.round(forecast.current.apparent_temperature)}°)
                  </span>
                </div>
                <div className="text-[9.5px] text-slate-300 truncate mt-0.5">{weatherDesc.label}</div>
              </div>

              {/* Air Quality */}
              <div className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <span className="text-[9.5px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Air Quality
                </span>
                <div className="text-xs font-bold text-white mt-0.5 flex items-center gap-1">
                  {aqiInfo ? (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: aqiInfo.color }} />
                      <span>AQI {airQuality?.current.us_aqi}</span>
                    </>
                  ) : (
                    <span>AQI --</span>
                  )}
                </div>
                <div className="text-[9.5px] text-slate-300 truncate mt-0.5">
                  {aqiInfo ? aqiInfo.level : 'Station monitoring'}
                </div>
              </div>

              {/* Wind Circulation */}
              <div className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <span className="text-[9.5px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Wind size={10} className="text-teal-400" />
                  Wind
                </span>
                <div className="text-xs font-bold text-white mt-0.5">
                  {Math.round(windSpeedKmh)} km/h
                </div>
                <div className="text-[9.5px] text-slate-300 mt-0.5 truncate">
                  Dir: {Math.round(forecast.current.wind_direction_10m)}°
                  {forecast.current.wind_gusts_10m ? ` · Gusts ${Math.round(forecast.current.wind_gusts_10m)}` : ''}
                </div>
              </div>

              {/* Sky Dynamics */}
              <div className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <span className="text-[9.5px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Cloud size={10} className="text-sky-400" />
                  Sky
                </span>
                <div className="text-xs font-bold text-white mt-0.5">
                  {cloudCover}% Cloud
                </div>
                <div className="text-[9.5px] text-slate-300 mt-0.5 truncate">
                  {precipitationMm > 0 ? `Rain: ${precipitationMm} mm` : 'Zero rain'}
                </div>
              </div>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}

export default Globe3DModal;
