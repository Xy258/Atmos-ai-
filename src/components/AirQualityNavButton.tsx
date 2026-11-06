import React from 'react';
import { Activity, Globe2 } from 'lucide-react';
import { useLongPress } from '../hooks/useLongPress';

interface AirQualityNavButtonProps {
  isMobile: boolean;
  isActive: boolean;
  onClick: () => void;
  onOpenGlobe: () => void;
}

export function AirQualityNavButton({
  isMobile,
  isActive,
  onClick,
  onOpenGlobe,
}: AirQualityNavButtonProps) {
  const { isPressing, pressProgress, handlers } = useLongPress({
    threshold: 480,
    onLongPress: onOpenGlobe,
    onClick,
  });

  const circleRadius = isMobile ? 18 : 19;
  const strokeWidth = 3;
  const circumference = 2 * Math.PI * circleRadius;
  const strokeDashoffset = circumference - pressProgress * circumference;

  if (isMobile) {
    return (
      <button
        {...handlers}
        type="button"
        className={`relative ${isActive ? 'active' : ''} mobile-nav-air-yellow`}
        data-testid="mobile-nav-air-quality"
        aria-label="Air Quality (Hold to open 3D Earth Globe)"
        title="Tap for Air Quality · Hold for 3D Earth Globe"
      >
        <div className="air-big-round-icon-mobile relative">
          {/* Circular SVG charging ring on hold */}
          {isPressing && (
            <svg
              className="absolute -inset-1 w-[42px] h-[42px] -rotate-90 pointer-events-none z-10"
              viewBox="0 0 44 44"
            >
              <circle
                cx="22"
                cy="22"
                r={circleRadius}
                fill="none"
                stroke="rgba(56, 189, 248, 0.3)"
                strokeWidth={strokeWidth}
              />
              <circle
                cx="22"
                cy="22"
                r={circleRadius}
                fill="none"
                stroke="#38bdf8"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>
          )}
          <Activity size={22} />
        </div>
        <span>Air Quality</span>

        {/* Long press tooltip feedback */}
        {isPressing && (
          <div
            className="absolute -top-11 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-md bg-slate-900 text-amber-300 text-[11px] font-semibold tracking-wide border border-amber-400/50 shadow-xl whitespace-nowrap pointer-events-none z-50 flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-100"
          >
            <Globe2 size={13} className="text-sky-400 animate-spin" />
            <span>{pressProgress >= 0.95 ? 'Opening 3D Globe!' : 'Hold for 3D Globe...'}</span>
          </div>
        )}
      </button>
    );
  }

  // Desktop Sidebar Button
  return (
    <button
      {...handlers}
      type="button"
      className={`relative group ${isActive ? 'active' : ''} side-nav-air-yellow`}
      data-testid="nav-air-quality"
      aria-label="Air Quality (Hold for 3D Earth Globe)"
      title="Click for Air Quality · Long press for 3D Earth Globe"
    >
      <div className="air-big-round-icon relative">
        {/* Circular SVG charging ring on hold */}
        {isPressing && (
          <svg
            className="absolute -inset-1 w-[44px] h-[44px] -rotate-90 pointer-events-none z-10"
            viewBox="0 0 44 44"
          >
            <circle
              cx="22"
              cy="22"
              r={circleRadius}
              fill="none"
              stroke="rgba(56, 189, 248, 0.3)"
              strokeWidth={strokeWidth}
            />
            <circle
              cx="22"
              cy="22"
              r={circleRadius}
              fill="none"
              stroke="#38bdf8"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </svg>
        )}
        <Activity size={22} />
      </div>

      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center justify-between w-full">
          <span className="font-medium text-slate-100">Air Quality</span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30 flex items-center gap-0.5 font-data"
            title="Long press to launch 3D Globe"
          >
            <Globe2 size={10} />
            <span>3D</span>
          </span>
        </div>
        <span className="text-[10px] text-slate-400 opacity-80 group-hover:opacity-100 transition truncate">
          Hold for 3D Globe
        </span>
      </div>

      {/* Long press tooltip feedback */}
      {isPressing && (
        <div
          className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg bg-slate-900 text-amber-300 text-xs font-semibold tracking-wide border border-amber-400/60 shadow-2xl whitespace-nowrap pointer-events-none z-50 flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-100"
        >
          <Globe2 size={14} className="text-sky-400 animate-spin" />
          <span>{pressProgress >= 0.95 ? 'Launching 3D Globe!' : 'Hold for 3D Earth Globe...'}</span>
        </div>
      )}
    </button>
  );
}

export default AirQualityNavButton;
