import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Volume2,
  VolumeX,
  Sparkles,
  CloudRain,
  Wind,
  Bird,
  Moon,
  Zap,
  Snowflake,
  ChevronDown,
} from 'lucide-react';
import {
  soundscapeEngine,
  getSoundscapeForWeather,
  type SoundscapePreset,
} from '@/utils/soundscapeEngine';

interface AtmosphericSoundscapeToggleProps {
  weatherCode: number;
  isDay?: boolean;
  windSpeedKmh?: number;
  className?: string;
  variant?: 'topbar' | 'card' | 'badge';
}

export function AtmosphericSoundscapeToggle({
  weatherCode,
  isDay = true,
  windSpeedKmh = 12,
  className = '',
  variant = 'topbar',
}: AtmosphericSoundscapeToggleProps) {
  const [isEnabled, setIsEnabled] = useState(() => {
    try {
      return localStorage.getItem('atmos_soundscape_enabled') === 'true';
    } catch {
      return false;
    }
  });

  const [preset, setPreset] = useState<SoundscapePreset>(() => {
    try {
      return (localStorage.getItem('atmos_soundscape_preset') as SoundscapePreset) || 'auto';
    } catch {
      return 'auto';
    }
  });

  const [volume, setVolume] = useState<number>(() => {
    try {
      const v = localStorage.getItem('atmos_soundscape_volume');
      return v ? Math.max(0.05, Math.min(1, parseFloat(v))) : 0.35;
    } catch {
      return 0.35;
    }
  });

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto weather soundscape determination
  const dynamicWeatherSound = useMemo(() => {
    return getSoundscapeForWeather(weatherCode, isDay, windSpeedKmh);
  }, [weatherCode, isDay, windSpeedKmh]);

  // Effective soundscape type to play
  const activeType = useMemo(() => {
    if (preset === 'auto') return dynamicWeatherSound.activeType;
    return preset;
  }, [preset, dynamicWeatherSound.activeType]);

  const activeLabel = useMemo(() => {
    if (preset === 'auto') return dynamicWeatherSound.label;
    switch (preset) {
      case 'rain':
        return 'Ambient Rain & Showers';
      case 'thunderstorm':
        return 'Distant Thunderstorm';
      case 'wind':
        return 'Atmospheric Wind & Gusts';
      case 'birds':
        return 'Sunny Nature & Songbirds';
      case 'crickets':
        return 'Nocturnal Sky & Crickets';
      case 'snow':
        return 'Winter Snowscape';
      default:
        return dynamicWeatherSound.label;
    }
  }, [preset, dynamicWeatherSound.label]);

  // Sync engine when parameters change
  useEffect(() => {
    if (!isEnabled) {
      soundscapeEngine.stop();
      return;
    }

    soundscapeEngine.setVolume(volume);
    soundscapeEngine.play(activeType, windSpeedKmh);
  }, [isEnabled, activeType, windSpeedKmh, volume]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      // Don't kill audio if just re-rendering, but keep reference
    };
  }, []);

  // Save state
  useEffect(() => {
    try {
      localStorage.setItem('atmos_soundscape_enabled', String(isEnabled));
      localStorage.setItem('atmos_soundscape_preset', preset);
      localStorage.setItem('atmos_soundscape_volume', String(volume));
    } catch {
      // ignore
    }
  }, [isEnabled, preset, volume]);

  // Close popup when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      window.addEventListener('mousedown', handleOutsideClick);
    }
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [isMenuOpen]);

  const toggleSoundscape = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEnabled((prev) => !prev);
  };

  const getPresetIcon = (type: string) => {
    switch (type) {
      case 'rain':
        return <CloudRain size={13} className="text-sky-400" />;
      case 'thunderstorm':
        return <Zap size={13} className="text-amber-400" />;
      case 'wind':
        return <Wind size={13} className="text-teal-300" />;
      case 'birds':
        return <Bird size={13} className="text-amber-300" />;
      case 'crickets':
        return <Moon size={13} className="text-indigo-300" />;
      case 'snow':
        return <Snowflake size={13} className="text-sky-200" />;
      default:
        return <Sparkles size={13} className="text-amber-300" />;
    }
  };

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      {variant === 'card' ? (
        // Atmospheric Card embedded pill button
        <button
          type="button"
          onClick={() => setIsMenuOpen((prev) => !prev)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all backdrop-blur-md border ${
            isEnabled
              ? 'bg-amber-500/15 border-amber-400/40 text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.2)]'
              : 'bg-white/10 border-white/15 text-slate-300 hover:bg-white/15'
          }`}
          data-testid="button-atmospheric-soundscape-card"
          title={isEnabled ? `Soundscape Active: ${activeLabel}` : 'Turn on Atmospheric Soundscape'}
        >
          {isEnabled ? (
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
              </span>
              {getPresetIcon(activeType)}
              <span className="font-mono text-[11px] font-semibold">{activeLabel}</span>
              <div className="flex items-end gap-0.5 h-3 ml-0.5" aria-hidden="true">
                <span className="w-0.5 bg-amber-400 rounded-full animate-pulse h-2" style={{ animationDuration: '0.6s' }} />
                <span className="w-0.5 bg-amber-400 rounded-full animate-pulse h-3" style={{ animationDuration: '0.8s' }} />
                <span className="w-0.5 bg-amber-400 rounded-full animate-pulse h-1.5" style={{ animationDuration: '0.7s' }} />
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <VolumeX size={13} className="opacity-70" />
              <span className="font-mono text-[11px]">Soundscape: Off</span>
            </div>
          )}
          <ChevronDown size={11} className={`transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`} />
        </button>
      ) : (
        // Topbar navigation icon/pill
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleSoundscape}
            className={`icon-btn soundscape-toggle-btn ${
              isEnabled ? 'text-amber-400 bg-amber-500/15 border-amber-400/35' : ''
            }`}
            data-testid="button-toggle-soundscape"
            aria-label={isEnabled ? 'Mute Atmospheric Soundscape' : 'Enable Atmospheric Soundscape'}
            title={
              isEnabled
                ? `Soundscape Active: ${activeLabel} · Click to mute, or tap chevron for settings`
                : 'Turn on Atmospheric Soundscape (procedural ambient rain, wind, birds)'
            }
          >
            {isEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className={`px-1.5 py-1 rounded-md text-[10px] font-mono flex items-center gap-1 border transition-all ${
              isEnabled
                ? 'bg-amber-500/10 border-amber-400/25 text-amber-300'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
            }`}
            data-testid="button-soundscape-menu"
            title="Soundscape Settings & Presets"
          >
            <span className="hidden sm:inline-block max-w-[120px] truncate">
              {isEnabled ? activeLabel : 'Soundscape'}
            </span>
            <ChevronDown size={10} className={`transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      )}

      {/* Floating Soundscape Settings Popover */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 4 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="absolute right-0 top-full mt-2 w-72 p-3.5 rounded-xl shadow-2xl z-50 backdrop-blur-xl border border-white/15 bg-slate-900/90 text-slate-100"
            data-testid="popover-soundscape-menu"
          >
            {/* Header with Master Toggle */}
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${isEnabled ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'}`}>
                  {isEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
                </div>
                <div>
                  <h4 className="text-xs font-semibold leading-tight">Atmospheric Audio</h4>
                  <p className="text-[10px] text-slate-400 leading-tight">Procedural ambient nature</p>
                </div>
              </div>

              {/* Master Power Button */}
              <button
                type="button"
                onClick={() => setIsEnabled((prev) => !prev)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-medium transition-all ${
                  isEnabled
                    ? 'bg-amber-400 text-slate-950 shadow-md font-semibold'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
                data-testid="button-soundscape-power-toggle"
              >
                {isEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            {/* Currently Active Weather Sound Cue */}
            <div className="p-2 rounded-lg bg-white/5 border border-white/10 mb-3 text-xs">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-1">
                <span>DYNAMIC SYNCHRONIZATION</span>
                {preset === 'auto' && (
                  <span className="text-amber-400 flex items-center gap-1 font-semibold">
                    <Sparkles size={9} /> LIVE WEATHER
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 font-medium text-slate-200">
                {getPresetIcon(activeType)}
                <span>{activeLabel}</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">
                {preset === 'auto'
                  ? `${dynamicWeatherSound.subLabel} (Weather Code: ${weatherCode})`
                  : 'Manual ambient preset override active'}
              </p>
            </div>

            {/* Master Volume Slider */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                <span>VOLUME</span>
                <span>{Math.round(volume * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="1"
                step="0.05"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-full accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                aria-label="Soundscape volume"
              />
            </div>

            {/* Soundscape Presets */}
            <div>
              <div className="text-[10px] font-mono text-slate-400 mb-1.5 uppercase tracking-wider">
                Soundscape Source
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setPreset('auto')}
                  className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-left transition-all ${
                    preset === 'auto'
                      ? 'bg-amber-500/20 border-amber-400/40 text-amber-200 font-medium'
                      : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <Sparkles size={12} className="text-amber-400 shrink-0" />
                  <span className="truncate text-[11px]">Auto Weather</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreset('rain')}
                  className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-left transition-all ${
                    preset === 'rain'
                      ? 'bg-amber-500/20 border-amber-400/40 text-amber-200 font-medium'
                      : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <CloudRain size={12} className="text-sky-400 shrink-0" />
                  <span className="truncate text-[11px]">Rain & Showers</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreset('wind')}
                  className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-left transition-all ${
                    preset === 'wind'
                      ? 'bg-amber-500/20 border-amber-400/40 text-amber-200 font-medium'
                      : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <Wind size={12} className="text-teal-300 shrink-0" />
                  <span className="truncate text-[11px]">Atmospheric Wind</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreset('birds')}
                  className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-left transition-all ${
                    preset === 'birds'
                      ? 'bg-amber-500/20 border-amber-400/40 text-amber-200 font-medium'
                      : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <Bird size={12} className="text-amber-300 shrink-0" />
                  <span className="truncate text-[11px]">Songbirds</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreset('crickets')}
                  className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-left transition-all ${
                    preset === 'crickets'
                      ? 'bg-amber-500/20 border-amber-400/40 text-amber-200 font-medium'
                      : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <Moon size={12} className="text-indigo-300 shrink-0" />
                  <span className="truncate text-[11px]">Night Crickets</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreset('thunderstorm')}
                  className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-left transition-all ${
                    preset === 'thunderstorm'
                      ? 'bg-amber-500/20 border-amber-400/40 text-amber-200 font-medium'
                      : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <Zap size={12} className="text-amber-400 shrink-0" />
                  <span className="truncate text-[11px]">Thunderstorm</span>
                </button>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-white/10 text-center text-[10px] text-slate-400 font-mono">
              Pure Web Audio synthesis · No audio files
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default AtmosphericSoundscapeToggle;
