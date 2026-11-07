import React from 'react';

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
            label = `${date.getHours()}:00`;
          } else {
            const h = date.getHours();
            const ampm = h >= 12 ? 'PM' : 'AM';
            const h12 = h % 12 || 12;
            label = `${h12} ${ampm}`;
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
    <div className="w-full mt-3 pt-2.5 border-t border-white/10 flex flex-col justify-between flex-1 select-none">
      <div className="flex items-center justify-between text-[10.5px] font-mono text-muted-foreground mb-1.5">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block animate-pulse" />
          Next 6 hours chance
        </span>
        <span className="font-semibold text-foreground">
          {maxProb > 0 ? `Peak ${maxProb}%` : 'Dry forecast'}
        </span>
      </div>

      {/* Mini probability bars */}
      <div className="grid grid-cols-6 gap-1.5 items-end h-[54px] pt-1">
        {upcomingHours.map((item, idx) => {
          const heightPercent = Math.max(12, Math.min(100, item.prob));
          return (
            <div key={idx} className="flex flex-col items-center gap-1 h-full justify-end">
              <span className="text-[9px] font-mono font-medium text-slate-300">
                {item.prob > 0 ? `${item.prob}%` : '0%'}
              </span>
              <div className="w-full bg-white/5 rounded-t-sm overflow-hidden h-[34px] flex items-end">
                <div
                  className={`w-full rounded-t-sm bg-gradient-to-t ${getProbColor(item.prob)} transition-all duration-300`}
                  style={{ height: `${heightPercent}%` }}
                />
              </div>
              <span className="text-[8.5px] font-mono text-muted-foreground truncate w-full text-center">
                {item.hour}
              </span>
            </div>
          );
        })}
      </div>

      {/* Bottom Summary Pill */}
      <div className="mt-2.5 pt-1.5 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
        <span>Accumulation</span>
        <span className="text-foreground font-medium">
          {currentPrecipitationMm > 0
            ? `${currentPrecipitationMm} ${precipUnit} active`
            : 'No rain expected'}
        </span>
      </div>
    </div>
  );
}

export default PrecipitationMiniChart;
