import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Compass,
  Droplets,
  ExternalLink,
  FlaskConical,
  Info,
  LocateFixed,
  RefreshCw,
  Search,
  ShieldAlert,
  Thermometer,
  Waves,
  X,
} from 'lucide-react';
import { cleanCityOrVillageName, cleanCountryName } from '@/lib/locationUtils';

export interface LiveWaterStation {
  id: string;
  name: string;
  agency: string;
  distanceKm: number;
  latitude: number;
  longitude: number;
  observedAt: string;
  metrics: {
    ph?: number;
    dissolvedOxygenMgL?: number;
    waterTempC?: number;
    turbidityFnu?: number;
    conductanceUsCm?: number;
    tdsEstimatedMgL?: number;
    nitrateMgL?: number;
    streamflowM3s?: number;
    gageHeightM?: number;
  };
}

export interface NearbyWaterBody {
  name: string;
  type: 'lake' | 'reservoir' | 'river' | 'canal' | 'stream' | 'water';
  distanceKm: number;
  latitude: number;
  longitude: number;
}

export interface WaterQualityResponse {
  area: {
    name: string;
    latitude: number;
    longitude: number;
  };
  fetchedAt: string;
  mode: 'live_sensor' | 'watershed_hydrology';
  overallScore: number;
  statusLabel: string;
  statusTone: 'good' | 'moderate' | 'warning' | 'alert';
  summary: string;
  guidance: string[];
  sources: string[];
  liveStations: LiveWaterStation[];
  hydrology: {
    riverDischargeM3s: number | null;
    riverDischargeMeanM3s: number | null;
    riverDischargeMedianM3s: number | null;
    dischargeRatio: number | null;
    dischargeStatus: string;
    dailyTrend: Array<{
      date: string;
      dischargeM3s: number;
      maxM3s: number;
    }>;
  };
  watershed: {
    soilMoistureTopPct: number | null;
    soilMoistureRootPct: number | null;
    recentRainMm: number | null;
    evapotranspirationMm: number | null;
    runoffRiskLabel: string;
    acidDepositionRisk: 'Low' | 'Moderate' | 'Elevated';
    so2UgM3: number | null;
    no2UgM3: number | null;
    pm25UgM3: number | null;
  };
  marine: {
    isCoastal: boolean;
    seaSurfaceTempC: number | null;
    waveHeightM: number | null;
    currentSpeedKmh: number | null;
  };
  nearbyWaterBodies: NearbyWaterBody[];
  regionalReport: {
    summary: string;
    citations: Array<{ title: string; url: string }>;
  } | null;
}

export interface WaterAreaTarget {
  name: string;
  latitude: number;
  longitude: number;
  admin1?: string;
  country?: string;
}

interface SearchGeoResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  admin1?: string;
  country?: string;
}

const TONE_STYLES: Record<
  WaterQualityResponse['statusTone'],
  { color: string; bg: string; border: string }
> = {
  good: {
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.14)',
    border: 'rgba(16, 185, 129, 0.45)',
  },
  moderate: {
    color: '#06b6d4',
    bg: 'rgba(6, 182, 212, 0.14)',
    border: 'rgba(6, 182, 212, 0.45)',
  },
  warning: {
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.14)',
    border: 'rgba(245, 158, 11, 0.45)',
  },
  alert: {
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.14)',
    border: 'rgba(239, 68, 68, 0.45)',
  },
};

function formatWaterTemp(tempC: number, unit: 'C' | 'F'): string {
  if (unit === 'F') {
    return `${((tempC * 9) / 5 + 32).toFixed(1)} °F`;
  }
  return `${tempC.toFixed(1)} °C`;
}

function formatWindOrCurrentSpeed(kmh: number, unit: 'km/h' | 'mph' | 'm/s' | 'kn'): string {
  if (unit === 'mph') return `${(kmh * 0.621371).toFixed(1)} mph`;
  if (unit === 'm/s') return `${(kmh / 3.6).toFixed(2)} m/s`;
  if (unit === 'kn') return `${(kmh * 0.539957).toFixed(1)} kn`;
  return `${kmh.toFixed(1)} km/h`;
}

function formatShortDate(isoDate: string): string {
  try {
    const d = new Date(`${isoDate}T00:00:00Z`);
    return d.toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' });
  } catch {
    return isoDate.slice(5);
  }
}

function formatObservedTime(iso: string): string {
  if (!iso) return 'Recent reading';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getWaterBodyLabel(type: NearbyWaterBody['type']): string {
  switch (type) {
    case 'reservoir':
      return 'Reservoir';
    case 'river':
      return 'River';
    case 'canal':
      return 'Canal';
    case 'stream':
      return 'Stream';
    case 'lake':
      return 'Lake';
    default:
      return 'Surface Water';
  }
}

export function WaterQualityPanel({
  activeLocation,
  tempUnit,
  windUnit,
}: {
  activeLocation: WaterAreaTarget;
  tempUnit: 'C' | 'F';
  windUnit: 'km/h' | 'mph' | 'm/s' | 'kn';
}) {
  const [inspectedArea, setInspectedArea] = useState<WaterAreaTarget>(activeLocation);
  const [isCustomArea, setIsCustomArea] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchGeoResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [data, setData] = useState<WaterQualityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshNonce, setRefreshNonce] = useState(0);

  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Sync automatically with active dashboard location unless user pinned a custom lookup
  useEffect(() => {
    if (!isCustomArea) {
      setInspectedArea(activeLocation);
    }
  }, [activeLocation, isCustomArea]);

  // Close search dropdown on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchResults([]);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Debounced area search using Atmos backend + Open-Meteo geocoding fallback
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        let items: SearchGeoResult[] = [];
        try {
          const res = await fetch(`/api/weather/search?q=${encodeURIComponent(trimmed)}`, {
            signal: controller.signal,
          });
          if (res.ok) {
            const json = (await res.json()) as { results?: SearchGeoResult[] };
            if (Array.isArray(json.results)) {
              items = json.results;
            }
          }
        } catch (err) {
          if ((err as Error)?.name === 'AbortError') throw err;
        }

        if (items.length === 0) {
          const fallbackRes = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
              trimmed
            )}&count=6&language=en&format=json`,
            { signal: controller.signal }
          );
          if (fallbackRes.ok) {
            const fallbackJson = (await fallbackRes.json()) as { results?: SearchGeoResult[] };
            items = fallbackJson.results ?? [];
          }
        }

        setSearchResults(items.slice(0, 6));
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') {
          setSearchResults([]);
        }
      } finally {
        setSearching(false);
      }
    }, 260);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

  const fetchWaterQuality = useCallback(
    async (target: WaterAreaTarget, signal?: AbortSignal) => {
      setLoading(true);
      setError('');
      try {
        const cleanName = cleanCityOrVillageName(target.name) || target.name;
        const params = new URLSearchParams({
          latitude: target.latitude.toString(),
          longitude: target.longitude.toString(),
          name: cleanName,
        });
        const res = await fetch(`/api/weather/water-quality?${params.toString()}`, { signal });
        if (!res.ok) {
          throw new Error(`Water telemetry service returned ${res.status}`);
        }
        const payload = (await res.json()) as WaterQualityResponse;
        setData(payload);
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to reach hydrological and water quality telemetry feeds.'
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const controller = new AbortController();
    void fetchWaterQuality(inspectedArea, controller.signal);
    return () => controller.abort();
  }, [inspectedArea, refreshNonce, fetchWaterQuality]);

  const selectSearchResult = (item: SearchGeoResult) => {
    setInspectedArea({
      name: cleanCityOrVillageName(item.name),
      latitude: item.latitude,
      longitude: item.longitude,
      admin1: item.admin1 ? cleanCityOrVillageName(item.admin1) : undefined,
      country: item.country ? cleanCityOrVillageName(cleanCountryName(item.country)) : undefined,
    });
    setIsCustomArea(true);
    setSearchQuery('');
    setSearchResults([]);
  };

  const resetToActiveCity = () => {
    setIsCustomArea(false);
    setInspectedArea(activeLocation);
    setSearchQuery('');
    setSearchResults([]);
  };

  const displayAreaName = cleanCityOrVillageName(inspectedArea.name) || inspectedArea.name;
  const regionMeta = [
    cleanCityOrVillageName(inspectedArea.admin1),
    cleanCityOrVillageName(cleanCountryName(inspectedArea.country)),
  ]
    .filter(Boolean)
    .join(', ');

  const toneStyle = data ? TONE_STYLES[data.statusTone] : TONE_STYLES.moderate;
  const maxTrendValue = data
    ? Math.max(
        0.5,
        ...data.hydrology.dailyTrend.map((d) => Math.max(d.dischargeM3s, d.maxM3s))
      )
    : 1;

  return (
    <div className="space-y-5" data-testid="container-water-quality-panel">
      {/* Area Selector & Search Bar */}
      <section
        ref={searchContainerRef}
        className="rounded-[18px] border border-[var(--liquid-glass-border)] bg-[var(--liquid-glass-bg)] p-4 sm:p-5 backdrop-blur-md shadow-[var(--liquid-glass-shadow)] relative z-20"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="eyebrow">Hydrology & Basin Diagnostics</div>
            <h3 className="text-lg font-semibold tracking-tight text-foreground mt-0.5">
              Water Quality · {displayAreaName}
            </h3>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap font-mono tabular-nums">
              {regionMeta && (
                <>
                  <span>{regionMeta}</span>
                  <span aria-hidden="true">·</span>
                </>
              )}
              <span>
                {inspectedArea.latitude.toFixed(3)}°, {inspectedArea.longitude.toFixed(3)}°
              </span>
              {isCustomArea && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-sky-600 dark:text-sky-400 font-medium">Custom area lookup</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {isCustomArea && (
              <button
                type="button"
                onClick={resetToActiveCity}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-border bg-muted/60 hover:bg-muted text-foreground transition-colors whitespace-nowrap shrink-0"
                data-testid="button-water-use-active-city"
              >
                <LocateFixed size={13} />
                <span>Use {cleanCityOrVillageName(activeLocation.name)}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setRefreshNonce((n) => n + 1)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-border bg-muted/60 hover:bg-muted text-foreground transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
              data-testid="button-water-refresh"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Particular Area Lookup Input */}
        <div className="mt-3.5 relative">
          <div className="relative flex items-center">
            <Search
              size={15}
              className="absolute left-3.5 text-muted-foreground pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Inspect water quality for any city, town, lake, or watershed (e.g. San Francisco, London, Bengaluru)..."
              aria-label="Inspect water quality for another area"
              data-testid="input-search-water-area"
              className="w-full h-11 pl-10 pr-10 rounded-xl border border-border bg-background/60 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500/60 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                aria-label="Clear water area search"
                className="absolute right-3 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {(searching || searchResults.length > 0) && (
            <div className="absolute left-0 right-0 mt-1.5 rounded-xl border border-border bg-card/95 backdrop-blur-xl shadow-xl overflow-hidden z-30">
              {searching && searchResults.length === 0 ? (
                <div className="px-4 py-3 text-xs text-muted-foreground font-mono">
                  Searching global gazetteer...
                </div>
              ) : (
                searchResults.map((item) => {
                  const sub = [
                    cleanCityOrVillageName(item.admin1),
                    cleanCityOrVillageName(cleanCountryName(item.country)),
                  ]
                    .filter(Boolean)
                    .join(', ');
                  return (
                    <button
                      key={`${item.id}-${item.latitude}-${item.longitude}`}
                      type="button"
                      onClick={() => selectSearchResult(item)}
                      className="w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-muted/70 border-b last:border-b-0 border-border/50 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                          {cleanCityOrVillageName(item.name)}
                        </div>
                        {sub && (
                          <div className="text-xs text-muted-foreground truncate">{sub}</div>
                        )}
                      </div>
                      <span className="text-[11px] font-mono tabular-nums text-muted-foreground shrink-0">
                        {item.latitude.toFixed(2)}°, {item.longitude.toFixed(2)}°
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </section>

      {/* Loading State */}
      {loading && !data && (
        <section className="rounded-[18px] border border-[var(--liquid-glass-border)] bg-[var(--liquid-glass-bg)] p-6 space-y-4 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-muted/60 shrink-0" />
            <div className="space-y-2.5 flex-1">
              <div className="h-4 w-44 rounded bg-muted/60" />
              <div className="h-5 w-3/4 rounded bg-muted/60" />
              <div className="h-3 w-1/2 rounded bg-muted/60" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="h-32 rounded-xl bg-muted/50" />
            <div className="h-32 rounded-xl bg-muted/50" />
          </div>
        </section>
      )}

      {/* Error State */}
      {error && !loading && (
        <section
          className="rounded-[18px] border border-red-500/40 bg-red-500/10 p-5 flex items-center justify-between gap-4 flex-wrap"
          data-testid="status-water-error"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-foreground">
                Water quality feed unavailable
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setRefreshNonce((n) => n + 1)}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-500/20 hover:bg-red-500/30 text-red-700 dark:text-red-300 border border-red-500/40 transition"
          >
            Try again
          </button>
        </section>
      )}

      {/* Main Live Data Content */}
      {data && (
        <>
          {/* Hero Score & Guidance Card */}
          <section
            className="aqi-hero-card"
            data-testid="card-water-hero"
            style={{ opacity: loading ? 0.72 : 1, transition: 'opacity 180ms ease' }}
          >
            <div className="aqi-hero-main-group">
              <div
                className="aqi-hero-dial"
                style={{
                  border: `3px solid ${toneStyle.border}`,
                  boxShadow: `0 0 16px ${toneStyle.bg}`,
                }}
              >
                <div className="aqi-hero-dial-inner">
                  <div
                    className="aqi-dial-number font-mono tabular-nums"
                    style={{ color: toneStyle.color }}
                  >
                    {data.overallScore}
                  </div>
                  <div className="aqi-dial-scale">Index / 100</div>
                </div>
              </div>

              <div className="aqi-hero-info">
                <div className="flex items-center gap-2 text-xs font-mono flex-wrap">
                  <span
                    className="inline-flex items-center gap-1.5 font-semibold"
                    style={{ color: toneStyle.color }}
                  >
                    {data.statusTone === 'good' || data.statusTone === 'moderate' ? (
                      <CheckCircle2 size={13} />
                    ) : (
                      <ShieldAlert size={13} />
                    )}
                    <span>{data.statusLabel}</span>
                  </span>
                  <span className="text-muted-foreground" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-muted-foreground">
                    {data.mode === 'live_sensor'
                      ? 'Live Chemical Sensor Verified'
                      : 'Global Watershed & Hydrology Telemetry'}
                  </span>
                </div>

                <h3 className="aqi-hero-title">{data.summary}</h3>

                <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                  <span>Sources:</span>
                  <span>{data.sources.join(' · ')}</span>
                </div>

                {data.guidance.length > 0 && (
                  <ul className="mt-2 space-y-1.5 text-xs text-foreground/90">
                    {data.guidance.map((tip, idx) => (
                      <li key={idx} className="flex items-start gap-2 leading-relaxed">
                        <Droplets
                          size={13}
                          className="text-sky-500 shrink-0 mt-0.5"
                        />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="aqi-hero-sub-stats">
              <div className="aqi-sub-stat-item">
                <span className="aqi-sub-stat-label">River Flow</span>
                <span className="aqi-sub-stat-value font-mono tabular-nums">
                  {data.hydrology.riverDischargeM3s != null
                    ? `${data.hydrology.riverDischargeM3s} m³/s`
                    : '--'}
                </span>
              </div>
              <div className="aqi-sub-stat-item">
                <span className="aqi-sub-stat-label">Soil Saturation</span>
                <span className="aqi-sub-stat-value font-mono tabular-nums">
                  {data.watershed.soilMoistureTopPct != null
                    ? `${data.watershed.soilMoistureTopPct}%`
                    : '--'}
                </span>
              </div>
              <div className="aqi-sub-stat-item">
                <span className="aqi-sub-stat-label">Acid Rain Risk</span>
                <span className="aqi-sub-stat-value font-mono tabular-nums">
                  {data.watershed.acidDepositionRisk}
                </span>
              </div>
            </div>
          </section>

          {/* Live Monitoring Stations (USGS / UK Environment Agency) */}
          <section className="space-y-3" data-testid="section-water-live-stations">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <div className="eyebrow">Public Gauge & Sensor Telemetry</div>
                <h3 className="text-base font-semibold text-foreground mt-0.5">
                  Nearby Monitoring Stations ({data.liveStations.length})
                </h3>
              </div>
              <span className="text-xs font-mono text-muted-foreground tabular-nums">
                Updated {formatObservedTime(data.fetchedAt)}
              </span>
            </div>

            {data.liveStations.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                {data.liveStations.map((station) => {
                  const m = station.metrics;
                  const metricCells: Array<{ label: string; value: string; band?: string }> = [];
                  if (m.ph != null) {
                    metricCells.push({
                      label: 'pH Level',
                      value: m.ph.toFixed(2),
                      band: 'Safe 6.5–8.5',
                    });
                  }
                  if (m.dissolvedOxygenMgL != null) {
                    metricCells.push({
                      label: 'Dissolved O₂',
                      value: `${m.dissolvedOxygenMgL.toFixed(1)} mg/L`,
                      band: 'Healthy ≥ 6.0',
                    });
                  }
                  if (m.turbidityFnu != null) {
                    metricCells.push({
                      label: 'Turbidity',
                      value: `${m.turbidityFnu.toFixed(1)} FNU`,
                      band: 'Clear ≤ 15 FNU',
                    });
                  }
                  if (m.conductanceUsCm != null) {
                    metricCells.push({
                      label: 'Conductance',
                      value: `${m.conductanceUsCm} µS/cm`,
                      band: m.tdsEstimatedMgL != null ? `Est. TDS ${m.tdsEstimatedMgL} mg/L` : undefined,
                    });
                  }
                  if (m.waterTempC != null) {
                    metricCells.push({
                      label: 'Water Temp',
                      value: formatWaterTemp(m.waterTempC, tempUnit),
                    });
                  }
                  if (m.nitrateMgL != null) {
                    metricCells.push({
                      label: 'Nitrate (NO₃⁻)',
                      value: `${m.nitrateMgL.toFixed(2)} mg/L`,
                      band: 'EPA Limit 10',
                    });
                  }
                  if (m.streamflowM3s != null) {
                    metricCells.push({
                      label: 'Streamflow',
                      value: `${m.streamflowM3s.toFixed(2)} m³/s`,
                    });
                  }
                  if (m.gageHeightM != null) {
                    metricCells.push({
                      label: 'Gage Height',
                      value: `${m.gageHeightM.toFixed(2)} m`,
                    });
                  }

                  return (
                    <article
                      key={station.id}
                      className="rounded-[16px] border border-[var(--liquid-glass-border)] bg-[var(--liquid-glass-bg)] p-4 backdrop-blur-md space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="text-sm font-semibold text-foreground leading-snug">
                            {station.name}
                          </h4>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 font-mono tabular-nums flex-wrap">
                            <span>{station.agency}</span>
                            <span aria-hidden="true">·</span>
                            <span>{station.distanceKm} km away</span>
                            <span aria-hidden="true">·</span>
                            <span>{formatObservedTime(station.observedAt)}</span>
                          </div>
                        </div>
                        <FlaskConical size={16} className="text-sky-500 shrink-0 mt-0.5" />
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1 border-t border-border/60">
                        {metricCells.map((cell) => (
                          <div key={cell.label} className="py-1">
                            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                              {cell.label}
                            </div>
                            <div className="text-base font-semibold font-mono tabular-nums text-foreground mt-0.5">
                              {cell.value}
                            </div>
                            {cell.band && (
                              <div className="text-[10px] font-mono text-muted-foreground">
                                {cell.band}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[16px] border border-border/80 bg-muted/25 px-4 py-3.5 flex items-start gap-3 text-xs text-muted-foreground leading-relaxed">
                <Info size={16} className="text-sky-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-foreground">
                    No open chemical probe feed (pH / DO / TDS) exposed publicly within 30 km of{' '}
                    {displayAreaName}.
                  </span>{' '}
                  Live sensor networks via USGS and UK Environment Agency publish real-time chemical
                  probes across the US and UK; for all global basins, Atmos displays live GloFAS
                  river discharge, soil runoff saturation, atmospheric wet-deposition chemistry,
                  and local hydrography below.
                </div>
              </div>
            )}
          </section>

          {/* 2-Column Hydrology & Watershed Chemistry Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
            {/* River Discharge & 7-Day GloFAS Trend */}
            <section className="rounded-[18px] border border-[var(--liquid-glass-border)] bg-[var(--liquid-glass-bg)] p-5 backdrop-blur-md flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="eyebrow">GloFAS River Basin Telemetry</div>
                    <h3 className="text-base font-semibold text-foreground mt-0.5">
                      Discharge & Sediment Surge
                    </h3>
                  </div>
                  <Waves size={18} className="text-sky-500 shrink-0" />
                </div>

                <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-border/60">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      Current Flow
                    </div>
                    <div className="text-xl font-semibold font-mono tabular-nums text-foreground mt-0.5">
                      {data.hydrology.riverDischargeM3s != null
                        ? `${data.hydrology.riverDischargeM3s}`
                        : '--'}
                      <span className="text-xs font-normal text-muted-foreground ml-1">m³/s</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      Median Base
                    </div>
                    <div className="text-xl font-semibold font-mono tabular-nums text-foreground mt-0.5">
                      {data.hydrology.riverDischargeMedianM3s != null
                        ? `${data.hydrology.riverDischargeMedianM3s}`
                        : '--'}
                      <span className="text-xs font-normal text-muted-foreground ml-1">m³/s</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      Surge Ratio
                    </div>
                    <div className="text-xl font-semibold font-mono tabular-nums text-foreground mt-0.5">
                      {data.hydrology.dischargeRatio != null
                        ? `${data.hydrology.dischargeRatio}×`
                        : '--'}
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-xs font-medium text-sky-600 dark:text-sky-400">
                  {data.hydrology.dischargeStatus}
                </div>
              </div>

              {data.hydrology.dailyTrend.length > 0 && (
                <div className="pt-2 border-t border-border/60">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2.5">
                    7-Day Discharge Projection (m³/s)
                  </div>
                  <div className="grid grid-cols-7 gap-2 items-end h-24">
                    {data.hydrology.dailyTrend.map((day, idx) => {
                      const heightPct = Math.max(
                        8,
                        Math.round((day.dischargeM3s / maxTrendValue) * 100)
                      );
                      return (
                        <div
                          key={day.date}
                          className="flex flex-col items-center justify-end h-full gap-1"
                          title={`${day.date}: ${day.dischargeM3s} m³/s (max ${day.maxM3s} m³/s)`}
                        >
                          <span className="text-[9px] font-mono tabular-nums text-muted-foreground">
                            {day.dischargeM3s >= 10
                              ? Math.round(day.dischargeM3s)
                              : day.dischargeM3s.toFixed(1)}
                          </span>
                          <div className="w-full max-w-[26px] flex-1 flex items-end">
                            <div
                              className={`w-full rounded-t-md transition-all ${
                                idx === 0
                                  ? 'bg-sky-500'
                                  : 'bg-sky-500/45 hover:bg-sky-500/75'
                              }`}
                              style={{ height: `${heightPct}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {idx === 0 ? 'Today' : formatShortDate(day.date)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            {/* Soil Runoff Saturation & Atmospheric Wet Deposition */}
            <section className="rounded-[18px] border border-[var(--liquid-glass-border)] bg-[var(--liquid-glass-bg)] p-5 backdrop-blur-md flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="eyebrow">Watershed Runoff & Rain Acidity</div>
                    <h3 className="text-base font-semibold text-foreground mt-0.5">
                      Soil Saturation & Atmospheric Deposition
                    </h3>
                  </div>
                  <Droplets size={18} className="text-emerald-500 shrink-0" />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-border/60">
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      Topsoil Moisture
                    </div>
                    <div className="text-lg font-semibold font-mono tabular-nums text-foreground mt-0.5">
                      {data.watershed.soilMoistureTopPct != null
                        ? `${data.watershed.soilMoistureTopPct}%`
                        : '--'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      Subsoil (1–3 cm)
                    </div>
                    <div className="text-lg font-semibold font-mono tabular-nums text-foreground mt-0.5">
                      {data.watershed.soilMoistureRootPct != null
                        ? `${data.watershed.soilMoistureRootPct}%`
                        : '--'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      Active Rain
                    </div>
                    <div className="text-lg font-semibold font-mono tabular-nums text-foreground mt-0.5">
                      {data.watershed.recentRainMm != null
                        ? `${data.watershed.recentRainMm} mm`
                        : '--'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      Evapotranspiration
                    </div>
                    <div className="text-lg font-semibold font-mono tabular-nums text-foreground mt-0.5">
                      {data.watershed.evapotranspirationMm != null
                        ? `${data.watershed.evapotranspirationMm} mm`
                        : '--'}
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-xs font-medium text-foreground">
                  Runoff state: <span className="text-sky-600 dark:text-sky-400">{data.watershed.runoffRiskLabel}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-border/60 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-mono uppercase tracking-wider text-[10px]">
                    Rainwater Acid-Deposition Precursors
                  </span>
                  <span
                    className={`font-mono font-semibold ${
                      data.watershed.acidDepositionRisk === 'Elevated'
                        ? 'text-red-500'
                        : data.watershed.acidDepositionRisk === 'Moderate'
                        ? 'text-amber-500'
                        : 'text-emerald-500'
                    }`}
                  >
                    {data.watershed.acidDepositionRisk} Risk
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs font-mono tabular-nums">
                  <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2">
                    <div className="text-[10px] text-muted-foreground">SO₂</div>
                    <div className="text-sm font-semibold text-foreground mt-0.5">
                      {data.watershed.so2UgM3 != null ? `${data.watershed.so2UgM3} µg/m³` : '--'}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2">
                    <div className="text-[10px] text-muted-foreground">NO₂</div>
                    <div className="text-sm font-semibold text-foreground mt-0.5">
                      {data.watershed.no2UgM3 != null ? `${data.watershed.no2UgM3} µg/m³` : '--'}
                    </div>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2">
                    <div className="text-[10px] text-muted-foreground">PM2.5 Fallout</div>
                    <div className="text-sm font-semibold text-foreground mt-0.5">
                      {data.watershed.pm25UgM3 != null ? `${data.watershed.pm25UgM3} µg/m³` : '--'}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Coastal / Marine Telemetry (only when area is near ocean/coast) */}
          {data.marine.isCoastal && (
            <section
              className="rounded-[18px] border border-[var(--liquid-glass-border)] bg-[var(--liquid-glass-bg)] p-5 backdrop-blur-md"
              data-testid="section-water-marine"
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <div className="eyebrow">Coastal & Marine Water Column</div>
                  <h3 className="text-base font-semibold text-foreground mt-0.5">
                    Nearshore Sea Conditions
                  </h3>
                </div>
                <Thermometer size={17} className="text-cyan-500 shrink-0" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-border/60">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Sea Surface Temp
                  </div>
                  <div className="text-xl font-semibold font-mono tabular-nums text-foreground mt-0.5">
                    {data.marine.seaSurfaceTempC != null
                      ? formatWaterTemp(data.marine.seaSurfaceTempC, tempUnit)
                      : '--'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Significant Wave Height
                  </div>
                  <div className="text-xl font-semibold font-mono tabular-nums text-foreground mt-0.5">
                    {data.marine.waveHeightM != null ? `${data.marine.waveHeightM} m` : '--'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                    Ocean Current Velocity
                  </div>
                  <div className="text-xl font-semibold font-mono tabular-nums text-foreground mt-0.5">
                    {data.marine.currentSpeedKmh != null
                      ? formatWindOrCurrentSpeed(data.marine.currentSpeedKmh, windUnit)
                      : '--'}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Nearest Mapped Water Bodies (Lakes, Rivers, Reservoirs, Canals) */}
          {data.nearbyWaterBodies.length > 0 && (
            <section
              className="rounded-[18px] border border-[var(--liquid-glass-border)] bg-[var(--liquid-glass-bg)] p-5 backdrop-blur-md space-y-3"
              data-testid="section-water-bodies"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="eyebrow">OpenStreetMap Hydrography (12 km radius)</div>
                  <h3 className="text-base font-semibold text-foreground mt-0.5">
                    Nearest Lakes, Rivers & Reservoirs
                  </h3>
                </div>
                <Compass size={17} className="text-sky-500 shrink-0" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                {data.nearbyWaterBodies.map((body) => (
                  <div
                    key={`${body.name}-${body.latitude}`}
                    className="rounded-xl border border-border/60 bg-muted/25 px-3.5 py-2.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {body.name}
                      </div>
                      <div className="text-[11px] font-mono text-muted-foreground">
                        {getWaterBodyLabel(body.type)}
                      </div>
                    </div>
                    <span className="text-xs font-mono tabular-nums text-foreground shrink-0">
                      {body.distanceKm} km
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Regional Water Report (Google Search Grounding) */}
          {data.regionalReport && (
            <section
              className="rounded-[18px] border border-[var(--liquid-glass-border)] bg-[var(--liquid-glass-bg)] p-5 backdrop-blur-md space-y-3"
              data-testid="section-water-regional-report"
            >
              <div>
                <div className="eyebrow">Verified Public Water Reports</div>
                <h3 className="text-base font-semibold text-foreground mt-0.5">
                  Regional Surface & Municipal Water Findings for {displayAreaName}
                </h3>
              </div>
              <p className="text-sm text-foreground/90 leading-relaxed">
                {data.regionalReport.summary}
              </p>
              {data.regionalReport.citations.length > 0 && (
                <div className="pt-2 border-t border-border/60 flex flex-wrap gap-x-4 gap-y-2">
                  {data.regionalReport.citations.map((cite) => (
                    <a
                      key={cite.url}
                      href={cite.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-sky-600 dark:text-sky-400 hover:underline"
                    >
                      <span className="truncate max-w-[240px]">{cite.title}</span>
                      <ExternalLink size={11} className="shrink-0" />
                    </a>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
