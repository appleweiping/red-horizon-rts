import { describe, expect, it } from 'vitest';
import { makeWorld, run } from './helpers';

describe('skirmish AI (smoke)', () => {
  it('deploys, powers up and grows an economy without crashing', () => {
    const w = makeWorld({ seed: 4242 }, true);
    run(w, 20 * 120); // two minutes of game time
    for (const p of w.players) {
      const buildings = [...w.buildings.values()].filter((b) => b.player === p.id && !b.dead);
      expect(buildings.some((b) => b.def.conyard), `${p.config.name} conyard`).toBe(true);
      expect(buildings.some((b) => b.def.power > 0), `${p.config.name} power`).toBe(true);
      expect(buildings.some((b) => b.def.refinery), `${p.config.name} refinery`).toBe(true);
    }
  }, 20000);

  it('produces an army and eventually fights', () => {
    const w = makeWorld({ seed: 31337 }, true);
    run(w, 20 * 60 * 6); // six minutes
    const combatants = [...w.units.values()].filter(
      (u) => u.weaponDefs.length > 0 && !u.def.harvester,
    );
    expect(combatants.length).toBeGreaterThan(4);
    // someone must have taken damage or died by now
    const anyLosses = w.players.some(
      (p) => p.stats.unitsLost > 0 || p.stats.unitsKilled > 0 || p.stats.buildingsLost > 0,
    );
    expect(anyLosses).toBe(true);
  }, 30000);

  it('keeps the whole match stable for a long horizon', () => {
    const w = makeWorld({ seed: 999 }, true);
    run(w, 20 * 60 * 10); // ten minutes
    expect(w.tick).toBe(20 * 60 * 10);
    // sim must stay finite and sane
    for (const u of w.units.values()) {
      expect(Number.isFinite(u.x)).toBe(true);
      expect(Number.isFinite(u.y)).toBe(true);
      expect(Number.isFinite(u.hp)).toBe(true);
    }
    for (const p of w.players) {
      expect(Number.isFinite(p.credits)).toBe(true);
      expect(p.credits).toBeGreaterThanOrEqual(0);
    }
  }, 60000);
});
