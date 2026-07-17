import type { FactionDef } from '../core/types';

/**
 * The two playable factions. Deliberately asymmetric in the classic mold:
 * Concord fights with precision, speed and trickery; the Pact fights with
 * mass, armor and raw voltage.
 */
export const FACTIONS: FactionDef[] = [
  {
    id: 'concord',
    name: 'Atlantic Concord',
    tagline: 'Precision. Mobility. Light itself as a weapon.',
    color: '#3f7fe0',
  },
  {
    id: 'pact',
    name: 'Crimson Pact',
    tagline: 'Steel floods. Sky burns. Numbers never lie.',
    color: '#d63c3c',
  },
];

export function getFaction(id: string): FactionDef {
  const f = FACTIONS.find((x) => x.id === id);
  if (!f) throw new Error(`Unknown faction: ${id}`);
  return f;
}
