import React from 'react';
import { Eye, Compass } from 'lucide-react';

export interface VisibilityClarityMiniProps {
  visibilityKm: number;
  unit?: 'km' | 'mi';
  relativeHumidity?: number;
  dewPointC?: number;
}

export function VisibilityClarityMini({
  visibilityKm = 10,
  unit = 'km',
  relativeHumidity = 50,
  dewPointC,
}: VisibilityClarityMiniProps) {
  const displayVal = unit === 'mi' ? visibilityKm * 0.621371 : visibilityKm;

  // Optical clarity assessment
  const clarityStatus = React.useMemo(() => {
    if (visibilityKm >= 10) return { label: 'Crystal Clear', color: 'text-emerald-400', barPos: 95, desc: 'Full horizon optical range' };
    if (visibilityKm >= 5) return { label: 'Good Clarity', color: 'text-sky-400', barPos: 68, desc: 'Distant features visible' };
    if (visibilityKm >= 2) return { label: 'Moderate Haze', color: 'text-amber-400', barPos: 38, desc: 'Atmospheric particles present' };
    return { label: 'Dense Fog / Mist', color: 'text-rose-400', barPos: 15, desc: 'Severely restricted sightline' };
  }, [visibilityKm]);

  return (
    <div className="w-full mt-3 pt-2.5 border-t border-white/10 flex flex-col justify-between flex-1 select-none min-w-0 max-w-full overflow-hidden">
      <div className="flex items-center justify-between text-[10.5px] font-mono mb-1.5 min-w-0">
        <span className="flex items-center gap-1 text-muted-foreground min-w-0 truncate">
          <Eye size={12} className="text-sky-400 shrink-0" />
          <span className="truncate">Optical range</span>
        </span>
        <span className={`font-semibold shrink-0 ml-1 ${clarityStatus.color}`}>
          {clarityStatus.label}
        </span>
      </div>

      {/* Visual Clarity Gauge */}
      <div className="py-2 w-full min-w-0">
        <div className="relative h-2 w-full rounded-full bg-white/10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-rose-500 via-amber-400 via-sky-400 to-emerald-400 opacity-80" />
        </div>
        <div className="relative w-full h-3">
          <div
            className="absolute top-0 -translate-x-1/2 flex flex-col items-center transition-all duration-500"
            style={{ left: `${clarityStatus.barPos}%` }}
          >
            <div className="w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-b-[5px] border-b-white" />
            <div className="w-1.5 h-1.5 rounded-full bg-white shadow-sm shadow-black/50" />
          </div>
        </div>

        <div className="flex justify-between text-[8px] font-mono text-muted-foreground w-full min-w-0">
          <span className="truncate">&lt;1 {unit}</span>
          <span className="truncate">Haze</span>
          <span className="truncate">10+ {unit}</span>
        </div>
      </div>

      {/* Atmospheric Context */}
      <div className="mt-1.5 pt-1.5 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-muted-foreground min-w-0">
        <span className="truncate">{clarityStatus.desc}</span>
        {relativeHumidity != null && (
          <span className="font-medium text-foreground ml-1 shrink-0">
            {relativeHumidity}% RH
          </span>
        )}
      </div>
    </div>
  );
}

export default VisibilityClarityMini;
