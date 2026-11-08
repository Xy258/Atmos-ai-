import React from 'react';
import { Compass, Gauge, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface PressureMiniGaugeProps {
  surfacePressureHpa: number;
  pressureTrend?: 'rising' | 'falling' | 'steady';
  elevationM?: number;
}

export function PressureMiniGauge({
  surfacePressureHpa = 1013,
  pressureTrend = 'steady',
  elevationM,
}: PressureMiniGaugeProps) {
  // Pressure characterization
  // Standard sea-level = 1013.25 hPa
  const pressureState = React.useMemo(() => {
    if (surfacePressureHpa > 1022) return { label: 'High pressure', desc: 'Fair, settled & calm skies', color: 'text-emerald-400' };
    if (surfacePressureHpa < 1005) return { label: 'Low pressure', desc: 'Front / storm system active', color: 'text-amber-400' };
    return { label: 'Normal / Stable', desc: 'Steady atmospheric equilibrium', color: 'text-sky-400' };
  }, [surfacePressureHpa]);

  // Position on scale (980 hPa to 1040 hPa)
  const meterPos = Math.max(5, Math.min(95, ((surfacePressureHpa - 980) / (1040 - 980)) * 100));

  const TrendIcon = pressureTrend === 'rising' ? TrendingUp : pressureTrend === 'falling' ? TrendingDown : Minus;
  const trendText = pressureTrend === 'rising' ? 'Rising' : pressureTrend === 'falling' ? 'Falling' : 'Steady';
  const trendColor = pressureTrend === 'rising' ? 'text-emerald-400' : pressureTrend === 'falling' ? 'text-amber-400' : 'text-slate-300';

  return (
    <div className="w-full mt-3 pt-2 border-t border-slate-900/10 dark:border-white/10 flex flex-col justify-between flex-1 select-none min-w-0 max-w-full overflow-hidden">
      <div className="flex items-center justify-between flex-wrap gap-x-1.5 gap-y-0.5 text-[clamp(9px,2.2vw,10.5px)] font-mono mb-1.5 min-w-0">
        <span className="flex items-center gap-1 text-muted-foreground min-w-0">
          <Gauge className="w-[clamp(11px,2.4vw,13px)] h-[clamp(11px,2.4vw,13px)] text-cyan-500 dark:text-cyan-400 shrink-0" />
          <span className="whitespace-nowrap font-medium">Barometer</span>
        </span>
        <span className={`font-semibold flex items-center gap-1 shrink-0 ml-auto ${trendColor}`}>
          <TrendIcon className="w-[clamp(10px,2.2vw,12px)] h-[clamp(10px,2.2vw,12px)] shrink-0" />
          <span>{trendText}</span>
        </span>
      </div>

      {/* Barometer gradient gauge */}
      <div className="py-1.5 w-full min-w-0">
        <div className="relative h-2 w-full rounded-full bg-slate-300/60 dark:bg-white/10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-rose-500 via-sky-400 to-emerald-400 opacity-90" />
        </div>
        <div className="relative w-full h-3">
          <div
            className="absolute top-0 -translate-x-1/2 flex flex-col items-center transition-all duration-500"
            style={{ left: `${meterPos}%` }}
          >
            <div className="w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-b-[5px] border-b-slate-900 dark:border-b-white" />
            <div className="w-1.5 h-1.5 rounded-full bg-slate-900 dark:bg-white shadow-sm shadow-black/40" />
          </div>
        </div>

        <div className="flex justify-between text-[clamp(7.5px,1.9vw,8.5px)] font-mono font-medium text-slate-700 dark:text-slate-300 w-full min-w-0">
          <span>980 Low</span>
          <span>1013 Norm</span>
          <span>1040 High</span>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-1.5 pt-1.5 border-t border-slate-900/10 dark:border-white/10 flex items-center justify-between flex-wrap gap-x-1.5 gap-y-0.5 text-[clamp(8.5px,2vw,10px)] font-mono text-muted-foreground min-w-0">
        <span className="leading-tight font-medium text-slate-800 dark:text-slate-200">{pressureState.desc}</span>
        {elevationM != null && (
          <span className="font-semibold text-foreground ml-auto shrink-0 whitespace-nowrap">
            {Math.round(elevationM)}m alt
          </span>
        )}
      </div>
    </div>
  );
}

export default PressureMiniGauge;
