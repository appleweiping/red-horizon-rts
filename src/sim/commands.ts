import type { Command } from '../core/types';
import { SELL_REFUND } from '../core/constants';
import { getBuilding } from '../data/buildings';
import type { World } from './world';
import { cancelProduction, startProduction } from './production';
import { firePower } from './superweapons';

/**
 * Apply one player command to the simulation. Commands are the only way any
 * intent (human or AI) enters the sim, which keeps replay/lockstep on the
 * table: same seed + same command stream = same battle.
 */
export function applyCommand(world: World, cmd: Command): void {
  switch (cmd.kind) {
    case 'move': {
      const spread = formationOffsets(cmd.units.length);
      let i = 0;
      for (const id of cmd.units) {
        const u = world.units.get(id);
        if (!u || u.dead) continue;
        const [ox, oy] = spread[i++ % spread.length];
        const order = { kind: 'move' as const, x: cmd.x + ox, y: cmd.y + oy };
        if (cmd.queued) u.queueOrder(order);
        else u.setOrder(order);
      }
      break;
    }
    case 'attackMove': {
      const spread = formationOffsets(cmd.units.length);
      let i = 0;
      for (const id of cmd.units) {
        const u = world.units.get(id);
        if (!u || u.dead) continue;
        const [ox, oy] = spread[i++ % spread.length];
        u.setOrder({ kind: 'attackMove', x: cmd.x + ox, y: cmd.y + oy });
      }
      break;
    }
    case 'attack': {
      for (const id of cmd.units) {
        const u = world.units.get(id);
        if (!u || u.dead) continue;
        u.setOrder({ kind: 'attack', target: cmd.target });
      }
      break;
    }
    case 'stop': {
      for (const id of cmd.units) {
        const u = world.units.get(id);
        if (!u || u.dead) continue;
        u.setOrder({ kind: 'none' });
        u.guardX = u.x;
        u.guardY = u.y;
      }
      break;
    }
    case 'deploy': {
      for (const id of cmd.units) {
        const u = world.units.get(id);
        if (!u || u.dead || !u.def.deployable) continue;
        u.setOrder({ kind: 'deploy' });
      }
      break;
    }
    case 'harvest': {
      for (const id of cmd.units) {
        const u = world.units.get(id);
        if (!u || u.dead || !u.def.harvester) continue;
        u.setOrder({ kind: 'none' });
        u.mineTile = { x: cmd.tx, y: cmd.ty };
        u.hphase = 'toOre';
        world.sendTo(u, cmd.tx + 0.5, cmd.ty + 0.5);
      }
      break;
    }
    case 'capture': {
      for (const id of cmd.units) {
        const u = world.units.get(id);
        if (!u || u.dead || !u.def.engineer) continue;
        u.setOrder({ kind: 'capture', target: cmd.target });
      }
      break;
    }
    case 'startProduction':
      startProduction(world, world.players[cmd.player], cmd.tab, cmd.def);
      break;
    case 'cancelProduction':
      cancelProduction(world, world.players[cmd.player], cmd.tab);
      break;
    case 'pauseProduction': {
      const q = world.players[cmd.player].queues[cmd.tab];
      q.hold = !q.hold;
      break;
    }
    case 'placeBuilding': {
      const player = world.players[cmd.player];
      const q = player.queues[getBuilding(cmd.def).tab];
      if (q.ready !== cmd.def) break;
      const def = getBuilding(cmd.def);
      if (!world.canPlaceBuilding(cmd.player, def, cmd.tx, cmd.ty, {})) break;
      q.ready = null;
      world.addBuilding(def, cmd.player, cmd.tx, cmd.ty);
      player.stats.buildingsBuilt++;
      break;
    }
    case 'sell': {
      const b = world.buildings.get(cmd.building);
      if (!b || b.dead || b.player !== cmd.player) break;
      const refund = Math.floor(b.def.cost * SELL_REFUND * (b.hp / b.def.hp));
      world.players[cmd.player].credits += refund;
      world.events.emit({ kind: 'sold', player: cmd.player, x: b.cx, y: b.cy });
      b.dead = true;
      world.map.setOccupancy(b.tx, b.ty, b.def.w, b.def.h, 0);
      break;
    }
    case 'repair': {
      const b = world.buildings.get(cmd.building);
      if (!b || b.dead || b.player !== cmd.player) break;
      b.repairing = !b.repairing;
      break;
    }
    case 'setRally': {
      const b = world.buildings.get(cmd.building);
      if (!b || b.dead) break;
      b.rally = { x: cmd.x, y: cmd.y };
      break;
    }
    case 'firePower':
      firePower(world, world.players[cmd.player], cmd.power, cmd.x, cmd.y, cmd.units ?? []);
      break;
  }
}

/** Loose diamond formation offsets so grouped moves don't dogpile one tile. */
function formationOffsets(n: number): Array<[number, number]> {
  const out: Array<[number, number]> = [[0, 0]];
  let ring = 1;
  while (out.length < n) {
    for (let i = 0; i < ring * 6 && out.length < n; i++) {
      const a = (i / (ring * 6)) * Math.PI * 2;
      out.push([Math.cos(a) * ring * 0.9, Math.sin(a) * ring * 0.9]);
    }
    ring++;
  }
  return out;
}
