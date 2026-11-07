import React, { useMemo, useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  LabelList,
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

// Custom Tooltip for Rain Probability Bar Chart
interface CustomRainTooltipProps {
  active?: boolean;
  payload?: any[];
  tempUnit: 'C' | 'F';
}

function CustomRainTooltip({ active, payload, tempUnit }: CustomRainTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const point = payload[0].payload as HourlyChartPoint;
  const condition = WEATHER_NAMES[point.weatherCode] ?? 'Changing skies';
  const rainDescription =
    point.pop >= 70
      ? 'High likelihood of rain or showers'
      : point.pop >= 40
      ? 'Moderate chance of precipitation'
      : point.pop >= 15
      ? 'Low chance of rain or drizzle'
      : point.pop > 0
      ? 'Isolated brief sprinkle possible'
      : 'Dry / minimal precipitation risk';

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
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25)',
        minWidth: '160px',
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
        <span style={{ fontFamily: 'var(--app-font-serif)', fontSize: '24px', fontWeight: 700, color: '#38bdf8', letterSpacing: '-0.03em', lineHeight: 1 }}>
          {point.pop}%
        </span>
        <span style={{ fontFamily: 'var(--app-font-mono)', fontSize: '11px', color: 'hsl(var(--muted-foreground))' }}>
          rain likelihood
        </span>
      </div>

      <div style={{ fontSize: '11px', color: 'hsl(var(--foreground))', fontWeight: 500, marginBottom: '2px' }}>
        {rainDescription}
      </div>

      <div style={{ fontSize: '10.5px', color: 'hsl(var(--muted-foreground))', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', paddingTop: '4px', borderTop: '1px solid hsl(var(--border) / 0.6)' }}>
        <Droplets size={11} color="#38bdf8" />
        <span>Temp: {point.temperature}°{tempUnit}</span>
        <span>·</span>
        <span>{condition}</span>
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
  // Toggle between 12-hour focus and full 24-hour day
  const [hoursCount, setHoursCount] = useState<12 | 24>(12);

  // Build the hourly data points
  const chartData = useMemo(() => {
    return buildHourlyChartData({
      times,
      temperatures,
      apparentTemps,
      precipProbabilities,
      weatherCodes,
      hourlyStart,
      count: hoursCount,
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
    hoursCount,
    tempUnit,
    timeFormat,
    selectedHour,
  ]);

  // Compute temperature stats across the selected range
  const stats = useMemo(() => calculateTemperatureStats(chartData), [chartData]);

  // Compute rain stats across the selected range
  const rainStats = useMemo(() => {
    if (!chartData.length) {
      return { maxPop: 0, peakTime: '--', avgPop: 0, hasRain: false };
    }
    let maxPop = 0;
    let peakTime = chartData[0].timeLabel;
    let totalPop = 0;

    for (const pt of chartData) {
      totalPop += pt.pop;
      if (pt.pop > maxPop) {
        maxPop = pt.pop;
        peakTime = pt.timeLabel;
      }
    }

    const avgPop = Math.round(totalPop / chartData.length);
    return {
      maxPop,
      peakTime,
      avgPop,
      hasRain: maxPop > 0,
    };
  }, [chartData]);

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
        padding: '16px 18px 14px',
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
              {hoursCount === 24 ? '24-Hour' : '12-Hour'} Temperature Trend
            </h3>
            <span
              style={{
                fontSize: '10.5px',
                color: 'hsl(var(--muted-foreground))',
                fontFamily: 'var(--app-font-mono)',
              }}
            >
              Interactive trend curve · Tap point or bar to select time slot
            </span>
          </div>
        </div>

        {/* Telemetry badges & Range Switcher */}
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

          {/* Timeframe switch: 12h or 24h Day */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '2px',
              borderRadius: '8px',
              background: 'hsl(var(--muted) / 0.5)',
              border: '1px solid hsl(var(--border) / 0.7)',
            }}
          >
            <button
              type="button"
              onClick={() => setHoursCount(12)}
              style={{
                border: 'none',
                background: hoursCount === 12 ? 'hsl(var(--card))' : 'transparent',
                color: hoursCount === 12 ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                fontSize: '10px',
                fontFamily: 'var(--app-font-mono)',
                fontWeight: hoursCount === 12 ? 600 : 400,
                padding: '2px 8px',
                borderRadius: '6px',
                cursor: 'pointer',
                boxShadow: hoursCount === 12 ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              12h
            </button>
            <button
              type="button"
              onClick={() => setHoursCount(24)}
              style={{
                border: 'none',
                background: hoursCount === 24 ? 'hsl(var(--card))' : 'transparent',
                color: hoursCount === 24 ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                fontSize: '10px',
                fontFamily: 'var(--app-font-mono)',
                fontWeight: hoursCount === 24 ? 600 : 400,
                padding: '2px 8px',
                borderRadius: '6px',
                cursor: 'pointer',
                boxShadow: hoursCount === 24 ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              24h Day
            </button>
          </div>
        </div>
      </div>

      {/* Recharts Responsive Line Chart Stage - outline none */}
      <div style={{ width: '100%', height: 175, position: 'relative', outline: 'none' }} tabIndex={-1}>
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
                fontSize: hoursCount === 24 ? 9 : 10,
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

      {/* --------------------------------------------------------------------- */}
      {/* Sub-section: Rain Probability Bar Chart Below Temperature Trend Line  */}
      {/* --------------------------------------------------------------------- */}
      <div
        style={{
          borderTop: '1px solid hsl(var(--border) / 0.65)',
          paddingTop: '14px',
          marginTop: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          marginBottom: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '7px',
              background: 'rgba(56, 189, 248, 0.16)',
              color: '#38bdf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Droplets size={15} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h4
                style={{
                  fontFamily: 'var(--app-font-serif)',
                  fontSize: '14px',
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                  margin: 0,
                  color: 'hsl(var(--foreground))',
                }}
              >
                Rain Probability Throughout the Day
              </h4>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  fontFamily: 'var(--app-font-mono)',
                  fontSize: '9.5px',
                  padding: '1px 6px',
                  borderRadius: '999px',
                  background: 'rgba(56, 189, 248, 0.1)',
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                }}
              >
                % likelihood
              </span>
            </div>
            <span
              style={{
                fontSize: '10.5px',
                color: 'hsl(var(--muted-foreground))',
                fontFamily: 'var(--app-font-mono)',
              }}
            >
              Hourly precipitation chance · Tap bar to select hour
            </span>
          </div>
        </div>

        {/* Rain stats telemetry badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {rainStats.hasRain ? (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 9px',
                borderRadius: '999px',
                background:
                  rainStats.maxPop >= 50
                    ? 'rgba(2, 132, 199, 0.18)'
                    : 'rgba(56, 189, 248, 0.12)',
                border:
                  rainStats.maxPop >= 50
                    ? '1px solid rgba(2, 132, 199, 0.4)'
                    : '1px solid rgba(56, 189, 248, 0.28)',
                color: rainStats.maxPop >= 50 ? '#0284c7' : '#38bdf8',
                fontFamily: 'var(--app-font-mono)',
                fontSize: '10.5px',
                fontWeight: 500,
              }}
              title={`Peak rain chance of ${rainStats.maxPop}% at ${rainStats.peakTime}`}
            >
              <Droplets size={11} />
              <span>Peak {rainStats.maxPop}% at {rainStats.peakTime}</span>
            </div>
          ) : (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 9px',
                borderRadius: '999px',
                background: 'rgba(34, 197, 94, 0.12)',
                border: '1px solid rgba(34, 197, 94, 0.28)',
                color: '#15803d',
                fontFamily: 'var(--app-font-mono)',
                fontSize: '10.5px',
                fontWeight: 500,
              }}
            >
              <span>✨ 0% · Dry throughout the day</span>
            </div>
          )}
        </div>
      </div>

      {/* Recharts Rain Probability Bar Chart Stage */}
      <div
        style={{ width: '100%', height: 130, position: 'relative', outline: 'none' }}
        tabIndex={-1}
        data-testid="chart-rain-probability-bars"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            tabIndex={-1}
            style={{ outline: 'none', userSelect: 'none' }}
            margin={{ top: 16, right: 16, left: 6, bottom: 2 }}
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
              {/* Rain Bar Gradients based on probability level */}
              <linearGradient id="rainBarLow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7dd3fc" stopOpacity={0.85} />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity={0.45} />
              </linearGradient>

              <linearGradient id="rainBarMed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#0284c7" stopOpacity={0.65} />
              </linearGradient>

              <linearGradient id="rainBarHigh" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#60a5fa" stopOpacity={1} />
                <stop offset="100%" stopColor="#2563eb" stopOpacity={0.8} />
              </linearGradient>

              <linearGradient id="rainBarSelected" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a5f3fc" stopOpacity={1} />
                <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.95} />
              </linearGradient>

              {/* Bar Glow Filter */}
              <filter id="rainBarGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#38bdf8" floodOpacity="0.4" />
              </filter>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="hsl(var(--border))"
              strokeOpacity={0.4}
            />

            <XAxis
              dataKey="timeLabel"
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))', strokeOpacity: 0.6 }}
              tick={{
                fill: 'hsl(var(--muted-foreground))',
                fontSize: hoursCount === 24 ? 9 : 10,
                fontFamily: 'var(--app-font-mono)',
              }}
              dy={6}
            />

            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tickLine={false}
              axisLine={false}
              tick={{
                fill: 'hsl(var(--muted-foreground))',
                fontSize: 9.5,
                fontFamily: 'var(--app-font-mono)',
              }}
              unit="%"
              width={42}
            />

            <Tooltip
              content={<CustomRainTooltip tempUnit={tempUnit} />}
              cursor={{ fill: 'hsl(var(--muted) / 0.35)', radius: 4 }}
            />

            <Bar
              dataKey="pop"
              name="Rain Probability"
              minPointSize={3}
              radius={[4, 4, 0, 0]}
              maxBarSize={hoursCount === 24 ? 18 : 28}
              cursor="pointer"
              isAnimationActive={true}
              animationDuration={650}
            >
              <LabelList
                dataKey="pop"
                position="top"
                formatter={(val: any) => (Number(val) > 0 ? `${val}%` : '')}
                style={{
                  fill: '#38bdf8',
                  fontSize: hoursCount === 24 ? '8px' : '9.5px',
                  fontFamily: 'var(--app-font-mono)',
                  fontWeight: 600,
                }}
                dy={-3}
              />
              {chartData.map((entry) => {
                const isSelected = entry.index === selectedHour;
                let fill = 'url(#rainBarMed)';
                if (isSelected) {
                  fill = 'url(#rainBarSelected)';
                } else if (entry.pop === 0) {
                  fill = 'hsl(var(--muted-foreground))';
                } else if (entry.pop <= 25) {
                  fill = 'url(#rainBarLow)';
                } else if (entry.pop > 65) {
                  fill = 'url(#rainBarHigh)';
                }

                return (
                  <Cell
                    key={`rain-bar-${entry.index}`}
                    fill={fill}
                    stroke={isSelected ? '#38bdf8' : 'none'}
                    strokeWidth={isSelected ? 1.8 : 0}
                    opacity={entry.pop === 0 ? (isSelected ? 0.6 : 0.22) : isSelected ? 1 : 0.88}
                    style={{
                      filter: isSelected ? 'url(#rainBarGlow)' : undefined,
                      transition: 'opacity 0.2s ease, filter 0.2s ease',
                    }}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
export default HourlyTemperatureChart;
