import type { AIDifficulty, BuildingDef, ProductionTab } from '../core/types';
import { dist2 } from '../core/math';
import { getBuilding } from '../data/buildings';
import { buildingsForFaction } from '../data';
import type { Building, Unit } from '../sim/entity';
import type { PlayerState } from '../sim/player';
import { canQueue } from '../sim/production';
import type { World } from '../sim/world';

/**
 * Skirmish AI: a pragmatic state machine that plays the same game the human
 * does — it deploys its Pioneer Crawler, grows an economy, climbs the tech tree, walls
 * the base with defenses, scouts, masses waves, defends, captures oil and
 * fires superweapons. Difficulty tunes tempo and army size, not cheats
 * (hard gets a small income trickle, clearly documented).
 */

interface AIMemory {
  enemySpawn: { x: number; y: number } | null;
  scoutSent: boolean;
  waveNumber: number;
  nextWaveCheck: number;
  defendUntil: number;
  defendAt: { x: number; y: number } | null;
  navalGiveUp: boolean;
  placeFail: Map<string, number>;
}

interface Tuning {
  waveSize: number;
  maxArmy: number;
  defenseCount: number;
  incomeTrickle: number;
  refineries: number;
  techUp: boolean;
}

const TUNING: Record<AIDifficulty, Tuning> = {
  easy: { waveSize: 7, maxArmy: 14, defenseCount: 2, incomeTrickle: 0, refineries: 1, techUp: false },
  normal: { waveSize: 12, maxArmy: 24, defenseCount: 4, incomeTrickle: 0, refineries: 2, techUp: true },
  hard: { waveSize: 16, maxArmy: 34, defenseCount: 6, incomeTrickle: 2, refineries: 2, techUp: true },
};

const memories = new WeakMap<World, Map<number, AIMemory>>();

function memory(world: World, player: PlayerState): AIMemory {
  let byPlayer = memories.get(world);
  if (!byPlayer) {
    byPlayer = new Map();
    memories.set(world, byPlayer);
  }
  let m = byPlayer.get(player.id);
  if (!m) {
    m = {
      enemySpawn: null, scoutSent: false, waveNumber: 0,
      nextWaveCheck: 0, defendUntil: 0, defendAt: null,
      navalGiveUp: false, placeFail: new Map(),
    };
    byPlayer.set(player.id, m);
  }
  return m;
}

export function updateAI(world: World, player: PlayerState): void {
  const mem = memory(world, player);
  const tune = TUNING[player.config.difficulty ?? 'normal'];

  player.credits += tune.incomeTrickle; // hard-mode handicap (documented)

  const own = collectOwn(world, player.id);

  // --- 0. deploy the crawler -----------------------------------------------------
  if (own.counts.get('conyard') === undefined) {
    const crawler = own.units.find((u) => u.def.deployable === 'base');
    if (crawler) {
      if (crawler.order.kind !== 'deploy') world.issue({ kind: 'deploy', units: [crawler.id] });
      return; // nothing else matters until the base exists
    }
    // no conyard, no crawler: try to build one if a factory survives
    maybeQueueUnit(world, player, 'vehicle', 'pioneer');
  }

  // --- 1. structures ----------------------------------------------------------
  planStructures(world, player, own, tune, mem);
  placeReadyStructures(world, player, own, mem);

  // --- 2. units ---------------------------------------------------------------
  planUnits(world, player, own, tune);

  // --- 3. repair damaged structures --------------------------------------------
  if (player.credits > 800) {
    for (const b of own.buildings) {
      if (!b.repairing && b.hp < b.def.hp * 0.7) {
        world.issue({ kind: 'repair', player: player.id, building: b.id });
        break;
      }
    }
  }

  // --- 4. engineers grab oil ---------------------------------------------------
  captureDerricks(world, player, own);

  // --- 5. military -------------------------------------------------------------
  runMilitary(world, player, own, tune, mem);

  // --- 6. superweapons ---------------------------------------------------------
  fireReadyPowers(world, player, own, mem);
}

// ---------------------------------------------------------------- helpers --

interface OwnForces {
  buildings: Building[];
  units: Unit[];
  counts: Map<string, number>;
  base: { x: number; y: number };
  army: Unit[];
  harvesters: Unit[];
}

function collectOwn(world: World, playerId: number): OwnForces {
  const buildings: Building[] = [];
  const units: Unit[] = [];
  const counts = new Map<string, number>();
  for (const b of world.buildings.values()) {
    if (b.dead || b.player !== playerId) continue;
    buildings.push(b);
    counts.set(b.def.id, (counts.get(b.def.id) ?? 0) + 1);
  }
  for (const u of world.units.values()) {
    if (u.dead || u.player !== playerId) continue;
    units.push(u);
    counts.set(u.def.id, (counts.get(u.def.id) ?? 0) + 1);
  }
  const conyard = buildings.find((b) => b.def.conyard);
  const base = conyard
    ? { x: conyard.cx, y: conyard.cy }
    : buildings.length > 0
      ? { x: buildings[0].cx, y: buildings[0].cy }
      : units.length > 0
        ? { x: units[0].x, y: units[0].y }
        : { x: world.map.width / 2, y: world.map.height / 2 };
  const army = units.filter(
    (u) => u.weaponDefs.length > 0 && !u.def.harvester && !u.def.engineer && !u.def.deployable,
  );
  const harvesters = units.filter((u) => u.def.harvester);
  return { buildings, units, counts, base, army, harvesters };
}

function count(own: OwnForces, id: string): number {
  return own.counts.get(id) ?? 0;
}

function queueBuilding(world: World, player: PlayerState, defId: string): boolean {
  const tab = getBuilding(defId).tab;
  const q = player.queues[tab];
  if (q.items.length > 0 || q.ready) return false;
  if (!canQueue(world, player, tab, defId)) return false;
  world.issue({ kind: 'startProduction', player: player.id, tab, def: defId });
  return true;
}

function maybeQueueUnit(world: World, player: PlayerState, tab: ProductionTab, defId: string): boolean {
  const q = player.queues[tab];
  if (q.items.length >= 2) return false; // keep queues short and reactive
  if (!canQueue(world, player, tab, defId)) return false;
  world.issue({ kind: 'startProduction', player: player.id, tab, def: defId });
  return true;
}

// ------------------------------------------------------------- structures --

function planStructures(
  world: World, player: PlayerState, own: OwnForces, tune: Tuning, mem: AIMemory,
): void {
  const faction = player.config.faction;
  const powerPlant = faction === 'pact' ? 'combustion_plant' : 'fusion_plant';
  const basicDef = faction === 'pact' ? 'sentry' : 'bunker';
  const aaDef = faction === 'pact' ? 'flak_cannon' : 'sam_site';
  const bigDef = faction === 'pact' ? 'arc_tower' : 'lance_tower';
  const superA = faction === 'pact' ? 'icbm_silo' : 'storm_array';
  const superB = faction === 'pact' ? 'aegis_generator' : 'phase_gate';

  // priority ladder — first match wins the build slot
  const wantPower =
    count(own, powerPlant) === 0 ||
    player.powerConsumed + 40 > player.powerProduced;
  const ladder: Array<[boolean, string]> = [
    [wantPower, powerPlant],
    [count(own, 'refinery') === 0, 'refinery'],
    [count(own, 'barracks') === 0, 'barracks'],
    [count(own, 'warfactory') === 0, 'warfactory'],
    [count(own, 'refinery') < tune.refineries, 'refinery'],
    [tune.techUp && count(own, 'radar') === 0, 'radar'],
    [countDefenses(own) < Math.min(2, tune.defenseCount), basicDef],
    [tune.techUp && count(own, 'lab') === 0 && player.credits > 1500, 'lab'],
    [tune.techUp && count(own, aaDef) < Math.ceil(tune.defenseCount / 3), aaDef],
    [tune.techUp && count(own, 'airfield') === 0 && player.credits > 2000, 'airfield'],
    [countDefenses(own) < tune.defenseCount && player.credits > 1200, bigDef],
    [
      tune.techUp && !mem.navalGiveUp && count(own, 'shipyard') === 0 &&
      world.config.mapId.length > 0 && hasNearbyWater(world, own.base) && player.credits > 2500,
      'shipyard',
    ],
    [world.config.superweapons && tune.techUp && count(own, superA) === 0 && player.credits > 4500, superA],
    [world.config.superweapons && tune.techUp && count(own, superB) === 0 && player.credits > 4000, superB],
  ];
  for (const [want, defId] of ladder) {
    if (!want) continue;
    if ((mem.placeFail.get(defId) ?? 0) >= 5) continue; // repeatedly unplaceable
    if (queueBuilding(world, player, defId)) return;
    return; // slot occupied or prereqs missing: wait, don't skip the ladder
  }
}

function countDefenses(own: OwnForces): number {
  return own.buildings.filter((b) => b.def.tab === 'defense').length;
}

function hasNearbyWater(world: World, base: { x: number; y: number }): boolean {
  const R = 16;
  for (let dy = -R; dy <= R; dy += 2) {
    for (let dx = -R; dx <= R; dx += 2) {
      const x = Math.floor(base.x + dx);
      const y = Math.floor(base.y + dy);
      if (world.map.inBounds(x, y) && world.map.isTerrainPassable(x, y, 'water')) return true;
    }
  }
  return false;
}

function placeReadyStructures(
  world: World, player: PlayerState, own: OwnForces, mem: AIMemory,
): void {
  for (const tab of ['building', 'defense'] as const) {
    const ready = player.queues[tab].ready;
    if (!ready) continue;
    const def = getBuilding(ready);
    const spot = findBuildSpot(world, player, def, own, mem);
    if (spot) {
      world.issue({ kind: 'placeBuilding', player: player.id, def: ready, tx: spot.x, ty: spot.y });
      mem.placeFail.delete(ready);
    } else {
      const fails = (mem.placeFail.get(ready) ?? 0) + 1;
      mem.placeFail.set(ready, fails);
      if (fails >= 5) {
        world.issue({ kind: 'cancelProduction', player: player.id, tab });
        if (def.naval) mem.navalGiveUp = true;
      }
    }
  }
}

function findBuildSpot(
  world: World, player: PlayerState, def: BuildingDef, own: OwnForces, mem: AIMemory,
): { x: number; y: number } | null {
  const anchor = own.base;
  // defenses lean toward the enemy; everything else hugs the yard
  let bias = 0;
  if (def.tab === 'defense' && mem.enemySpawn) {
    bias = Math.atan2(mem.enemySpawn.y - anchor.y, mem.enemySpawn.x - anchor.x);
  }
  for (let r = 2; r <= 14; r++) {
    const steps = 8 + r * 2;
    for (let s = 0; s < steps; s++) {
      const a = bias + (s / steps) * Math.PI * 2 * (s % 2 === 0 ? 1 : -1) * 0.5;
      const tx = Math.round(anchor.x + Math.cos(a) * r - def.w / 2);
      const ty = Math.round(anchor.y + Math.sin(a) * r - def.h / 2);
      if (world.canPlaceBuilding(player.id, def, tx, ty, {})) return { x: tx, y: ty };
    }
  }
  return null;
}

// ------------------------------------------------------------------ units --

function planUnits(world: World, player: PlayerState, own: OwnForces, tune: Tuning): void {
  const faction = player.config.faction;
  const refineries = count(own, 'refinery');
  const harvDef = faction === 'pact' ? 'excavator' : 'prospector';

  // economy first: two harvesters per refinery
  if (own.harvesters.length < refineries * 2) {
    if (maybeQueueUnit(world, player, 'vehicle', harvDef)) return;
  }

  if (own.army.length >= tune.maxArmy) return;

  const enemyAir = countEnemyAir(world, player);
  if (faction === 'pact') {
    const wantFlak = Math.min(6, 2 + enemyAir);
    if (count(own, 'flaktrooper') < wantFlak) maybeQueueUnit(world, player, 'infantry', 'flaktrooper');
    else if (count(own, 'militia') < 6) maybeQueueUnit(world, player, 'infantry', 'militia');
    else if (count(own, 'arctrooper') < 4) maybeQueueUnit(world, player, 'infantry', 'arctrooper');

    if (count(own, 'bear') < Math.ceil(tune.maxArmy * 0.4)) maybeQueueUnit(world, player, 'vehicle', 'bear');
    else if (count(own, 'hailstorm') < 3) maybeQueueUnit(world, player, 'vehicle', 'hailstorm');
    else if (count(own, 'behemoth') < 3) maybeQueueUnit(world, player, 'vehicle', 'behemoth');
    else maybeQueueUnit(world, player, 'vehicle', 'viper');

    if (count(own, 'leviathan') < 2) maybeQueueUnit(world, player, 'air', 'leviathan');
    if (!memory(world, player).navalGiveUp && count(own, 'seascorpion') < 2) {
      maybeQueueUnit(world, player, 'naval', 'seascorpion');
    }
  } else {
    const wantIfv = Math.min(6, 2 + enemyAir);
    if (count(own, 'guardsman') < 6) maybeQueueUnit(world, player, 'infantry', 'guardsman');
    else if (count(own, 'jettrooper') < 3) maybeQueueUnit(world, player, 'infantry', 'jettrooper');

    if (count(own, 'ifv') < wantIfv) maybeQueueUnit(world, player, 'vehicle', 'ifv');
    else if (count(own, 'wolf') < Math.ceil(tune.maxArmy * 0.45)) maybeQueueUnit(world, player, 'vehicle', 'wolf');
    else if (count(own, 'lance') < 3) maybeQueueUnit(world, player, 'vehicle', 'lance');
    else maybeQueueUnit(world, player, 'vehicle', 'thicket');

    if (count(own, 'kestrel') < 3) maybeQueueUnit(world, player, 'air', 'kestrel');
    if (!memory(world, player).navalGiveUp && count(own, 'corvette') < 2) {
      maybeQueueUnit(world, player, 'naval', 'corvette');
    }
  }

  // an engineer on standby when there is oil to grab
  if (count(own, 'engineer') === 0 && neutralDerrickExists(world)) {
    maybeQueueUnit(world, player, 'infantry', 'engineer');
  }
}

function countEnemyAir(world: World, player: PlayerState): number {
  let n = 0;
  for (const u of world.units.values()) {
    if (u.dead || u.def.domain !== 'air') continue;
    const owner = world.players[u.player];
    if (owner && !player.isAlliedWith(owner)) n++;
  }
  return n;
}

function neutralDerrickExists(world: World): boolean {
  for (const b of world.buildings.values()) {
    if (!b.dead && b.player < 0 && b.def.capturable) return true;
  }
  return false;
}

function captureDerricks(world: World, player: PlayerState, own: OwnForces): void {
  const engineer = own.units.find((u) => u.def.engineer && u.order.kind === 'none');
  if (!engineer) return;
  let best: Building | null = null;
  let bestD = Infinity;
  for (const b of world.buildings.values()) {
    if (b.dead || !b.def.capturable || b.player === player.id) continue;
    if (b.player >= 0) continue; // only neutral grabs; combat engineers are a human trick
    const d = dist2(engineer.x, engineer.y, b.cx, b.cy);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  if (best) world.issue({ kind: 'capture', units: [engineer.id], target: best.id });
}

// --------------------------------------------------------------- military --

function runMilitary(
  world: World, player: PlayerState, own: OwnForces, tune: Tuning, mem: AIMemory,
): void {
  // remember the nearest enemy spawn as "their base"
  if (!mem.enemySpawn) {
    let bestD = Infinity;
    for (const p of world.players) {
      if (p.id === player.id || p.defeated || player.isAlliedWith(p)) continue;
      const s = world.map.spawns[p.id % world.map.spawns.length];
      const d = dist2(own.base.x, own.base.y, s.x, s.y);
      if (d < bestD) {
        bestD = d;
        mem.enemySpawn = { x: s.x, y: s.y };
      }
    }
  }

  // scout early with the first cheap unit
  if (!mem.scoutSent && mem.enemySpawn && own.army.length >= 2) {
    const scout = own.army.find((u) => u.def.speed >= 2.5) ?? own.army[0];
    world.issue({ kind: 'attackMove', units: [scout.id], x: mem.enemySpawn.x, y: mem.enemySpawn.y });
    mem.scoutSent = true;
  }

  // base defense: any enemy near home pulls the army back
  const intruder = findIntruder(world, player, own.base, 14);
  if (intruder) {
    if (world.tick > mem.defendUntil) {
      mem.defendUntil = world.tick + 100;
      mem.defendAt = intruder;
      const defenders = own.army.filter((u) => u.def.domain !== 'water').map((u) => u.id);
      if (defenders.length > 0) {
        world.issue({ kind: 'attackMove', units: defenders, x: intruder.x, y: intruder.y });
      }
    }
    return;
  }

  // attack waves
  if (world.tick < mem.nextWaveCheck) return;
  mem.nextWaveCheck = world.tick + 60;
  const idleArmy = own.army.filter(
    (u) => u.def.domain !== 'water' &&
      (u.order.kind === 'none' || (u.order.kind === 'attackMove' && mem.defendAt !== null)),
  );
  if (idleArmy.length >= tune.waveSize) {
    mem.defendAt = null;
    mem.waveNumber++;
    const target = pickAttackTarget(world, player, mem);
    if (target) {
      world.issue({
        kind: 'attackMove',
        units: idleArmy.map((u) => u.id),
        x: target.x, y: target.y,
      });
    }
  }

  // navy hunts along the coast on its own schedule
  const idleShips = own.army.filter((u) => u.def.domain === 'water' && u.order.kind === 'none');
  if (idleShips.length >= 2 && mem.enemySpawn) {
    world.issue({
      kind: 'attackMove', units: idleShips.map((u) => u.id),
      x: mem.enemySpawn.x, y: mem.enemySpawn.y,
    });
  }
}

function findIntruder(
  world: World, player: PlayerState, base: { x: number; y: number }, radius: number,
): { x: number; y: number } | null {
  for (const u of world.units.values()) {
    if (u.dead || u.weaponDefs.length === 0) continue;
    const owner = world.players[u.player];
    if (!owner || player.isAlliedWith(owner)) continue;
    if (dist2(u.x, u.y, base.x, base.y) < radius * radius) return { x: u.x, y: u.y };
  }
  return null;
}

function pickAttackTarget(
  world: World, player: PlayerState, mem: AIMemory,
): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (const b of world.buildings.values()) {
    if (b.dead || b.player < 0) continue;
    const owner = world.players[b.player];
    if (!owner || player.isAlliedWith(owner) || owner.defeated) continue;
    const d = dist2(b.cx, b.cy, mem.enemySpawn?.x ?? b.cx, mem.enemySpawn?.y ?? b.cy);
    // prefer production over walls: conyards and factories first
    const weight = b.def.conyard || b.def.factory ? 0 : 1000;
    if (d + weight < bestD) {
      bestD = d + weight;
      best = { x: b.cx, y: b.cy };
    }
  }
  if (!best && mem.enemySpawn) best = mem.enemySpawn;
  return best;
}

// ------------------------------------------------------------ superpowers --

function fireReadyPowers(world: World, player: PlayerState, own: OwnForces, mem: AIMemory): void {
  for (const pc of player.powers.values()) {
    if (!pc.ready) continue;
    const kind = pc.def.kind;
    if (kind === 'storm' || kind === 'nuke') {
      const target = pickAttackTarget(world, player, mem);
      if (target) {
        world.issue({ kind: 'firePower', player: player.id, power: pc.def.id, x: target.x, y: target.y });
      }
    } else if (kind === 'aegis') {
      // shield the largest forward cluster of our own army
      const attacker = own.army.find((u) => u.order.kind === 'attackMove');
      if (attacker && own.army.length >= 8) {
        world.issue({ kind: 'firePower', player: player.id, power: pc.def.id, x: attacker.x, y: attacker.y });
      }
    } else if (kind === 'phase') {
      // hurl the strike force at the enemy base
      const target = pickAttackTarget(world, player, mem);
      const force = own.army.filter((u) => u.def.domain === 'ground').slice(0, 8);
      if (target && force.length >= 6) {
        world.issue({
          kind: 'firePower', player: player.id, power: pc.def.id,
          x: target.x, y: target.y, units: force.map((u) => u.id),
        });
      }
    }
  }
}
