import React, { useMemo, useState } from 'react';
import * as d3 from 'd3';
import { Compass, Wind, Zap } from 'lucide-react';

export interface WindRoseVisualizationProps {
  /** Current wind direction in degrees (0 - 360, where 0 is North) */
  direction: number;
  /** Current wind speed in km/h */
  speed: number;
  /** Unit for display ('km/h' | 'mph' | 'm/s' | 'kn') */
  unit: 'km/h' | 'mph' | 'm/s' | 'kn';
  /** Optional peak gust in km/h */
  gusts?: number;
  /** Hourly wind directions for today (optional) */
  hourlyDirections?: number[];
  /** Hourly wind speeds for today in km/h (optional) */
  hourlySpeeds?: number[];
  /** Current hour index */
  startIndex?: number;
}

interface SectorInfo {
  index: number;
  code: string;
  name: string;
  deg: number;
  startDeg: number;
  endDeg: number;
  count: number;
  avgSpeed: number;
  pathD: string;
  isActive: boolean;
  color: string;
}

const SECTOR_DEFS = [
  { code: 'N', name: 'North', deg: 0 },
  { code: 'NNE', name: 'North-Northeast', deg: 22.5 },
  { code: 'NE', name: 'Northeast', deg: 45 },
  { code: 'ENE', name: 'East-Northeast', deg: 67.5 },
  { code: 'E', name: 'East', deg: 90 },
  { code: 'ESE', name: 'East-Southeast', deg: 112.5 },
  { code: 'SE', name: 'Southeast', deg: 135 },
  { code: 'SSE', name: 'South-Southeast', deg: 157.5 },
  { code: 'S', name: 'South', deg: 180 },
  { code: 'SSW', name: 'South-Southwest', deg: 202.5 },
  { code: 'SW', name: 'Southwest', deg: 225 },
  { code: 'WSW', name: 'West-Southwest', deg: 247.5 },
  { code: 'W', name: 'West', deg: 270 },
  { code: 'WNW', name: 'West-Northwest', deg: 292.5 },
  { code: 'NW', name: 'Northwest', deg: 315 },
  { code: 'NNW', name: 'North-Northwest', deg: 337.5 },
];

function getBeaufort(kmh: number): { scale: number; label: string; desc: string } {
  if (kmh < 1) return { scale: 0, label: 'Calm', desc: 'Smoke rises vertically' };
  if (kmh <= 5) return { scale: 1, label: 'Light air', desc: 'Smoke drift indicates direction' };
  if (kmh <= 11) return { scale: 2, label: 'Light breeze', desc: 'Leaves rustle, wind felt on face' };
  if (kmh <= 19) return { scale: 3, label: 'Gentle breeze', desc: 'Leaves and small twigs in motion' };
  if (kmh <= 28) return { scale: 4, label: 'Moderate breeze', desc: 'Small branches moved, dust raised' };
  if (kmh <= 38) return { scale: 5, label: 'Fresh breeze', desc: 'Small trees in leaf begin to sway' };
  if (kmh <= 49) return { scale: 6, label: 'Strong breeze', desc: 'Large branches in continuous motion' };
  if (kmh <= 61) return { scale: 7, label: 'Near gale', desc: 'Whole trees in motion, effort to walk' };
  if (kmh <= 74) return { scale: 8, label: 'Gale', desc: 'Twigs broken off trees, progress impeded' };
  if (kmh <= 88) return { scale: 9, label: 'Strong gale', desc: 'Slight structural damage occurs' };
  if (kmh <= 102) return { scale: 10, label: 'Storm', desc: 'Trees uprooted, considerable damage' };
  if (kmh <= 117) return { scale: 11, label: 'Violent storm', desc: 'Widespread damage' };
  return { scale: 12, label: 'Hurricane', desc: 'Devastation occurs' };
}

function formatWindSpeed(kmh: number, unit: 'km/h' | 'mph' | 'm/s' | 'kn'): string {
  switch (unit) {
    case 'mph':
      return `${Math.round(kmh * 0.621371)} mph`;
    case 'm/s':
      return `${(kmh / 3.6).toFixed(1)} m/s`;
    case 'kn':
      return `${Math.round(kmh * 0.539957)} kn`;
    case 'km/h':
    default:
      return `${Math.round(kmh)} km/h`;
  }
}

export function WindRoseVisualization({
  direction,
  speed,
  unit,
  gusts,
  hourlyDirections = [],
  hourlySpeeds = [],
  startIndex = 0,
}: WindRoseVisualizationProps) {
  const [hoveredSector, setHoveredSector] = useState<SectorInfo | null>(null);

  // Normalize current direction [0, 360)
  const normDeg = ((direction % 360) + 360) % 360;
  const activeSectorIndex = Math.round(normDeg / 22.5) % 16;
  const activeSectorDef = SECTOR_DEFS[activeSectorIndex];
  const beaufort = getBeaufort(speed);

  // Layout parameters for SVG
  const width = 84;
  const height = 84;
  const cx = width / 2;
  const cy = height / 2;
  const hubRadius = 7.5;
  const maxPetalRadius = 31;
  const labelRadius = 37.5;

  // D3 Scales & Radial Arc Generator
  const { sectors, speedScale } = useMemo(() => {
    // Collect 24h sector counts & speeds
    const counts = new Array(16).fill(0);
    const speedSums = new Array(16).fill(0);

    const availableHours = Math.min(24, Math.max(0, hourlyDirections.length - startIndex));
    for (let i = 0; i < availableHours; i++) {
      const idx = startIndex + i;
      const d = hourlyDirections[idx];
      const s = hourlySpeeds[idx] ?? speed;
      if (typeof d === 'number') {
        const sIndex = Math.round((((d % 360) + 360) % 360) / 22.5) % 16;
        counts[sIndex]++;
        speedSums[sIndex] += s;
      }
    }

    const maxCount = Math.max(1, ...counts);
    const maxSpeedObserved = Math.max(speed, ...hourlySpeeds.slice(startIndex, startIndex + 24), 25);

    // D3 linear scale mapping wind speed/frequency to petal radius
    const scale = d3
      .scaleLinear()
      .domain([0, maxSpeedObserved])
      .range([hubRadius + 3, maxPetalRadius])
      .clamp(true);

    // D3 Arc generator configured for polar coordinates
    const arcGenerator = d3
      .arc<{ innerRadius: number; outerRadius: number; startAngle: number; endAngle: number }>()
      .innerRadius((d) => d.innerRadius)
      .outerRadius((d) => d.outerRadius)
      .startAngle((d) => d.startAngle)
      .endAngle((d) => d.endAngle)
      .cornerRadius(1.5);

    const sectorList: SectorInfo[] = SECTOR_DEFS.map((def, i) => {
      const isActive = i === activeSectorIndex;
      const cnt = counts[i];
      const avgS = cnt > 0 ? speedSums[i] / cnt : 0;

      // Calculate radius using D3 scale:
      // Active sector always extends dynamically with current speed
      let r: number;
      if (isActive) {
        r = scale(Math.max(speed, 6));
      } else if (cnt > 0) {
        // Hourly occurrences scale between hubRadius + 2.5 and maxPetalRadius * 0.82
        const freqRatio = cnt / maxCount;
        r = hubRadius + 2.5 + freqRatio * (maxPetalRadius * 0.72 - hubRadius);
      } else {
        r = hubRadius + 2;
      }

      // Convert angles from degrees to radians (0 is North at 12 o'clock, clockwise)
      const startDeg = def.deg - 10.5;
      const endDeg = def.deg + 10.5;
      const startAngle = (startDeg * Math.PI) / 180;
      const endAngle = (endDeg * Math.PI) / 180;

      const pathD =
        arcGenerator({
          innerRadius: hubRadius,
          outerRadius: r,
          startAngle,
          endAngle,
        }) || '';

      // Color based on speed and active state
      let color = 'hsl(var(--muted-foreground) / 0.18)';
      if (isActive) {
        color = speed > 40 ? '#ec4899' : speed > 25 ? '#3b82f6' : '#0ea5e9';
      } else if (cnt > 0) {
        color = 'hsl(var(--primary) / 0.32)';
      }

      return {
        index: i,
        code: def.code,
        name: def.name,
        deg: def.deg,
        startDeg,
        endDeg,
        count: cnt,
        avgSpeed: avgS,
        pathD,
        isActive,
        color,
      };
    });

    return { sectors: sectorList, speedScale: scale };
  }, [direction, speed, hourlyDirections, hourlySpeeds, startIndex, activeSectorIndex]);

  // Concentric speed guide circles via D3 range
  const ringRadii = useMemo(() => {
    return [hubRadius + 6, hubRadius + 14, maxPetalRadius];
  }, [hubRadius, maxPetalRadius]);

  // Dynamic needle vector for current wind direction
  // Wind blows towards (normDeg + 180) or originates from normDeg.
  // In meteorological convention, compass points in direction the wind is blowing towards,
  // or arrow points into the center. We render a precision needle oriented along normDeg.
  const needleRad = (normDeg * Math.PI) / 180;
  const needleLen = maxPetalRadius + 3;
  const needleTipX = cx + Math.sin(needleRad) * needleLen;
  const needleTipY = cy - Math.cos(needleRad) * needleLen;
  const needleTailX = cx - Math.sin(needleRad) * 4.5;
  const needleTailY = cy + Math.cos(needleRad) * 4.5;

  return (
    <div
      className="wind-rose-container"
      style={{
        marginTop: '10px',
        paddingTop: '8px',
        borderTop: '1px solid hsl(var(--border) / 0.55)',
        width: '100%',
        userSelect: 'none',
      }}
      role="region"
      aria-label={`Wind rose visualization: wind from ${activeSectorDef.code} at ${formatWindSpeed(speed, unit)}`}
    >
      {/* Top Header / Kicker */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '9.5px',
          fontFamily: 'var(--app-font-mono)',
          color: 'hsl(var(--muted-foreground))',
          marginBottom: '6px',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <Compass size={11} className="text-primary/70" />
          <span>Wind rose</span>
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            color: 'hsl(var(--primary))',
            fontWeight: 600,
          }}
        >
          <span>From {activeSectorDef.code} · {Math.round(normDeg)}°</span>
        </span>
      </div>

      {/* Main Rose & Telemetry Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
        }}
      >
        {/* D3 Polar Wind Rose SVG */}
        <div style={{ position: 'relative', width: `${width}px`, height: `${height}px`, flexShrink: 0 }}>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            width={width}
            height={height}
            style={{ overflow: 'visible', display: 'block' }}
          >
            <defs>
              {/* Radial glow for active wind vector */}
              <radialGradient id="activePetalGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.1" />
              </radialGradient>
              <filter id="windDropGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="1.5" floodColor="#0ea5e9" floodOpacity="0.6" />
              </filter>
            </defs>

            {/* Concentric speed reference rings (D3 generated) */}
            {ringRadii.map((r, i) => (
              <circle
                key={`ring-${i}`}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke="hsl(var(--border))"
                strokeWidth="0.8"
                strokeDasharray={i < 2 ? '2 2' : 'none'}
                strokeOpacity={i === 2 ? 0.6 : 0.35}
              />
            ))}

            {/* Crosshair cardinal axis lines */}
            <line
              x1={cx}
              y1={cy - maxPetalRadius}
              x2={cx}
              y2={cy + maxPetalRadius}
              stroke="hsl(var(--border))"
              strokeWidth="0.7"
              strokeOpacity="0.3"
            />
            <line
              x1={cx - maxPetalRadius}
              y1={cy}
              x2={cx + maxPetalRadius}
              y2={cy}
              stroke="hsl(var(--border))"
              strokeWidth="0.7"
              strokeOpacity="0.3"
            />

            {/* 16 D3 Polar Arc Sectors */}
            <g transform={`translate(${cx}, ${cy})`}>
              {sectors.map((sec) => (
                <path
                  key={`sec-${sec.code}`}
                  d={sec.pathD}
                  fill={sec.color}
                  stroke={sec.isActive ? '#38bdf8' : 'hsl(var(--card-border))'}
                  strokeWidth={sec.isActive ? 1.2 : 0.5}
                  strokeOpacity={sec.isActive ? 0.9 : 0.4}
                  style={{
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    filter: sec.isActive ? 'url(#windDropGlow)' : undefined,
                  }}
                  onMouseEnter={() => setHoveredSector(sec)}
                  onMouseLeave={() => setHoveredSector(null)}
                />
              ))}
            </g>

            {/* Dynamic Meteorological Direction Needle */}
            <g style={{ pointerEvents: 'none' }}>
              {/* Needle stem */}
              <line
                x1={needleTailX}
                y1={needleTailY}
                x2={needleTipX}
                y2={needleTipY}
                stroke="#0ea5e9"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              {/* Dynamic arrowhead pointing along the current wind direction */}
              <circle
                cx={needleTipX}
                cy={needleTipY}
                r="2.8"
                fill="#38bdf8"
                stroke="#ffffff"
                strokeWidth="1.2"
              />
            </g>

            {/* Center Hub */}
            <circle
              cx={cx}
              cy={cy}
              r={hubRadius}
              fill="hsl(var(--card))"
              stroke="hsl(var(--border))"
              strokeWidth="1.2"
            />
            <circle
              cx={cx}
              cy={cy}
              r={2.6}
              fill="#0ea5e9"
            />

            {/* Cardinal Labels: N, E, S, W */}
            <text
              x={cx}
              y={cy - labelRadius + 3}
              textAnchor="middle"
              fill={activeSectorIndex === 0 ? '#0ea5e9' : 'hsl(var(--muted-foreground))'}
              fontSize="8"
              fontWeight={activeSectorIndex === 0 ? '700' : '600'}
              fontFamily="var(--app-font-mono)"
            >
              N
            </text>
            <text
              x={cx + labelRadius - 2}
              y={cy + 2.5}
              textAnchor="middle"
              fill={activeSectorIndex === 4 ? '#0ea5e9' : 'hsl(var(--muted-foreground))'}
              fontSize="8"
              fontWeight={activeSectorIndex === 4 ? '700' : '600'}
              fontFamily="var(--app-font-mono)"
            >
              E
            </text>
            <text
              x={cx}
              y={cy + labelRadius + 3}
              textAnchor="middle"
              fill={activeSectorIndex === 8 ? '#0ea5e9' : 'hsl(var(--muted-foreground))'}
              fontSize="8"
              fontWeight={activeSectorIndex === 8 ? '700' : '600'}
              fontFamily="var(--app-font-mono)"
            >
              S
            </text>
            <text
              x={cx - labelRadius + 2}
              y={cy + 2.5}
              textAnchor="middle"
              fill={activeSectorIndex === 12 ? '#0ea5e9' : 'hsl(var(--muted-foreground))'}
              fontSize="8"
              fontWeight={activeSectorIndex === 12 ? '700' : '600'}
              fontFamily="var(--app-font-mono)"
            >
              W
            </text>
          </svg>

          {/* Hover Tooltip Popup */}
          {hoveredSector && (
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '-24px',
                transform: 'translateX(-50%)',
                background: 'hsl(var(--sidebar))',
                color: 'hsl(var(--sidebar-foreground))',
                border: '1px solid hsl(var(--sidebar-border))',
                borderRadius: '4px',
                padding: '2px 6px',
                fontSize: '8.5px',
                fontFamily: 'var(--app-font-mono)',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                zIndex: 20,
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
              }}
            >
              {hoveredSector.code} ({hoveredSector.deg}°):{' '}
              {hoveredSector.isActive
                ? `Active ${formatWindSpeed(speed, unit)}`
                : hoveredSector.count > 0
                ? `${hoveredSector.count}h · avg ${formatWindSpeed(hoveredSector.avgSpeed, unit)}`
                : 'Calm'}
            </div>
          )}
        </div>

        {/* Telemetry Summary Panel */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            minWidth: 0,
            gap: '3px',
          }}
        >
          {/* Beaufort Tier */}
          <div
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'hsl(var(--foreground))',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {beaufort.label}
          </div>

          {/* Beaufort description */}
          <div
            style={{
              fontSize: '8.5px',
              color: 'hsl(var(--muted-foreground))',
              lineHeight: 1.25,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={beaufort.desc}
          >
            Force {beaufort.scale} · {beaufort.desc}
          </div>

          {/* Gust or Bearing status */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              marginTop: '2px',
              fontSize: '8.5px',
              fontFamily: 'var(--app-font-mono)',
              color: 'hsl(var(--muted-foreground))',
            }}
          >
            {typeof gusts === 'number' && gusts > speed ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  color: '#f59e0b',
                }}
              >
                <Zap size={9} />
                <span>Gusts {formatWindSpeed(gusts, unit)}</span>
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                <Wind size={9} />
                <span>Steady airflow</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default WindRoseVisualization;
