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
  CloudFog,
  Timer,
  Sliders,
} from 'lucide-react';
import {
  soundscapeEngine,
  getSoundscapeForWeather,
  type SoundscapePreset,
  type SoundscapeType,
  type AcousticMixFocus,
} from '@/utils/soundscapeEngine';

export { type SoundscapePreset, type AcousticMixFocus } from '@/utils/soundscapeEngine';

interface SoundscapeSnapshot {
  isEnabled: boolean;
  preset: SoundscapePreset;
  volume: number;
  mixFocus: AcousticMixFocus;
  sleepMinutes: number; // 0 = off, 15, 30, 60
  sleepSecondsLeft: number;
}

/**
 * Singleton soundscape store using React's useSyncExternalStore pattern.
 * Ensures multiple components (topbar button & Settings panel) read/write a
 * single source of truth without triggering cross-component render warnings.
 */
class SoundscapeStore {
  private snapshot: SoundscapeSnapshot;
  private listeners = new Set<() => void>();
  private weatherCode = 0;
  private isDay = true;
  private windSpeedKmh = 12;
  private sleepEndsAt: number | null = null;
  private sleepIntervalId: number | null = null;
  private unlockAttached = false;

  constructor() {
    let isEnabled = false;
    let preset: SoundscapePreset = 'auto';
    let volume = 0.35;
    let mixFocus: AcousticMixFocus = 'balanced';

    try {
      isEnabled = localStorage.getItem('atmos_soundscape_enabled') === 'true';
      preset = (localStorage.getItem('atmos_soundscape_preset') as SoundscapePreset) || 'auto';
      const v = localStorage.getItem('atmos_soundscape_volume');
      if (v) volume = Math.max(0.05, Math.min(1, parseFloat(v)));
      const mf = localStorage.getItem('atmos_soundscape_mix') as AcousticMixFocus | null;
      if (mf === 'balanced' || mf === 'weather' || mf === 'nature') {
        mixFocus = mf;
      }
    } catch {
      // ignore storage errors
    }

    this.snapshot = {
      isEnabled,
      preset,
      volume,
      mixFocus,
      sleepMinutes: 0,
      sleepSecondsLeft: 0,
    };

    soundscapeEngine.setMixFocus(mixFocus);
    if (isEnabled && typeof window !== 'undefined') {
      this.attachGestureUnlock();
    }
  }

  private attachGestureUnlock() {
    if (this.unlockAttached || typeof window === 'undefined') return;
    this.unlockAttached = true;

    const unlock = () => {
      this.unlockAttached = false;
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      if (this.snapshot.isEnabled) {
        this.syncAudio();
      }
    };

    window.addEventListener('pointerdown', unlock, { capture: true, passive: true });
    window.addEventListener('keydown', unlock, { capture: true, passive: true });
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
    if (this.snapshot.isEnabled) {
      this.syncAudio();
    }
  }

  public syncAudio() {
    if (!this.snapshot.isEnabled) {
      soundscapeEngine.stop();
      return;
    }
    const dynamic = getSoundscapeForWeather(this.weatherCode, this.isDay, this.windSpeedKmh);
    const activeType = this.snapshot.preset === 'auto' ? dynamic.activeType : this.snapshot.preset;
    soundscapeEngine.setVolume(this.snapshot.volume);
    soundscapeEngine.setMixFocus(this.snapshot.mixFocus);
    void soundscapeEngine.play(activeType, this.windSpeedKmh, this.weatherCode);
  }

  public setIsEnabled(enabled: boolean) {
    if (this.snapshot.isEnabled === enabled) return;
    this.snapshot = {
      ...this.snapshot,
      isEnabled: enabled,
      ...(enabled ? {} : { sleepMinutes: 0, sleepSecondsLeft: 0 }),
    };
    if (!enabled) {
      this.sleepEndsAt = null;
      this.clearSleepTimerInterval();
    }
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

  public setMixFocus(mixFocus: AcousticMixFocus) {
    if (this.snapshot.mixFocus === mixFocus) return;
    this.snapshot = { ...this.snapshot, mixFocus };
    try {
      localStorage.setItem('atmos_soundscape_mix', mixFocus);
    } catch {
      // ignore
    }
    soundscapeEngine.setMixFocus(mixFocus);
    this.notify();
  }

  private clearSleepTimerInterval() {
    if (this.sleepIntervalId !== null) {
      window.clearInterval(this.sleepIntervalId);
      this.sleepIntervalId = null;
    }
  }

  public setSleepTimer(minutes: number) {
    this.clearSleepTimerInterval();
    if (minutes <= 0) {
      this.sleepEndsAt = null;
      this.snapshot = { ...this.snapshot, sleepMinutes: 0, sleepSecondsLeft: 0 };
      this.notify();
      return;
    }

    const totalSec = minutes * 60;
    this.sleepEndsAt = Date.now() + totalSec * 1000;
    this.snapshot = {
      ...this.snapshot,
      isEnabled: true,
      sleepMinutes: minutes,
      sleepSecondsLeft: totalSec,
    };

    try {
      localStorage.setItem('atmos_soundscape_enabled', 'true');
    } catch {
      // ignore
    }
    this.syncAudio();
    this.notify();

    this.sleepIntervalId = window.setInterval(() => {
      if (this.sleepEndsAt === null) {
        this.clearSleepTimerInterval();
        return;
      }
      const remainingSec = Math.max(0, Math.ceil((this.sleepEndsAt - Date.now()) / 1000));
      if (remainingSec <= 0) {
        this.sleepEndsAt = null;
        this.clearSleepTimerInterval();
        this.setIsEnabled(false);
      } else if (remainingSec !== this.snapshot.sleepSecondsLeft) {
        this.snapshot = { ...this.snapshot, sleepSecondsLeft: remainingSec };
        this.notify();
      }
    }, 1000);
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

  const activeType = useMemo<SoundscapeType>(() => {
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
      case 'fog':
        return 'Quiet Fog & Dew';
      default:
        return dynamicWeatherSound.label;
    }
  }, [storeState.preset, dynamicWeatherSound.label]);

  const sleepRemainingLabel = useMemo(() => {
    if (!storeState.isEnabled || storeState.sleepMinutes <= 0 || storeState.sleepSecondsLeft <= 0) {
      return null;
    }
    const mins = Math.floor(storeState.sleepSecondsLeft / 60);
    const secs = storeState.sleepSecondsLeft % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [storeState.sleepSecondsLeft, storeState.sleepMinutes, storeState.isEnabled]);

  return {
    isEnabled: storeState.isEnabled,
    setIsEnabled: (val: boolean) => soundscapeStore.setIsEnabled(val),
    toggleEnabled: () => soundscapeStore.toggleEnabled(),
    preset: storeState.preset,
    setPreset: (p: SoundscapePreset) => soundscapeStore.setPreset(p),
    volume: storeState.volume,
    setVolume: (v: number) => soundscapeStore.setVolume(v),
    mixFocus: storeState.mixFocus,
    setMixFocus: (m: AcousticMixFocus) => soundscapeStore.setMixFocus(m),
    sleepMinutes: storeState.sleepMinutes,
    setSleepTimer: (mins: number) => soundscapeStore.setSleepTimer(mins),
    sleepRemainingLabel,
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
      return <Wind size={size} className="text-teal-400 shrink-0" />;
    case 'birds':
      return <Bird size={size} className="text-amber-400 shrink-0" />;
    case 'crickets':
      return <Moon size={size} className="text-indigo-400 shrink-0" />;
    case 'snow':
      return <Snowflake size={size} className="text-sky-300 shrink-0" />;
    case 'fog':
      return <CloudFog size={size} className="text-slate-400 shrink-0" />;
    default:
      return <Sparkles size={size} className="text-amber-400 shrink-0" />;
  }
}

/**
 * Atmospheric Audio Simple Toggle for Today View:
 * Strictly toggles audio ON and OFF with a single click.
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
      {isEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
    </button>
  );
}

/**
 * Complete Soundscape & Audio Settings Section for the Settings Tab:
 * Master power switch, volume slider, acoustic balance, sleep timer, live cues, and presets.
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
    mixFocus,
    setMixFocus,
    sleepMinutes,
    setSleepTimer,
    sleepRemainingLabel,
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
      desc: 'Follows live local weather code, wind speed & solar day/night',
      type: 'auto',
    },
    {
      id: 'rain',
      title: 'Rain & Showers',
      desc: 'Multi-band spatial rainfall with scattered stereo water droplets',
      type: 'rain',
    },
    {
      id: 'thunderstorm',
      title: 'Thunderstorm',
      desc: 'Rolling sub-bass thunder swells, heavy showers & brisk gusts',
      type: 'thunderstorm',
    },
    {
      id: 'wind',
      title: 'Atmospheric Wind',
      desc: 'Sweeping dual-band wind gusts drifting across stereo channels',
      type: 'wind',
    },
    {
      id: 'birds',
      title: 'Sunny Songbirds',
      desc: 'Warm afternoon breeze with melodic stereo forest bird phrases',
      type: 'birds',
    },
    {
      id: 'crickets',
      title: 'Night Crickets',
      desc: 'Evening breeze paired with harmonic rhythmic night field crickets',
      type: 'crickets',
    },
    {
      id: 'snow',
      title: 'Winter Snowscape',
      desc: 'Hushed winter air stillness with delicate crystalline frost chimes',
      type: 'snow',
    },
    {
      id: 'fog',
      title: 'Fog & Quiet Dew',
      desc: 'Muted vapor mist ambience with sparse, calm water droplets',
      type: 'fog',
    },
  ];

  const mixOptions: Array<{ id: AcousticMixFocus; label: string }> = [
    { id: 'balanced', label: 'Balanced' },
    { id: 'weather', label: 'Rain & Wind' },
    { id: 'nature', label: 'Nature & Drops' },
  ];

  const sleepOptions = [
    { mins: 0, label: 'Off' },
    { mins: 15, label: '15m' },
    { mins: 30, label: '30m' },
    { mins: 60, label: '60m' },
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
            Spatial ambient nature audio synchronized with live weather conditions
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
                ? 'Audio is active. You can also mute or unmute quickly from the topbar in Today.'
                : 'Audio is muted. Turn on to hear spatial rainfall, wind gusts, thunder, and nature calls.'}
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
              ? 'bg-amber-500/10 border-amber-400/30 shadow-[0_0_15px_rgba(251,191,36,0.08)]'
              : 'bg-black/[0.03] dark:bg-white/5 border-black/10 dark:border-white/10'
          }`}
          data-testid="status-soundscape-live-banner"
        >
          <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono font-semibold uppercase tracking-wider">
                {isEnabled ? 'Now Playing' : 'Standby'}
              </span>
              {preset === 'auto' && isEnabled && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-amber-500 dark:text-amber-300 font-medium">
                    Auto Weather Sync
                  </span>
                </>
              )}
              {sleepRemainingLabel && isEnabled && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums text-sky-500 dark:text-sky-300 font-medium">
                    Sleep in {sleepRemainingLabel}
                  </span>
                </>
              )}
            </div>
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
              ? `${dynamicWeatherSound.subLabel} · Code ${weatherCode} · Wind ${Math.round(windSpeedKmh)} km/h`
              : 'Manual ambient preset active · Switch back to Auto Weather Sync anytime.'}
          </p>
        </div>

        {/* Master Volume Range Slider */}
        <div className="settings-row">
          <div>
            <div className="settings-row-label">Master Volume</div>
            <div className="settings-row-sub">
              Output level: <strong className="text-foreground font-mono tabular-nums">{Math.round(volume * 100)}%</strong>
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
              className="w-full accent-amber-400 h-2 bg-black/10 dark:bg-white/10 rounded-lg cursor-pointer"
              aria-label="Soundscape volume"
              data-testid="slider-soundscape-volume"
            />
            <Volume2 size={16} className="text-amber-500 dark:text-amber-400 shrink-0" />
            <span className="font-mono tabular-nums text-xs font-semibold w-10 text-right text-foreground">
              {Math.round(volume * 100)}%
            </span>
          </div>
        </div>

        {/* Acoustic Mix Balance */}
        <div className="settings-row">
          <div>
            <div className="settings-row-label flex items-center gap-1.5">
              <Sliders size={13} className="text-amber-500 dark:text-amber-400" />
              <span>Acoustic Layer Balance</span>
            </div>
            <div className="settings-row-sub">
              Emphasize continuous rain/wind ambience or spatial droplets, thunder & wildlife
            </div>
          </div>
          <div className="segmented-group">
            {mixOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`segmented-btn ${mixFocus === opt.id ? 'active' : ''}`}
                onClick={() => setMixFocus(opt.id)}
                data-testid={`button-soundscape-mix-${opt.id}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sleep Timer */}
        <div className="settings-row">
          <div>
            <div className="settings-row-label flex items-center gap-1.5">
              <Timer size={13} className="text-sky-500 dark:text-sky-400" />
              <span>Ambient Sleep Timer</span>
            </div>
            <div className="settings-row-sub">
              {sleepRemainingLabel
                ? `Automatically fades out and mutes in ${sleepRemainingLabel}`
                : 'Play continuously or schedule an automatic fade-out'}
            </div>
          </div>
          <div className="segmented-group">
            {sleepOptions.map((opt) => (
              <button
                key={opt.mins}
                type="button"
                className={`segmented-btn ${sleepMinutes === opt.mins ? 'active' : ''}`}
                onClick={() => setSleepTimer(opt.mins)}
                data-testid={`button-soundscape-sleep-${opt.mins}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Soundscape Source Presets */}
        <div style={{ marginTop: 8 }}>
          <div className="settings-row-label" style={{ marginBottom: 4 }}>
            Soundscape Source & Atmosphere
          </div>
          <div className="settings-row-sub" style={{ marginBottom: 12 }}>
            Track live local weather automatically or lock into a preferred ambient environment
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {presetsList.map((item) => {
              const isSelected = preset === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPreset(item.id)}
                  className={`flex flex-col text-left p-3 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-400/50 text-foreground shadow-[0_0_12px_rgba(251,191,36,0.12)] ring-1 ring-amber-400/30'
                      : 'bg-black/[0.025] dark:bg-white/5 border-black/10 dark:border-white/10 hover:bg-black/[0.05] dark:hover:bg-white/10 text-muted-foreground hover:text-foreground'
                  }`}
                  data-testid={`button-soundscape-preset-${item.id}`}
                >
                  <div className="flex items-center justify-between w-full mb-1 gap-2">
                    <div className="flex items-center gap-1.5 font-medium text-xs text-foreground">
                      {getPresetIcon(item.type, 14)}
                      <span>{item.title}</span>
                    </div>
                    {isSelected && (
                      <span className="text-[10px] font-mono text-amber-600 dark:text-amber-300 font-semibold shrink-0">
                        Active
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
