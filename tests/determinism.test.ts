import { describe, expect, it } from 'vitest';
import { makeWorld, run, stateHash } from './helpers';

describe('simulation determinism', () => {
  it('same seed + same command stream = identical battles', () => {
    const script = (w: ReturnType<typeof makeWorld>) => {
      // deploy both MCVs, then poke some orders at fixed ticks
      const units = [...w.units.values()];
      for (const u of units) w.issue({ kind: 'deploy', units: [u.id] });
      run(w, 50);
      w.issue({ kind: 'startProduction', player: 0, tab: 'building', def: 'fusion_plant' });
      w.issue({ kind: 'startProduction', player: 1, tab: 'building', def: 'combustion_plant' });
      run(w, 500);
    };
    const a = makeWorld({ seed: 777 });
    const b = makeWorld({ seed: 777 });
    script(a);
    script(b);
    expect(a.tick).toBe(b.tick);
    expect(stateHash(a)).toBe(stateHash(b));
  });

  it('different seeds diverge', () => {
    const a = makeWorld({ seed: 1001 });
    const b = makeWorld({ seed: 2002 });
    run(a, 100);
    run(b, 100);
    // maps differ, so spawns and hashes differ
    expect(stateHash(a)).not.toBe(stateHash(b));
  });

  it('AI worlds replay identically too', () => {
    const a = makeWorld({ seed: 555 }, true);
    const b = makeWorld({ seed: 555 }, true);
    run(a, 1200);
    run(b, 1200);
    expect(stateHash(a)).toBe(stateHash(b));
  });
});
