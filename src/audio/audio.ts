/**
 * All sound is synthesized live with WebAudio — no audio files exist.
 * Each cue is a tiny recipe of oscillators + filtered noise envelopes.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private lastPlayed = new Map<string, number>();
  volume = 0.5;
  enabled = true;

  /** Must be called from a user gesture (browser autoplay policy). */
  unlock(): void {
    if (this.ctx) return;
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  /** Play a named cue with basic per-cue rate limiting. */
  play(name: string): void {
    if (!this.enabled || !this.ctx || !this.master) return;
    const now = performance.now();
    const last = this.lastPlayed.get(name) ?? 0;
    const minGap = name === 'rifle' || name === 'mg' ? 70 : 110;
    if (now - last < minGap) return;
    this.lastPlayed.set(name, now);

    const t = this.ctx.currentTime;
    switch (name) {
      case 'rifle':
      case 'mg':
        this.noise(0.06, 1600, 0.35, t);
        break;
      case 'sniper':
        this.noise(0.14, 1100, 0.5, t);
        this.tone('sine', 220, 90, 0.12, 0.25, t);
        break;
      case 'cannon':
        this.noise(0.18, 420, 0.55, t);
        this.tone('sine', 110, 42, 0.22, 0.5, t);
        break;
      case 'artillery':
        this.noise(0.3, 300, 0.6, t);
        this.tone('sine', 90, 30, 0.35, 0.55, t);
        break;
      case 'missile':
        this.sweepNoise(0.35, 500, 2400, 0.3, t);
        break;
      case 'flak':
        this.noise(0.1, 900, 0.45, t);
        break;
      case 'zap':
        this.tone('sawtooth', 900, 120, 0.18, 0.3, t);
        this.noise(0.12, 2400, 0.25, t);
        break;
      case 'beam':
        this.tone('sine', 1400, 500, 0.25, 0.22, t);
        this.tone('sine', 2100, 700, 0.25, 0.12, t);
        break;
      case 'drill':
        this.tone('square', 160, 140, 0.1, 0.2, t);
        break;
      case 'boom':
      case 'explosion':
        this.noise(0.5, 240, 0.7, t);
        this.tone('sine', 70, 28, 0.5, 0.6, t);
        break;
      case 'bigboom':
        this.noise(1.1, 160, 0.9, t);
        this.tone('sine', 55, 20, 1.0, 0.8, t);
        break;
      case 'place':
        this.tone('triangle', 320, 480, 0.12, 0.3, t);
        this.tone('triangle', 480, 640, 0.1, 0.2, t + 0.07);
        break;
      case 'sell':
        for (let i = 0; i < 4; i++) this.tone('square', 500 + i * 160, 500 + i * 160, 0.05, 0.15, t + i * 0.05);
        break;
      case 'click':
        this.tone('square', 660, 660, 0.03, 0.15, t);
        break;
      case 'error':
        this.tone('square', 140, 120, 0.16, 0.3, t);
        break;
      case 'ready':
        this.tone('triangle', 520, 780, 0.14, 0.28, t);
        break;
      case 'alarm':
        for (let i = 0; i < 3; i++) this.tone('sawtooth', 620, 400, 0.16, 0.22, t + i * 0.2);
        break;
      case 'phase':
        this.sweepNoise(0.5, 3000, 300, 0.3, t);
        this.tone('sine', 880, 220, 0.4, 0.25, t);
        break;
      case 'promote':
        this.tone('triangle', 660, 990, 0.18, 0.3, t);
        break;
      default:
        this.tone('sine', 440, 440, 0.05, 0.12, t);
    }
  }

  private tone(
    type: OscillatorType, f0: number, f1: number, dur: number, gain: number, at: number,
  ): void {
    if (!this.ctx || !this.master) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, at);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + dur);
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    o.connect(g).connect(this.master);
    o.start(at);
    o.stop(at + dur + 0.02);
  }

  private noise(dur: number, cutoff: number, gain: number, at: number): void {
    if (!this.ctx || !this.master) return;
    const len = Math.ceil(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(at);
  }

  private sweepNoise(dur: number, from: number, to: number, gain: number, at: number): void {
    if (!this.ctx || !this.master) return;
    const len = Math.ceil(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(from, at);
    f.frequency.exponentialRampToValueAtTime(to, at + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(at);
  }
}
