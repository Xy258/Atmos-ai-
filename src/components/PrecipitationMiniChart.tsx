import React from 'react';
import { CloudRain } from 'lucide-react';

export interface PrecipitationMiniChartProps {
  hourlyProbability: number[];
  hourlyTimes: string[];
  startIndex: number;
  currentPrecipitationMm: number;
  precipUnit?: string;
  timezone?: string;
  timeFormat?: '12h' | '24h';
}

export function PrecipitationMiniChart({
  hourlyProbability = [],
  hourlyTimes = [],
  startIndex = 0,
  currentPrecipitationMm = 0,
  precipUnit = 'mm',
  timezone = 'auto',
  timeFormat = '12h',
}: PrecipitationMiniChartProps) {
  // Take next 6 hours
  const upcomingHours = React.useMemo(() => {
    const list = [];
    for (let i = 0; i < 6; i++) {
      const idx = startIndex + i;
      const prob = hourlyProbability[idx] ?? 0;
      const timeStr = hourlyTimes[idx];
      let label = `+${i}h`;
      if (timeStr) {
        try {
          const date = new Date(timeStr);
          if (timeFormat === '24h') {
            label = `${date.getHours()}h`;
          } else {
            const h = date.getHours();
            const ampm = h >= 12 ? 'p' : 'a';
            const h12 = h % 12 || 12;
            label = `${h12}${ampm}`;
          }
        } catch {
          label = `+${i}h`;
        }
      }
      list.push({ hour: label, prob, isCurrent: i === 0 });
    }
    return list;
  }, [hourlyProbability, hourlyTimes, startIndex, timeFormat]);

  const maxProb = Math.max(...upcomingHours.map((h) => h.prob), 0);

  const getProbColor = (p: number) => {
    if (p >= 70) return 'from-sky-400 to-blue-600';
    if (p >= 40) return 'from-cyan-400 to-sky-500';
    if (p >= 20) return 'from-teal-400 to-cyan-500';
    return 'from-slate-400/50 to-slate-500/50';
  };

  return (
    <div className="w-full mt-3 pt-2 border-t border-slate-900/10 dark:border-white/10 flex flex-col justify-between flex-1 select-none min-w-0 max-w-full overflow-hidden">
      <div className="flex items-center justify-between flex-wrap gap-x-1.5 gap-y-0.5 text-[clamp(9px,2.2vw,10.5px)] font-mono text-muted-foreground mb-1.5 min-w-0">
        <span className="flex items-center gap-1 min-w-0">
          <CloudRain className="w-[clamp(11px,2.4vw,13px)] h-[clamp(11px,2.4vw,13px)] text-cyan-500 dark:text-cyan-400 shrink-0" />
          <span className="whitespace-nowrap font-medium">Next 6h chance</span>
        </span>
        <span className="font-semibold text-foreground shrink-0 ml-auto">
          {maxProb > 0 ? `Peak ${maxProb}%` : 'Dry forecast'}
        </span>
      </div>

      {/* Mini probability bars */}
      <div className="grid grid-cols-6 gap-0.5 sm:gap-1 items-end h-[50px] sm:h-[54px] pt-1 w-full min-w-0">
        {upcomingHours.map((item, idx) => {
          const heightPercent = Math.max(12, Math.min(100, item.prob));
          return (
            <div key={idx} className="flex flex-col items-center gap-0.5 sm:gap-1 h-full justify-end min-w-0 w-full overflow-hidden">
              <span className="text-[clamp(7.5px,1.9vw,8.5px)] font-mono font-semibold text-slate-700 dark:text-slate-200 w-full text-center leading-none">
                {item.prob > 0 ? `${item.prob}%` : '0%'}
              </span>
              <div className="w-full bg-slate-200/70 dark:bg-white/10 rounded-t-sm overflow-hidden h-[30px] sm:h-[34px] flex items-end">
                <div
                  className={`w-full rounded-t-sm bg-gradient-to-t ${getProbColor(item.prob)} transition-all duration-300`}
                  style={{ height: `${heightPercent}%` }}
                />
              </div>
              <span className="text-[clamp(7px,1.8vw,8px)] font-mono font-medium text-slate-600 dark:text-slate-400 w-full text-center leading-none">
                {item.hour}
              </span>
            </div>
          );
        })}
      </div>

      {/* Bottom Summary Pill */}
      <div className="mt-2 pt-1.5 border-t border-slate-900/10 dark:border-white/10 flex items-center justify-between flex-wrap gap-x-1.5 gap-y-0.5 text-[clamp(8.5px,2vw,10px)] font-mono text-muted-foreground min-w-0">
        <span className="shrink-0 font-medium">Accumulation</span>
        <span className="text-foreground font-semibold text-right ml-auto leading-tight">
          {currentPrecipitationMm > 0
            ? `${currentPrecipitationMm} ${precipUnit} active`
            : 'No rain expected'}
        </span>
      </div>
    </div>
  );
}

export default PrecipitationMiniChart;
