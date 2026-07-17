import type { MatchConfig, PlayerConfig } from '../src/core/types';
import { World } from '../src/sim/world';

/** Standard two-player test world (no AI so tests control everything). */
export function makeWorld(overrides: Partial<MatchConfig> = {}, aiPlayers = false): World {
  const players: PlayerConfig[] = [
    { name: 'P0', faction: 'concord', color: '#e8b023', isAI: aiPlayers, difficulty: 'normal' },
    { name: 'P1', faction: 'pact', color: '#d63c3c', isAI: aiPlayers, difficulty: 'normal' },
  ];
  return new World({
    mapId: 'emerald_divide',
    seed: 12345,
    players,
    startingCredits: 10000,
    speed: 1,
    superweapons: true,
    ...overrides,
  });
}

export function run(world: World, ticks: number): void {
  for (let i = 0; i < ticks; i++) world.step();
}

/** Order-independent structural fingerprint of the sim state. */
export function stateHash(world: World): number {
  let h = 0;
  for (const u of world.units.values()) {
    h = (h + u.id * 31 + Math.round(u.x * 1000) * 7 + Math.round(u.y * 1000) * 13 +
      Math.round(u.hp * 10) * 3) | 0;
  }
  for (const b of world.buildings.values()) {
    h = (h + b.id * 17 + b.tx * 5 + b.ty * 11 + Math.round(b.hp * 10)) | 0;
  }
  for (const p of world.players) {
    h = (h + Math.round(p.credits * 100)) | 0;
  }
  return h;
}
