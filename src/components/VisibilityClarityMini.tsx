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
    <div className="w-full mt-3 pt-2 border-t border-slate-900/10 dark:border-white/10 flex flex-col justify-between flex-1 select-none min-w-0 max-w-full overflow-hidden">
      <div className="flex items-center justify-between flex-wrap gap-x-1.5 gap-y-0.5 text-[clamp(9px,2.2vw,10.5px)] font-mono mb-1.5 min-w-0">
        <span className="flex items-center gap-1 text-muted-foreground min-w-0">
          <Eye className="w-[clamp(11px,2.4vw,13px)] h-[clamp(11px,2.4vw,13px)] text-sky-500 dark:text-sky-400 shrink-0" />
          <span className="whitespace-nowrap font-medium">Optical range</span>
        </span>
        <span className={`font-semibold shrink-0 ml-auto ${clarityStatus.color}`}>
          {clarityStatus.label}
        </span>
      </div>

      {/* Visual Clarity Gauge */}
      <div className="py-1.5 w-full min-w-0">
        <div className="relative h-2 w-full rounded-full bg-slate-300/60 dark:bg-white/10 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-rose-500 via-amber-400 via-sky-400 to-emerald-400 opacity-90" />
        </div>
        <div className="relative w-full h-3">
          <div
            className="absolute top-0 -translate-x-1/2 flex flex-col items-center transition-all duration-500"
            style={{ left: `${clarityStatus.barPos}%` }}
          >
            <div className="w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-b-[5px] border-b-slate-900 dark:border-b-white" />
            <div className="w-1.5 h-1.5 rounded-full bg-slate-900 dark:bg-white shadow-sm shadow-black/40" />
          </div>
        </div>

        <div className="flex justify-between text-[clamp(7.5px,1.9vw,8.5px)] font-mono font-medium text-slate-700 dark:text-slate-300 w-full min-w-0">
          <span>&lt;1 {unit}</span>
          <span>Haze</span>
          <span>10+ {unit}</span>
        </div>
      </div>

      {/* Atmospheric Context */}
      <div className="mt-1.5 pt-1.5 border-t border-slate-900/10 dark:border-white/10 flex items-center justify-between flex-wrap gap-x-1.5 gap-y-0.5 text-[clamp(8.5px,2vw,10px)] font-mono text-muted-foreground min-w-0">
        <span className="leading-tight font-medium text-slate-800 dark:text-slate-200">{clarityStatus.desc}</span>
        {relativeHumidity != null && (
          <span className="font-semibold text-foreground ml-auto shrink-0 whitespace-nowrap">
            {relativeHumidity}% RH
          </span>
        )}
      </div>
    </div>
  );
}

export default VisibilityClarityMini;
