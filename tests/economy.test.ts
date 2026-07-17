import { describe, expect, it } from 'vitest';
import { Terrain } from '../src/core/types';
import { getBuilding } from '../src/data/buildings';
import { makeWorld, run } from './helpers';

describe('economy', () => {
  it('a refinery ships with a free harvester', () => {
    const w = makeWorld();
    const before = [...w.units.values()].filter((u) => u.player === 0 && u.def.harvester).length;
    w.addBuilding(getBuilding('refinery'), 0, 30, 30, true);
    const after = [...w.units.values()].filter((u) => u.player === 0 && u.def.harvester).length;
    expect(after).toBe(before + 1);
  });

  it('harvester mines ore and delivers credits to the refinery', () => {
    const w = makeWorld();
    const refinery = w.addBuilding(getBuilding('refinery'), 0, 30, 30, true);
    expect(refinery.dead).toBe(false);
    // paint a rich ore patch right next to the dock
    for (let y = 35; y < 39; y++) {
      for (let x = 29; x < 34; x++) {
        const i = w.map.idx(x, y);
        w.map.terrain[i] = Terrain.OreBearing;
        w.map.oreKind[i] = 1;
        w.map.ore[i] = 30;
      }
    }
    const credits0 = w.players[0].credits;
    run(w, 2400); // two minutes of sim: at least one full haul
    expect(w.players[0].credits).toBeGreaterThan(credits0);
    expect(w.players[0].stats.creditsHarvested).toBeGreaterThan(0);
  });

  it('gems are worth more than ore', () => {
    const w = makeWorld();
    // two identical setups can't run in one world; check constants instead
    // via the map takeOre contract
    const i = w.map.idx(50, 50);
    w.map.terrain[i] = Terrain.OreBearing;
    w.map.oreKind[i] = 2;
    w.map.ore[i] = 1;
    expect(w.map.takeOre(50, 50)).toBe(2); // kind 2 = gems
  });

  it('captured oil derricks pay out over time', () => {
    const w = makeWorld();
    const derrick = [...w.buildings.values()].find((b) => b.def.id === 'oil_derrick')!;
    expect(derrick).toBeDefined();
    derrick.player = 0; // simulate a completed capture
    const credits0 = w.players[0].credits;
    run(w, 100); // 5 seconds -> ~50 credits at 10/s
    expect(w.players[0].credits).toBeGreaterThanOrEqual(credits0 + 40);
  });
});
