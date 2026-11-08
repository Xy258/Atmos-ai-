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
    <div className="w-full mt-3 pt-2.5 border-t border-white/10 flex flex-col justify-between flex-1 select-none min-w-0 max-w-full overflow-hidden">
      <div className="flex items-center justify-between text-[10.5px] font-mono mb-1.5 min-w-0">
        <span className="flex items-center gap-1 text-muted-foreground min-w-0 truncate">
          <Droplets size={12} className="text-teal-400 shrink-0" />
          <span className="truncate">Comfort scale</span>
        </span>
        <span className={`font-semibold shrink-0 ml-1 ${comfortState.color}`}>
          {comfortState.label}
        </span>
      </div>

      {/* Moisture spectrum meter */}
      <div className="py-2 w-full min-w-0">
        <div className="relative h-2 w-full rounded-full bg-white/10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-400 via-emerald-400 via-teal-400 to-sky-500 opacity-80" />
        </div>
        <div className="relative w-full h-3">
          <div
            className="absolute top-0 -translate-x-1/2 flex flex-col items-center transition-all duration-500"
            style={{ left: `${Math.max(6, Math.min(94, relativeHumidity))}%` }}
          >
            <div className="w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-b-[5px] border-b-white" />
            <div className="w-1.5 h-1.5 rounded-full bg-white shadow-sm shadow-black/50" />
          </div>
        </div>

        <div className="flex justify-between text-[8px] font-mono text-muted-foreground w-full min-w-0">
          <span>Dry (20%)</span>
          <span>Ideal (45%)</span>
          <span>Humid (80%+)</span>
        </div>
      </div>

      {/* Dew Point Context */}
      <div className="mt-1.5 pt-1.5 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
        <span>Dew point</span>
        <span className="font-medium text-foreground">
          {dewPointDisplay ?? `${Math.round(relativeHumidity * 0.18 + 5)}°${tempUnit}`}
        </span>
      </div>
    </div>
  );
}

export default HumidityMiniMeter;
