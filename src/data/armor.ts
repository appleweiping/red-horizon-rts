import type { ArmorType, WarheadType } from '../core/types';

/**
 * Damage multiplier matrix: DAMAGE_MATRIX[warhead][armor].
 * The rock-paper-scissors backbone of combat. Values are hand-tuned so that
 * every unit has a clear role and a clear counter (anti-toy guarantee):
 * small arms shred infantry but bounce off tanks, AP guns hunt vehicles,
 * HE flattens structures, flak owns the sky and little else.
 */
export const DAMAGE_MATRIX: Record<WarheadType, Record<ArmorType, number>> = {
  sa: {
    none: 1.0, flak: 0.9, plate: 0.55,
    light: 0.5, medium: 0.25, heavy: 0.15,
    wood: 0.4, steel: 0.25, concrete: 0.1,
  },
  sniper: {
    none: 2.5, flak: 2.0, plate: 1.5,
    light: 0.1, medium: 0.05, heavy: 0.05,
    wood: 0.05, steel: 0.05, concrete: 0.05,
  },
  ap: {
    none: 0.45, flak: 0.5, plate: 0.4,
    light: 1.0, medium: 0.85, heavy: 0.7,
    wood: 0.6, steel: 0.5, concrete: 0.3,
  },
  shell: {
    none: 0.5, flak: 0.55, plate: 0.5,
    light: 0.9, medium: 1.0, heavy: 0.9,
    wood: 0.7, steel: 0.65, concrete: 0.5,
  },
  he: {
    none: 0.9, flak: 0.85, plate: 0.7,
    light: 0.75, medium: 0.6, heavy: 0.5,
    wood: 1.0, steel: 0.9, concrete: 0.65,
  },
  arc: {
    none: 1.0, flak: 1.0, plate: 0.9,
    light: 1.0, medium: 0.9, heavy: 0.8,
    wood: 0.8, steel: 0.9, concrete: 0.6,
  },
  beam: {
    none: 0.9, flak: 0.9, plate: 0.8,
    light: 1.0, medium: 0.95, heavy: 0.85,
    wood: 0.9, steel: 0.85, concrete: 0.7,
  },
  bomb: {
    none: 1.0, flak: 1.0, plate: 0.9,
    light: 0.9, medium: 0.85, heavy: 0.75,
    wood: 1.2, steel: 1.1, concrete: 0.9,
  },
  nuke: {
    none: 1.2, flak: 1.2, plate: 1.1,
    light: 1.0, medium: 1.0, heavy: 0.9,
    wood: 1.3, steel: 1.2, concrete: 1.0,
  },
  c4: {
    none: 0.3, flak: 0.3, plate: 0.3,
    light: 0.2, medium: 0.2, heavy: 0.2,
    wood: 5.0, steel: 5.0, concrete: 5.0,
  },
  suicide: {
    none: 1.1, flak: 1.1, plate: 1.0,
    light: 0.9, medium: 0.8, heavy: 0.7,
    wood: 1.3, steel: 1.2, concrete: 0.9,
  },
  flakhead: {
    none: 1.1, flak: 1.2, plate: 0.9,
    light: 0.6, medium: 0.4, heavy: 0.3,
    wood: 0.4, steel: 0.35, concrete: 0.2,
  },
  depth: {
    none: 0.1, flak: 0.1, plate: 0.1,
    light: 0.6, medium: 0.7, heavy: 1.2,
    wood: 0.3, steel: 0.3, concrete: 0.2,
  },
};

export function damageMultiplier(warhead: WarheadType, armor: ArmorType): number {
  return DAMAGE_MATRIX[warhead][armor];
}
