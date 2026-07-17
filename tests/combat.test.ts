import { describe, expect, it } from 'vitest';
import { getUnit } from '../src/data/units';
import { getBuilding } from '../src/data/buildings';
import { getWeapon } from '../src/data/weapons';
import { damageMultiplier } from '../src/data/armor';
import { dealDamage, killEntity, areEnemies } from '../src/sim/combat';
import { makeWorld, run } from './helpers';

describe('combat', () => {
  it('applies the warhead x armor matrix', () => {
    const w = makeWorld();
    const wolf = w.addUnit(getUnit('wolf'), 0, 20.5, 20.5);
    const rifle = getWeapon('gauss_rifle');
    const before = wolf.hp;
    dealDamage(w, wolf, rifle.damage, rifle, 1, 0);
    const expected = rifle.damage * damageMultiplier('sa', 'medium');
    expect(before - wolf.hp).toBeCloseTo(expected, 5);
  });

  it('kills at zero hp, emits events and updates stats', () => {
    const w = makeWorld();
    const militia = w.addUnit(getUnit('militia'), 1, 22.5, 22.5);
    const cannon = getWeapon('bear_cannon');
    while (!militia.dead) dealDamage(w, militia, 500, cannon, 0, 0);
    expect(militia.dead).toBe(true);
    expect(w.players[1].stats.unitsLost).toBe(1);
    expect(w.players[0].stats.unitsKilled).toBe(1);
    const events = w.events.drain();
    expect(events.some((e) => e.kind === 'death')).toBe(true);
    expect(events.some((e) => e.kind === 'unitLost')).toBe(true);
  });

  it('promotes units on accumulated kill value', () => {
    const w = makeWorld();
    const wolf = w.addUnit(getUnit('wolf'), 0, 20.5, 20.5);
    const cannon = getWeapon('wolf_cannon');
    // wolf costs 700: veteran at 2x = 1400 credits of kills
    for (let i = 0; i < 12; i++) {
      const victim = w.addUnit(getUnit('militia'), 1, 30.5, 30.5);
      while (!victim.dead) dealDamage(w, victim, 999, cannon, 0, wolf.id);
    }
    expect(wolf.rank).toBeGreaterThanOrEqual(1);
    const events = w.events.drain();
    expect(events.some((e) => e.kind === 'promoted')).toBe(true);
  });

  it('elite units take reduced damage', () => {
    const w = makeWorld();
    const a = w.addUnit(getUnit('bear'), 0, 20.5, 20.5);
    const b = w.addUnit(getUnit('bear'), 0, 24.5, 24.5);
    b.rank = 2;
    const shell = getWeapon('wolf_cannon');
    dealDamage(w, a, 100, shell, 1, 0);
    dealDamage(w, b, 100, shell, 1, 0);
    expect(b.def.hp - b.hp).toBeLessThan(a.def.hp - a.hp);
  });

  it('aegis-shielded units are invulnerable', () => {
    const w = makeWorld();
    const u = w.addUnit(getUnit('militia'), 0, 20.5, 20.5);
    u.aegisUntil = w.tick + 100;
    dealDamage(w, u, 9999, getWeapon('bear_cannon'), 1, 0);
    expect(u.hp).toBe(u.def.hp);
  });

  it('keeps AA and AG weapon roles separated in data', () => {
    expect(getWeapon('sam_missile').antiGround).toBe(false);
    expect(getWeapon('sam_missile').antiAir).toBe(true);
    expect(getWeapon('bear_cannon').antiAir).toBe(false);
    expect(getWeapon('flak_cannon_gun').antiGround).toBe(false);
  });

  it('defensive structures engage hostiles that walk into range', () => {
    const w = makeWorld();
    const sentry = w.addBuilding(getBuilding('sentry'), 1, 30, 30, true);
    const victim = w.addUnit(getUnit('guardsman'), 0, 32.5, 32.5);
    run(w, 60);
    expect(victim.hp).toBeLessThan(victim.def.hp);
    expect(sentry.dead).toBe(false);
  });

  it('treats allies and neutrals correctly', () => {
    const w = makeWorld();
    expect(areEnemies(w, 0, 1)).toBe(true);
    expect(areEnemies(w, 0, 0)).toBe(false);
    expect(areEnemies(w, 0, -1)).toBe(false);
  });

  it('killEntity clears building occupancy', () => {
    const w = makeWorld();
    const b = w.addBuilding(getBuilding('barracks'), 0, 40, 40, true);
    expect(w.map.occupierAt(40, 40)).toBe(b.id);
    killEntity(w, b, 1, 0);
    expect(w.map.occupierAt(40, 40)).toBe(0);
  });
});
