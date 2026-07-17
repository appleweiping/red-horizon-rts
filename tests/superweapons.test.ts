import { describe, expect, it } from 'vitest';
import { getBuilding } from '../src/data/buildings';
import { getUnit } from '../src/data/units';
import { getPower } from '../src/data/powers';
import { makeWorld, run } from './helpers';

function chargedWorld() {
  const w = makeWorld();
  w.addBuilding(getBuilding('conyard'), 0, 20, 20, true);
  w.addBuilding(getBuilding('fusion_plant'), 0, 24, 20, true);
  w.addBuilding(getBuilding('fusion_plant'), 0, 24, 23, true);
  return w;
}

describe('superweapons', () => {
  it('charges while powered and reports ready', () => {
    const w = chargedWorld();
    w.addBuilding(getBuilding('storm_array'), 0, 27, 20, true);
    run(w, 3);
    const pc = w.players[0].powers.get('stormstrike');
    expect(pc).toBeDefined();
    expect(pc!.charge).toBeGreaterThan(0);
  });

  it('loses charge when the structure dies', () => {
    const w = chargedWorld();
    const silo = w.addBuilding(getBuilding('storm_array'), 0, 27, 20, true);
    run(w, 10);
    silo.dead = true;
    run(w, 2);
    expect(w.players[0].powers.has('stormstrike')).toBe(false);
  });

  it('a storm strike damages things in the target area', () => {
    const w = chargedWorld();
    w.addBuilding(getBuilding('storm_array'), 0, 27, 20, true);
    const victim = w.addUnit(getUnit('bear'), 1, 50.5, 50.5);
    const pc = w.players[0].powers.get('stormstrike');
    // force-charge (tests shouldn't wait 8 minutes)
    run(w, 2);
    w.players[0].powers.get('stormstrike')!.charge = getPower('stormstrike').chargeTicks;
    run(w, 2);
    expect(w.players[0].powers.get('stormstrike')!.ready).toBe(true);
    w.issue({ kind: 'firePower', player: 0, power: 'stormstrike', x: 50.5, y: 50.5 });
    run(w, 200); // clouds gather, bolts fall
    expect(victim.hp).toBeLessThan(victim.def.hp);
    void pc;
  });

  it('chrono relay teleports the strike force', () => {
    const w = chargedWorld();
    w.addBuilding(getBuilding('chrono_relay'), 0, 27, 23, true);
    const tank = w.addUnit(getUnit('wolf'), 0, 21.5, 26.5);
    run(w, 2);
    w.players[0].powers.get('chronoshift')!.charge = getPower('chronoshift').chargeTicks;
    run(w, 2);
    w.issue({ kind: 'firePower', player: 0, power: 'chronoshift', x: 60.5, y: 60.5, units: [tank.id] });
    run(w, 2);
    expect(Math.hypot(tank.x - 60.5, tank.y - 60.5)).toBeLessThan(6);
  });

  it('aegis makes friendlies in the area invulnerable for a while', () => {
    const w = chargedWorld();
    w.addBuilding(getBuilding('aegis_generator'), 0, 27, 23, true);
    // aegis is a Pact power but charging is data-driven; force ownership works
    const inf = w.addUnit(getUnit('guardsman'), 0, 40.5, 40.5);
    run(w, 2);
    const pc = w.players[0].powers.get('aegis')!;
    pc.charge = getPower('aegis').chargeTicks;
    run(w, 2);
    w.issue({ kind: 'firePower', player: 0, power: 'aegis', x: 40.5, y: 40.5 });
    run(w, 2);
    expect(inf.aegisUntil).toBeGreaterThan(w.tick);
  });

  it('never charges with superweapons disabled', () => {
    const w = makeWorld({ superweapons: false });
    w.addBuilding(getBuilding('conyard'), 0, 20, 20, true);
    w.addBuilding(getBuilding('fusion_plant'), 0, 24, 20, true);
    w.addBuilding(getBuilding('fusion_plant'), 0, 24, 23, true);
    w.addBuilding(getBuilding('storm_array'), 0, 27, 20, true);
    run(w, 20);
    expect(w.players[0].powers.size).toBe(0);
  });
});
