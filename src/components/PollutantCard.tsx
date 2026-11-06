import React from 'react';
import {
  Factory,
  HeartPulse,
  Info,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';

export interface PollutantItem {
  id: string;
  name: string;
  formula: string;
  value: string;
  unit: string;
  raw: number;
  safeMax: number;
  status: string;
  statusColor: string;
  progress: number;
  desc: string;
  sources: string[];
  healthRisks: string[];
  guideline: string;
}

interface PollutantCardProps {
  item: PollutantItem;
}

export function PollutantCard({ item }: PollutantCardProps) {
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <div
          className="pollutant-card group cursor-pointer transition-all duration-200 hover:ring-2 hover:ring-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          tabIndex={0}
          data-testid={`card-pollutant-${item.id}`}
          role="button"
          aria-label={`Inspect ${item.name} sources and health risks`}
        >
          <div>
            <div className="pollutant-header flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="pollutant-name font-semibold text-foreground truncate">
                  {item.name}
                </span>
                <span className="pollutant-formula font-mono text-muted-foreground text-xs shrink-0">
                  ({item.formula})
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className="pollutant-badge text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    color: item.statusColor,
                    backgroundColor: `${item.statusColor}1f`,
                    border: `1px solid ${item.statusColor}40`,
                  }}
                >
                  {item.status}
                </span>

                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground bg-muted/60 transition"
                  title="Hover for primary sources and specific health risks"
                >
                  <Info size={12} />
                </div>
              </div>
            </div>

            <div className="pollutant-value-row mt-3 flex items-baseline gap-1.5">
              <span className="pollutant-num text-2xl font-bold font-mono text-foreground">
                {item.value}
              </span>
              <span className="pollutant-unit text-xs text-muted-foreground font-mono">
                {item.unit}
              </span>
              <span className="text-[11px] text-muted-foreground font-medium ml-auto">
                Safe: ≤ {item.safeMax} {item.unit}
              </span>
            </div>

            <div className="pollutant-progress-track mt-2.5 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="pollutant-progress-fill h-full rounded-full transition-all duration-500"
                style={{
                  width: `${item.progress}%`,
                  backgroundColor: item.statusColor,
                }}
              />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
            <p className="pollutant-footer line-clamp-2 leading-relaxed flex-1 mr-2">
              {item.desc}
            </p>
            <span className="text-[10px] text-primary/80 group-hover:text-primary font-semibold shrink-0 flex items-center gap-0.5">
              <span>Learn more</span>
              <span aria-hidden="true">→</span>
            </span>
          </div>
        </div>
      </TooltipTrigger>

      <TooltipContent
        side="top"
        align="center"
        sideOffset={8}
        className="max-w-[340px] sm:max-w-[420px] p-4 bg-slate-900/95 text-slate-100 border border-slate-700/80 shadow-2xl rounded-2xl backdrop-blur-md text-xs pointer-events-auto select-text"
      >
        {/* Tooltip Header */}
        <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-slate-700/80 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-white font-display">
              {item.name}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-mono text-[11px] font-semibold border border-slate-700">
              {item.formula}
            </span>
          </div>
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-bold"
            style={{
              backgroundColor: `${item.statusColor}22`,
              color: item.statusColor,
              border: `1px solid ${item.statusColor}60`,
            }}
          >
            {item.status} ({item.value} {item.unit})
          </span>
        </div>

        {/* Primary Sources Section */}
        <div className="mb-3">
          <div className="flex items-center gap-1.5 text-amber-300 font-semibold text-[11px] uppercase tracking-wider mb-1.5">
            <Factory size={13} className="text-amber-400" />
            <span>Primary Emission Sources</span>
          </div>
          <ul className="space-y-1 text-slate-300 pl-4 list-disc text-[11px] leading-relaxed">
            {item.sources.map((source, idx) => (
              <li key={idx}>{source}</li>
            ))}
          </ul>
        </div>

        {/* Specific Health Risks Section */}
        <div className="mb-3 pt-2.5 border-t border-slate-800">
          <div className="flex items-center gap-1.5 text-rose-300 font-semibold text-[11px] uppercase tracking-wider mb-1.5">
            <HeartPulse size={13} className="text-rose-400" />
            <span>Specific Health Risks</span>
          </div>
          <ul className="space-y-1 text-slate-300 pl-4 list-disc text-[11px] leading-relaxed">
            {item.healthRisks.map((risk, idx) => (
              <li key={idx}>{risk}</li>
            ))}
          </ul>
        </div>

        {/* Safety Guideline Footer */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
          <span className="flex items-center gap-1 text-emerald-400 font-medium">
            <ShieldCheck size={12} />
            <span>{item.guideline}</span>
          </span>
          <span className="font-mono text-slate-500">WHO / EPA standard</span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export default PollutantCard;
