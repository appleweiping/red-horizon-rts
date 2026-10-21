import { describe, expect, it } from 'vitest';
import { getBuilding } from '../src/data/buildings';
import { getUnit } from '../src/data/units';
import { killEntity } from '../src/sim/combat';
import { checkVictory } from '../src/sim/victory';
import { makeWorld, run } from './helpers';

describe('victory conditions', () => {
  it('eliminates a player with no structures and no crawler', () => {
    const w = makeWorld();
    // both players deploy
    for (const u of w.units.values()) w.issue({ kind: 'deploy', units: [u.id] });
    run(w, 10);
    // destroy everything player 1 owns
    for (const b of w.buildings.values()) {
      if (b.player === 1) killEntity(w, b, 0, 0);
    }
    for (const u of w.units.values()) {
      if (u.player === 1 && u.def.deployable === 'base') killEntity(w, u, 0, 0);
    }
    checkVictory(w);
    expect(w.players[1].defeated).toBe(true);
    expect(w.gameOver).toBe(true);
    w.events.drain(); // gameOver event exists
  });

  it('does not eliminate a player who still holds a Pioneer Crawler', () => {
    const w = makeWorld();
    // player 1 keeps the starting crawler, has no buildings
    checkVictory(w);
    expect(w.players[1].defeated).toBe(false);
    expect(w.gameOver).toBe(false);
  });

  it('announces winners once when only one side remains', () => {
    const w = makeWorld();
    for (const u of [...w.units.values()]) {
      if (u.player === 1) killEntity(w, u, 0, 0);
    }
    checkVictory(w);
    const over = w.events.drain().filter((e) => e.kind === 'gameOver');
    expect(over).toHaveLength(1);
    if (over[0].kind === 'gameOver') {
      expect(over[0].winners).toEqual([0]);
    }
    // repeated checks must not re-emit
    checkVictory(w);
    expect(w.events.drain().filter((e) => e.kind === 'gameOver')).toHaveLength(0);
  });

  it('engineer capture flips ownership', () => {
    const w = makeWorld();
    const barracks = w.addBuilding(getBuilding('barracks'), 1, 30, 30, true);
    const eng = w.addUnit(getUnit('engineer'), 0, 33.5, 33.5);
    w.issue({ kind: 'capture', units: [eng.id], target: barracks.id });
    run(w, 200);
    expect(barracks.player).toBe(0);
    expect(w.units.has(eng.id)).toBe(false); // consumed
  });
});
