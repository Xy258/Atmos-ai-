import React from 'react';
import { motion } from 'framer-motion';
import { HeartPulse } from 'lucide-react';

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
  desc?: string;
  sources?: string[];
  healthRisks: string[];
  guideline?: string;
}

interface PollutantCardProps {
  item: PollutantItem;
}

export function PollutantCard({ item }: PollutantCardProps) {
  const isElevated =
    item.status.toLowerCase().includes('elevated') ||
    item.status.toLowerCase().includes('unhealthy') ||
    item.status.toLowerCase().includes('high') ||
    item.status.toLowerCase().includes('danger') ||
    (item.safeMax > 0 && item.raw > item.safeMax);

  return (
    <motion.div
      className={`pollutant-card group transition-all duration-200 select-none ${
        isElevated ? 'border-rose-500/35' : ''
      }`}
      data-testid={`card-pollutant-${item.id}`}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
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

          <span
            className="pollutant-badge text-xs font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1.5 shrink-0"
            style={{
              color: item.statusColor,
              backgroundColor: `${item.statusColor}1f`,
              border: `1px solid ${item.statusColor}40`,
            }}
          >
            {isElevated && (
              <motion.span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: item.statusColor }}
                animate={{
                  opacity: [0.35, 1, 0.35],
                  scale: [0.8, 1.3, 0.8],
                }}
                transition={{
                  duration: 2.2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            )}
            {item.status}
          </span>
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

        <div className="pollutant-progress-track mt-2.5 h-1.5 rounded-full bg-muted overflow-hidden relative">
          {isElevated && (
            <motion.div
              className="absolute inset-y-0 left-0 rounded-full pointer-events-none blur-[2px]"
              style={{
                width: `${item.progress}%`,
                backgroundColor: item.statusColor,
              }}
              animate={{
                opacity: [0.3, 0.8, 0.3],
              }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          )}
          <motion.div
            className="pollutant-progress-fill relative h-full rounded-full"
            style={{
              backgroundColor: item.statusColor,
            }}
            initial={{ width: 0 }}
            animate={{
              width: `${item.progress}%`,
              opacity: isElevated ? [0.8, 1, 0.8] : 1,
              boxShadow: isElevated
                ? [
                    `0 0 2px ${item.statusColor}40`,
                    `0 0 10px ${item.statusColor}cc, 0 0 3px ${item.statusColor}`,
                    `0 0 2px ${item.statusColor}40`,
                  ]
                : 'none',
            }}
            transition={{
              width: { duration: 0.7, ease: 'easeOut' },
              opacity: isElevated
                ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
                : { duration: 0.3 },
              boxShadow: isElevated
                ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }
                : { duration: 0.3 },
            }}
          />
        </div>

        {/* Health Risks below pollutant card bar in small size */}
        {item.healthRisks && item.healthRisks.length > 0 && (
          <div className="mt-3 pt-2.5 border-t border-border/40">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              <HeartPulse size={12} className={isElevated ? 'text-rose-500' : 'text-primary/80'} />
              <span>Health Risks</span>
            </div>
            <ul className="space-y-1 text-[11px] leading-snug text-muted-foreground/90">
              {item.healthRisks.map((risk, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-primary/40 shrink-0 mt-1.5" />
                  <span>{risk}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default PollutantCard;
