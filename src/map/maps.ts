import type { MapDef } from '../core/types';

/** Preset skirmish battlefields. Each is fully deterministic from its seed. */
export const MAPS: MapDef[] = [
  {
    id: 'emerald_divide',
    name: 'Emerald Divide',
    desc: 'A green 1v1 valley split by a lazy river. Classic opener.',
    width: 96, height: 96, seed: 0x5eed0001, maxPlayers: 2, water: 0.35, ore: 0.6,
  },
  {
    id: 'dry_thunder',
    name: 'Dry Thunder',
    desc: 'Parched flats, thin ore, roads everywhere. Rush at your peril.',
    width: 96, height: 96, seed: 0x5eed0002, maxPlayers: 2, water: 0.05, ore: 0.45,
  },
  {
    id: 'archipelago_war',
    name: 'Archipelago War',
    desc: 'Water rules this map. Bring a navy or stay home.',
    width: 112, height: 112, seed: 0x5eed0003, maxPlayers: 2, water: 0.75, ore: 0.7,
  },
  {
    id: 'four_corners',
    name: 'Four Corners',
    desc: 'Four bases, one gem-rich center. Free-for-all mayhem.',
    width: 128, height: 128, seed: 0x5eed0004, maxPlayers: 4, water: 0.3, ore: 0.8,
  },
  {
    id: 'gold_rush_gorge',
    name: 'Gold Rush Gorge',
    desc: 'Overflowing ore and cliffs to fight over. Economy wins wars.',
    width: 112, height: 112, seed: 0x5eed0005, maxPlayers: 3, water: 0.15, ore: 1.0,
  },
  {
    id: 'midnight_delta',
    name: 'Midnight Delta',
    desc: 'A big 4-player delta of islands, bridges and oil.',
    width: 128, height: 128, seed: 0x5eed0006, maxPlayers: 4, water: 0.55, ore: 0.7,
  },
];

export function getMapDef(id: string): MapDef {
  const m = MAPS.find((x) => x.id === id);
  if (!m) throw new Error(`Unknown map: ${id}`);
  return m;
}
