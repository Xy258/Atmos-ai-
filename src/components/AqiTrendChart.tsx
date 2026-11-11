import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Wind,
  ShieldAlert,
} from 'lucide-react';
import { getAqiDetails, type AqiDetails } from '../App';

export interface AqiTrendChartProps {
  times: string[];
  hourlyAqi: number[];
  hourlyPm25: number[];
  currentAqi: number;
  timezone?: string;
  timeFormat?: '12h' | '24h';
  locationName: string;
}

interface ChartDataPoint {
  time: string;
  label: string;
  fullTime: string;
  aqi: number;
  pm25: number;
  details: AqiDetails;
  isSpike: boolean;
  isImprovement: boolean;
}

function formatHourLabel(value: string, timezone?: string, format: '12h' | '24h' = '12h') {
  if (!value) return '';
  const timePart = value.split('T')[1]?.slice(0, 5);
  if (timePart) {
    const [hours] = timePart.split(':').map(Number);
    if (format === '24h') {
      return `${String(hours).padStart(2, '0')}:00`;
    }
    const suffix = hours >= 12 ? 'PM' : 'AM';
    const hour = hours % 12 || 12;
    return `${hour} ${suffix}`;
  }
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: format === '12h',
    timeZone: timezone,
  }).format(new Date(value));
}

// Custom Dot for Line with AQI color coding
const CustomDot = (props: any) => {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload) return null;

  const color = payload.details?.color || '#38bdf8';
  const isSpike = payload.isSpike;

  return (
    <g>
      {isSpike && (
        <circle
          cx={cx}
          cy={cy}
          r={9}
          fill="none"
          stroke="#ef4444"
          strokeWidth={1.5}
          strokeDasharray="2 2"
          opacity={0.8}
        />
      )}
      <circle
        cx={cx}
        cy={cy}
        r={isSpike ? 5 : 4}
        fill={color}
        stroke="#ffffff"
        strokeWidth={1.5}
      />
    </g>
  );
};

// Custom Glassmorphic Tooltip
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload as ChartDataPoint;
  if (!data) return null;

  const details = data.details;

  return (
    <div
      className="rounded-xl p-3 shadow-xl border backdrop-blur-md pointer-events-none z-50 text-xs min-w-[190px]"
      style={{
        backgroundColor: 'rgba(15, 23, 42, 0.94)',
        borderColor: details.borderColor || 'hsl(var(--border))',
      }}
    >
      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-700/80 mb-2">
        <span className="font-semibold text-slate-200">{data.fullTime}</span>
        <span
          className="px-2 py-0.5 rounded-full text-[10px] font-bold"
          style={{
            backgroundColor: details.bgColor,
            color: details.color,
            border: `1px solid ${details.borderColor}`,
          }}
        >
          {details.level}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3 py-0.5">
        <span className="text-slate-400 flex items-center gap-1">
          <Activity size={12} className="text-amber-400" />
          Air Quality Index:
        </span>
        <span className="font-bold text-sm" style={{ color: details.color }}>
          {data.aqi} AQI
        </span>
      </div>

      <div className="flex items-center justify-between gap-3 py-0.5">
        <span className="text-slate-400 flex items-center gap-1">
          <Wind size={12} className="text-sky-400" />
          Fine Particles (PM2.5):
        </span>
        <span className="font-mono text-slate-200 font-semibold">
          {data.pm25.toFixed(1)} µg/m³
        </span>
      </div>

      {data.isSpike && (
        <div className="mt-2 pt-1.5 border-t border-red-500/30 flex items-center gap-1.5 text-red-400 text-[11px] font-semibold">
          <AlertTriangle size={12} />
          <span>Potential Pollution Spike</span>
        </div>
      )}

      {data.isImprovement && (
        <div className="mt-2 pt-1.5 border-t border-emerald-500/30 flex items-center gap-1.5 text-emerald-400 text-[11px] font-semibold">
          <CheckCircle2 size={12} />
          <span>Clean Air Improvement Window</span>
        </div>
      )}
    </div>
  );
};

export function AqiTrendChart({
  times,
  hourlyAqi,
  hourlyPm25,
  currentAqi,
  timezone,
  timeFormat = '12h',
  locationName,
}: AqiTrendChartProps) {
  // Build chart dataset for next 12 hours
  const { chartData, peakPoint, lowestPoint, spikeDetected, improvementDetected, maxAqi } =
    useMemo(() => {
      const pointsCount = Math.min(12, times.length);
      const points: ChartDataPoint[] = [];

      let peakVal = -Infinity;
      let lowestVal = Infinity;
      let peakIdx = 0;
      let lowestIdx = 0;

      for (let i = 0; i < pointsCount; i++) {
        const time = times[i];
        const aqi = hourlyAqi[i] ?? currentAqi;
        const pm25 = hourlyPm25[i] ?? 0;
        const details = getAqiDetails(aqi);

        if (aqi > peakVal) {
          peakVal = aqi;
          peakIdx = i;
        }
        if (aqi < lowestVal) {
          lowestVal = aqi;
          lowestIdx = i;
        }

        const label = i === 0 ? 'Now' : formatHourLabel(time, timezone, timeFormat);
        const fullTime = i === 0 ? 'Current Status' : formatHourLabel(time, timezone, timeFormat);

        points.push({
          time,
          label,
          fullTime,
          aqi,
          pm25,
          details,
          isSpike: false,
          isImprovement: false,
        });
      }

      const initialAqi = points[0]?.aqi ?? currentAqi;

      // Identify potential spikes:
      // A point is marked as a spike if it rises by >= 15 pts above initial or reaches >= 101 (Sensitive/Unhealthy)
      let spikeFound = false;
      let improvementFound = false;

      points.forEach((pt, idx) => {
        if (
          idx > 0 &&
          ((pt.aqi - initialAqi >= 15 && pt.aqi > 50) ||
            (pt.aqi >= 101 && initialAqi <= 100) ||
            (pt.aqi >= 51 && initialAqi <= 40 && pt.aqi - initialAqi >= 12))
        ) {
          pt.isSpike = true;
          spikeFound = true;
        }

        if (
          idx > 0 &&
          ((initialAqi - pt.aqi >= 15 && initialAqi > 50) ||
            (initialAqi >= 101 && pt.aqi <= 100) ||
            (initialAqi >= 51 && pt.aqi <= 50))
        ) {
          pt.isImprovement = true;
          improvementFound = true;
        }
      });

      return {
        chartData: points,
        peakPoint: points[peakIdx] || points[0],
        lowestPoint: points[lowestIdx] || points[0],
        spikeDetected: spikeFound,
        improvementDetected: improvementFound,
        maxAqi: Math.max(...points.map((p) => p.aqi), 100),
      };
    }, [times, hourlyAqi, hourlyPm25, currentAqi, timezone, timeFormat]);

  if (!chartData.length) return null;

  const yDomainMax = Math.max(Math.ceil(maxAqi / 20) * 20 + 20, 110);

  return (
    <div
      className="aqi-trend-card rounded-2xl p-4 sm:p-6 bg-card border border-border shadow-sm text-card-foreground animate-rise outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus:border-border select-none"
      data-testid="container-aqi-trend-chart"
      style={{ outline: 'none', WebkitTapHighlightColor: 'transparent' }}
    >
      {/* Header with Title and Quick Spike/Improvement Diagnostic Pill */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="text-[11px] uppercase tracking-wider font-semibold text-primary font-mono flex items-center gap-1.5">
            <Activity size={13} />
            Next 12 Hours Forecast Trend
          </div>
          <h3 className="text-lg sm:text-xl font-bold tracking-tight mt-0.5 font-display">
            12-Hour Air Quality (AQI) Trajectory
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Hour-by-hour projected air quality & pollutant dynamics for {locationName}
          </p>
        </div>

        {/* Dynamic Quick Alert Pill */}
        <div className="flex items-center gap-2">
          {spikeDetected ? (
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
              data-testid="badge-aqi-spike-detected"
            >
              <AlertTriangle size={13} />
              <span>Potential Spike at {peakPoint.label} (AQI {peakPoint.aqi})</span>
            </div>
          ) : improvementDetected ? (
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
              data-testid="badge-aqi-improvement-detected"
            >
              <TrendingDown size={13} />
              <span>Clean Air Window at {lowestPoint.label} (AQI {lowestPoint.aqi})</span>
            </div>
          ) : (
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30"
              data-testid="badge-aqi-steady"
            >
              <Sparkles size={13} />
              <span>Stable Atmosphere ({lowestPoint.aqi}–{peakPoint.aqi} AQI)</span>
            </div>
          )}
        </div>
      </div>

      {/* Summary KPI Cards: Peak vs Lowest vs Trajectory */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        {/* Peak AQI */}
        <div className="p-3 rounded-xl bg-muted/50 border border-border flex flex-col">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <TrendingUp size={12} className="text-amber-500" />
            Projected Peak
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span
              className="text-xl font-bold font-mono"
              style={{ color: peakPoint.details.color }}
            >
              {peakPoint.aqi} AQI
            </span>
            <span className="text-xs text-muted-foreground">at {peakPoint.label}</span>
          </div>
          <span className="text-[11px] text-muted-foreground font-medium mt-0.5">
            {peakPoint.details.level}
          </span>
        </div>

        {/* Lowest / Best AQI */}
        <div className="p-3 rounded-xl bg-muted/50 border border-border flex flex-col">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <TrendingDown size={12} className="text-emerald-500" />
            Cleanest Window
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span
              className="text-xl font-bold font-mono"
              style={{ color: lowestPoint.details.color }}
            >
              {lowestPoint.aqi} AQI
            </span>
            <span className="text-xs text-muted-foreground">at {lowestPoint.label}</span>
          </div>
          <span className="text-[11px] text-muted-foreground font-medium mt-0.5">
            {lowestPoint.details.level}
          </span>
        </div>

        {/* 12-Hour Trend Evaluation */}
        <div className="col-span-2 sm:col-span-1 p-3 rounded-xl bg-muted/50 border border-border flex flex-col justify-center">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <ShieldAlert size={12} className="text-primary" />
            Spike / Improvement Index
          </span>
          <span className="text-xs font-semibold text-foreground mt-1">
            {spikeDetected
              ? `Spike alert: +${peakPoint.aqi - (chartData[0]?.aqi ?? 0)} pts predicted`
              : improvementDetected
              ? `Improvement: -${(chartData[0]?.aqi ?? 0) - lowestPoint.aqi} pts predicted`
              : 'Flat variance (< 10 pts variance)'}
          </span>
          <span className="text-[11px] text-muted-foreground mt-0.5">
            {peakPoint.aqi <= 50
              ? 'Ideal for all outdoor activities'
              : peakPoint.aqi <= 100
              ? 'Safe for general population'
              : 'Sensitive groups take precaution'}
          </span>
        </div>
      </div>

      {/* Recharts Line Chart Container */}
      <div className="w-full h-[240px] sm:h-[270px] outline-none focus:outline-none" style={{ outline: 'none', WebkitTapHighlightColor: 'transparent' }}>
        <ResponsiveContainer width="100%" height="100%" style={{ outline: 'none', WebkitTapHighlightColor: 'transparent' }}>
          <LineChart
            data={chartData}
            margin={{ top: 12, right: 18, left: -14, bottom: 0 }}
            style={{ outline: 'none', WebkitTapHighlightColor: 'transparent' }}
          >
            <defs>
              <linearGradient id="aqiLineGradient" x1="0" y1="0" x2="1" y2="0">
                {chartData.map((d, i) => (
                  <stop
                    key={d.time}
                    offset={`${(i / (chartData.length - 1)) * 100}%`}
                    stopColor={d.details.color}
                  />
                ))}
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="hsl(var(--border))"
              opacity={0.55}
            />

            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              dy={6}
            />

            <YAxis
              domain={[0, yDomainMax]}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              dx={-4}
            />

            <Tooltip content={<CustomTooltip />} />

            {/* Good AQI Threshold Line (50) */}
            <ReferenceLine
              y={50}
              stroke="#48bb78"
              strokeDasharray="4 4"
              strokeOpacity={0.65}
              label={{
                value: 'Good (50)',
                fill: '#48bb78',
                fontSize: 10,
                position: 'right',
                offset: 8,
              }}
            />

            {/* Moderate AQI Threshold Line (100) */}
            <ReferenceLine
              y={100}
              stroke="#ecc94b"
              strokeDasharray="4 4"
              strokeOpacity={0.65}
              label={{
                value: 'Moderate (100)',
                fill: '#ecc94b',
                fontSize: 10,
                position: 'right',
                offset: 8,
              }}
            />

            <Line
              type="monotone"
              dataKey="aqi"
              name="AQI"
              stroke="url(#aqiLineGradient)"
              strokeWidth={3}
              dot={<CustomDot />}
              activeDot={{
                r: 6,
                stroke: '#38bdf8',
                strokeWidth: 2,
                fill: '#ffffff',
              }}
              animationDuration={900}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom Color Legend for Quick Interpretation */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-2 border-t border-border text-[11px] text-muted-foreground font-medium">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#48bb78]" />
            <span>0–50 Good</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ecc94b]" />
            <span>51–100 Moderate</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ed8936]" />
            <span>101–150 Sensitive</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#e53e3e]" />
            <span>151+ Unhealthy</span>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono">
          <span>* Red dashed rings identify potential spike hours</span>
        </div>
      </div>
    </div>
  );
}

export default AqiTrendChart;
