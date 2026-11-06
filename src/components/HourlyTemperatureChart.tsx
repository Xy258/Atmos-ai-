import React, { useMemo, useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  type TooltipProps,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Droplets,
  CloudSun,
  Sparkles,
} from 'lucide-react';
import {
  buildHourlyChartData,
  calculateTemperatureStats,
  type HourlyChartPoint,
} from '../lib/weather-chart-utils';

interface HourlyTemperatureChartProps {
  times: string[];
  temperatures: number[];
  apparentTemps?: number[];
  precipProbabilities?: number[];
  weatherCodes?: number[];
  hourlyStart: number;
  sunrise?: string;
  sunset?: string;
  timezone?: string;
  tempUnit: 'C' | 'F';
  timeFormat: '12h' | '24h';
  selectedHour: number;
  onSelectHour: (hourIndex: number) => void;
  className?: string;
}

// Weather descriptions mapped from WMO codes
const WEATHER_NAMES: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  80: 'Rain showers',
  81: 'Showers',
  82: 'Heavy showers',
  95: 'Thunderstorm',
  96: 'Storm with hail',
  99: 'Heavy thunderstorm',
};

// Custom interactive Dot for the Line chart
interface DotProps {
  cx?: number;
  cy?: number;
  payload?: HourlyChartPoint;
  selectedIndex?: number;
  minTemp?: number;
  maxTemp?: number;
  onCoord?: (index: number, x: number, y: number) => void;
}

function CustomLineDot(props: DotProps) {
  const { cx, cy, payload, minTemp, maxTemp, onCoord } = props;

  useEffect(() => {
    if (cx != null && cy != null && payload && onCoord) {
      onCoord(payload.index, cx, cy);
    }
  }, [cx, cy, payload?.index, onCoord]);

  if (cx == null || cy == null || !payload) return null;

  const isExtreme = payload.temperature === maxTemp || payload.temperature === minTemp;

  return (
    <g>
      {/* Base baseline point dot */}
      <circle
        cx={cx}
        cy={cy}
        r={isExtreme ? 3.5 : 2.5}
        fill={isExtreme ? (payload.temperature === maxTemp ? '#f59e0b' : '#38bdf8') : 'hsl(var(--muted-foreground))'}
        opacity={isExtreme ? 0.95 : 0.65}
        stroke="hsl(var(--card))"
        strokeWidth={isExtreme ? 1.5 : 1}
      />
    </g>
  );
}

// Custom Glassmorphic Tooltip
interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  tempUnit: 'C' | 'F';
}

function CustomChartTooltip({ active, payload, tempUnit }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const point = payload[0].payload as HourlyChartPoint;
  const condition = WEATHER_NAMES[point.weatherCode] ?? 'Changing skies';

  return (
    <div
      className="chart-custom-tooltip"
      style={{
        background: 'hsl(var(--card) / 0.94)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid hsl(var(--border))',
        borderRadius: '12px',
        padding: '10px 14px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.2)',
        minWidth: '150px',
        pointerEvents: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
        <span style={{ fontFamily: 'var(--app-font-mono)', fontSize: '11px', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
          {point.timeLabel}
        </span>
        <span style={{ fontSize: '10px', color: 'hsl(var(--muted-foreground))' }}>
          {point.isDay ? 'Day' : 'Night'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '4px 0' }}>
        <span style={{ fontFamily: 'var(--app-font-serif)', fontSize: '24px', fontWeight: 700, color: 'hsl(var(--foreground))', letterSpacing: '-0.03em', lineHeight: 1 }}>
          {point.temperature}°
        </span>
        <span style={{ fontFamily: 'var(--app-font-mono)', fontSize: '11px', color: 'hsl(var(--muted-foreground))' }}>
          {tempUnit}
        </span>
        {point.apparentTemp != null && (
          <span style={{ fontSize: '10.5px', color: 'hsl(var(--muted-foreground))', marginLeft: 'auto' }}>
            Feels {point.apparentTemp}°
          </span>
        )}
      </div>

      <div style={{ fontSize: '11px', color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }}>
        {condition}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10.5px', color: '#38bdf8', paddingTop: '4px', borderTop: '1px solid hsl(var(--border) / 0.6)' }}>
        <Droplets size={11} />
        <span>{point.pop}% rain chance</span>
      </div>
    </div>
  );
}

export function HourlyTemperatureChart({
  times,
  temperatures,
  apparentTemps,
  precipProbabilities,
  weatherCodes,
  hourlyStart,
  tempUnit,
  timeFormat,
  selectedHour,
  onSelectHour,
  className = '',
}: HourlyTemperatureChartProps) {
  // Build the 12-hour data points
  const chartData = useMemo(() => {
    return buildHourlyChartData({
      times,
      temperatures,
      apparentTemps,
      precipProbabilities,
      weatherCodes,
      hourlyStart,
      count: 12,
      tempUnit,
      timeFormat,
      selectedHour,
    });
  }, [
    times,
    temperatures,
    apparentTemps,
    precipProbabilities,
    weatherCodes,
    hourlyStart,
    tempUnit,
    timeFormat,
    selectedHour,
  ]);

  // Compute stats across the 12 hours
  const stats = useMemo(() => calculateTemperatureStats(chartData), [chartData]);

  // Persistent coordinate tracking so indicator dot slides smoothly on selection changes
  const coordsMapRef = useRef<Record<number, { x: number; y: number }>>({});
  const [activePoint, setActivePoint] = useState<{ x: number; y: number } | null>(null);

  const handleCoord = (index: number, x: number, y: number) => {
    coordsMapRef.current[index] = { x, y };
    if (index === selectedHour) {
      setActivePoint((prev) => {
        if (!prev || Math.abs(prev.x - x) > 0.5 || Math.abs(prev.y - y) > 0.5) {
          return { x, y };
        }
        return prev;
      });
    }
  };

  useEffect(() => {
    const coord = coordsMapRef.current[selectedHour];
    if (coord) {
      setActivePoint(coord);
    }
  }, [selectedHour]);

  if (chartData.length === 0) return null;

  return (
    <div
      className={`hourly-trend-card ${className}`}
      data-testid="card-hourly-temperature-trend"
      style={{
        border: '1px solid hsl(var(--card-border))',
        background: 'hsl(var(--card) / 0.76)',
        borderRadius: '17px',
        padding: '16px 18px 12px',
        boxShadow: 'var(--shadow-sm)',
        marginTop: '12px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top Header Row with Title and Stats Pills */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          marginBottom: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '7px',
              background: 'rgba(245, 158, 11, 0.14)',
              color: '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {stats.trend === 'warming' ? (
              <TrendingUp size={15} />
            ) : stats.trend === 'cooling' ? (
              <TrendingDown size={15} />
            ) : (
              <Minus size={15} />
            )}
          </div>
          <div>
            <h3
              style={{
                fontFamily: 'var(--app-font-serif)',
                fontSize: '15px',
                fontWeight: 600,
                letterSpacing: '-0.02em',
                margin: 0,
                color: 'hsl(var(--foreground))',
              }}
            >
              12-Hour Temperature Trend
            </h3>
            <span
              style={{
                fontSize: '10.5px',
                color: 'hsl(var(--muted-foreground))',
                fontFamily: 'var(--app-font-mono)',
              }}
            >
              Interactive line visualization · Tap point to select
            </span>
          </div>
        </div>

        {/* Telemetry badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '3px 9px',
              borderRadius: '999px',
              background: 'rgba(56, 189, 248, 0.12)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              color: '#38bdf8',
              fontFamily: 'var(--app-font-mono)',
              fontSize: '10.5px',
              fontWeight: 500,
            }}
            title={`Lowest point at ${stats.troughLabel}`}
          >
            <span>Low {stats.minTemp}°{tempUnit}</span>
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '3px 9px',
              borderRadius: '999px',
              background: 'rgba(245, 158, 11, 0.14)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#f59e0b',
              fontFamily: 'var(--app-font-mono)',
              fontSize: '10.5px',
              fontWeight: 500,
            }}
            title={`Peak temperature at ${stats.peakLabel}`}
          >
            <span>High {stats.maxTemp}°{tempUnit}</span>
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '999px',
              background: 'hsl(var(--muted) / 0.5)',
              border: '1px solid hsl(var(--border) / 0.8)',
              color: 'hsl(var(--muted-foreground))',
              fontFamily: 'var(--app-font-mono)',
              fontSize: '10.5px',
            }}
          >
            <span>
              {stats.trend === 'warming'
                ? `+${stats.netChange}° warming`
                : stats.trend === 'cooling'
                ? `${stats.netChange}° cooling`
                : 'Steady'}
            </span>
          </div>
        </div>
      </div>

      {/* Recharts Responsive Line Chart Stage - outline none */}
      <div style={{ width: '100%', height: 185, position: 'relative', outline: 'none' }} tabIndex={-1}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            tabIndex={-1}
            style={{ outline: 'none', userSelect: 'none' }}
            margin={{ top: 14, right: 16, left: 6, bottom: 2 }}
            onClick={(state: any) => {
              if (state && state.activePayload && state.activePayload.length > 0) {
                const pt = state.activePayload[0].payload as HourlyChartPoint;
                if (pt && typeof pt.index === 'number') {
                  onSelectHour(pt.index);
                }
              }
            }}
          >
            <defs>
              {/* Subtle line glow filter */}
              <filter id="tempLineGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#f59e0b" floodOpacity="0.4" />
              </filter>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="hsl(var(--border))"
              strokeOpacity={0.45}
            />

            <XAxis
              dataKey="timeLabel"
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))', strokeOpacity: 0.6 }}
              tick={{
                fill: 'hsl(var(--muted-foreground))',
                fontSize: 10,
                fontFamily: 'var(--app-font-mono)',
              }}
              dy={6}
            />

            <YAxis
              domain={['dataMin - 1', 'dataMax + 1']}
              tickLine={false}
              axisLine={false}
              tick={{
                fill: 'hsl(var(--muted-foreground))',
                fontSize: 10,
                fontFamily: 'var(--app-font-mono)',
              }}
              unit="°"
              width={42}
            />

            <Tooltip
              content={<CustomChartTooltip tempUnit={tempUnit} />}
              cursor={{ stroke: 'hsl(var(--accent))', strokeWidth: 1.2, strokeDasharray: '3 3' }}
            />

            <Line
              type="monotone"
              dataKey="temperature"
              name="Temperature"
              stroke="#f59e0b"
              strokeWidth={2.75}
              filter="url(#tempLineGlow)"
              isAnimationActive={true}
              animationDuration={800}
              dot={
                <CustomLineDot
                  onCoord={handleCoord}
                  selectedIndex={selectedHour}
                  minTemp={stats.minTemp}
                  maxTemp={stats.maxTemp}
                />
              }
              activeDot={{
                r: 6.5,
                fill: '#f59e0b',
                stroke: 'hsl(var(--card))',
                strokeWidth: 2.5,
                cursor: 'pointer',
              }}
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Smoothly animated sliding indicator dot across hours */}
        {activePoint && (
          <svg
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
              overflow: 'visible',
              zIndex: 5,
            }}
          >
            <motion.g
              initial={false}
              animate={{ x: activePoint.x, y: activePoint.y }}
              transition={{
                type: 'spring',
                stiffness: 240,
                damping: 24,
                mass: 0.7,
              }}
            >
              {/* Pulsing outer halo */}
              <circle
                cx={0}
                cy={0}
                r={11}
                fill="rgba(245, 158, 11, 0.24)"
                stroke="#f59e0b"
                strokeWidth={1.5}
                className="animate-pulse"
              />
              {/* Central glowing core dot */}
              <circle
                cx={0}
                cy={0}
                r={5.5}
                fill="#f59e0b"
                stroke="hsl(var(--card))"
                strokeWidth={2}
              />
            </motion.g>
          </svg>
        )}
      </div>
    </div>
  );
}
export default HourlyTemperatureChart;
