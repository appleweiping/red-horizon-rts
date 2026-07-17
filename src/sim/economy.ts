import { Terrain } from '../core/types';
import {
  GEM_VALUE, HARVESTER_CAPACITY, HARVEST_TICKS, ORE_VALUE, UNLOAD_TICKS,
} from '../core/constants';
import { dist2 } from '../core/math';
import type { Unit, Building } from './entity';
import type { World } from './world';

/**
 * The harvester brain: seek ore -> drive out -> mine -> haul home -> unload.
 * Runs every tick for units with def.harvester. Manual orders (harvest tile /
 * return) just reposition the cycle; the loop itself is autonomous.
 */
export function updateHarvester(world: World, u: Unit): void {
  switch (u.hphase) {
    case 'seek': {
      if (u.cargo >= HARVESTER_CAPACITY) {
        u.hphase = 'toRefinery';
        return;
      }
      const tile = findOreTile(world, u);
      if (!tile) {
        if (u.cargo > 0) u.hphase = 'toRefinery';
        return; // idle: no ore known
      }
      u.mineTile = tile;
      u.hphase = 'toOre';
      world.sendTo(u, tile.x + 0.5, tile.y + 0.5);
      return;
    }

    case 'toOre': {
      const t = u.mineTile;
      if (!t) {
        u.hphase = 'seek';
        return;
      }
      if (world.map.ore[world.map.idx(t.x, t.y)] === 0) {
        u.hphase = 'seek'; // someone drained it first
        return;
      }
      if (dist2(u.x, u.y, t.x + 0.5, t.y + 0.5) < 1.2) {
        u.path = null;
        u.hphase = 'mining';
        u.mineTicks = 0;
      } else if (!u.path && u.order.kind === 'none') {
        world.sendTo(u, t.x + 0.5, t.y + 0.5); // path was lost/blocked, retry
      }
      return;
    }

    case 'mining': {
      const t = u.mineTile;
      if (!t || u.cargo >= HARVESTER_CAPACITY) {
        u.hphase = u.cargo > 0 ? 'toRefinery' : 'seek';
        return;
      }
      u.mineTicks++;
      if (u.mineTicks >= HARVEST_TICKS) {
        u.mineTicks = 0;
        const kind = world.map.takeOre(t.x, t.y);
        if (kind === 0) {
          u.hphase = 'seek'; // tile exhausted, look for the next one
          return;
        }
        u.cargo++;
        u.cargoValue += kind === 2 ? GEM_VALUE : ORE_VALUE;
      }
      return;
    }

    case 'toRefinery': {
      const refinery = findRefinery(world, u);
      if (!refinery) return; // no refinery: wait (player must build one)
      u.refineryId = refinery.id;
      const dock = dockPoint(refinery);
      if (dist2(u.x, u.y, dock.x, dock.y) < 1.44) {
        u.path = null;
        u.hphase = 'unloading';
        u.mineTicks = 0;
      } else if (!u.path && u.order.kind === 'none') {
        world.sendTo(u, dock.x, dock.y, refinery.id);
      }
      return;
    }

    case 'unloading': {
      const refinery = world.buildings.get(u.refineryId);
      if (!refinery || refinery.dead) {
        u.hphase = 'toRefinery';
        return;
      }
      u.mineTicks++;
      if (u.mineTicks >= UNLOAD_TICKS) {
        const player = world.players[u.player];
        player.credits += u.cargoValue;
        player.stats.creditsHarvested += u.cargoValue;
        world.events.emit({ kind: 'harvested', player: u.player, amount: u.cargoValue });
        u.cargo = 0;
        u.cargoValue = 0;
        u.mineTicks = 0;
        u.hphase = 'seek';
      }
      return;
    }
  }
}

/** Nearest ore tile, preferring the current patch, then anywhere explored. */
function findOreTile(world: World, u: Unit): { x: number; y: number } | null {
  const map = world.map;
  const ux = Math.floor(u.x);
  const uy = Math.floor(u.y);
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  // spiral out to a generous radius; harvesters will trek if they must
  const R = 40;
  for (let r = 0; r <= R; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = ux + dx;
        const y = uy + dy;
        if (!map.inBounds(x, y)) continue;
        if (map.ore[map.idx(x, y)] === 0) continue;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = { x, y };
        }
      }
    }
    if (best && r > Math.sqrt(bestD) + 2) break; // ring search can stop early
  }
  return best;
}

function findRefinery(world: World, u: Unit): Building | null {
  let best: Building | null = null;
  let bestD = Infinity;
  for (const b of world.buildings.values()) {
    if (b.dead || b.player !== u.player || !b.def.refinery || b.constructTicks > 0) continue;
    const d = dist2(u.x, u.y, b.cx, b.cy);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}

/** Harvesters dock at the south face of the refinery. */
export function dockPoint(refinery: Building): { x: number; y: number } {
  return { x: refinery.cx, y: refinery.ty + refinery.def.h + 0.6 };
}

/** Neutral-tech and per-building passive income (oil derricks). */
export function updateIncome(world: World, b: Building): void {
  if (!b.def.income || b.player < 0 || b.dead) return;
  b.incomeAccum += b.def.income / 20; // per tick share of credits-per-second
  if (b.incomeAccum >= 1) {
    const whole = Math.floor(b.incomeAccum);
    b.incomeAccum -= whole;
    world.players[b.player].credits += whole;
  }
}
