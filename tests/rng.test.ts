import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';

describe('Rng (mulberry32)', () => {
  it('is deterministic for the same seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 1000; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it('differs across seeds', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it('stays within [0, 1) and int(n) within [0, n)', () => {
    const r = new Rng(7);
    for (let i = 0; i < 5000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      const n = r.int(10);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(10);
    }
  });

  it('has a roughly uniform mean', () => {
    const r = new Rng(99);
    let sum = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) sum += r.next();
    expect(sum / N).toBeGreaterThan(0.48);
    expect(sum / N).toBeLessThan(0.52);
  });

  it('handles a zero seed', () => {
    const r = new Rng(0);
    expect(r.next()).not.toBeNaN();
  });
});
