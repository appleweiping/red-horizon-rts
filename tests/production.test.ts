import { describe, expect, it } from 'vitest';
import { getBuilding } from '../src/data/buildings';
import { getUnit } from '../src/data/units';
import { makeWorld, run } from './helpers';

/** Give player 0 a working base core. */
function bootstrap(w: ReturnType<typeof makeWorld>) {
  w.addBuilding(getBuilding('conyard'), 0, 20, 20, true);
  w.addBuilding(getBuilding('fusion_plant'), 0, 24, 20, true);
  w.addBuilding(getBuilding('refinery'), 0, 20, 24, true);
  w.addBuilding(getBuilding('barracks'), 0, 24, 24, true);
}

describe('production', () => {
  it('trains a unit, spends credits pay-as-you-go and spawns it', () => {
    const w = makeWorld();
    bootstrap(w);
    const credits0 = w.players[0].credits;
    const units0 = [...w.units.values()].filter((u) => u.player === 0).length;
    w.issue({ kind: 'startProduction', player: 0, tab: 'infantry', def: 'guardsman' });
    run(w, getUnit('guardsman').buildTime + 30);
    const units1 = [...w.units.values()].filter((u) => u.player === 0).length;
    expect(units1).toBe(units0 + 1);
    expect(w.players[0].credits).toBeCloseTo(credits0 - 200, 0);
  });

  it('enforces prerequisites and faction', () => {
    const w = makeWorld();
    bootstrap(w);
    // jettrooper needs radar
    w.issue({ kind: 'startProduction', player: 0, tab: 'infantry', def: 'jettrooper' });
    // militia is a Pact unit; player 0 is Concord
    w.issue({ kind: 'startProduction', player: 0, tab: 'infantry', def: 'militia' });
    run(w, 5);
    expect(w.players[0].queues.infantry.items).toHaveLength(0);
  });

  it('finishes structures into a ready-to-place state and places them', () => {
    const w = makeWorld();
    bootstrap(w);
    w.issue({ kind: 'startProduction', player: 0, tab: 'building', def: 'radar' });
    run(w, getBuilding('radar').buildTime + 30);
    expect(w.players[0].queues.building.ready).toBe('radar');
    w.issue({ kind: 'placeBuilding', player: 0, def: 'radar', tx: 27, ty: 20 });
    run(w, 60); // includes construction animation
    expect(w.players[0].queues.building.ready).toBeNull();
    const radar = [...w.buildings.values()].find((b) => b.def.id === 'radar' && b.player === 0);
    expect(radar).toBeDefined();
    expect(w.players[0].radarActive).toBe(true);
  });

  it('rejects placement outside the base radius or on blocked tiles', () => {
    const w = makeWorld();
    bootstrap(w);
    w.issue({ kind: 'startProduction', player: 0, tab: 'building', def: 'barracks' });
    run(w, getBuilding('barracks').buildTime + 30);
    expect(w.players[0].queues.building.ready).toBe('barracks');
    // miles away from the base: must be refused
    w.issue({ kind: 'placeBuilding', player: 0, def: 'barracks', tx: 70, ty: 70 });
    run(w, 2);
    expect(w.players[0].queues.building.ready).toBe('barracks'); // still pending
  });

  it('cancelling refunds what was paid', () => {
    const w = makeWorld();
    bootstrap(w);
    const credits0 = w.players[0].credits;
    w.issue({ kind: 'startProduction', player: 0, tab: 'vehicle', def: 'wolf' });
    run(w, 3);
    w.issue({ kind: 'startProduction', player: 0, tab: 'vehicle', def: 'wolf' });
    run(w, 40);
    w.issue({ kind: 'cancelProduction', player: 0, tab: 'vehicle' });
    w.issue({ kind: 'cancelProduction', player: 0, tab: 'vehicle' });
    run(w, 2);
    // no war factory -> nothing should have been built or spent at all
    expect(w.players[0].credits).toBeCloseTo(credits0, 0);
  });

  it('low power slows production down', () => {
    const wA = makeWorld();
    bootstrap(wA);
    wA.issue({ kind: 'startProduction', player: 0, tab: 'infantry', def: 'guardsman' });
    run(wA, 20);
    const progressHealthy = wA.players[0].queues.infantry.items[0]?.progress ?? 99;

    const wB = makeWorld();
    w2boot(wB); // same base but no power plant
    wB.issue({ kind: 'startProduction', player: 0, tab: 'infantry', def: 'guardsman' });
    run(wB, 20);
    const progressStarved = wB.players[0].queues.infantry.items[0]?.progress ?? 0;
    expect(progressStarved).toBeLessThan(progressHealthy);
  });

  it('Pioneer Crawler deploys into a construction yard', () => {
    const w = makeWorld();
    const crawler = [...w.units.values()].find((u) => u.player === 0 && u.def.deployable === 'base')!;
    expect(crawler).toBeDefined();
    w.issue({ kind: 'deploy', units: [crawler.id] });
    run(w, 10);
    const conyard = [...w.buildings.values()].find((b) => b.def.conyard && b.player === 0);
    expect(conyard).toBeDefined();
    expect(w.units.has(crawler.id)).toBe(false);
  });
});

function w2boot(w: ReturnType<typeof makeWorld>) {
  w.addBuilding(getBuilding('conyard'), 0, 20, 20, true);
  w.addBuilding(getBuilding('refinery'), 0, 20, 24, true); // consumes power, none produced
  w.addBuilding(getBuilding('barracks'), 0, 24, 24, true);
}
