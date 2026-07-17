import { Terrain } from '../core/types';
import type { MapDef } from '../core/types';
import { Rng } from '../core/rng';
import { clamp } from '../core/math';
import { GameMap } from './terrain';

/**
 * Seeded procedural map generator. The same MapDef always yields the same
 * battlefield: value-noise landmass with lakes, cliff ridges, roads between
 * spawns with bridges over water, guaranteed ore near every spawn, gem
 * fields and oil derricks contested in the middle.
 */
export function generateMap(def: MapDef): GameMap {
  const rng = new Rng(def.seed);
  const map = new GameMap(def.width, def.height);
  const { width: W, height: H } = map;

  // -- value noise ----------------------------------------------------------
  const GRID = 8;
  const gw = Math.ceil(W / GRID) + 2;
  const gh = Math.ceil(H / GRID) + 2;
  const lattice = new Float32Array(gw * gh);
  for (let i = 0; i < lattice.length; i++) lattice[i] = rng.next();

  const smooth = (t: number) => t * t * (3 - 2 * t);
  const noise = (x: number, y: number): number => {
    const gx = x / GRID;
    const gy = y / GRID;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const fx = smooth(gx - x0);
    const fy = smooth(gy - y0);
    const v = (xx: number, yy: number) => lattice[yy * gw + xx];
    const a = v(x0, y0) + (v(x0 + 1, y0) - v(x0, y0)) * fx;
    const b = v(x0, y0 + 1) + (v(x0 + 1, y0 + 1) - v(x0, y0 + 1)) * fx;
    return a + (b - a) * fy;
  };

  // -- base terrain: water in noise basins, cliffs on ridges -----------------
  const waterLevel = def.water * 0.32;
  const cliffBand = 0.04;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = noise(x, y);
      const i = map.idx(x, y);
      if (n < waterLevel) map.terrain[i] = Terrain.Water;
      else if (n < waterLevel + 0.045) map.terrain[i] = Terrain.Shore;
      else if (n > 0.86 && n < 0.86 + cliffBand) map.terrain[i] = Terrain.Cliff;
      else map.terrain[i] = Terrain.Grass;
    }
  }

  // -- spawn points on an inset ring -----------------------------------------
  const cx = W / 2;
  const cy = H / 2;
  const ring = Math.min(W, H) * 0.36;
  const angle0 = rng.next() * Math.PI * 2;
  for (let p = 0; p < def.maxPlayers; p++) {
    const a = angle0 + (p / def.maxPlayers) * Math.PI * 2;
    const sx = clamp(Math.round(cx + Math.cos(a) * ring), 8, W - 9);
    const sy = clamp(Math.round(cy + Math.sin(a) * ring), 8, H - 9);
    map.spawns.push({ x: sx, y: sy });
  }

  // -- flatten spawn areas so every base site is usable ----------------------
  const flatten = (sx: number, sy: number, r: number) => {
    for (let y = sy - r; y <= sy + r; y++) {
      for (let x = sx - r; x <= sx + r; x++) {
        if (!map.inBounds(x, y)) continue;
        const d = Math.hypot(x - sx, y - sy);
        if (d <= r) map.terrain[map.idx(x, y)] = Terrain.Grass;
      }
    }
  };
  for (const s of map.spawns) flatten(s.x, s.y, 11);

  // -- roads between neighbouring spawns, bridging water ---------------------
  const drawRoad = (x0: number, y0: number, x1: number, y1: number) => {
    let x = x0;
    let y = y0;
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      // gentle sine wobble so roads do not look laser-drawn
      const wob = Math.sin(t * Math.PI * 3) * 2.5;
      const px = Math.round(x + (x1 - x0) * t + wob * (y1 - y0 === 0 ? 0 : 1) * 0.3);
      const py = Math.round(y + (y1 - y0) * t + wob * 0.3);
      for (let dy = 0; dy <= 1; dy++) {
        for (let dx = 0; dx <= 1; dx++) {
          const tx = px + dx;
          const ty = py + dy;
          if (!map.inBounds(tx, ty)) continue;
          const i = map.idx(tx, ty);
          const t0 = map.terrain[i] as Terrain;
          map.terrain[i] =
            t0 === Terrain.Water || t0 === Terrain.Shore ? Terrain.Bridge : Terrain.Road;
        }
      }
    }
  };
  for (let p = 0; p < map.spawns.length; p++) {
    const a = map.spawns[p];
    const b = map.spawns[(p + 1) % map.spawns.length];
    drawRoad(a.x, a.y, b.x, b.y);
    // spoke to center keeps mid-map contested and reachable
    if (p % 2 === 0) drawRoad(a.x, a.y, Math.round(cx), Math.round(cy));
  }

  // -- ore fields -------------------------------------------------------------
  const paintOre = (ox: number, oy: number, r: number, gems: boolean, richness: number) => {
    for (let y = oy - r; y <= oy + r; y++) {
      for (let x = ox - r; x <= ox + r; x++) {
        if (!map.inBounds(x, y)) continue;
        const d = Math.hypot(x - ox, y - oy);
        if (d > r) continue;
        const i = map.idx(x, y);
        if (map.terrain[i] !== Terrain.Grass) continue;
        if (rng.next() > 0.82 - (d / r) * 0.5) continue;
        map.terrain[i] = Terrain.OreBearing;
        map.oreKind[i] = gems ? 2 : 1;
        map.ore[i] = Math.round((gems ? 10 : 16) * richness * rng.range(0.7, 1.3));
      }
    }
  };
  const richness = 0.6 + def.ore * 0.9;
  for (const s of map.spawns) {
    // two guaranteed patches near every spawn, offset toward map center
    const toC = Math.atan2(cy - s.y, cx - s.x);
    for (let k = 0; k < 2; k++) {
      const a = toC + rng.jitter(1.2) + (k === 0 ? 0.6 : -0.6);
      const d = rng.range(7, 10);
      paintOre(
        Math.round(s.x + Math.cos(a) * d),
        Math.round(s.y + Math.sin(a) * d),
        4, false, richness,
      );
    }
  }
  // contested center fields, some with gems
  const centerFields = 3 + Math.round(def.ore * 3);
  for (let k = 0; k < centerFields; k++) {
    const a = rng.next() * Math.PI * 2;
    const d = rng.range(4, ring * 0.55);
    paintOre(
      Math.round(cx + Math.cos(a) * d),
      Math.round(cy + Math.sin(a) * d),
      rng.int(2) + 3, k % 2 === 0, richness,
    );
  }

  // -- scattered trees ---------------------------------------------------------
  const treeCount = Math.round(W * H * 0.012);
  for (let k = 0; k < treeCount; k++) {
    const x = rng.int(W);
    const y = rng.int(H);
    const i = map.idx(x, y);
    if (map.terrain[i] !== Terrain.Grass) continue;
    // keep spawn areas clear
    if (map.spawns.some((s) => Math.hypot(x - s.x, y - s.y) < 12)) continue;
    map.terrain[i] = Terrain.Trees;
  }

  // -- oil derrick sites in the contested middle -------------------------------
  const derrickCount = 2 + (def.maxPlayers > 2 ? 2 : 0);
  let attempts = 0;
  while (map.derricks.length < derrickCount && attempts++ < 300) {
    const a = rng.next() * Math.PI * 2;
    const d = rng.range(3, ring * 0.5);
    const tx = Math.round(cx + Math.cos(a) * d);
    const ty = Math.round(cy + Math.sin(a) * d);
    let ok = true;
    for (let y = ty; y < ty + 2 && ok; y++) {
      for (let x = tx; x < tx + 2 && ok; x++) {
        if (!map.inBounds(x, y) || map.terrain[map.idx(x, y)] !== Terrain.Grass) ok = false;
      }
    }
    if (ok && map.derricks.every((o) => Math.hypot(o.x - tx, o.y - ty) > 8)) {
      map.derricks.push({ x: tx, y: ty });
    }
  }

  return map;
}
