import React from 'react';
import { Droplets } from 'lucide-react';

export interface HumidityMiniMeterProps {
  relativeHumidity: number;
  dewPointC?: number;
  tempUnit?: 'C' | 'F';
}

export function HumidityMiniMeter({
  relativeHumidity = 55,
  dewPointC,
  tempUnit = 'C',
}: HumidityMiniMeterProps) {
  const dewPointDisplay = React.useMemo(() => {
    if (dewPointC == null) return null;
    const val = tempUnit === 'F' ? (dewPointC * 9) / 5 + 32 : dewPointC;
    return `${Math.round(val)}°${tempUnit}`;
  }, [dewPointC, tempUnit]);

  const comfortState = React.useMemo(() => {
    if (relativeHumidity < 30) return { label: 'Dry air', color: 'text-amber-400', desc: 'Low moisture level', pos: 18 };
    if (relativeHumidity <= 60) return { label: 'Optimal comfort', color: 'text-emerald-400', desc: 'Ideal human comfort zone', pos: 48 };
    if (relativeHumidity <= 75) return { label: 'Humid', color: 'text-teal-400', desc: 'Moisture in the air', pos: 72 };
    return { label: 'Muggy / High moisture', color: 'text-rose-400', desc: 'Sticky condensation risk', pos: 90 };
  }, [relativeHumidity]);

  return (
    <div className="w-full mt-3 pt-2 border-t border-slate-900/10 dark:border-white/10 flex flex-col justify-between flex-1 select-none min-w-0 max-w-full overflow-hidden">
      <div className="flex items-center justify-between flex-wrap gap-x-1.5 gap-y-0.5 text-[clamp(9px,2.2vw,10.5px)] font-mono mb-1.5 min-w-0">
        <span className="flex items-center gap-1 text-muted-foreground min-w-0">
          <Droplets className="w-[clamp(11px,2.4vw,13px)] h-[clamp(11px,2.4vw,13px)] text-teal-500 dark:text-teal-400 shrink-0" />
          <span className="whitespace-nowrap font-medium">Comfort scale</span>
        </span>
        <span className={`font-semibold shrink-0 ml-auto ${comfortState.color}`}>
          {comfortState.label}
        </span>
      </div>

      {/* Moisture spectrum meter */}
      <div className="py-1.5 w-full min-w-0">
        <div className="relative h-2 w-full rounded-full bg-slate-300/60 dark:bg-white/10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-400 via-emerald-400 via-teal-400 to-sky-500 opacity-90" />
        </div>
        <div className="relative w-full h-3">
          <div
            className="absolute top-0 -translate-x-1/2 flex flex-col items-center transition-all duration-500"
            style={{ left: `${Math.max(6, Math.min(94, relativeHumidity))}%` }}
          >
            <div className="w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-b-[5px] border-b-slate-900 dark:border-b-white" />
            <div className="w-1.5 h-1.5 rounded-full bg-slate-900 dark:bg-white shadow-sm shadow-black/40" />
          </div>
        </div>

        <div className="flex justify-between text-[clamp(7.5px,1.9vw,8.5px)] font-mono font-medium text-slate-700 dark:text-slate-300 w-full min-w-0">
          <span>Dry (20%)</span>
          <span>Ideal (45%)</span>
          <span>Humid (80%+)</span>
        </div>
      </div>

      {/* Dew Point Context */}
      <div className="mt-1.5 pt-1.5 border-t border-slate-900/10 dark:border-white/10 flex items-center justify-between flex-wrap gap-x-1.5 gap-y-0.5 text-[clamp(8.5px,2vw,10px)] font-mono text-muted-foreground min-w-0">
        <span className="leading-tight font-medium text-slate-800 dark:text-slate-200">{comfortState.desc}</span>
        <span className="font-semibold text-foreground ml-auto shrink-0 whitespace-nowrap">
          {dewPointDisplay ? `Dew: ${dewPointDisplay}` : `Dew: ${Math.round(relativeHumidity * 0.18 + 5)}°${tempUnit}`}
        </span>
      </div>
    </div>
  );
}

export default HumidityMiniMeter;
