import { FOG_EXPLORED, FOG_SHROUD, FOG_VISIBLE } from '../core/constants';
import type { GameMap } from '../map/terrain';
import type { PlayerState } from './player';
import type { Building, Unit } from './entity';

/** Precomputed circle offsets per integer radius. */
const circleCache = new Map<number, Int16Array>();

function circleOffsets(r: number): Int16Array {
  let c = circleCache.get(r);
  if (c) return c;
  const pts: number[] = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= r * r) pts.push(dx, dy);
    }
  }
  c = new Int16Array(pts);
  circleCache.set(r, c);
  return c;
}

/**
 * Recompute a player's fog layer. Two passes: everything currently visible
 * decays to explored, then every allied unit/building stamps fresh vision.
 */
export function updateFog(
  map: GameMap,
  player: PlayerState,
  allPlayers: PlayerState[],
  units: Iterable<Unit>,
  buildings: Iterable<Building>,
): void {
  const fog = player.fog;
  for (let i = 0; i < fog.length; i++) {
    if (fog[i] === FOG_VISIBLE) fog[i] = FOG_EXPLORED;
  }

  const W = map.width;
  const H = map.height;
  const stamp = (cx: number, cy: number, sight: number) => {
    const r = Math.round(sight);
    const offs = circleOffsets(r);
    const bx = Math.floor(cx);
    const by = Math.floor(cy);
    for (let i = 0; i < offs.length; i += 2) {
      const x = bx + offs[i];
      const y = by + offs[i + 1];
      if (x >= 0 && y >= 0 && x < W && y < H) fog[y * W + x] = FOG_VISIBLE;
    }
  };

  for (const u of units) {
    if (u.dead) continue;
    const owner = allPlayers[u.player];
    if (owner && player.isAlliedWith(owner)) stamp(u.x, u.y, u.def.sight);
  }
  for (const b of buildings) {
    if (b.dead || b.player < 0) continue;
    const owner = allPlayers[b.player];
    if (owner && player.isAlliedWith(owner)) stamp(b.cx, b.cy, b.def.sight);
  }
}

export function isVisibleTo(player: PlayerState, map: GameMap, x: number, y: number): boolean {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return false;
  return player.fog[ty * map.width + tx] === FOG_VISIBLE;
}

export function isExploredBy(player: PlayerState, map: GameMap, x: number, y: number): boolean {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return false;
  return player.fog[ty * map.width + tx] !== FOG_SHROUD;
}
