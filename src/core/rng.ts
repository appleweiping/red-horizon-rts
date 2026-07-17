/**
 * Seeded PRNG (mulberry32). The simulation gets all randomness from one
 * instance so that a given (map seed, command stream) replays identically —
 * the foundation for lockstep multiplayer and reproducible tests.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
    if (this.state === 0) this.state = 0x9e3779b9;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform integer in [0, n). */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  /** Uniform float in [lo, hi). */
  range(lo: number, hi: number): number {
    return lo + this.next() * (hi - lo);
  }

  /** Pick a random element. */
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(arr.length)];
  }

  /** Random point jitter in [-r, r]. */
  jitter(r: number): number {
    return (this.next() * 2 - 1) * r;
  }
}
