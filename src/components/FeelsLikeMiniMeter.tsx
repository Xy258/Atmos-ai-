import React from 'react';
import { Thermometer, Wind, Droplets } from 'lucide-react';

export interface FeelsLikeMiniMeterProps {
  realTemp: number;
  apparentTemp: number;
  windSpeedKmh: number;
  humidityPercent: number;
  tempUnit?: 'C' | 'F';
}

export function FeelsLikeMiniMeter({
  realTemp = 20,
  apparentTemp = 20,
  windSpeedKmh = 10,
  humidityPercent = 50,
  tempUnit = 'C',
}: FeelsLikeMiniMeterProps) {
  const diff = Math.round(apparentTemp - realTemp);

  const factorInfo = React.useMemo(() => {
    if (diff > 0) {
      return {
        label: `+${diff}° warmer`,
        color: 'text-amber-400',
        factor: 'Humidity retains heat',
        icon: Droplets,
      };
    }
    if (diff < 0) {
      return {
        label: `${diff}° cooler`,
        color: 'text-sky-400',
        factor: 'Wind breeze cools surface',
        icon: Wind,
      };
    }
    return {
      label: 'Exact match',
      color: 'text-emerald-400',
      factor: 'Thermal equilibrium',
      icon: Thermometer,
    };
  }, [diff]);

  const FactorIcon = factorInfo.icon;

  return (
    <div className="w-full mt-3 pt-2.5 border-t border-white/10 flex flex-col justify-between flex-1 select-none min-w-0 max-w-full overflow-hidden">
      <div className="flex items-center justify-between text-[10.5px] font-mono mb-1.5 min-w-0">
        <span className="flex items-center gap-1 text-muted-foreground min-w-0 truncate">
          <FactorIcon size={12} className={`${factorInfo.color} shrink-0`} />
          <span className="truncate">Sensory index</span>
        </span>
        <span className={`font-semibold shrink-0 ml-1 ${factorInfo.color}`}>
          {factorInfo.label}
        </span>
      </div>

      {/* Differential gauge */}
      <div className="py-2 w-full min-w-0">
        <div className="flex items-center justify-between text-[9.5px] font-mono mb-1 min-w-0">
          <span className="text-muted-foreground truncate">Act: {Math.round(realTemp)}°{tempUnit}</span>
          <span className="text-foreground font-semibold truncate ml-1">Feels: {Math.round(apparentTemp)}°{tempUnit}</span>
        </div>
        <div className="relative h-2 w-full rounded-full bg-white/10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-sky-400 via-emerald-400 to-amber-500 opacity-80" />
        </div>
      </div>

      {/* Factor Explanation */}
      <div className="mt-1.5 pt-1.5 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-muted-foreground min-w-0">
        <span className="truncate">{factorInfo.factor}</span>
        <span className="font-medium text-foreground ml-1 shrink-0">
          {windSpeedKmh > 20 ? `${Math.round(windSpeedKmh)} km/h wind` : `${humidityPercent}% moisture`}
        </span>
      </div>
    </div>
  );
}

export default FeelsLikeMiniMeter;
