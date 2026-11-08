import React from 'react';
import { Cloud, Sun, CloudRain } from 'lucide-react';

export interface CloudCoverMiniMeterProps {
  cloudCoverPercent: number;
}

export function CloudCoverMiniMeter({ cloudCoverPercent = 30 }: CloudCoverMiniMeterProps) {
  const cloudInfo = React.useMemo(() => {
    if (cloudCoverPercent >= 80) return { label: 'Overcast', desc: 'Thick stratiform cloud layer', icon: CloudRain, color: 'text-slate-300' };
    if (cloudCoverPercent >= 50) return { label: 'Mostly cloudy', desc: 'Substantial cloud clusters', icon: Cloud, color: 'text-sky-300' };
    if (cloudCoverPercent >= 20) return { label: 'Partly cloudy', desc: 'Scattered cumulus clouds', icon: Cloud, color: 'text-sky-400' };
    return { label: 'Clear sky', desc: 'Unobstructed solar path', icon: Sun, color: 'text-amber-400' };
  }, [cloudCoverPercent]);

  const Icon = cloudInfo.icon;

  return (
    <div className="w-full mt-3 pt-2 border-t border-slate-900/10 dark:border-white/10 flex flex-col justify-between flex-1 select-none min-w-0 max-w-full overflow-hidden">
      <div className="flex items-center justify-between flex-wrap gap-x-1.5 gap-y-0.5 text-[clamp(9px,2.2vw,10.5px)] font-mono mb-1.5 min-w-0">
        <span className="flex items-center gap-1 text-muted-foreground min-w-0">
          <Icon className={`w-[clamp(11px,2.4vw,13px)] h-[clamp(11px,2.4vw,13px)] ${cloudInfo.color} shrink-0`} />
          <span className="whitespace-nowrap font-medium">Sky coverage</span>
        </span>
        <span className={`font-semibold shrink-0 ml-auto ${cloudInfo.color}`}>
          {cloudInfo.label}
        </span>
      </div>

      {/* Cloud coverage gauge */}
      <div className="py-1.5 w-full min-w-0">
        <div className="relative h-2 w-full rounded-full bg-slate-300/60 dark:bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 via-sky-400 to-slate-400 dark:to-slate-200 transition-all duration-500"
            style={{ width: `${Math.max(6, Math.min(100, cloudCoverPercent))}%` }}
          />
        </div>
        <div className="flex justify-between text-[clamp(7.5px,1.9vw,8.5px)] font-mono font-medium text-slate-700 dark:text-slate-300 mt-1 w-full min-w-0">
          <span>0% Clear</span>
          <span>50% Scat</span>
          <span>100% Dense</span>
        </div>
      </div>

      {/* Cloud layer context */}
      <div className="mt-1.5 pt-1.5 border-t border-slate-900/10 dark:border-white/10 flex items-center justify-between flex-wrap gap-x-1.5 gap-y-0.5 text-[clamp(8.5px,2vw,10px)] font-mono text-muted-foreground min-w-0">
        <span className="leading-tight font-medium text-slate-800 dark:text-slate-200">{cloudInfo.desc}</span>
        <span className="font-semibold text-foreground ml-auto shrink-0 whitespace-nowrap">
          {100 - cloudCoverPercent}% sun
        </span>
      </div>
    </div>
  );
}

export default CloudCoverMiniMeter;
