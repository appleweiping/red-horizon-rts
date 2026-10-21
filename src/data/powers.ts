import type { SupportPowerDef } from '../core/types';
import { TICKS_PER_SEC } from '../core/constants';

const MIN = 60 * TICKS_PER_SEC;

/** Superweapons — two per faction, charged by their dedicated structures. */
export const POWERS: SupportPowerDef[] = [
  {
    id: 'stormstrike',
    name: 'Tempest Strike',
    desc: 'Calls a concentrated ion storm down on the target area.',
    kind: 'storm',
    faction: 'concord',
    chargeTicks: 8 * MIN,
    radius: 4,
    damage: 110, // per bolt; the storm drops ~14 bolts
    announce: 'Tempest strike initiated.',
  },
  {
    id: 'phase_jump',
    name: 'Phase Gate',
    desc: 'Teleports your selected combat units to the target location.',
    kind: 'phase',
    faction: 'concord',
    chargeTicks: 5 * MIN,
    radius: 3,
    damage: 0,
    announce: 'Phase jump engaged.',
  },
  {
    id: 'icbm',
    name: 'ICBM Launch',
    desc: 'A single ballistic warhead. Everything near the impact point dies.',
    kind: 'nuke',
    faction: 'pact',
    chargeTicks: 10 * MIN,
    radius: 5,
    damage: 1500,
    announce: 'Missile launched.',
  },
  {
    id: 'aegis',
    name: 'Aegis Field',
    desc: 'Renders friendly units in the area invulnerable for 8 seconds.',
    kind: 'aegis',
    faction: 'pact',
    chargeTicks: 5 * MIN,
    radius: 4,
    damage: 0,
    announce: 'Aegis field deployed.',
  },
];

export const POWER_BY_ID: ReadonlyMap<string, SupportPowerDef> = new Map(
  POWERS.map((p) => [p.id, p]),
);

export function getPower(id: string): SupportPowerDef {
  const p = POWER_BY_ID.get(id);
  if (!p) throw new Error(`Unknown support power: ${id}`);
  return p;
}
