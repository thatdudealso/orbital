/**
 * Procedural WebAudio SFX - no audio assets, everything synthesized.
 * Short, tasteful blips that match the minimal aesthetic.
 */

interface ToneOpts {
  type?: OscillatorType;
  gain?: number;
  slide?: number; // semitone slide over duration
  delay?: number;
}

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;

  /** Must be called from a user gesture at least once. */
  resume(): void {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.16;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.16;
  }

  private tone(freq: number, dur: number, opts: ToneOpts = {}): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t0 = this.ctx.currentTime + (opts.delay ?? 0);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.slide) {
      osc.frequency.exponentialRampToValueAtTime(freq * Math.pow(2, opts.slide / 12), t0 + dur);
    }
    const peak = opts.gain ?? 0.5;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private noise(dur: number, freq: number, gain = 0.3, delay = 0): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(filter).connect(g).connect(this.master);
    src.start(t0);
  }

  jump(): void { this.tone(220, 0.18, { type: 'triangle', slide: 7, gain: 0.35 }); }
  land(): void { this.noise(0.09, 500, 0.22); }
  shard(): void { this.tone(880 + Math.random() * 220, 0.1, { type: 'sine', gain: 0.22, slide: 3 }); }
  powerup(): void {
    this.tone(440, 0.12, { type: 'square', gain: 0.14 });
    this.tone(660, 0.16, { type: 'square', gain: 0.14, delay: 0.07 });
  }
  boost(): void { this.noise(0.5, 2400, 0.18); this.tone(160, 0.5, { type: 'sawtooth', slide: 12, gain: 0.16 }); }
  checkpoint(): void {
    this.tone(523, 0.14, { type: 'triangle', gain: 0.3 });
    this.tone(784, 0.22, { type: 'triangle', gain: 0.3, delay: 0.09 });
  }
  death(): void {
    this.noise(0.4, 900, 0.35);
    this.tone(220, 0.5, { type: 'sawtooth', slide: -12, gain: 0.2 });
  }
  hazard(): void { this.tone(180, 0.25, { type: 'square', slide: -6, gain: 0.25 }); }
  countdownTick(): void { this.tone(440, 0.09, { type: 'square', gain: 0.2 }); }
  countdownGo(): void { this.tone(880, 0.3, { type: 'square', gain: 0.3 }); }
  victory(): void {
    const seq = [523, 659, 784, 1046, 1318];
    seq.forEach((f, i) => this.tone(f, 0.35, { type: 'triangle', gain: 0.28, delay: i * 0.12 }));
  }
  bounce(): void { this.tone(300, 0.16, { type: 'sine', slide: 9, gain: 0.3 }); }
}
