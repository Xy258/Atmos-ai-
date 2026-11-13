/**
 * Atmospheric Soundscapes Engine using the Web Audio API
 * Generates spatial, procedural ambient nature soundscapes:
 * - Multi-band spatial rain + stochastic water droplets
 * - Dual-band sweeping wind gusts with stereo drift modulated by live wind speed
 * - Multi-phrase melodic songbirds (clear/partly cloudy day)
 * - Harmonic field crickets (clear/partly cloudy night)
 * - Multi-stage thunder rumbles + storm downpour (thunderstorms)
 * - Hushed alpine wind + crystalline frost shimmers (snow)
 * - Muted misty stillness + sparse dew droplets (fog/mist)
 */

export type SoundscapeType =
  | 'rain'
  | 'thunderstorm'
  | 'wind'
  | 'birds'
  | 'crickets'
  | 'snow'
  | 'fog';

export type SoundscapePreset = 'auto' | SoundscapeType;

export type AcousticMixFocus = 'balanced' | 'weather' | 'nature';

export interface SoundscapeState {
  preset: SoundscapePreset;
  activeType: SoundscapeType;
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
  activeType: SoundscapeType;
  label: string;
  subLabel: string;
} {
  // Thunderstorms (95, 96, 99)
  if ([95, 96, 99].includes(weatherCode)) {
    return {
      activeType: 'thunderstorm',
      label: weatherCode === 96 || weatherCode === 99 ? 'Severe Storm & Hail' : 'Distant Thunderstorm',
      subLabel: 'Rolling sub-bass thunder, heavy downpour & sweeping gusts',
    };
  }

  // Snow & Ice Showers (71, 73, 75, 77, 85, 86)
  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) {
    return {
      activeType: 'snow',
      label: 'Winter Snowscape',
      subLabel: 'Hushed winter air, soft drift & crystalline frost chimes',
    };
  }

  // Rain / Showers / Drizzle / Freezing Rain (51..67, 80..82)
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)) {
    const isHeavy = [65, 67, 82].includes(weatherCode);
    const isDrizzle = [51, 53, 55, 56, 57].includes(weatherCode);
    return {
      activeType: 'rain',
      label: isDrizzle ? 'Gentle Drizzle' : isHeavy ? 'Heavy Rain Showers' : 'Ambient Rainfall',
      subLabel: isDrizzle
        ? 'Delicate mist rainfall & scattered water droplets'
        : isHeavy
        ? 'Dense spatial downpour, brisk gusts & resonant droplets'
        : 'Layered rainfall, rhythmic droplets & gentle air',
    };
  }

  // Fog / Rime Fog (45, 48)
  if (weatherCode === 45 || weatherCode === 48) {
    return {
      activeType: 'fog',
      label: weatherCode === 48 ? 'Rime Fog & Frost Mist' : 'Quiet Fog & Dew',
      subLabel: 'Muted misty stillness & sparse dew droplets',
    };
  }

  // Strong wind condition (wind speed >= 24 km/h)
  if (windSpeedKmh >= 24) {
    return {
      activeType: 'wind',
      label: 'Atmospheric Wind',
      subLabel: `Sweeping gusts (${Math.round(windSpeedKmh)} km/h) & open-air shimmer`,
    };
  }

  // Clear / Mainly Clear / Partly Cloudy (0, 1, 2)
  if ([0, 1, 2].includes(weatherCode)) {
    if (isDay) {
      return {
        activeType: 'birds',
        label: 'Sunny Nature & Songbirds',
        subLabel: 'Melodic stereo bird calls & warm afternoon breeze',
      };
    }
    return {
      activeType: 'crickets',
      label: 'Nocturnal Sky & Crickets',
      subLabel: 'Harmonic night field crickets & calm evening air',
    };
  }

  // Overcast (3)
  return {
    activeType: 'wind',
    label: isDay ? 'Atmospheric Breeze' : 'Evening Breeze',
    subLabel: 'Gentle open-air drift & calm sky cadence',
  };
}

class AtmosphericSoundscapeEngine {
  private ctx: AudioContext | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private masterGain: GainNode | null = null;

  // Noise buffer shared across continuous beds
  private noiseBuffer: AudioBuffer | null = null;

  // Sound generator gains
  private rainLowGain: GainNode | null = null;
  private rainHighGain: GainNode | null = null;
  private windLowGain: GainNode | null = null;
  private windAirGain: GainNode | null = null;
  private birdGain: GainNode | null = null;
  private cricketGain: GainNode | null = null;
  private thunderGain: GainNode | null = null;
  private dropletGain: GainNode | null = null;
  private frostGain: GainNode | null = null;

  // Filter & panning nodes
  private windLowFilter: BiquadFilterNode | null = null;
  private windAirFilter: BiquadFilterNode | null = null;
  private windPanner: StereoPannerNode | null = null;
  private rainHighFilter: BiquadFilterNode | null = null;

  // Periodic timers for stochastic events
  private birdTimer: number | null = null;
  private cricketTimer: number | null = null;
  private thunderTimer: number | null = null;
  private dropletTimer: number | null = null;
  private frostTimer: number | null = null;
  private windLfoTimer: number | null = null;

  // Active state
  private isRunning = false;
  private currentVolume = 0.35;
  private activeType: SoundscapeType = 'birds';
  private currentWindSpeed = 12;
  private currentWeatherCode = 0;
  private mixFocus: AcousticMixFocus = 'balanced';
  private activeTimerIds = new Set<number>();

  private clearScheduledTimeout(id: number | null): null {
    if (id !== null) {
      window.clearTimeout(id);
      this.activeTimerIds.delete(id);
    }
    return null;
  }

  private scheduleSubTimeout(fn: () => void, delayMs: number): number {
    const id = window.setTimeout(() => {
      this.activeTimerIds.delete(id);
      fn();
    }, delayMs);
    this.activeTimerIds.add(id);
    return id;
  }

  private createPanner(pan: number): AudioNode | null {
    if (!this.ctx) return null;
    if (typeof this.ctx.createStereoPanner === 'function') {
      const p = this.ctx.createStereoPanner();
      p.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), this.ctx.currentTime);
      return p;
    }
    return null;
  }

  private initContext() {
    if (this.ctx) return;
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    this.ctx = new AudioContextClass();

    // Soft master compressor prevents clipping when thunder + heavy rain peak together
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(14, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(4, this.ctx.currentTime);
    this.compressor.attack.setValueAtTime(0.008, this.ctx.currentTime);
    this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.currentVolume, this.ctx.currentTime);

    this.compressor.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    // Stereo Pink Noise Buffer (6 seconds loop for less repetition)
    const bufferSize = this.ctx.sampleRate * 6;
    const noiseBuffer = this.ctx.createBuffer(2, bufferSize, this.ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = noiseBuffer.getChannelData(channel);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
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
    this.noiseBuffer = noiseBuffer;

    // --- Rain Layer A: Warm Low-Mid Rainfall Body ---
    const rainLowSrc = this.ctx.createBufferSource();
    rainLowSrc.buffer = noiseBuffer;
    rainLowSrc.loop = true;

    const rainLowFilter = this.ctx.createBiquadFilter();
    rainLowFilter.type = 'lowpass';
    rainLowFilter.frequency.setValueAtTime(520, this.ctx.currentTime);
    rainLowFilter.Q.setValueAtTime(0.7, this.ctx.currentTime);

    this.rainLowGain = this.ctx.createGain();
    this.rainLowGain.gain.setValueAtTime(0, this.ctx.currentTime);

    rainLowSrc.connect(rainLowFilter);
    rainLowFilter.connect(this.rainLowGain);
    this.rainLowGain.connect(this.compressor);
    rainLowSrc.start();

    // --- Rain Layer B: Crisp Patter Texture ---
    const rainHighSrc = this.ctx.createBufferSource();
    rainHighSrc.buffer = noiseBuffer;
    rainHighSrc.loop = true;
    rainHighSrc.loopStart = 1.3;

    this.rainHighFilter = this.ctx.createBiquadFilter();
    this.rainHighFilter.type = 'bandpass';
    this.rainHighFilter.frequency.setValueAtTime(2150, this.ctx.currentTime);
    this.rainHighFilter.Q.setValueAtTime(0.85, this.ctx.currentTime);

    this.rainHighGain = this.ctx.createGain();
    this.rainHighGain.gain.setValueAtTime(0, this.ctx.currentTime);

    rainHighSrc.connect(this.rainHighFilter);
    this.rainHighFilter.connect(this.rainHighGain);
    this.rainHighGain.connect(this.compressor);
    rainHighSrc.start();

    // --- Wind Layer A + B: Deep Sweep + High Canopy Air ---
    const windLowSrc = this.ctx.createBufferSource();
    windLowSrc.buffer = noiseBuffer;
    windLowSrc.loop = true;
    windLowSrc.loopStart = 0.5;

    this.windLowFilter = this.ctx.createBiquadFilter();
    this.windLowFilter.type = 'lowpass';
    this.windLowFilter.frequency.setValueAtTime(280, this.ctx.currentTime);
    this.windLowFilter.Q.setValueAtTime(2.8, this.ctx.currentTime);

    this.windLowGain = this.ctx.createGain();
    this.windLowGain.gain.setValueAtTime(0, this.ctx.currentTime);

    const windAirSrc = this.ctx.createBufferSource();
    windAirSrc.buffer = noiseBuffer;
    windAirSrc.loop = true;
    windAirSrc.loopStart = 2.1;

    this.windAirFilter = this.ctx.createBiquadFilter();
    this.windAirFilter.type = 'bandpass';
    this.windAirFilter.frequency.setValueAtTime(760, this.ctx.currentTime);
    this.windAirFilter.Q.setValueAtTime(1.6, this.ctx.currentTime);

    this.windAirGain = this.ctx.createGain();
    this.windAirGain.gain.setValueAtTime(0, this.ctx.currentTime);

    if (typeof this.ctx.createStereoPanner === 'function') {
      this.windPanner = this.ctx.createStereoPanner();
      this.windPanner.pan.setValueAtTime(0, this.ctx.currentTime);
      this.windLowGain.connect(this.windPanner);
      this.windAirGain.connect(this.windPanner);
      this.windPanner.connect(this.compressor);
    } else {
      this.windLowGain.connect(this.compressor);
      this.windAirGain.connect(this.compressor);
    }

    windLowSrc.connect(this.windLowFilter);
    this.windLowFilter.connect(this.windLowGain);
    windLowSrc.start();

    windAirSrc.connect(this.windAirFilter);
    this.windAirFilter.connect(this.windAirGain);
    windAirSrc.start();

    // --- Event Buses ---
    this.birdGain = this.ctx.createGain();
    this.birdGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.birdGain.connect(this.compressor);

    this.cricketGain = this.ctx.createGain();
    this.cricketGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.cricketGain.connect(this.compressor);

    this.thunderGain = this.ctx.createGain();
    this.thunderGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.thunderGain.connect(this.compressor);

    this.dropletGain = this.ctx.createGain();
    this.dropletGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.dropletGain.connect(this.compressor);

    this.frostGain = this.ctx.createGain();
    this.frostGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.frostGain.connect(this.compressor);
  }

  private startWindModulation() {
    if (this.windLfoTimer !== null) {
      window.clearInterval(this.windLfoTimer);
      this.windLfoTimer = null;
    }
    this.windLfoTimer = window.setInterval(() => {
      if (!this.ctx || !this.windLowFilter || !this.isRunning) return;
      const t = this.ctx.currentTime;
      const isSnow = this.activeType === 'snow';
      const isFog = this.activeType === 'fog';
      const baseFreq = isSnow
        ? 155
        : isFog
        ? 190
        : Math.min(540, 200 + this.currentWindSpeed * 11);
      const targetFreq = Math.max(110, baseFreq + (Math.random() - 0.45) * (isSnow ? 45 : 170));

      this.windLowFilter.frequency.cancelScheduledValues(t);
      this.windLowFilter.frequency.linearRampToValueAtTime(targetFreq, t + 2.4);

      if (this.windAirFilter) {
        const airFreq = Math.max(480, 650 + this.currentWindSpeed * 14 + (Math.random() - 0.5) * 240);
        this.windAirFilter.frequency.cancelScheduledValues(t);
        this.windAirFilter.frequency.linearRampToValueAtTime(airFreq, t + 2.6);
      }

      if (this.windPanner) {
        const targetPan = (Math.random() - 0.5) * 0.55;
        this.windPanner.pan.cancelScheduledValues(t);
        this.windPanner.pan.linearRampToValueAtTime(targetPan, t + 2.8);
      }
    }, 2600);
  }

  private stopWindModulation() {
    if (this.windLfoTimer !== null) {
      window.clearInterval(this.windLfoTimer);
      this.windLfoTimer = null;
    }
  }

  /**
   * Synthesize a crisp spatial raindrop or dew droplet plink
   */
  private triggerRainDroplet(soft = false) {
    if (!this.ctx || !this.dropletGain || !this.isRunning) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const panner = this.createPanner((Math.random() - 0.5) * 1.5);

      // Liquid droplet upward pitch bend (pop resonance)
      const baseFreq = soft ? 650 + Math.random() * 650 : 880 + Math.random() * 1450;
      const dur = soft ? 0.045 + Math.random() * 0.03 : 0.035 + Math.random() * 0.035;
      const peak = soft ? 0.045 + Math.random() * 0.03 : 0.065 + Math.random() * 0.055;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.48, now + dur);

      gain.gain.setValueAtTime(0.0008, now);
      gain.gain.linearRampToValueAtTime(peak, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + dur);

      osc.connect(gain);
      if (panner) {
        gain.connect(panner);
        panner.connect(this.dropletGain);
      } else {
        gain.connect(this.dropletGain);
      }

      osc.start(now);
      osc.stop(now + dur + 0.02);
    } catch {
      // ignore audio node errors
    }
  }

  /**
   * Synthesize delicate crystalline frost shimmer (snowscape)
   */
  private triggerFrostShimmer() {
    if (!this.ctx || !this.frostGain || !this.isRunning) return;
    try {
      const now = this.ctx.currentTime;
      const notes = [1046.5, 1318.5, 1567.98, 1760, 2093]; // C6 pentatonic ice harmonics
      const freq = notes[Math.floor(Math.random() * notes.length)];
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const panner = this.createPanner((Math.random() - 0.5) * 1.2);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.0005, now);
      gain.gain.linearRampToValueAtTime(0.035, now + 0.14);
      gain.gain.exponentialRampToValueAtTime(0.0004, now + 1.8);

      osc.connect(gain);
      if (panner) {
        gain.connect(panner);
        panner.connect(this.frostGain);
      } else {
        gain.connect(this.frostGain);
      }

      osc.start(now);
      osc.stop(now + 1.9);
    } catch {
      // ignore
    }
  }

  /**
   * Synthesize melodic multi-phrase songbird call in stereo canopy
   */
  private triggerBirdChirp() {
    if (!this.ctx || !this.birdGain || !this.isRunning) return;
    try {
      const panVal = (Math.random() - 0.5) * 1.4;
      const style = Math.random();
      const syllableCount = style > 0.65 ? 3 : style > 0.25 ? 2 : 1;
      const basePitch = 2100 + Math.random() * 1100;

      for (let s = 0; s < syllableCount; s++) {
        const delayMs = s * (110 + Math.random() * 75);
        this.scheduleSubTimeout(() => {
          if (!this.ctx || !this.birdGain || !this.isRunning) return;
          const now = this.ctx.currentTime;
          const osc = this.ctx.createOscillator();
          const chirpGain = this.ctx.createGain();
          const panner = this.createPanner(panVal);

          const startFreq = basePitch * (1 + s * 0.08);
          const peakFreq = startFreq + 750 + Math.random() * 950;
          const endFreq = startFreq + (Math.random() > 0.5 ? 220 : -280);
          const duration = 0.08 + Math.random() * 0.07;

          osc.type = 'sine';
          osc.frequency.setValueAtTime(startFreq, now);
          osc.frequency.exponentialRampToValueAtTime(peakFreq, now + duration * 0.42);
          osc.frequency.exponentialRampToValueAtTime(Math.max(900, endFreq), now + duration);

          chirpGain.gain.setValueAtTime(0.0008, now);
          chirpGain.gain.linearRampToValueAtTime(0.11 + Math.random() * 0.06, now + 0.015);
          chirpGain.gain.exponentialRampToValueAtTime(0.0008, now + duration);

          osc.connect(chirpGain);
          if (panner) {
            chirpGain.connect(panner);
            panner.connect(this.birdGain);
          } else {
            chirpGain.connect(this.birdGain);
          }

          osc.start(now);
          osc.stop(now + duration + 0.02);
        }, delayMs);
      }
    } catch {
      // ignore
    }
  }

  /**
   * Synthesize realistic harmonic field cricket trill in stereo
   */
  private triggerCricketChirp() {
    if (!this.ctx || !this.cricketGain || !this.isRunning) return;
    try {
      const now = this.ctx.currentTime;
      const fundFreq = 4050 + (Math.random() - 0.5) * 280;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const amp = this.ctx.createGain();
      const panner = this.createPanner((Math.random() - 0.5) * 1.35);

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(fundFreq, now);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(fundFreq * 2, now); // natural stridulation harmonic

      const harmGain = this.ctx.createGain();
      harmGain.gain.setValueAtTime(0.22, now);

      const pulses = Math.random() > 0.4 ? 4 : 3;
      const pulseDur = 0.032;
      amp.gain.setValueAtTime(0.0006, now);
      for (let i = 0; i < pulses; i++) {
        const t = now + i * 0.052;
        amp.gain.linearRampToValueAtTime(0.065, t + 0.008);
        amp.gain.linearRampToValueAtTime(0.0008, t + pulseDur);
      }

      osc1.connect(amp);
      osc2.connect(harmGain);
      harmGain.connect(amp);

      if (panner) {
        amp.connect(panner);
        panner.connect(this.cricketGain);
      } else {
        amp.connect(this.cricketGain);
      }

      const endT = now + pulses * 0.055 + 0.03;
      osc1.start(now);
      osc2.start(now);
      osc1.stop(endT);
      osc2.stop(endT);
    } catch {
      // ignore
    }
  }

  /**
   * Synthesize realistic multi-stage thunder roll using filtered pink noise + sub-bass boom
   */
  private triggerThunderRoll() {
    if (!this.ctx || !this.thunderGain || !this.noiseBuffer || !this.isRunning) return;
    try {
      const now = this.ctx.currentTime;
      const panner = this.createPanner((Math.random() - 0.5) * 1.1);

      // Stage 1: Filtered noise rumble with sweeping low-pass cutoff
      const noiseSrc = this.ctx.createBufferSource();
      noiseSrc.buffer = this.noiseBuffer;
      noiseSrc.loop = true;
      noiseSrc.playbackRate.setValueAtTime(0.65, now);

      const thunderFilter = this.ctx.createBiquadFilter();
      thunderFilter.type = 'lowpass';
      thunderFilter.frequency.setValueAtTime(240, now);
      thunderFilter.frequency.exponentialRampToValueAtTime(48, now + 3.6);
      thunderFilter.Q.setValueAtTime(2.2, now);

      const noiseAmp = this.ctx.createGain();
      noiseAmp.gain.setValueAtTime(0.001, now);
      noiseAmp.gain.linearRampToValueAtTime(0.62, now + 0.14);
      noiseAmp.gain.linearRampToValueAtTime(0.38, now + 0.85);
      noiseAmp.gain.linearRampToValueAtTime(0.45, now + 1.25); // secondary echo swell
      noiseAmp.gain.exponentialRampToValueAtTime(0.001, now + 4.4);

      // Stage 2: Deep sub-bass pressure bloom
      const subOsc = this.ctx.createOscillator();
      const subAmp = this.ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(62, now);
      subOsc.frequency.exponentialRampToValueAtTime(31, now + 2.8);

      subAmp.gain.setValueAtTime(0.001, now);
      subAmp.gain.linearRampToValueAtTime(0.24, now + 0.25);
      subAmp.gain.exponentialRampToValueAtTime(0.001, now + 3.2);

      noiseSrc.connect(thunderFilter);
      thunderFilter.connect(noiseAmp);
      subOsc.connect(subAmp);

      if (panner) {
        noiseAmp.connect(panner);
        subAmp.connect(panner);
        panner.connect(this.thunderGain);
      } else {
        noiseAmp.connect(this.thunderGain);
        subAmp.connect(this.thunderGain);
      }

      noiseSrc.start(now);
      noiseSrc.stop(now + 4.5);
      subOsc.start(now);
      subOsc.stop(now + 3.4);
    } catch {
      // ignore
    }
  }

  private clearAllEventTimers() {
    this.birdTimer = this.clearScheduledTimeout(this.birdTimer);
    this.cricketTimer = this.clearScheduledTimeout(this.cricketTimer);
    this.thunderTimer = this.clearScheduledTimeout(this.thunderTimer);
    this.dropletTimer = this.clearScheduledTimeout(this.dropletTimer);
    this.frostTimer = this.clearScheduledTimeout(this.frostTimer);

    for (const id of this.activeTimerIds) {
      window.clearTimeout(id);
    }
    this.activeTimerIds.clear();
  }

  /**
   * Schedule stochastic acoustic events matched to active weather type
   */
  private scheduleAtmosphericEvents() {
    this.clearAllEventTimers();
    if (!this.isRunning) return;

    if (this.activeType === 'birds') {
      const runBirdCycle = () => {
        if (!this.isRunning || this.activeType !== 'birds') return;
        this.triggerBirdChirp();
        this.birdTimer = this.scheduleSubTimeout(runBirdCycle, 2400 + Math.random() * 3800);
      };
      this.birdTimer = this.scheduleSubTimeout(runBirdCycle, 800);
    }

    if (this.activeType === 'crickets') {
      const runCricketCycle = () => {
        if (!this.isRunning || this.activeType !== 'crickets') return;
        this.triggerCricketChirp();
        this.cricketTimer = this.scheduleSubTimeout(runCricketCycle, 1500 + Math.random() * 2200);
      };
      this.cricketTimer = this.scheduleSubTimeout(runCricketCycle, 700);
    }

    if (this.activeType === 'thunderstorm') {
      const runThunderCycle = () => {
        if (!this.isRunning || this.activeType !== 'thunderstorm') return;
        this.triggerThunderRoll();
        this.thunderTimer = this.scheduleSubTimeout(runThunderCycle, 6500 + Math.random() * 8500);
      };
      this.thunderTimer = this.scheduleSubTimeout(runThunderCycle, 1600);
    }

    if (this.activeType === 'rain' || this.activeType === 'thunderstorm' || this.activeType === 'fog') {
      const isFog = this.activeType === 'fog';
      const isHeavy =
        this.activeType === 'thunderstorm' || [65, 67, 82].includes(this.currentWeatherCode);
      const isDrizzle = [51, 53, 55, 56, 57].includes(this.currentWeatherCode);

      const runDropletCycle = () => {
        if (!this.isRunning) return;
        if (!['rain', 'thunderstorm', 'fog'].includes(this.activeType)) return;
        this.triggerRainDroplet(isFog || isDrizzle);
        const minDelay = isFog ? 900 : isHeavy ? 140 : isDrizzle ? 360 : 220;
        const spread = isFog ? 1800 : isHeavy ? 320 : isDrizzle ? 650 : 450;
        this.dropletTimer = this.scheduleSubTimeout(runDropletCycle, minDelay + Math.random() * spread);
      };
      this.dropletTimer = this.scheduleSubTimeout(runDropletCycle, 400);
    }

    if (this.activeType === 'snow') {
      const runFrostCycle = () => {
        if (!this.isRunning || this.activeType !== 'snow') return;
        this.triggerFrostShimmer();
        this.frostTimer = this.scheduleSubTimeout(runFrostCycle, 3400 + Math.random() * 4400);
      };
      this.frostTimer = this.scheduleSubTimeout(runFrostCycle, 1400);
    }
  }

  public setMixFocus(focus: AcousticMixFocus) {
    this.mixFocus = focus;
    if (this.isRunning) {
      this.updateSoundscape(this.activeType, this.currentWindSpeed, this.currentWeatherCode);
    }
  }

  public getMixFocus(): AcousticMixFocus {
    return this.mixFocus;
  }

  /**
   * Crossfade sound layers dynamically based on target soundscape, wind velocity, & focus balance
   */
  public updateSoundscape(
    type: SoundscapeType,
    windSpeedKmh: number = 12,
    weatherCode: number = this.currentWeatherCode
  ) {
    this.activeType = type;
    this.currentWindSpeed = windSpeedKmh;
    this.currentWeatherCode = weatherCode;

    if (!this.ctx || !this.isRunning) return;
    const now = this.ctx.currentTime;
    const fadeDuration = 1.25;

    const isDrizzle = [51, 53, 55, 56, 57].includes(weatherCode);
    const isHeavyRain = [65, 67, 82, 95, 96, 99].includes(weatherCode);

    // Adjust crispness of rain filter by intensity
    if (this.rainHighFilter) {
      const targetRainHz = isDrizzle ? 2700 : isHeavyRain ? 1750 : 2150;
      this.rainHighFilter.frequency.cancelScheduledValues(now);
      this.rainHighFilter.frequency.linearRampToValueAtTime(targetRainHz, now + fadeDuration);
    }

    let targetRainLow = 0;
    let targetRainHigh = 0;
    let targetWindLow = 0;
    let targetWindAir = 0;
    let targetBirds = 0;
    let targetCrickets = 0;
    let targetThunder = 0;
    let targetDroplets = 0;
    let targetFrost = 0;

    const windIntensity = Math.min(1.15, 0.28 + windSpeedKmh / 34);

    switch (type) {
      case 'rain':
        targetRainLow = isDrizzle ? 0.24 : isHeavyRain ? 0.56 : 0.4;
        targetRainHigh = isDrizzle ? 0.26 : isHeavyRain ? 0.44 : 0.34;
        targetDroplets = isDrizzle ? 0.52 : 0.62;
        targetWindLow = 0.18 * windIntensity;
        targetWindAir = windSpeedKmh > 20 ? 0.08 * windIntensity : 0;
        break;
      case 'thunderstorm':
        targetRainLow = 0.58;
        targetRainHigh = 0.46;
        targetDroplets = 0.58;
        targetWindLow = 0.4 * windIntensity;
        targetWindAir = 0.18 * windIntensity;
        targetThunder = 0.78;
        break;
      case 'wind':
        targetWindLow = 0.54 * windIntensity;
        targetWindAir = 0.26 * windIntensity;
        break;
      case 'birds':
        targetBirds = 0.7;
        targetWindLow = 0.14 * Math.min(1, 0.5 + windSpeedKmh / 40);
        targetWindAir = 0.06;
        break;
      case 'crickets':
        targetCrickets = 0.62;
        targetWindLow = 0.12;
        break;
      case 'snow':
        targetWindLow = 0.24;
        targetFrost = 0.58;
        break;
      case 'fog':
        targetWindLow = 0.16;
        targetRainHigh = 0.06;
        targetDroplets = 0.42;
        break;
    }

    // Apply Acoustic Mix Focus scaling
    const bedScale = this.mixFocus === 'weather' ? 1.2 : this.mixFocus === 'nature' ? 0.72 : 1.0;
    const bioScale = this.mixFocus === 'nature' ? 1.28 : this.mixFocus === 'weather' ? 0.72 : 1.0;

    const ramp = (node: GainNode | null, targetVal: number) => {
      if (!node) return;
      node.gain.cancelScheduledValues(now);
      node.gain.linearRampToValueAtTime(Math.min(1.0, targetVal), now + fadeDuration);
    };

    ramp(this.rainLowGain, targetRainLow * bedScale);
    ramp(this.rainHighGain, targetRainHigh * bedScale);
    ramp(this.windLowGain, targetWindLow * bedScale);
    ramp(this.windAirGain, targetWindAir * bedScale);
    ramp(this.birdGain, targetBirds * bioScale);
    ramp(this.cricketGain, targetCrickets * bioScale);
    ramp(this.thunderGain, targetThunder * bioScale);
    ramp(this.dropletGain, targetDroplets * bioScale);
    ramp(this.frostGain, targetFrost * bioScale);

    this.scheduleAtmosphericEvents();
  }

  /**
   * Start / Resume audio playback
   */
  public async play(
    type: SoundscapeType,
    windSpeedKmh: number = 12,
    weatherCode: number = this.currentWeatherCode
  ) {
    this.initContext();
    if (!this.ctx) return;

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    this.isRunning = true;
    this.startWindModulation();
    this.updateSoundscape(type, windSpeedKmh, weatherCode);
  }

  /**
   * Stop / Mute audio playback smoothly
   */
  public stop() {
    this.isRunning = false;
    this.stopWindModulation();
    this.clearAllEventTimers();

    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const fade = 0.55;

    const zero = (node: GainNode | null) => {
      if (!node) return;
      node.gain.cancelScheduledValues(now);
      node.gain.linearRampToValueAtTime(0, now + fade);
    };

    zero(this.rainLowGain);
    zero(this.rainHighGain);
    zero(this.windLowGain);
    zero(this.windAirGain);
    zero(this.birdGain);
    zero(this.cricketGain);
    zero(this.thunderGain);
    zero(this.dropletGain);
    zero(this.frostGain);
  }

  /**
   * Set Master Volume (0.0 to 1.0)
   */
  public setVolume(vol: number) {
    this.currentVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.linearRampToValueAtTime(this.currentVolume, this.ctx.currentTime + 0.08);
    }
  }

  public getIsPlaying(): boolean {
    return this.isRunning;
  }

  public getContextState(): AudioContextState | 'uninitialized' {
    return this.ctx ? this.ctx.state : 'uninitialized';
  }
}

export const soundscapeEngine = new AtmosphericSoundscapeEngine();
