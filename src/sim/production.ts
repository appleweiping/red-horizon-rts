import type { ProductionTab } from '../core/types';
import {
  EXTRA_FACTORY_MULT, LOW_POWER_BUILD_MULT, MAX_FACTORY_MULT,
} from '../core/constants';
import { getBuilding, getUnit, BUILDING_BY_ID } from '../data';
import type { PlayerState } from './player';
import type { World } from './world';

/** Which factory class serves each unit tab. */
const TAB_FACTORY: Record<string, string> = {
  infantry: 'infantry',
  vehicle: 'vehicle',
  air: 'aircraft',
  naval: 'ship',
};

/** Does the player own a completed building with this def id? */
export function ownsBuilding(world: World, playerId: number, defId: string): boolean {
  for (const b of world.buildings.values()) {
    if (!b.dead && b.player === playerId && b.def.id === defId && b.constructTicks <= 0) {
      return true;
    }
  }
  return false;
}

export function prereqsMet(world: World, playerId: number, prereqs: string[]): boolean {
  return prereqs.every((p) => ownsBuilding(world, playerId, p));
}

/** Count completed factories able to produce for a tab (build speed bonus). */
function factoryCount(world: World, playerId: number, tab: ProductionTab): number {
  if (tab === 'building' || tab === 'defense') {
    let n = 0;
    for (const b of world.buildings.values()) {
      if (!b.dead && b.player === playerId && b.def.conyard && b.constructTicks <= 0) n++;
    }
    return n;
  }
  const cls = TAB_FACTORY[tab];
  let n = 0;
  for (const b of world.buildings.values()) {
    if (!b.dead && b.player === playerId && b.def.factory === cls && b.constructTicks <= 0) n++;
  }
  return n;
}

/** Can this def be queued right now (faction, prereqs, factory present)? */
export function canQueue(world: World, player: PlayerState, tab: ProductionTab, defId: string): boolean {
  if (player.defeated) return false;
  const faction = player.config.faction;
  if (tab === 'building' || tab === 'defense') {
    const def = BUILDING_BY_ID.get(defId);
    if (!def || def.conyard || def.faction === 'neutral') return false;
    if (def.faction !== 'both' && def.faction !== faction) return false;
    if (def.tab !== tab) return false;
    if (factoryCount(world, player.id, tab) === 0) return false;
    return prereqsMet(world, player.id, def.prerequisites);
  }
  const def = getUnit(defId);
  if (def.faction !== 'both' && def.faction !== faction) return false;
  if (def.tab !== tab) return false;
  if (factoryCount(world, player.id, tab) === 0) return false;
  if (def.unique) {
    for (const u of world.units.values()) {
      if (!u.dead && u.player === player.id && u.def.id === defId) return false;
    }
    // also blocked while one is already queued
    if (player.queues[tab].items.some((i) => i.def === defId)) return false;
  }
  return prereqsMet(world, player.id, def.prerequisites);
}

export function startProduction(
  world: World, player: PlayerState, tab: ProductionTab, defId: string,
): void {
  if (!canQueue(world, player, tab, defId)) return;
  const q = player.queues[tab];
  const isStructure = tab === 'building' || tab === 'defense';
  if (isStructure && (q.items.length > 0 || q.ready)) return; // one at a time
  if (!isStructure && q.items.length >= 9) return;
  const def = isStructure ? getBuilding(defId) : getUnit(defId);
  q.items.push({
    def: defId, progress: 0, paid: 0,
    total: def.buildTime, cost: def.cost,
  });
  q.hold = false;
}

export function cancelProduction(world: World, player: PlayerState, tab: ProductionTab): void {
  const q = player.queues[tab];
  if (q.ready) {
    // refund a placed-but-unbuilt structure fully (it was fully paid)
    const def = getBuilding(q.ready);
    player.credits += def.cost;
    q.ready = null;
    return;
  }
  const item = q.items.shift();
  if (item) player.credits += item.paid;
}

/** Advance every queue one tick: pay-as-you-go, low-power slowdown. */
export function updateProduction(world: World, player: PlayerState): void {
  for (const tab of Object.keys(player.queues) as ProductionTab[]) {
    const q = player.queues[tab];
    if (q.fundsNagCooldown > 0) q.fundsNagCooldown--;
    if (q.hold || q.items.length === 0) continue;
    if ((tab === 'building' || tab === 'defense') && q.ready) continue;

    const factories = factoryCount(world, player.id, tab);
    if (factories === 0) continue; // factory destroyed mid-build: pause

    const item = q.items[0];
    let speed = Math.min(1 + (factories - 1) * EXTRA_FACTORY_MULT, MAX_FACTORY_MULT);
    if (player.lowPower) speed *= LOW_POWER_BUILD_MULT;

    const costDue = (item.cost * Math.min(speed, item.total - item.progress)) / item.total;
    if (player.credits < costDue) {
      if (q.fundsNagCooldown === 0) {
        world.events.emit({ kind: 'insufficientFunds', player: player.id });
        q.fundsNagCooldown = 100;
      }
      continue;
    }
    player.credits -= costDue;
    item.paid += costDue;
    player.stats.creditsSpent += costDue;
    item.progress += speed;

    if (item.progress >= item.total) {
      q.items.shift();
      if (tab === 'building' || tab === 'defense') {
        q.ready = item.def;
        world.events.emit({ kind: 'constructionComplete', player: player.id, def: item.def });
      } else {
        world.spawnProducedUnit(player, item.def);
      }
    }
  }
}
