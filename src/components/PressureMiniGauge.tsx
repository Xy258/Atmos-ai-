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
    <div className="w-full mt-3 pt-2.5 border-t border-white/10 flex flex-col justify-between flex-1 select-none">
      <div className="flex items-center justify-between text-[10.5px] font-mono mb-1.5">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Gauge size={12} className="text-cyan-400" />
          Barometer
        </span>
        <span className={`font-semibold flex items-center gap-1 ${trendColor}`}>
          <TrendIcon size={12} />
          {trendText}
        </span>
      </div>

      {/* Barometer gradient gauge */}
      <div className="py-2">
        <div className="relative h-2 w-full rounded-full bg-white/10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-rose-500 via-sky-400 to-emerald-400 opacity-80" />
        </div>
        <div className="relative w-full h-3">
          <div
            className="absolute top-0 -translate-x-1/2 flex flex-col items-center transition-all duration-500"
            style={{ left: `${meterPos}%` }}
          >
            <div className="w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-b-[5px] border-b-white" />
            <div className="w-1.5 h-1.5 rounded-full bg-white shadow-sm shadow-black/50" />
          </div>
        </div>

        <div className="flex justify-between text-[8.5px] font-mono text-muted-foreground">
          <span>980 Low</span>
          <span>1013 Norm</span>
          <span>1040 High</span>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-1.5 pt-1.5 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
        <span className="truncate">{pressureState.desc}</span>
        {elevationM != null && (
          <span className="font-medium text-foreground ml-1 shrink-0">
            {Math.round(elevationM)}m alt
          </span>
        )}
      </div>
    </div>
  );
}

export default PressureMiniGauge;
