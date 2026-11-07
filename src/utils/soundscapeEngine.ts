/**
 * Atmospheric Soundscapes Engine using the Web Audio API
 * Generates procedural, infinite, high-fidelity ambient nature sounds:
 * - Subtle rain & droplets
 * - Natural wind gusts scaled by local wind speed
 * - Daytime singing birds (clear/partly cloudy)
 * - Nighttime crickets (clear night)
 * - Distant rumbling thunder (thunderstorms)
 * - Muffled winter breeze (snow)
 * 100% procedural, 0 external audio file dependencies.
 */

export type SoundscapePreset =
  | 'auto'
  | 'rain'
  | 'thunderstorm'
  | 'wind'
  | 'birds'
  | 'crickets'
  | 'snow';

export interface SoundscapeState {
  preset: SoundscapePreset;
  activeType: 'rain' | 'thunderstorm' | 'wind' | 'birds' | 'crickets' | 'snow';
  label: string;
  subLabel: string;
  isPlaying: boolean;
  volume: number; // 0 to 1
}

/**
 * Determine the dynamic atmospheric soundscape from Open-Meteo weather code and solar day/night
 */
export function getSoundscapeForWeather(
  weatherCode: number,
  isDay: boolean = true,
  windSpeedKmh: number = 12
): {
  activeType: 'rain' | 'thunderstorm' | 'wind' | 'birds' | 'crickets' | 'snow';
  label: string;
  subLabel: string;
} {
  // Thunderstorms (95, 96, 99)
  if ([95, 96, 99].includes(weatherCode)) {
    return {
      activeType: 'thunderstorm',
      label: 'Distant Thunderstorm',
      subLabel: 'Rumbling thunder, heavy rain & gusting wind',
    };
  }

  // Snow (71, 73, 75, 77, 85, 86)
  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) {
    return {
      activeType: 'snow',
      label: 'Winter Snowscape',
      subLabel: 'Muffled winter air & soft crisp wind',
    };
  }

  // Rain / Showers / Drizzle (51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82)
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)) {
    const isHeavy = [65, 67, 82].includes(weatherCode);
    const isDrizzle = [51, 53, 55, 56, 57].includes(weatherCode);
    return {
      activeType: 'rain',
      label: isDrizzle ? 'Gentle Drizzle' : isHeavy ? 'Rain Showers' : 'Ambient Rainfall',
      subLabel: isDrizzle
        ? 'Delicate rain pitter-patter & soft mist'
        : 'Subtle rhythmic raindrops & gentle wind',
    };
  }

  // Strong wind condition (wind speed > 24 km/h)
  if (windSpeedKmh >= 24) {
    return {
      activeType: 'wind',
      label: 'Atmospheric Wind',
      subLabel: `Sweeping gusts (${Math.round(windSpeedKmh)} km/h) & open air`,
    };
  }

  // Clear / Mainly Clear / Partly Cloudy (0, 1, 2)
  if ([0, 1, 2].includes(weatherCode)) {
    if (isDay) {
      return {
        activeType: 'birds',
        label: 'Sunny Nature & Songbirds',
        subLabel: 'Tranquil bird calls & warm afternoon breeze',
      };
    } else {
      return {
        activeType: 'crickets',
        label: 'Nocturnal Sky & Crickets',
        subLabel: 'Gentle night insects & peaceful night breeze',
      };
    }
  }

  // Overcast or Fog (3, 45, 48)
  return {
    activeType: 'wind',
    label: isDay ? 'Atmospheric Breeze' : 'Evening Breeze',
    subLabel: 'Gentle open air & calm ambient drift',
  };
}

class AtmosphericSoundscapeEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  // Sound generator gains
  private rainGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private birdGain: GainNode | null = null;
  private cricketGain: GainNode | null = null;
  private thunderGain: GainNode | null = null;

  // Periodic timers for stochastic events (bird calls, crickets, thunder, rain drops)
  private birdTimer: number | null = null;
  private cricketTimer: number | null = null;
  private thunderTimer: number | null = null;
  private dropletTimer: number | null = null;
  private windLfoTimer: number | null = null;

  // Filter nodes
  private windFilter: BiquadFilterNode | null = null;
  private rainFilter: BiquadFilterNode | null = null;

  // Active state
  private isRunning = false;
  private currentVolume = 0.35;
  private activeType: 'rain' | 'thunderstorm' | 'wind' | 'birds' | 'crickets' | 'snow' = 'birds';
  private currentWindSpeed = 12;

  private initContext() {
    if (this.ctx) return;
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    this.ctx = new AudioContextClass();

    // Master Gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.currentVolume, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    // Create Stereo Pink/White Noise Buffer (4 seconds loop)
    const bufferSize = this.ctx.sampleRate * 4;
    const noiseBuffer = this.ctx.createBuffer(2, bufferSize, this.ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = noiseBuffer.getChannelData(channel);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Paul Kellet's filtered pink noise approximation
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    }

    // --- Rain Layer ---
    const rainSource = this.ctx.createBufferSource();
    rainSource.buffer = noiseBuffer;
    rainSource.loop = true;

    this.rainFilter = this.ctx.createBiquadFilter();
    this.rainFilter.type = 'bandpass';
    this.rainFilter.frequency.setValueAtTime(1400, this.ctx.currentTime);
    this.rainFilter.Q.setValueAtTime(1.2, this.ctx.currentTime);

    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.setValueAtTime(0, this.ctx.currentTime);

    rainSource.connect(this.rainFilter);
    this.rainFilter.connect(this.rainGain);
    this.rainGain.connect(this.masterGain);
    rainSource.start();

    // --- Wind Layer ---
    const windSource = this.ctx.createBufferSource();
    windSource.buffer = noiseBuffer;
    windSource.loop = true;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.setValueAtTime(320, this.ctx.currentTime);
    this.windFilter.Q.setValueAtTime(3.5, this.ctx.currentTime);

    this.windGain = this.ctx.createGain();
    this.windGain.gain.setValueAtTime(0, this.ctx.currentTime);

    windSource.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.masterGain);
    windSource.start();

    // --- Birds / Nature Layer Gain ---
    this.birdGain = this.ctx.createGain();
    this.birdGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.birdGain.connect(this.masterGain);

    // --- Crickets Layer Gain ---
    this.cricketGain = this.ctx.createGain();
    this.cricketGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.cricketGain.connect(this.masterGain);

    // --- Thunder Layer Gain ---
    this.thunderGain = this.ctx.createGain();
    this.thunderGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.thunderGain.connect(this.masterGain);

    // Start Wind Gust LFO modulation
    this.startWindModulation();
  }

  private startWindModulation() {
    if (this.windLfoTimer) clearInterval(this.windLfoTimer);
    this.windLfoTimer = window.setInterval(() => {
      if (!this.ctx || !this.windFilter || !this.isRunning) return;
      const t = this.ctx.currentTime;
      // Modulate wind cutoff between 220Hz and 650Hz based on wind speed
      const baseFreq = Math.min(550, 220 + this.currentWindSpeed * 12);
      const targetFreq = baseFreq + (Math.random() - 0.5) * 180;
      this.windFilter.frequency.cancelScheduledValues(t);
      this.windFilter.frequency.linearRampToValueAtTime(targetFreq, t + 2.5);
    }, 2800);
  }

  /**
   * Synthesize a single organic bird chirp (FM modulated sine sweep)
   */
  private triggerBirdChirp() {
    if (!this.ctx || !this.birdGain || !this.isRunning) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const chirpGain = this.ctx.createGain();

      // Pitch sweep: e.g. 2600Hz -> 4200Hz -> 3100Hz
      const startFreq = 2600 + Math.random() * 500;
      const peakFreq = startFreq + 1200 + Math.random() * 800;
      const endFreq = startFreq - 200 + Math.random() * 400;
      const duration = 0.09 + Math.random() * 0.07;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(peakFreq, now + duration * 0.45);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);

      // Volume envelope
      chirpGain.gain.setValueAtTime(0.001, now);
      chirpGain.gain.linearRampToValueAtTime(0.18 + Math.random() * 0.08, now + 0.015);
      chirpGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(chirpGain);
      chirpGain.connect(this.birdGain);

      osc.start(now);
      osc.stop(now + duration + 0.02);

      // Random secondary chirp pulse 100ms later (call-response)
      if (Math.random() > 0.4) {
        setTimeout(() => {
          if (!this.ctx || !this.birdGain || !this.isRunning) return;
          const now2 = this.ctx.currentTime;
          const osc2 = this.ctx.createOscillator();
          const chirpGain2 = this.ctx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(startFreq * 1.1, now2);
          osc2.frequency.exponentialRampToValueAtTime(peakFreq * 1.05, now2 + 0.04);
          osc2.frequency.exponentialRampToValueAtTime(endFreq * 1.1, now2 + 0.08);

          chirpGain2.gain.setValueAtTime(0.001, now2);
          chirpGain2.gain.linearRampToValueAtTime(0.14, now2 + 0.01);
          chirpGain2.gain.exponentialRampToValueAtTime(0.001, now2 + 0.08);

          osc2.connect(chirpGain2);
          chirpGain2.connect(this.birdGain);
          osc2.start(now2);
          osc2.stop(now2 + 0.1);
        }, 80 + Math.random() * 90);
      }
    } catch {
      // Audio node cleanup
    }
  }

  /**
   * Synthesize a gentle cricket chirp pattern (nighttime)
   */
  private triggerCricketChirp() {
    if (!this.ctx || !this.cricketGain || !this.isRunning) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const cricketAmp = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(4500 + (Math.random() - 0.5) * 300, now);

      // Triple pulse chirp
      const pulseDuration = 0.035;
      cricketAmp.gain.setValueAtTime(0.001, now);
      for (let i = 0; i < 3; i++) {
        const t = now + i * 0.055;
        cricketAmp.gain.linearRampToValueAtTime(0.08, t + 0.01);
        cricketAmp.gain.linearRampToValueAtTime(0.001, t + pulseDuration);
      }

      osc.connect(cricketAmp);
      cricketAmp.connect(this.cricketGain);

      osc.start(now);
      osc.stop(now + 0.22);
    } catch {
      // Audio error safety
    }
  }

  /**
   * Synthesize a deep rumbling thunder roll
   */
  private triggerThunderRoll() {
    if (!this.ctx || !this.thunderGain || !this.isRunning) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const thunderAmp = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(110, now);
      filter.Q.setValueAtTime(4.0, now);

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(85, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 3.8);

      thunderAmp.gain.setValueAtTime(0.001, now);
      thunderAmp.gain.linearRampToValueAtTime(0.28, now + 0.6);
      thunderAmp.gain.exponentialRampToValueAtTime(0.001, now + 4.2);

      osc.connect(filter);
      filter.connect(thunderAmp);
      thunderAmp.connect(this.thunderGain);

      osc.start(now);
      osc.stop(now + 4.5);
    } catch {
      // Audio error safety
    }
  }

  /**
   * Start scheduling background events based on active soundscape
   */
  private scheduleAtmosphericEvents() {
    if (this.birdTimer) clearInterval(this.birdTimer);
    if (this.cricketTimer) clearInterval(this.cricketTimer);
    if (this.thunderTimer) clearInterval(this.thunderTimer);

    if (!this.isRunning) return;

    if (this.activeType === 'birds') {
      const runBirdCycle = () => {
        if (!this.isRunning || this.activeType !== 'birds') return;
        this.triggerBirdChirp();
        const nextDelay = 2800 + Math.random() * 4200;
        this.birdTimer = window.setTimeout(runBirdCycle, nextDelay);
      };
      this.birdTimer = window.setTimeout(runBirdCycle, 1200);
    } else if (this.activeType === 'crickets') {
      const runCricketCycle = () => {
        if (!this.isRunning || this.activeType !== 'crickets') return;
        this.triggerCricketChirp();
        const nextDelay = 1800 + Math.random() * 2600;
        this.cricketTimer = window.setTimeout(runCricketCycle, nextDelay);
      };
      this.cricketTimer = window.setTimeout(runCricketCycle, 1000);
    } else if (this.activeType === 'thunderstorm') {
      const runThunderCycle = () => {
        if (!this.isRunning || this.activeType !== 'thunderstorm') return;
        this.triggerThunderRoll();
        const nextDelay = 7000 + Math.random() * 9000;
        this.thunderTimer = window.setTimeout(runThunderCycle, nextDelay);
      };
      this.thunderTimer = window.setTimeout(runThunderCycle, 2000);
    }
  }

  /**
   * Crossfade sound layers dynamically based on target soundscape
   */
  public updateSoundscape(
    type: 'rain' | 'thunderstorm' | 'wind' | 'birds' | 'crickets' | 'snow',
    windSpeedKmh: number = 12
  ) {
    this.activeType = type;
    this.currentWindSpeed = windSpeedKmh;

    if (!this.ctx || !this.isRunning) return;
    const now = this.ctx.currentTime;
    const fadeDuration = 1.4;

    // Target gain targets
    let targetRain = 0;
    let targetWind = 0;
    let targetBirds = 0;
    let targetCrickets = 0;
    let targetThunder = 0;

    const windIntensity = Math.min(1.0, 0.2 + windSpeedKmh / 35);

    switch (type) {
      case 'rain':
        targetRain = 0.55;
        targetWind = 0.25 * windIntensity;
        break;
      case 'thunderstorm':
        targetRain = 0.65;
        targetWind = 0.45 * windIntensity;
        targetThunder = 0.7;
        break;
      case 'wind':
        targetWind = 0.6 * windIntensity;
        break;
      case 'birds':
        targetBirds = 0.65;
        targetWind = 0.18;
        break;
      case 'crickets':
        targetCrickets = 0.55;
        targetWind = 0.16;
        break;
      case 'snow':
        targetWind = 0.32;
        break;
    }

    // Smoothly ramp gains to prevent audio clicking
    const ramp = (node: GainNode | null, targetVal: number) => {
      if (!node) return;
      node.gain.cancelScheduledValues(now);
      node.gain.linearRampToValueAtTime(targetVal, now + fadeDuration);
    };

    ramp(this.rainGain, targetRain);
    ramp(this.windGain, targetWind);
    ramp(this.birdGain, targetBirds);
    ramp(this.cricketGain, targetCrickets);
    ramp(this.thunderGain, targetThunder);

    this.scheduleAtmosphericEvents();
  }

  /**
   * Start / Resume audio playback
   */
  public async play(
    type: 'rain' | 'thunderstorm' | 'wind' | 'birds' | 'crickets' | 'snow',
    windSpeedKmh: number = 12
  ) {
    this.initContext();
    if (!this.ctx) return;

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    this.isRunning = true;
    this.updateSoundscape(type, windSpeedKmh);
  }

  /**
   * Stop / Mute audio playback
   */
  public stop() {
    this.isRunning = false;
    if (this.birdTimer) clearTimeout(this.birdTimer);
    if (this.cricketTimer) clearTimeout(this.cricketTimer);
    if (this.thunderTimer) clearTimeout(this.thunderTimer);

    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const fade = 0.6;

    const zero = (node: GainNode | null) => {
      if (!node) return;
      node.gain.cancelScheduledValues(now);
      node.gain.linearRampToValueAtTime(0, now + fade);
    };

    zero(this.rainGain);
    zero(this.windGain);
    zero(this.birdGain);
    zero(this.cricketGain);
    zero(this.thunderGain);
  }

  /**
   * Set Master Volume (0.0 to 1.0)
   */
  public setVolume(vol: number) {
    this.currentVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.linearRampToValueAtTime(this.currentVolume, this.ctx.currentTime + 0.1);
    }
  }

  public getIsPlaying(): boolean {
    return this.isRunning;
  }
}

// Global Singleton Engine
export const soundscapeEngine = new AtmosphericSoundscapeEngine();
