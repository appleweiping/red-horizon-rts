import type { MoveDomain } from '../core/types';
import type { GameMap } from '../map/terrain';
import type { Vec2 } from '../core/math';
import { ASTAR_MAX_EXPANSIONS } from '../core/constants';

/**
 * 8-directional A* over the tile grid with terrain costs and building
 * occupancy, followed by line-of-sight string pulling so units drive in
 * straight lines instead of tile staircases.
 */

const DIRS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
] as const;
const SQRT2 = Math.SQRT2;

interface Node {
  x: number;
  y: number;
  g: number;
  f: number;
  parent: Node | null;
}

/** Binary min-heap keyed on f. */
class Heap {
  private a: Node[] = [];

  get size(): number {
    return this.a.length;
  }

  push(n: Node): void {
    const a = this.a;
    a.push(n);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }

  pop(): Node {
    const a = this.a;
    const top = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

function octile(dx: number, dy: number): number {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  return ax > ay ? ax + (SQRT2 - 1) * ay : ay + (SQRT2 - 1) * ax;
}

/** Find the nearest passable tile to (tx, ty) via ring search (radius <= 6). */
export function nearestPassable(
  map: GameMap, tx: number, ty: number, domain: MoveDomain, allowId = 0,
): { x: number; y: number } | null {
  if (map.isPassable(tx, ty, domain, allowId)) return { x: tx, y: ty };
  for (let r = 1; r <= 6; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (map.isPassable(tx + dx, ty + dy, domain, allowId)) {
          return { x: tx + dx, y: ty + dy };
        }
      }
    }
  }
  return null;
}

/** Bresenham LOS: every tile on the segment must be passable. */
function lineClear(
  map: GameMap, x0: number, y0: number, x1: number, y1: number,
  domain: MoveDomain, allowId: number,
): boolean {
  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  for (;;) {
    if (!map.isPassable(x, y, domain, allowId)) return false;
    if (x === x1 && y === y1) return true;
    const e2 = 2 * err;
    // when the line crosses a corner, require one of the adjacent tiles open
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    } else if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

/**
 * Compute a path in world coordinates (tile centers). Returns null when no
 * path exists or the search budget is exhausted (caller falls back to a
 * direct move so units never freeze).
 */
export function findPath(
  map: GameMap,
  fromX: number, fromY: number,
  toX: number, toY: number,
  domain: MoveDomain,
  allowId = 0,
): Vec2[] | null {
  const sx = Math.floor(fromX);
  const sy = Math.floor(fromY);
  const goal = nearestPassable(map, Math.floor(toX), Math.floor(toY), domain, allowId);
  if (!goal) return null;
  const gx = goal.x;
  const gy = goal.y;
  if (sx === gx && sy === gy) return [{ x: gx + 0.5, y: gy + 0.5 }];

  // air units fly straight
  if (domain === 'air') return [{ x: toX, y: toY }];

  const W = map.width;
  const open = new Heap();
  const best = new Map<number, number>(); // tile idx -> best g
  const start: Node = { x: sx, y: sy, g: 0, f: octile(gx - sx, gy - sy), parent: null };
  open.push(start);
  best.set(sy * W + sx, 0);

  let goalNode: Node | null = null;
  let expansions = 0;
  let closest: Node = start;
  let closestH = octile(gx - sx, gy - sy);

  while (open.size > 0 && expansions < ASTAR_MAX_EXPANSIONS) {
    const cur = open.pop();
    expansions++;
    if (cur.x === gx && cur.y === gy) {
      goalNode = cur;
      break;
    }
    const h = octile(gx - cur.x, gy - cur.y);
    if (h < closestH) {
      closestH = h;
      closest = cur;
    }
    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!map.isPassable(nx, ny, domain, allowId)) continue;
      // no diagonal corner cutting through blocked tiles
      if (dx !== 0 && dy !== 0) {
        if (!map.isPassable(cur.x + dx, cur.y, domain, allowId)) continue;
        if (!map.isPassable(cur.x, cur.y + dy, domain, allowId)) continue;
      }
      const stepCost =
        (dx !== 0 && dy !== 0 ? SQRT2 : 1) *
        (domain === 'ground' ? map.moveCost(nx, ny) : 1);
      const g = cur.g + stepCost;
      const key = ny * W + nx;
      const prev = best.get(key);
      if (prev !== undefined && prev <= g) continue;
      best.set(key, g);
      open.push({ x: nx, y: ny, g, f: g + octile(gx - nx, gy - ny), parent: cur });
    }
  }

  // unreachable: path toward the closest approach so units still try
  const end = goalNode ?? (closestH < octile(gx - sx, gy - sy) ? closest : null);
  if (!end) return null;

  const tiles: { x: number; y: number }[] = [];
  for (let n: Node | null = end; n; n = n.parent) tiles.push({ x: n.x, y: n.y });
  tiles.reverse();

  // string pulling: keep only waypoints where LOS breaks
  const out: Vec2[] = [];
  let anchor = 0;
  for (let i = 2; i < tiles.length; i++) {
    if (!lineClear(map, tiles[anchor].x, tiles[anchor].y, tiles[i].x, tiles[i].y, domain, allowId)) {
      anchor = i - 1;
      out.push({ x: tiles[anchor].x + 0.5, y: tiles[anchor].y + 0.5 });
    }
  }
  const last = tiles[tiles.length - 1];
  out.push({ x: last.x + 0.5, y: last.y + 0.5 });
  return out;
}
