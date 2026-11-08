import React, { useState } from 'react';
import { ShieldCheck, SunMedium, AlertTriangle } from 'lucide-react';

interface UvIndexMiniChartProps {
  hourlyTimes: string[];
  hourlyUv?: number[];
  startIndex: number;
  timezone: string;
  timeFormat: '12h' | '24h';
}

function formatHour(isoString: string, timezone: string, timeFormat: '12h' | '24h'): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: undefined,
      hour12: timeFormat === '12h',
      timeZone: timezone,
    });
  } catch {
    const hour = parseInt(isoString.slice(11, 13), 10);
    if (timeFormat === '24h') return `${hour}:00`;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${h12} ${ampm}`;
  }
}

function getUvColor(val: number): string {
  if (val < 3) return '#10b981'; // Green / Low
  if (val < 6) return '#f59e0b'; // Amber / Moderate
  if (val < 8) return '#f97316'; // Orange / High
  if (val < 11) return '#ef4444'; // Red / Very High
  return '#a855f7'; // Purple / Extreme
}

function getUvSafetyTag(peakVal: number, peakTime: string): { text: string; icon: 'check' | 'sun' | 'alert' } {
  if (peakVal < 3) {
    return { text: 'Low UV · No protection needed', icon: 'check' };
  }
  if (peakVal < 6) {
    return { text: `Peak ${peakVal.toFixed(1)} @ ${peakTime} · Sunscreen advised`, icon: 'sun' };
  }
  if (peakVal < 8) {
    return { text: `Peak ${peakVal.toFixed(1)} @ ${peakTime} · Seek shade midday`, icon: 'alert' };
  }
  return { text: `Peak ${peakVal.toFixed(1)} @ ${peakTime} · Protection essential`, icon: 'alert' };
}

export function UvIndexMiniChart({
  hourlyTimes,
  hourlyUv = [],
  startIndex,
  timezone,
  timeFormat,
}: UvIndexMiniChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!hourlyTimes || hourlyTimes.length === 0 || hourlyUv.length === 0) {
    return null;
  }

  // Determine hours for remainder of today
  const currentIso = hourlyTimes[startIndex] || hourlyTimes[0];
  const todayPrefix = currentIso.slice(0, 10);

  const indices: number[] = [];
  for (let i = startIndex; i < hourlyTimes.length; i++) {
    if (hourlyTimes[i].startsWith(todayPrefix)) {
      indices.push(i);
    } else {
      break;
    }
  }

  // If late at night, include next 8-12 hours so the curve is informative
  const activeIndices = indices.length >= 4
    ? indices
    : Array.from(
        { length: Math.min(12, hourlyTimes.length - startIndex) },
        (_, k) => startIndex + k
      );

  if (activeIndices.length < 2) return null;

  const points = activeIndices.map((idx) => {
    const rawVal = hourlyUv[idx] ?? 0;
    const uv = Math.max(0, Math.round(rawVal * 10) / 10);
    const label = formatHour(hourlyTimes[idx], timezone, timeFormat);
    return { idx, uv, label, time: hourlyTimes[idx] };
  });

  const peakPoint = points.reduce((max, pt) => (pt.uv > max.uv ? pt : max), points[0]);
  const maxDomain = Math.max(peakPoint.uv, 4);

  // SVG dimensions
  const svgWidth = 190;
  const svgHeight = 42;
  const padX = 6;
  const padTop = 6;
  const padBottom = 6;
  const plotWidth = svgWidth - padX * 2;
  const plotHeight = svgHeight - padTop - padBottom;

  const coords = points.map((pt, i) => {
    const x = padX + (i / (points.length - 1)) * plotWidth;
    const y = padTop + (1 - pt.uv / maxDomain) * plotHeight;
    return { ...pt, x, y };
  });

  // Generate smooth SVG curve path using cubic bezier
  let pathD = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i === 0 ? 0 : i - 1];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[i + 2] || p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    pathD += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }

  // Area under curve
  const firstPt = coords[0];
  const lastPt = coords[coords.length - 1];
  const baselineY = svgHeight - padBottom;
  const areaD = `${pathD} L ${lastPt.x.toFixed(1)} ${baselineY} L ${firstPt.x.toFixed(1)} ${baselineY} Z`;

  const themeColor = getUvColor(peakPoint.uv);
  const safety = getUvSafetyTag(peakPoint.uv, peakPoint.label);

  const hoveredPoint = hoveredIdx != null ? coords[hoveredIdx] : null;

  return (
    <div
      className="uv-mini-chart-wrap"
      style={{
        marginTop: '10px',
        paddingTop: '8px',
        borderTop: '1px solid hsl(var(--border) / 0.55)',
        width: '100%',
        minWidth: 0,
        maxWidth: '100%',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Header with safety pill */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '9.5px',
          fontFamily: 'var(--app-font-mono)',
          color: 'hsl(var(--muted-foreground))',
          marginBottom: '4px',
          width: '100%',
          minWidth: 0,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Rest of day</span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            color: themeColor,
            fontWeight: 600,
            flexShrink: 0,
            marginLeft: '4px',
          }}
          title={safety.text}
        >
          {safety.icon === 'check' ? (
            <ShieldCheck size={11} />
          ) : safety.icon === 'sun' ? (
            <SunMedium size={11} />
          ) : (
            <AlertTriangle size={11} />
          )}
          <span>{peakPoint.uv > 0 ? `Peak ${peakPoint.uv} @ ${peakPoint.label}` : 'Zero UV'}</span>
        </span>
      </div>

      {/* SVG Line Chart */}
      <div style={{ position: 'relative', width: '100%', height: '42px' }}>
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          preserveAspectRatio="none"
          style={{
            width: '100%',
            height: '100%',
            overflow: 'visible',
            display: 'block',
          }}
        >
          <defs>
            <linearGradient id="uvChartAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={themeColor} stopOpacity="0.3" />
              <stop offset="100%" stopColor={themeColor} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Dotted baseline */}
          <line
            x1={padX}
            y1={baselineY}
            x2={svgWidth - padX}
            y2={baselineY}
            stroke="hsl(var(--border))"
            strokeDasharray="2 3"
            strokeOpacity="0.5"
            strokeWidth="1"
          />

          {/* Gradient area */}
          <path d={areaD} fill="url(#uvChartAreaGrad)" />

          {/* Curve stroke */}
          <path
            d={pathD}
            fill="none"
            stroke={themeColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Current point (first point) */}
          <circle
            cx={firstPt.x}
            cy={firstPt.y}
            r="3.2"
            fill={themeColor}
            stroke="hsl(var(--card))"
            strokeWidth="1.5"
          />

          {/* Peak point marker if > 0 and distinct from first */}
          {peakPoint.uv > 0 && peakPoint.idx !== firstPt.idx && (
            <g>
              <circle
                cx={coords.find((c) => c.idx === peakPoint.idx)?.x ?? 0}
                cy={coords.find((c) => c.idx === peakPoint.idx)?.y ?? 0}
                r="3"
                fill="#f59e0b"
                stroke="hsl(var(--card))"
                strokeWidth="1.5"
              />
            </g>
          )}

          {/* Interactive hover points */}
          {coords.map((pt, i) => (
            <circle
              key={pt.idx}
              cx={pt.x}
              cy={pt.y}
              r="7"
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          ))}

          {/* Active hover dot indicator */}
          {hoveredPoint && (
            <g style={{ pointerEvents: 'none' }}>
              <circle
                cx={hoveredPoint.x}
                cy={hoveredPoint.y}
                r="5"
                fill={themeColor}
                stroke="#ffffff"
                strokeWidth="1.8"
              />
            </g>
          )}
        </svg>

        {/* Hover Tooltip Float */}
        {hoveredPoint && (
          <div
            style={{
              position: 'absolute',
              left: `${(hoveredPoint.x / svgWidth) * 100}%`,
              top: '-18px',
              transform: 'translateX(-50%)',
              background: 'hsl(var(--sidebar))',
              color: 'hsl(var(--sidebar-foreground))',
              border: '1px solid hsl(var(--sidebar-border))',
              borderRadius: '4px',
              padding: '1px 5px',
              fontSize: '8.5px',
              fontFamily: 'var(--app-font-mono)',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              zIndex: 10,
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
            }}
          >
            {hoveredPoint.label}: UV {hoveredPoint.uv}
          </div>
        )}
      </div>

      {/* Time Range Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '8.5px',
          fontFamily: 'var(--app-font-mono)',
          color: 'hsl(var(--muted-foreground))',
          marginTop: '2px',
          opacity: 0.8,
        }}
      >
        <span>{coords[0].label}</span>
        <span style={{ fontSize: '8px' }}>
          {peakPoint.uv >= 3 ? 'Protection window' : 'Safe UV index'}
        </span>
        <span>{coords[coords.length - 1].label}</span>
      </div>
    </div>
  );
}

export default UvIndexMiniChart;
