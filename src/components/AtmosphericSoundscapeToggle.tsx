import React, { useEffect, useMemo, useSyncExternalStore } from 'react';
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
} from 'lucide-react';
import {
  soundscapeEngine,
  getSoundscapeForWeather,
  type SoundscapePreset,
} from '@/utils/soundscapeEngine';

export { type SoundscapePreset } from '@/utils/soundscapeEngine';

interface SoundscapeSnapshot {
  isEnabled: boolean;
  preset: SoundscapePreset;
  volume: number;
}

/**
 * Singleton soundscape store using React's useSyncExternalStore pattern.
 * This ensures that multiple components (e.g. topbar on/off button and SettingsTab panel)
 * always read from and write to the same single source of truth without triggering
 * "Cannot update a component while rendering a different component" warnings.
 */
class SoundscapeStore {
  private snapshot: SoundscapeSnapshot;
  private listeners = new Set<() => void>();
  private weatherCode = 0;
  private isDay = true;
  private windSpeedKmh = 12;

  constructor() {
    let isEnabled = false;
    let preset: SoundscapePreset = 'auto';
    let volume = 0.35;

    try {
      isEnabled = localStorage.getItem('atmos_soundscape_enabled') === 'true';
      preset = (localStorage.getItem('atmos_soundscape_preset') as SoundscapePreset) || 'auto';
      const v = localStorage.getItem('atmos_soundscape_volume');
      if (v) volume = Math.max(0.05, Math.min(1, parseFloat(v)));
    } catch {
      // ignore
    }

    this.snapshot = { isEnabled, preset, volume };
  }

  public getSnapshot = (): SoundscapeSnapshot => {
    return this.snapshot;
  };

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private notify() {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        // ignore listener errors
      }
    }
  }

  public updateWeatherParams(weatherCode: number, isDay: boolean, windSpeedKmh: number) {
    if (
      this.weatherCode === weatherCode &&
      this.isDay === isDay &&
      this.windSpeedKmh === windSpeedKmh
    ) {
      return;
    }
    this.weatherCode = weatherCode;
    this.isDay = isDay;
    this.windSpeedKmh = windSpeedKmh;
    this.syncAudio();
  }

  public syncAudio() {
    if (!this.snapshot.isEnabled) {
      soundscapeEngine.stop();
      return;
    }
    const dynamic = getSoundscapeForWeather(this.weatherCode, this.isDay, this.windSpeedKmh);
    const activeType = this.snapshot.preset === 'auto' ? dynamic.activeType : this.snapshot.preset;
    soundscapeEngine.setVolume(this.snapshot.volume);
    soundscapeEngine.play(activeType, this.windSpeedKmh);
  }

  public setIsEnabled(enabled: boolean) {
    if (this.snapshot.isEnabled === enabled) return;
    this.snapshot = { ...this.snapshot, isEnabled: enabled };
    try {
      localStorage.setItem('atmos_soundscape_enabled', String(enabled));
    } catch {
      // ignore
    }
    this.syncAudio();
    this.notify();
  }

  public toggleEnabled() {
    this.setIsEnabled(!this.snapshot.isEnabled);
  }

  public setPreset(preset: SoundscapePreset) {
    if (this.snapshot.preset === preset) return;
    this.snapshot = { ...this.snapshot, preset };
    try {
      localStorage.setItem('atmos_soundscape_preset', preset);
    } catch {
      // ignore
    }
    this.syncAudio();
    this.notify();
  }

  public setVolume(volume: number) {
    const clamped = Math.max(0.05, Math.min(1, volume));
    if (this.snapshot.volume === clamped) return;
    this.snapshot = { ...this.snapshot, volume: clamped };
    try {
      localStorage.setItem('atmos_soundscape_volume', String(clamped));
    } catch {
      // ignore
    }
    soundscapeEngine.setVolume(clamped);
    this.notify();
  }
}

export const soundscapeStore = new SoundscapeStore();

/**
 * Shared hook that maintains soundscape state across all tabs & components
 * via useSyncExternalStore.
 */
export function useAtmosphericSoundscape(
  weatherCode: number = 0,
  isDay: boolean = true,
  windSpeedKmh: number = 12
) {
  const storeState = useSyncExternalStore(
    soundscapeStore.subscribe,
    soundscapeStore.getSnapshot,
    soundscapeStore.getSnapshot
  );

  useEffect(() => {
    soundscapeStore.updateWeatherParams(weatherCode, isDay, windSpeedKmh);
  }, [weatherCode, isDay, windSpeedKmh]);

  const dynamicWeatherSound = useMemo(() => {
    return getSoundscapeForWeather(weatherCode, isDay, windSpeedKmh);
  }, [weatherCode, isDay, windSpeedKmh]);

  const activeType = useMemo<'rain' | 'thunderstorm' | 'wind' | 'birds' | 'crickets' | 'snow'>(() => {
    if (storeState.preset === 'auto') return dynamicWeatherSound.activeType;
    return storeState.preset;
  }, [storeState.preset, dynamicWeatherSound.activeType]);

  const activeLabel = useMemo<string>(() => {
    if (storeState.preset === 'auto') return dynamicWeatherSound.label;
    switch (storeState.preset) {
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
  }, [storeState.preset, dynamicWeatherSound.label]);

  return {
    isEnabled: storeState.isEnabled,
    setIsEnabled: (val: boolean) => soundscapeStore.setIsEnabled(val),
    toggleEnabled: () => soundscapeStore.toggleEnabled(),
    preset: storeState.preset,
    setPreset: (p: SoundscapePreset) => soundscapeStore.setPreset(p),
    volume: storeState.volume,
    setVolume: (v: number) => soundscapeStore.setVolume(v),
    activeType,
    activeLabel,
    dynamicWeatherSound,
  };
}

/**
 * Helper to return icons for presets
 */
export function getPresetIcon(type: string, size = 14) {
  switch (type) {
    case 'rain':
      return <CloudRain size={size} className="text-sky-400 shrink-0" />;
    case 'thunderstorm':
      return <Zap size={size} className="text-amber-400 shrink-0" />;
    case 'wind':
      return <Wind size={size} className="text-teal-300 shrink-0" />;
    case 'birds':
      return <Bird size={size} className="text-amber-300 shrink-0" />;
    case 'crickets':
      return <Moon size={size} className="text-indigo-300 shrink-0" />;
    case 'snow':
      return <Snowflake size={size} className="text-sky-200 shrink-0" />;
    default:
      return <Sparkles size={size} className="text-amber-300 shrink-0" />;
  }
}

/**
 * Atmospheric Audio Simple Toggle for Today View:
 * STRICTLY toggles audio ON and OFF only with a single click. No dropdowns, no popovers.
 */
export function AtmosphericAudioSimpleToggle({
  weatherCode,
  isDay = true,
  windSpeedKmh = 12,
  className = '',
}: {
  weatherCode: number;
  isDay?: boolean;
  windSpeedKmh?: number;
  className?: string;
}) {
  const { isEnabled, toggleEnabled, activeLabel } = useAtmosphericSoundscape(
    weatherCode,
    isDay,
    windSpeedKmh
  );

  return (
    <button
      type="button"
      onClick={toggleEnabled}
      className={`icon-btn atmospheric-audio-toggle ${
        isEnabled ? 'active text-amber-400 bg-amber-500/15 border-amber-400/40 shadow-[0_0_12px_rgba(251,191,36,0.25)]' : ''
      } ${className}`}
      data-testid="button-toggle-atmospheric-audio"
      aria-label={isEnabled ? 'Mute Atmospheric Audio' : 'Enable Atmospheric Audio'}
      title={
        isEnabled
          ? `Atmospheric Audio: Active (${activeLabel}) · Click to mute · Audio settings available in Settings tab`
          : 'Atmospheric Audio: Off · Click to turn on ambient soundscape'
      }
    >
      {isEnabled ? (
        <Volume2 size={16} />
      ) : (
        <VolumeX size={16} />
      )}
    </button>
  );
}

/**
 * Complete Soundscape & Audio Settings Section for the Settings Tab:
 * Displays all controls, master power switch, volume slider, live sync cues, and presets.
 */
export function AtmosphericSoundscapeSettings({
  weatherCode,
  isDay = true,
  windSpeedKmh = 12,
}: {
  weatherCode: number;
  isDay?: boolean;
  windSpeedKmh?: number;
}) {
  const {
    isEnabled,
    setIsEnabled,
    preset,
    setPreset,
    volume,
    setVolume,
    activeType,
    activeLabel,
    dynamicWeatherSound,
  } = useAtmosphericSoundscape(weatherCode, isDay, windSpeedKmh);

  const presetsList: Array<{
    id: SoundscapePreset;
    title: string;
    desc: string;
    type: string;
  }> = [
    {
      id: 'auto',
      title: 'Auto Weather Sync',
      desc: 'Matches live Open-Meteo weather code & solar day/night automatically',
      type: 'auto',
    },
    {
      id: 'rain',
      title: 'Rain & Showers',
      desc: 'Delicate rain pitter-patter, droplets & soft background mist',
      type: 'rain',
    },
    {
      id: 'wind',
      title: 'Atmospheric Wind',
      desc: 'Sweeping ambient wind gusts modulated by local air velocity',
      type: 'wind',
    },
    {
      id: 'birds',
      title: 'Sunny Songbirds',
      desc: 'Warm afternoon breeze & realistic randomized procedural bird chirps',
      type: 'birds',
    },
    {
      id: 'crickets',
      title: 'Night Crickets',
      desc: 'Nocturnal sky, evening breeze & tranquil rhythmic field crickets',
      type: 'crickets',
    },
    {
      id: 'thunderstorm',
      title: 'Thunderstorm',
      desc: 'Deep rumbling bass thunder rolls & rhythmic shower layers',
      type: 'thunderstorm',
    },
    {
      id: 'snow',
      title: 'Winter Snowscape',
      desc: 'Muffled crisp winter atmosphere & soft high-altitude chill',
      type: 'snow',
    },
  ];

  return (
    <section className="settings-section-card" data-testid="card-settings-soundscape">
      <div className="settings-section-header">
        <div
          className="settings-section-icon"
          style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}
        >
          <Volume2 size={18} />
        </div>
        <div>
          <h3 className="settings-section-title">Atmospheric Soundscape & Audio</h3>
          <div className="settings-section-desc">
            Procedural ambient nature audio generated in real time with Web Audio API
          </div>
        </div>
      </div>

      <div className="settings-rows">
        {/* Master Audio Power Toggle */}
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Atmospheric Audio Master</div>
            <div className="settings-row-sub">
              {isEnabled
                ? 'Audio synthesizer is active. You can also quickly mute/unmute from the topbar in Today.'
                : 'Audio is muted. Turn on to hear ambient rainfall, wind gusts, and bird songscapes.'}
            </div>
          </div>
          <div className="segmented-group">
            <button
              type="button"
              className={`segmented-btn ${!isEnabled ? 'active' : ''}`}
              onClick={() => setIsEnabled(false)}
              data-testid="button-soundscape-power-off"
            >
              <VolumeX size={13} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />
              Audio Muted
            </button>
            <button
              type="button"
              className={`segmented-btn ${isEnabled ? 'active' : ''}`}
              onClick={() => setIsEnabled(true)}
              data-testid="button-soundscape-power-on"
            >
              <Volume2 size={13} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />
              Audio Active
            </button>
          </div>
        </div>

        {/* Live Acoustic Cue Banner */}
        <div
          className={`p-3.5 rounded-xl border transition-all ${
            isEnabled
              ? 'bg-amber-500/10 border-amber-400/30 text-amber-100 shadow-[0_0_15px_rgba(251,191,36,0.08)]'
              : 'bg-white/5 border-white/10 text-slate-400'
          }`}
          data-testid="status-soundscape-live-banner"
        >
          <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                {isEnabled && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    isEnabled ? 'bg-amber-400' : 'bg-slate-500'
                  }`}
                />
              </span>
              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-300">
                {isEnabled ? 'Live Acoustic Synthesizer Playing' : 'Audio Engine Standby'}
              </span>
            </div>

            {preset === 'auto' && isEnabled && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-semibold flex items-center gap-1 border border-amber-400/30">
                <Sparkles size={10} /> LIVE WEATHER SYNC
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
            {getPresetIcon(activeType, 16)}
            <span>{activeLabel}</span>
            {isEnabled && (
              <div className="flex items-end gap-0.5 h-3.5 ml-1" aria-hidden="true">
                <span className="w-0.5 bg-amber-400 rounded-full animate-pulse h-2" style={{ animationDuration: '0.6s' }} />
                <span className="w-0.5 bg-amber-400 rounded-full animate-pulse h-3.5" style={{ animationDuration: '0.8s' }} />
                <span className="w-0.5 bg-amber-400 rounded-full animate-pulse h-1.5" style={{ animationDuration: '0.7s' }} />
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground mt-1">
            {preset === 'auto'
              ? `${dynamicWeatherSound.subLabel} (Matched to Open-Meteo code: ${weatherCode}, wind: ${Math.round(windSpeedKmh)} km/h)`
              : 'Manual ambient nature preset override active.'}
          </p>
        </div>

        {/* Master Volume Range Slider */}
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Master Volume</div>
            <div className="settings-row-sub">
              Synthesizer gain output: <strong className="text-foreground">{Math.round(volume * 100)}%</strong>
            </div>
          </div>
          <div style={{ minWidth: 220, display: 'flex', alignItems: 'center', gap: 12 }}>
            <VolumeX size={14} className="text-muted-foreground shrink-0" />
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full accent-amber-400 h-2 bg-white/10 rounded-lg cursor-pointer"
              aria-label="Soundscape volume"
              data-testid="slider-soundscape-volume"
            />
            <Volume2 size={16} className="text-amber-400 shrink-0" />
            <span className="font-mono text-xs font-semibold w-10 text-right text-foreground">
              {Math.round(volume * 100)}%
            </span>
          </div>
        </div>

        {/* Soundscape Source Presets */}
        <div style={{ marginTop: 8 }}>
          <div className="settings-row-label" style={{ marginBottom: 4 }}>
            Soundscape Source & Atmosphere
          </div>
          <div className="settings-row-sub" style={{ marginBottom: 12 }}>
            Select live atmospheric tracking or lock into your favorite procedural nature environment
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {presetsList.map((item) => {
              const isSelected = preset === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPreset(item.id)}
                  className={`flex flex-col text-left p-3 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-400/40 text-foreground shadow-[0_0_12px_rgba(251,191,36,0.15)] ring-1 ring-amber-400/30'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 text-muted-foreground hover:text-foreground'
                  }`}
                  data-testid={`button-soundscape-preset-${item.id}`}
                >
                  <div className="flex items-center justify-between w-full mb-1">
                    <div className="flex items-center gap-1.5 font-medium text-xs text-foreground">
                      {getPresetIcon(item.type, 14)}
                      <span>{item.title}</span>
                    </div>
                    {isSelected && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 font-semibold">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground leading-snug">
                    {item.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Backwards compatibility default export
 */
export const AtmosphericSoundscapeToggle = AtmosphericAudioSimpleToggle;
export default AtmosphericSoundscapeToggle;
