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
} from 'lucide-react';
import type { Location, Forecast, AirQuality } from '../App';
import { getAqiDetails } from '../App';

export type AtmosphericLayer = 'none' | 'clouds' | 'temperature' | 'wind' | 'precipitation';
export type GlobeMapMode = 'satellite' | 'night' | 'cartographic';

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

// Cached GeoJSON country borders geometry
let cachedCountryGeoJson: any = null;

// ============================================================================
// REALISTIC HIGH-FIDELITY BORDER OVERLAY CANVAS TEXTURE
// Draws official international borders from Natural Earth 110m GeoJSON
// ============================================================================
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

  // Draw delicate graticules
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

  // Draw Real International Country Frontiers
  if (geoJsonData && Array.isArray(geoJsonData.features)) {
    ctx.save();
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.85)'; // Crisp cyan-white border
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
          // Detect meridian wrapping (-180 / +180) to avoid horizontal cross-screen lines
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
      if (isDrawing) {
        ctx.stroke();
      }
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
  const density = Math.max(0.18, Math.min(1.0, cloudCoverPercentage / 100));
  const numCloudPuffs = Math.floor(180 * density) + 40;

  ctx.save();
  for (let i = 0; i < numCloudPuffs; i++) {
    const u = Math.random();
    const v = Math.random();
    const x = u * width;
    const y = v * height;
    const radius = (22 + Math.random() * 65) * (0.6 + density * 0.7);
    const alpha = (0.2 + Math.random() * 0.45) * Math.min(1, density * 1.3);

    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, `rgba(255, 255, 255, ${alpha.toFixed(2)})`);
    grad.addColorStop(0.5, `rgba(240, 249, 255, ${(alpha * 0.6).toFixed(2)})`);
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    // Wrap-around for seamless equirectangular sphere mapping
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

// Procedural Temperature Heatmap Layer
function createProceduralTemperatureTexture(currentTemp: number, activeLat: number, activeLon: number): THREE.CanvasTexture {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const tempGrad = ctx.createLinearGradient(0, 0, 0, height);
  tempGrad.addColorStop(0, 'rgba(59, 7, 100, 0.85)');    // North Pole: -25°C
  tempGrad.addColorStop(0.15, 'rgba(6, 182, 212, 0.78)');  // Sub-Arctic: -10°C
  tempGrad.addColorStop(0.3, 'rgba(16, 185, 129, 0.72)');  // Mid-Latitudes: +10°C
  tempGrad.addColorStop(0.42, 'rgba(234, 179, 8, 0.75)');  // Subtropical: +22°C
  tempGrad.addColorStop(0.5, 'rgba(239, 68, 68, 0.82)');   // Equator: +32°C
  tempGrad.addColorStop(0.58, 'rgba(234, 179, 8, 0.75)');  // Southern Subtropics: +22°C
  tempGrad.addColorStop(0.72, 'rgba(16, 185, 129, 0.72)'); // Southern Mid-Lat: +10°C
  tempGrad.addColorStop(0.85, 'rgba(6, 182, 212, 0.78)'); // Sub-Antarctic: -10°C
  tempGrad.addColorStop(1, 'rgba(30, 27, 75, 0.9)');      // South Pole: -35°C

  ctx.fillStyle = tempGrad;
  ctx.fillRect(0, 0, width, height);

  // Local temperature anchor around active location
  const locX = ((activeLon + 180) / 360) * width;
  const locY = ((90 - activeLat) / 180) * height;
  const locRadius = 140;

  let localColor = 'rgba(234, 179, 8, 0.75)';
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

  // White dashed isotherms
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.setLineDash([4, 6]);
  ctx.lineWidth = 1;
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

// Procedural Precipitation Radar Layer
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
  ctx.fillStyle = 'rgba(8, 47, 73, 0.25)';
  ctx.fillRect(0, 0, width, height);

  // Equatorial rain belt
  const eqY = (90 / 180) * height;
  for (let b = 0; b < 16; b++) {
    const bx = (b / 16) * width + (Math.random() - 0.5) * 40;
    const by = eqY + (Math.random() - 0.5) * 35;
    const rad = 25 + Math.random() * 45;

    const radGrad = ctx.createRadialGradient(bx, by, 0, bx, by, rad);
    radGrad.addColorStop(0, 'rgba(34, 197, 94, 0.7)');
    radGrad.addColorStop(0.5, 'rgba(14, 165, 233, 0.45)');
    radGrad.addColorStop(1, 'rgba(14, 165, 233, 0)');

    ctx.fillStyle = radGrad;
    ctx.beginPath();
    ctx.arc(bx, by, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // Active Location Radar Cell
  const locX = ((activeLon + 180) / 360) * width;
  const locY = ((90 - activeLat) / 180) * height;
  const isRaining = [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(weatherCode) || precipitationMm > 0;
  const isSnowing = [71, 73, 75, 77, 85, 86].includes(weatherCode);

  const cellRadius = isRaining ? 95 : 55;
  const cellGrad = ctx.createRadialGradient(locX, locY, 0, locX, locY, cellRadius);

  if (weatherCode >= 95) {
    cellGrad.addColorStop(0, 'rgba(168, 85, 247, 0.95)');
    cellGrad.addColorStop(0.35, 'rgba(239, 68, 68, 0.9)');
    cellGrad.addColorStop(0.65, 'rgba(245, 158, 11, 0.7)');
    cellGrad.addColorStop(1, 'rgba(34, 197, 94, 0)');
  } else if (isRaining) {
    cellGrad.addColorStop(0, 'rgba(239, 68, 68, 0.85)');
    cellGrad.addColorStop(0.3, 'rgba(234, 179, 8, 0.8)');
    cellGrad.addColorStop(0.65, 'rgba(34, 197, 94, 0.65)');
    cellGrad.addColorStop(1, 'rgba(14, 165, 233, 0)');
  } else if (isSnowing) {
    cellGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    cellGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.7)');
    cellGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
  } else {
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

// Procedural Wind Velocity Heatmap Layer
function createProceduralWindTexture(windSpeedKmh: number, activeLat: number, activeLon: number): THREE.CanvasTexture {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(2, 44, 34, 0.3)';
  ctx.fillRect(0, 0, width, height);

  // Mid-latitude Jet streams bands
  const jetBands = [height * 0.28, height * 0.72];
  jetBands.forEach((jy) => {
    const jetGrad = ctx.createLinearGradient(0, jy - 35, 0, jy + 35);
    jetGrad.addColorStop(0, 'rgba(13, 148, 136, 0.1)');
    jetGrad.addColorStop(0.5, 'rgba(20, 184, 166, 0.55)');
    jetGrad.addColorStop(1, 'rgba(13, 148, 136, 0.1)');
    ctx.fillStyle = jetGrad;
    ctx.fillRect(0, jy - 35, width, 70);
  });

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

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export function Globe3DModal({
  location,
  forecast,
  airQuality,
  onClose,
}: Globe3DModalProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  // Map Appearance Mode: Realistic Satellite (Blue Marble), Night Lights, or Cartographic
  const [mapMode, setMapMode] = useState<GlobeMapMode>('satellite');

  // Atmospheric Layer state & UI controls
  const [selectedLayer, setSelectedLayer] = useState<AtmosphericLayer>('temperature');
  const [layerOpacity, setLayerOpacity] = useState<number>(0.85);
  const [showWindStreams, setShowWindStreams] = useState<boolean>(true);
  const [showBorders, setShowBorders] = useState<boolean>(true);
  const [isAutoRotating, setIsAutoRotating] = useState<boolean>(true);
  const [isStationCardCollapsed, setIsStationCardCollapsed] = useState<boolean>(false);
  const [geoJsonData, setGeoJsonData] = useState<any>(cachedCountryGeoJson);
  const [webglError, setWebglError] = useState<string | null>(null);

  // Three.js References
  const targetRotationRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const currentRotationRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const earthGroupRef = useRef<THREE.Group | null>(null);
  const earthMeshRef = useRef<THREE.Mesh | null>(null);
  const bordersMeshRef = useRef<THREE.Mesh | null>(null);
  const cloudMeshRef = useRef<THREE.Mesh | null>(null);
  const tempMeshRef = useRef<THREE.Mesh | null>(null);
  const precipMeshRef = useRef<THREE.Mesh | null>(null);
  const windMeshRef = useRef<THREE.Mesh | null>(null);
  const windParticlesRef = useRef<THREE.Points | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const previousPointerPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Texture Cache References
  const texturesRef = useRef<{
    satellite?: THREE.Texture;
    night?: THREE.Texture;
    topology?: THREE.Texture;
    water?: THREE.Texture;
  }>({});

  const cloudCover = forecast.current.cloud_cover ?? 35;
  const currentTemp = forecast.current.temperature_2m ?? 20;
  const windSpeedKmh = forecast.current.wind_speed_10m ?? 12;
  const precipitationMm = forecast.current.precipitation ?? 0;
  const weatherDesc = getWeatherDescription(forecast.current.weather_code ?? 0);
  const aqiInfo = airQuality?.current?.us_aqi != null ? getAqiDetails(airQuality.current.us_aqi) : null;

  const countryDisplayName = location.country && location.country.trim() !== ''
    ? location.country.toUpperCase()
    : 'GLOBAL STATION';
  const countryBadge = getCountryBadge(location.country);

  // Fetch Natural Earth 110m countries GeoJSON on mount
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
      cameraRef.current.position.set(0, 0, 5.0);
    }
  }, [location.latitude, location.longitude, getCenterRotation]);

  const handleZoom = (delta: number) => {
    if (!cameraRef.current) return;
    const newZ = cameraRef.current.position.z + delta;
    cameraRef.current.position.z = Math.max(3.0, Math.min(7.5, newZ));
  };

  // Switch Globe Base Texture when Map Mode changes
  useEffect(() => {
    if (!earthMeshRef.current) return;
    const mat = earthMeshRef.current.material as THREE.MeshStandardMaterial;

    if (mapMode === 'satellite' && texturesRef.current.satellite) {
      mat.map = texturesRef.current.satellite;
      mat.bumpMap = texturesRef.current.topology || null;
      mat.bumpScale = 0.04;
      mat.roughnessMap = texturesRef.current.water || null;
      mat.roughness = 0.6;
      mat.metalness = 0.1;
      mat.needsUpdate = true;
    } else if (mapMode === 'night' && texturesRef.current.night) {
      mat.map = texturesRef.current.night;
      mat.bumpMap = texturesRef.current.topology || null;
      mat.bumpScale = 0.03;
      mat.roughnessMap = null;
      mat.roughness = 0.7;
      mat.metalness = 0.05;
      mat.needsUpdate = true;
    }
  }, [mapMode]);

  // Update Country Borders visibility & rebuild texture when geojson finishes loading
  useEffect(() => {
    if (!bordersMeshRef.current) return;
    const mat = bordersMeshRef.current.material as THREE.MeshBasicMaterial;
    mat.visible = showBorders;

    if (geoJsonData) {
      const newBordersTexture = createCountryBordersTexture(geoJsonData);
      if (mat.map) mat.map.dispose();
      mat.map = newBordersTexture;
      mat.needsUpdate = true;
    }
  }, [showBorders, geoJsonData]);

  // Update Layer Opacities
  useEffect(() => {
    if (tempMeshRef.current) {
      const mat = tempMeshRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = selectedLayer === 'temperature' ? layerOpacity : 0;
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
      mat.opacity = selectedLayer === 'clouds' ? layerOpacity : 0.45;
    }
  }, [selectedLayer, layerOpacity]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Initialize Three.js Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030712);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 5.0);
    cameraRef.current = camera;

    // Detect software WebGL probe safely without triggering unhandled context loss
    const isSoftwareGl = (() => {
      try {
        const testCanvas = document.createElement('canvas');
        const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : (gl as any).RENDERER;
        const gpu = String((gl as any).getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return false;
      }
    })();

    // Robust WebGL Renderer creation with fallback
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'default',
        alpha: false,
        failIfMajorPerformanceCaveat: false,
      });
    } catch (err: any) {
      console.warn('WebGL context creation failed:', err);
      setWebglError(err?.message || 'WebGL not supported or blocked in this browser environment');
      return;
    }

    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Natural Sunlight Rig
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffaf0, 2.6);
    sunLight.position.set(7, 5, 8);
    scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.4);
    rimLight.position.set(-8, -2, -6);
    scene.add(rimLight);

    // Deep Space Starfield
    const starsGeo = new THREE.BufferGeometry();
    const starCount = 900;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount * 3; i += 3) {
      starPositions[i] = (Math.random() - 0.5) * 70;
      starPositions[i + 1] = (Math.random() - 0.5) * 70;
      starPositions[i + 2] = (Math.random() - 0.5) * 70;
    }
    starsGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starsMat = new THREE.PointsMaterial({
      color: 0x94a3b8,
      size: 0.12,
      transparent: true,
      opacity: 0.8,
    });
    const stars = new THREE.Points(starsGeo, starsMat);
    scene.add(stars);

    // Earth Hierarchy Group
    const earthGroup = new THREE.Group();
    earthGroupRef.current = earthGroup;
    scene.add(earthGroup);

    const earthRadius = 2.0;

    // Preload Realistic High-Res Textures (NASA Blue Marble & Topography)
    const textureLoader = new THREE.TextureLoader();
    const satelliteTexture = textureLoader.load('/assets/earth-blue-marble.jpg');
    satelliteTexture.colorSpace = THREE.SRGBColorSpace;

    const nightTexture = textureLoader.load('/assets/earth-night.jpg');
    nightTexture.colorSpace = THREE.SRGBColorSpace;

    const topologyTexture = textureLoader.load('/assets/earth-topology.png');
    const waterTexture = textureLoader.load('/assets/earth-water.png');

    texturesRef.current = {
      satellite: satelliteTexture,
      night: nightTexture,
      topology: topologyTexture,
      water: waterTexture,
    };

    // 1. Realistic Earth Base Sphere (Blue Marble + Topography + Specular)
    const earthGeo = new THREE.SphereGeometry(earthRadius, 64, 64);
    const initialTexture = mapMode === 'night' ? nightTexture : satelliteTexture;
    const earthMat = new THREE.MeshStandardMaterial({
      map: initialTexture,
      bumpMap: topologyTexture,
      bumpScale: 0.04,
      roughnessMap: waterTexture,
      roughness: 0.6,
      metalness: 0.1,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthMeshRef.current = earthMesh;
    earthGroup.add(earthMesh);

    // 2. International Country Borders Overlay (Thin sphere shell right above land)
    const bordersGeo = new THREE.SphereGeometry(earthRadius * 1.002, 64, 64);
    const bordersTexture = createCountryBordersTexture(geoJsonData);
    const bordersMat = new THREE.MeshBasicMaterial({
      map: bordersTexture,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      visible: showBorders,
    });
    const bordersMesh = new THREE.Mesh(bordersGeo, bordersMat);
    bordersMeshRef.current = bordersMesh;
    earthGroup.add(bordersMesh);

    // 3. Temperature Heatmap Layer
    const tempGeo = new THREE.SphereGeometry(earthRadius * 1.008, 64, 64);
    const tempTexture = createProceduralTemperatureTexture(currentTemp, location.latitude, location.longitude);
    const tempMat = new THREE.MeshStandardMaterial({
      map: tempTexture,
      transparent: true,
      opacity: selectedLayer === 'temperature' ? layerOpacity : 0,
      depthWrite: false,
      roughness: 0.7,
    });
    const tempMesh = new THREE.Mesh(tempGeo, tempMat);
    tempMeshRef.current = tempMesh;
    earthGroup.add(tempMesh);

    // 4. Precipitation Radar Layer
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
      roughness: 0.7,
    });
    const precipMesh = new THREE.Mesh(precipGeo, precipMat);
    precipMeshRef.current = precipMesh;
    earthGroup.add(precipMesh);

    // 5. Wind Velocity Layer
    const windGeo = new THREE.SphereGeometry(earthRadius * 1.016, 64, 64);
    const windTexture = createProceduralWindTexture(windSpeedKmh, location.latitude, location.longitude);
    const windMat = new THREE.MeshStandardMaterial({
      map: windTexture,
      transparent: true,
      opacity: selectedLayer === 'wind' ? layerOpacity : 0,
      depthWrite: false,
      roughness: 0.7,
    });
    const windMesh = new THREE.Mesh(windGeo, windMat);
    windMeshRef.current = windMesh;
    earthGroup.add(windMesh);

    // 6. Passing Clouds Layer
    const cloudRadius = earthRadius * 1.024;
    const cloudGeo = new THREE.SphereGeometry(cloudRadius, 64, 64);
    const cloudTexture = createProceduralCloudTexture(cloudCover);
    const cloudMat = new THREE.MeshStandardMaterial({
      map: cloudTexture,
      transparent: true,
      opacity: selectedLayer === 'clouds' ? layerOpacity : 0.45,
      depthWrite: false,
    });
    const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    cloudMeshRef.current = cloudMesh;
    earthGroup.add(cloudMesh);

    // 7. Dynamic Wind Streamline Particles
    const streamCount = 850;
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
      opacity: showWindStreams ? 0.85 : 0,
      depthWrite: false,
    });
    const windParticles = new THREE.Points(streamGeo, streamMat);
    windParticlesRef.current = windParticles;
    earthGroup.add(windParticles);

    // 8. Outer Atmospheric Rayleigh Halo
    const atmoRadius = earthRadius * 1.05;
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
          float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.4);
          gl_FragColor = vec4(0.22, 0.74, 0.97, 1.0) * intensity * 0.95;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
    const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
    scene.add(atmoMesh);

    // 9. Holographic Active Location Marker
    const markerGroup = new THREE.Group();
    const locPos = latLonToVector3(location.latitude, location.longitude, earthRadius);
    markerGroup.position.copy(locPos);
    markerGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), locPos.clone().normalize());

    // Pulsing ground radar rings
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

    // Vertical luminous laser beam
    const beamGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.4, 16);
    beamGeo.translate(0, 0.2, 0);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.9,
    });
    const beamMesh = new THREE.Mesh(beamGeo, beamMat);
    markerGroup.add(beamMesh);

    // Pin head glowing orb
    const pinHeadGeo = new THREE.SphereGeometry(0.045, 16, 16);
    pinHeadGeo.translate(0, 0.4, 0);
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

    // Set initial center
    const initialCenter = getCenterRotation(location.latitude, location.longitude);
    currentRotationRef.current = { ...initialCenter };
    targetRotationRef.current = { ...initialCenter };
    earthGroup.rotation.x = initialCenter.x;
    earthGroup.rotation.y = initialCenter.y;

    // Interaction Handlers (Pointer Orbit with momentum damping)
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

    const dom = renderer.domElement;
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

    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    dom.addEventListener('wheel', handleWheel, { passive: false });

    // Resize
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

      // Ambient auto-rotation when user is not dragging
      if (isAutoRotating && !isDraggingRef.current) {
        targetRotationRef.current.y += 0.04 * delta;
      }

      // Smooth damping interpolation
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

      // Clouds rotation
      if (cloudMeshRef.current) {
        cloudMeshRef.current.rotation.y += 0.035 * delta;
      }

      // Pulsing active marker ring
      ringMesh.scale.setScalar(1 + Math.sin(elapsed * 4) * 0.3);

      // Wind particles stream
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

    // Cleanup
    return () => {
      cancelAnimationFrame(animId);
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      dom.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', handleResize);

      // Dispose resources
      earthGeo.dispose();
      earthMat.dispose();
      satelliteTexture.dispose();
      nightTexture.dispose();
      topologyTexture.dispose();
      waterTexture.dispose();
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

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [location.latitude, location.longitude, getCenterRotation, showWindStreams, isAutoRotating]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-xl animate-fade-in select-none overflow-hidden"
      data-testid="modal-3d-globe"
      role="dialog"
      aria-label="3D Interactive Earth Weather Globe"
    >
      {/* 3D Canvas Mount Container */}
      <div
        ref={mountRef}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing z-0"
        title="Drag to spin the globe · Scroll to zoom"
      />

      {/* Graceful WebGL Hardware Fallback Notice if WebGL context is blocked by browser */}
      {webglError && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center bg-slate-950/90 backdrop-blur-md">
          <div className="max-w-md p-6 rounded-3xl bg-slate-900/90 border border-slate-700/80 shadow-2xl">
            <div className="w-14 h-14 mx-auto mb-3.5 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Globe2 size={28} />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Hardware Acceleration Notice</h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Your browser or environment temporarily restricted WebGL 3D context creation. Standard meteorological telemetry for <strong className="text-white">{location.name}</strong> remains active below.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-semibold shadow-md transition"
              >
                Reload Context
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Floating Glass Command Bar */}
      <header className="relative z-20 flex items-center justify-between p-3.5 sm:px-6 pointer-events-none">
        {/* Left: Location & Country Identity */}
        <div className="pointer-events-auto flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-slate-900/85 border border-slate-700/60 shadow-xl backdrop-blur-md">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-500 text-white flex items-center justify-center font-bold shadow-md shadow-sky-500/20 shrink-0">
            <Globe2 size={18} />
          </div>
          <div>
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-sm">{countryBadge}</span>
              <span className="text-xs sm:text-sm font-bold text-white tracking-wide uppercase font-display">
                {countryDisplayName}
              </span>
              <span className="hidden sm:inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
                Live Realistic Globe
              </span>
            </div>
            <p className="text-[11px] text-slate-300 font-medium mt-1 flex items-center gap-1 leading-none">
              <MapPin size={11} className="text-amber-400" />
              <span>{location.name}</span>
              {location.admin1 && <span className="text-slate-400">· {location.admin1}</span>}
              <span className="text-slate-500 font-mono text-[10px] hidden md:inline">
                ({location.latitude.toFixed(2)}°, {location.longitude.toFixed(2)}°)
              </span>
            </p>
          </div>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2">
          {/* Base Map Style Switcher (Satellite Blue Marble vs Night Lights) */}
          <div className="flex items-center rounded-xl bg-slate-900/85 border border-slate-700/60 p-0.5 shadow-lg backdrop-blur-md">
            <button
              onClick={() => setMapMode('satellite')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                mapMode === 'satellite'
                  ? 'bg-sky-500/25 text-sky-300 border border-sky-400/50'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="NASA Blue Marble High-Resolution Satellite Map"
              data-testid="btn-mode-satellite"
            >
              <Satellite size={13} className="text-sky-400" />
              <span className="hidden sm:inline">Satellite</span>
            </button>
            <button
              onClick={() => setMapMode('night')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                mapMode === 'night'
                  ? 'bg-amber-500/25 text-amber-300 border border-amber-400/50'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Global Night City Lights Map"
              data-testid="btn-mode-night"
            >
              <Moon size={13} className="text-amber-400" />
              <span className="hidden sm:inline">Night</span>
            </button>
          </div>

          {/* Zoom Buttons */}
          <div className="hidden sm:flex items-center rounded-xl bg-slate-900/85 border border-slate-700/60 p-0.5 shadow-lg backdrop-blur-md">
            <button
              onClick={() => handleZoom(-0.5)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 transition"
              title="Zoom In"
              aria-label="Zoom In"
            >
              <Plus size={15} />
            </button>
            <button
              onClick={() => handleZoom(0.5)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 transition"
              title="Zoom Out"
              aria-label="Zoom Out"
            >
              <Minus size={15} />
            </button>
          </div>

          {/* Auto Rotation Toggle */}
          <button
            onClick={() => setIsAutoRotating(!isAutoRotating)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center border shadow-lg backdrop-blur-md transition ${
              isAutoRotating
                ? 'bg-sky-500/20 text-sky-300 border-sky-400/40'
                : 'bg-slate-900/85 text-slate-400 border-slate-700/60 hover:text-white'
            }`}
            title={isAutoRotating ? 'Pause Orbit Rotation' : 'Start Orbit Rotation'}
            data-testid="button-auto-rotate"
          >
            {isAutoRotating ? <Pause size={15} /> : <Play size={15} />}
          </button>

          {/* Recenter Location Button */}
          <button
            onClick={recenterActiveLocation}
            className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40 shadow-lg backdrop-blur-md text-xs font-semibold transition"
            title="Focus and Center Active Location"
            data-testid="button-recenter-globe"
          >
            <RotateCcw size={13} className="text-amber-400" />
            <span className="hidden sm:inline">Center</span>
          </button>

          {/* Close Modal Button */}
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-900/85 hover:bg-rose-500 text-slate-300 hover:text-white flex items-center justify-center border border-slate-700/60 shadow-lg backdrop-blur-md transition"
            aria-label="Close 3D Globe"
            data-testid="button-close-globe"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* Center Floating Layer Switcher Pill */}
      <div className="relative z-10 mx-auto mt-1 sm:mt-2 pointer-events-none px-4">
        <div className="pointer-events-auto inline-flex flex-wrap items-center justify-center gap-1 p-1 rounded-2xl bg-slate-900/85 border border-slate-700/70 shadow-2xl backdrop-blur-xl max-w-full">
          {/* Surface Temperature */}
          <button
            onClick={() => setSelectedLayer(selectedLayer === 'temperature' ? 'none' : 'temperature')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition ${
              selectedLayer === 'temperature'
                ? 'bg-amber-500/25 text-amber-300 border border-amber-400/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
            data-testid="layer-btn-temperature"
          >
            <Thermometer size={13} className="text-amber-400 shrink-0" />
            <span>Thermal</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-200 hidden sm:inline">
              {Math.round(currentTemp)}°C
            </span>
          </button>

          {/* Wind Streamlines */}
          <button
            onClick={() => setSelectedLayer(selectedLayer === 'wind' ? 'none' : 'wind')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition ${
              selectedLayer === 'wind'
                ? 'bg-teal-500/25 text-teal-300 border border-teal-400/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
            data-testid="layer-btn-wind"
          >
            <Wind size={13} className="text-teal-400 shrink-0" />
            <span>Wind</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-teal-400/20 text-teal-200 hidden sm:inline">
              {Math.round(windSpeedKmh)} km/h
            </span>
          </button>

          {/* Precipitation Radar */}
          <button
            onClick={() => setSelectedLayer(selectedLayer === 'precipitation' ? 'none' : 'precipitation')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition ${
              selectedLayer === 'precipitation'
                ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-400/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
            data-testid="layer-btn-precipitation"
          >
            <Radar size={13} className="text-emerald-400 shrink-0" />
            <span>Precipitation</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-400/20 text-emerald-200 hidden sm:inline">
              {precipitationMm > 0 ? `${precipitationMm} mm` : 'Radar'}
            </span>
          </button>

          {/* Satellite Clouds */}
          <button
            onClick={() => setSelectedLayer(selectedLayer === 'clouds' ? 'none' : 'clouds')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition ${
              selectedLayer === 'clouds'
                ? 'bg-sky-500/25 text-sky-300 border border-sky-400/50 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
            data-testid="layer-btn-clouds"
          >
            <Cloud size={13} className="text-sky-400 shrink-0" />
            <span>Clouds</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-400/20 text-sky-200 hidden sm:inline">
              {cloudCover}%
            </span>
          </button>

          <div className="h-4 w-px bg-slate-700/60 mx-1 hidden sm:block" />

          {/* Real Country Borders Toggle */}
          <button
            onClick={() => setShowBorders(!showBorders)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition border ${
              showBorders
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-400/40'
                : 'text-slate-500 border-transparent hover:text-slate-300'
            }`}
            title="Toggle international country borders on the realistic globe"
            data-testid="button-toggle-borders"
          >
            <Compass size={12} className={showBorders ? 'text-indigo-400' : 'text-slate-500'} />
            <span className="hidden md:inline">Borders:</span>
            <span>{showBorders ? 'ON' : 'OFF'}</span>
          </button>

          {/* Wind Streamlines Toggle */}
          <button
            onClick={() => setShowWindStreams(!showWindStreams)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition border ${
              showWindStreams
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40'
                : 'text-slate-500 border-transparent hover:text-slate-300'
            }`}
            title="Toggle animated wind vector circulation system"
            data-testid="button-toggle-streamlines"
          >
            <Sparkles size={12} className={showWindStreams ? 'text-cyan-400' : 'text-slate-500'} />
            <span className="hidden md:inline">Vectors:</span>
            <span>{showWindStreams ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>

      {/* Floating Bottom Section: Telemetry & Controls Dock */}
      <footer className="relative z-10 mt-auto p-3 sm:p-5 pointer-events-none flex flex-col sm:flex-row items-end sm:items-center justify-between gap-3">
        {/* Left: Layer Opacity Slider Toolbar */}
        <div className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/85 border border-slate-700/60 shadow-xl backdrop-blur-md text-xs text-slate-300">
          <Sliders size={12} className="text-amber-400 shrink-0" />
          <span className="text-[11px] text-slate-400">Layer Opacity:</span>
          <input
            type="range"
            min="0.2"
            max="1"
            step="0.05"
            value={layerOpacity}
            onChange={(e) => setLayerOpacity(parseFloat(e.target.value))}
            className="w-16 sm:w-24 accent-amber-400 cursor-pointer"
          />
          <span className="font-mono text-[10px] text-slate-300 w-7">{Math.round(layerOpacity * 100)}%</span>
        </div>

        {/* Right: Collapsible Station Telemetry Card */}
        <div className="pointer-events-auto w-full sm:w-auto max-w-sm rounded-2xl bg-slate-900/85 border border-slate-700/70 shadow-2xl backdrop-blur-xl overflow-hidden">
          {/* Card Header with Collapse Toggle */}
          <button
            onClick={() => setIsStationCardCollapsed(!isStationCardCollapsed)}
            className="w-full flex items-center justify-between px-3.5 py-2 text-xs font-medium text-slate-300 hover:text-white border-b border-slate-800/60 transition"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold text-white uppercase text-[11px] tracking-wider">
                {location.name} Telemetry
              </span>
            </div>
            <div className="flex items-center gap-1 text-slate-400 text-[11px]">
              <span>{isStationCardCollapsed ? 'Expand' : 'Collapse'}</span>
              {isStationCardCollapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </div>
          </button>

          {!isStationCardCollapsed && (
            <div className="p-3 grid grid-cols-2 gap-2 text-xs">
              {/* Temperature & Condition */}
              <div className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Sun size={11} className="text-amber-400" />
                  Thermal State
                </span>
                <div className="text-sm font-bold text-white mt-0.5">
                  {Math.round(currentTemp)}°C
                  <span className="text-[10px] text-slate-400 font-normal ml-1">
                    (Feels {Math.round(forecast.current.apparent_temperature)}°)
                  </span>
                </div>
                <div className="text-[10px] text-slate-300 truncate mt-0.5">{weatherDesc.label}</div>
              </div>

              {/* Air Quality */}
              <div className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Air Quality
                </span>
                <div className="text-sm font-bold text-white mt-0.5 flex items-center gap-1.5">
                  {aqiInfo ? (
                    <>
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: aqiInfo.color }} />
                      <span>AQI {airQuality?.current.us_aqi}</span>
                    </>
                  ) : (
                    <span>AQI --</span>
                  )}
                </div>
                <div className="text-[10px] text-slate-300 truncate mt-0.5">
                  {aqiInfo ? aqiInfo.level : 'Station monitoring'}
                </div>
              </div>

              {/* Wind Speed & Direction */}
              <div className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Wind size={11} className="text-teal-400" />
                  Wind Circulation
                </span>
                <div className="text-sm font-bold text-white mt-0.5">
                  {Math.round(windSpeedKmh)} km/h
                </div>
                <div className="text-[10px] text-slate-300 mt-0.5">
                  Dir: {Math.round(forecast.current.wind_direction_10m)}°
                  {forecast.current.wind_gusts_10m ? ` · Gusts ${Math.round(forecast.current.wind_gusts_10m)}` : ''}
                </div>
              </div>

              {/* Cloud & Precipitation */}
              <div className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/50">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Cloud size={11} className="text-sky-400" />
                  Sky Dynamics
                </span>
                <div className="text-sm font-bold text-white mt-0.5">
                  {cloudCover}% Cloud
                </div>
                <div className="text-[10px] text-slate-300 mt-0.5">
                  {precipitationMm > 0 ? `Rain: ${precipitationMm} mm` : 'Zero precipitation'}
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
