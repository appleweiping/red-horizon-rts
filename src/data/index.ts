import type { BuildingDef, FactionId, ProductionTab, UnitDef } from '../core/types';
import { BUILDINGS, BUILDING_BY_ID, getBuilding } from './buildings';
import { UNITS, UNIT_BY_ID, getUnit } from './units';
import { WEAPONS, WEAPON_BY_ID, getWeapon } from './weapons';
import { POWERS, POWER_BY_ID, getPower } from './powers';
import { FACTIONS, getFaction } from './factions';
import { DAMAGE_MATRIX, damageMultiplier } from './armor';

export {
  BUILDINGS, BUILDING_BY_ID, getBuilding,
  UNITS, UNIT_BY_ID, getUnit,
  WEAPONS, WEAPON_BY_ID, getWeapon,
  POWERS, POWER_BY_ID, getPower,
  FACTIONS, getFaction,
  DAMAGE_MATRIX, damageMultiplier,
};

/** Units a faction can produce in a given sidebar tab (prereqs NOT checked here). */
export function unitsForFaction(faction: FactionId, tab?: ProductionTab): UnitDef[] {
  return UNITS.filter(
    (u) => (u.faction === faction || u.faction === 'both') && (!tab || u.tab === tab),
  );
}

/** Buildings a faction can construct (excludes conyard — it comes from a Pioneer Crawler — and neutrals). */
export function buildingsForFaction(faction: FactionId, tab?: ProductionTab): BuildingDef[] {
  return BUILDINGS.filter(
    (b) =>
      (b.faction === faction || b.faction === 'both') &&
      !b.conyard &&
      (!tab || b.tab === tab),
  );
}

/**
 * Data integrity validation, run by the test suite: every weapon reference,
 * prerequisite chain, superweapon link and deploy target must resolve.
 */
export function validateData(): string[] {
  const errors: string[] = [];
  const buildingIds = new Set(BUILDINGS.map((b) => b.id));

  for (const u of UNITS) {
    for (const w of u.weapons) {
      if (!WEAPON_BY_ID.has(w)) errors.push(`unit ${u.id}: unknown weapon ${w}`);
    }
    for (const p of u.prerequisites) {
      if (!buildingIds.has(p)) errors.push(`unit ${u.id}: unknown prerequisite ${p}`);
    }
    if (u.deploysInto && !buildingIds.has(u.deploysInto)) {
      errors.push(`unit ${u.id}: unknown deploysInto ${u.deploysInto}`);
    }
    if (u.suicide && u.weapons.length === 0) {
      errors.push(`unit ${u.id}: suicide unit needs a warhead weapon`);
    }
    if (u.cost <= 0 || u.hp <= 0 || u.buildTime <= 0) {
      errors.push(`unit ${u.id}: non-positive cost/hp/buildTime`);
    }
  }

  for (const b of BUILDINGS) {
    for (const w of b.weapons ?? []) {
      if (!WEAPON_BY_ID.has(w)) errors.push(`building ${b.id}: unknown weapon ${w}`);
    }
    for (const p of b.prerequisites) {
      if (!buildingIds.has(p)) errors.push(`building ${b.id}: unknown prerequisite ${p}`);
    }
    if (b.superweapon && !POWER_BY_ID.has(b.superweapon)) {
      errors.push(`building ${b.id}: unknown superweapon ${b.superweapon}`);
    }
    if (b.w <= 0 || b.h <= 0) errors.push(`building ${b.id}: bad footprint`);
  }

  for (const p of POWERS) {
    const source = BUILDINGS.find((b) => b.superweapon === p.id);
    if (!source) errors.push(`power ${p.id}: no building charges it`);
  }

  // Every faction must be able to reach every tab's tech from scratch.
  for (const f of FACTIONS) {
    const reachable = new Set<string>(['conyard']);
    let grew = true;
    while (grew) {
      grew = false;
      for (const b of buildingsForFaction(f.id)) {
        if (reachable.has(b.id)) continue;
        if (b.prerequisites.every((p) => reachable.has(p))) {
          reachable.add(b.id);
          grew = true;
        }
      }
    }
    for (const b of buildingsForFaction(f.id)) {
      if (!reachable.has(b.id)) errors.push(`faction ${f.id}: ${b.id} unreachable in tech tree`);
    }
    for (const u of unitsForFaction(f.id)) {
      if (!u.prerequisites.every((p) => reachable.has(p))) {
        errors.push(`faction ${f.id}: unit ${u.id} has unreachable prerequisites`);
      }
    }
  }

  return errors;
}
