import { TICKS_PER_SEC } from '../core/constants';
import { angleDiff, dist, dist2, turnToward } from '../core/math';
import { getBuilding } from '../data/buildings';
import { getWeapon } from '../data/weapons';
import {
  acquireTarget, areEnemies, canEngage, dealDamage, distToEntity,
  entityPos, fireWeapon, isAirborne, isUnit, killEntity,
} from './combat';
import type { Entity } from './combat';
import { updateHarvester } from './economy';
import type { Unit } from './entity';
import type { World } from './world';

const TURN_RATE = 0.35; // radians per tick for vehicles
const SEPARATION = 0.55; // desired distance between ground units

/** Full per-tick update for one unit: orders, combat, locomotion. */
export function updateUnit(world: World, u: Unit): void {
  u.px = u.x;
  u.py = u.y;
  for (let i = 0; i < u.cooldowns.length; i++) {
    if (u.cooldowns[i] > 0) u.cooldowns[i]--;
  }
  if (u.c4Cooldown > 0) u.c4Cooldown--;
  u.idleTicks++;

  // elite self-heal
  if (u.rank === 2 && u.hp < u.def.hp && world.tick % TICKS_PER_SEC === 0) {
    u.hp = Math.min(u.def.hp, u.hp + 2);
  }

  if (u.def.harvester) {
    // explicit move orders override the mining loop until complete
    if (u.order.kind === 'move') {
      locomote(world, u);
      return;
    }
    updateHarvester(world, u);
    locomote(world, u);
    return;
  }

  switch (u.order.kind) {
    case 'none':
      updateGuard(world, u);
      break;
    case 'move':
      if (!ensurePathTo(world, u, u.order.x, u.order.y)) u.nextOrder();
      break;
    case 'attackMove':
      updateAttackMove(world, u);
      break;
    case 'attack':
      updateAttack(world, u);
      break;
    case 'capture':
      updateCapture(world, u);
      break;
    case 'deploy':
      updateDeploy(world, u);
      break;
    case 'rearm':
      updateRearm(world, u);
      break;
    case 'harvest':
    case 'returnOre':
      // handled by the harvester brain; treat as complete for non-harvesters
      u.nextOrder();
      break;
  }

  locomote(world, u);
  if (u.def.crushes) crushInfantry(world, u);
}

/** Idle stance: engage what wanders into range, pursue on a short leash. */
function updateGuard(world: World, u: Unit): void {
  if (u.weaponDefs.length === 0) return;
  if (u.def.ammo && u.ammo <= 0) return; // dry aircraft: wait for a rearm order
  if (u.idleTicks === 1 || (u.guardX === 0 && u.guardY === 0)) {
    u.guardX = u.x;
    u.guardY = u.y;
  }
  const target = validTarget(world, u);
  if (!target) {
    if (u.scanCooldown-- <= 0) {
      u.scanCooldown = 5;
      u.targetId = acquireTarget(world, u, Math.max(u.maxRange + 1, u.def.sight));
    }
    // drift back to the guard post when the fight is over
    if (!u.targetId && !u.path && !u.deployed &&
        dist2(u.x, u.y, u.guardX, u.guardY) > 4) {
      world.sendTo(u, u.guardX, u.guardY);
    }
    return;
  }
  const leash = dist(u.guardX, u.guardY, u.x, u.y);
  if (engageTarget(world, u, target, /*canChase*/ leash < 6 && !u.deployed)) return;
  u.targetId = 0;
}

function updateAttackMove(world: World, u: Unit): void {
  if (u.order.kind !== 'attackMove') return;
  const target = validTarget(world, u);
  if (target) {
    if (engageTarget(world, u, target, true)) return;
    u.targetId = 0;
  }
  if (u.scanCooldown-- <= 0) {
    u.scanCooldown = 5;
    const found = acquireTarget(world, u, Math.max(u.maxRange + 1.5, u.def.sight));
    if (found) {
      u.targetId = found;
      u.path = null; // break off the march to fight
      return;
    }
  }
  if (!ensurePathTo(world, u, u.order.x, u.order.y)) u.nextOrder();
}

function updateAttack(world: World, u: Unit): void {
  if (u.order.kind !== 'attack') return;
  const target =
    (world.units.get(u.order.target) as Entity | undefined) ??
    world.buildings.get(u.order.target);
  if (!target || target.dead) {
    u.nextOrder();
    return;
  }
  u.targetId = target.id;

  // commando: buildings are demolished with planted charges
  if (u.def.c4 && !isUnit(target)) {
    const d = target.distTo(u.x, u.y);
    if (d <= 1.1) {
      u.path = null;
      if (u.c4Cooldown <= 0) {
        u.c4Cooldown = 50;
        dealDamage(world, target, 400, { ...u.weaponDefs[0], warhead: 'c4' }, u.player, u.id);
        world.events.emit({ kind: 'impact', weapon: 'c4', x: target.cx, y: target.cy, big: true });
      }
      return;
    }
    approach(world, u, target);
    return;
  }

  // suicide unit: detonate on contact
  if (u.def.suicide) {
    const d = distToEntity(u.x, u.y, target);
    if (d <= (u.weaponDefs[0]?.range ?? 0.7)) {
      detonate(world, u, target);
      return;
    }
    approach(world, u, target);
    return;
  }

  if (!canEngage(u, target)) {
    // e.g. AA-only unit ordered at a ground target: just escort/approach
    approach(world, u, target);
    return;
  }
  if (engageTarget(world, u, target, true)) return;
  u.nextOrder();
}

/**
 * Core engagement: get in range, face the target, fire everything that can.
 * Returns false when the engagement should end (target dead / unhittable).
 */
function engageTarget(world: World, u: Unit, target: Entity, canChase: boolean): boolean {
  if (target.dead) return false;
  if (isUnit(target) && target.disguised) return false;
  if (!canEngage(u, target)) return false;

  const pos = entityPos(target);
  const d = distToEntity(u.x, u.y, target);
  const rangeBonus = u.deployed ? 1.5 : 0;

  // suicide units never "shoot" — they close in and detonate
  if (u.def.suicide) {
    if (d <= (u.weaponDefs[0]?.range ?? 0.7)) {
      detonate(world, u, target);
      return true;
    }
    if (canChase) approach(world, u, target);
    return canChase;
  }

  let anyInRange = false;
  let tooClose = false;
  for (let i = 0; i < u.weaponDefs.length; i++) {
    const w = u.weaponDefs[i];
    if (isAirborne(target) ? !w.antiAir : !w.antiGround) continue;
    if (u.def.ammo && u.ammo <= 0) continue; // dry aircraft can't fire
    const min = w.minRange ?? 0;
    if (d < min) {
      tooClose = true;
      continue;
    }
    if (d <= w.range + rangeBonus) {
      anyInRange = true;
      // aim: vehicles rotate turret, others rotate hull
      const want = Math.atan2(pos.y - u.y, pos.x - u.x);
      if (u.def.turret) {
        u.turretFacing = turnToward(u.turretFacing, want, 0.5);
      } else if (!u.def.strafes) {
        u.facing = turnToward(u.facing, want, TURN_RATE * 2);
        if (Math.abs(angleDiff(u.facing, want)) > 0.4) continue; // still turning
      }
      if (u.cooldowns[i] <= 0) {
        fireWeapon(world, u, i, target);
        if (u.def.ammo && u.ammo > 0) {
          u.ammo--;
          if (u.ammo === 0) u.setOrder({ kind: 'rearm' });
        }
      }
    }
  }

  if (anyInRange) {
    if (!u.def.strafes) u.path = null; // stand and fight
    else strafePast(world, u, pos.x, pos.y);
    return true;
  }
  if (tooClose) {
    u.path = null; // artillery holds instead of walking into its own dead zone
    return true;
  }

  // out of range: close in (or give up if rooted)
  if (!canChase || u.deployed) return false;
  approach(world, u, target);
  return true;
}

/** Move toward an entity, refreshing the path as it relocates. */
function approach(world: World, u: Unit, target: Entity): void {
  const pos = entityPos(target);
  if (u.pathGoal && dist2(u.pathGoal.x, u.pathGoal.y, pos.x, pos.y) < 4 && u.path) return;
  world.sendTo(u, pos.x, pos.y, isUnit(target) ? 0 : target.id);
}

/** Fixed-wing aircraft overfly the target and loop back for another pass. */
function strafePast(world: World, u: Unit, tx: number, ty: number): void {
  if (u.path && u.path.length > 0) return;
  const a = Math.atan2(ty - u.y, tx - u.x);
  u.path = [{ x: tx + Math.cos(a) * 5, y: ty + Math.sin(a) * 5 }];
  u.pathGoal = u.path[0];
}

function detonate(world: World, u: Unit, target: Entity | null): void {
  const w = u.weaponDefs[0];
  world.events.emit({ kind: 'impact', weapon: w.id, x: u.x, y: u.y, big: true });
  if (target && !target.dead) dealDamage(world, target, w.damage, w, u.player, u.id);
  if (w.splash) {
    // reuse splash via combat: emitting through dealDamage on nearby entities
    const r = w.splash;
    for (const v of world.units.values()) {
      if (v.dead || v.id === u.id || (target && v.id === target.id)) continue;
      const d = dist(u.x, u.y, v.x, v.y);
      if (d <= r) dealDamage(world, v, w.damage * (1 - 0.6 * (d / r)), w, u.player, u.id);
    }
    for (const b of world.buildings.values()) {
      if (b.dead || (target && b.id === target.id)) continue;
      const d = b.distTo(u.x, u.y);
      if (d <= r) dealDamage(world, b, w.damage * (1 - 0.6 * (d / r)), w, u.player, u.id);
    }
  }
  killEntity(world, u, -1, 0);
}

function updateCapture(world: World, u: Unit): void {
  if (u.order.kind !== 'capture') return;
  const b = world.buildings.get(u.order.target);
  if (!b || b.dead || b.player === u.player) {
    u.nextOrder();
    return;
  }
  const capturable = b.def.capturable || areEnemies(world, u.player, b.player) || b.player < 0;
  if (!capturable) {
    u.nextOrder();
    return;
  }
  if (b.distTo(u.x, u.y) <= 0.9) {
    const from = b.player;
    b.player = u.player;
    b.targetId = 0;
    b.repairing = false;
    world.events.emit({ kind: 'buildingCaptured', player: u.player, from, def: b.def.id });
    killEntity(world, u, -1, 0); // engineer is consumed silently
    u.dead = true;
    return;
  }
  if (!u.path) world.sendTo(u, b.cx, b.cy, b.id);
}

function updateDeploy(world: World, u: Unit): void {
  if (u.def.deployable === 'fortify') {
    u.deployed = !u.deployed;
    u.path = null;
    // braced guardsmen swap to the heavier braced rifle
    if (u.def.id === 'guardsman') {
      u.weaponDefs[0] = getWeapon(u.deployed ? 'gauss_rifle_deployed' : 'gauss_rifle');
    }
    u.nextOrder();
    return;
  }
  if (u.def.deployable === 'base' && u.def.deploysInto) {
    const def = getBuilding(u.def.deploysInto);
    const tx = Math.round(u.x - def.w / 2);
    const ty = Math.round(u.y - def.h / 2);
    if (world.canPlaceBuilding(u.player, def, tx, ty, { ignoreRadius: true, ignoreUnit: u.id })) {
      u.dead = true;
      world.addBuilding(def, u.player, tx, ty);
      world.events.emit({ kind: 'buildingPlaced', player: u.player, building: 0, def: def.id });
    } else {
      // nudge to a nearby clear spot and try again next tick
      const t = world.findDeploySpot(u, def);
      if (t) world.sendTo(u, t.x + def.w / 2, t.y + def.h / 2);
      else u.nextOrder();
    }
    return;
  }
  u.nextOrder();
}

function updateRearm(world: World, u: Unit): void {
  const pad = world.nearestAirfield(u.player, u.x, u.y);
  if (!pad) {
    u.nextOrder(); // nowhere to land; loiter
    return;
  }
  const d = dist(u.x, u.y, pad.cx, pad.cy);
  if (d > 0.8) {
    if (!u.path) world.sendTo(u, pad.cx, pad.cy);
    return;
  }
  u.path = null;
  u.rearmTicks++;
  if (u.rearmTicks >= 60) {
    u.rearmTicks = 0;
    u.ammo = u.def.ammo ?? 0;
    u.nextOrder();
  }
}

/** Returns the unit's current explicit target if it is still valid. */
function validTarget(world: World, u: Unit): Entity | null {
  if (!u.targetId) return null;
  const t =
    (world.units.get(u.targetId) as Entity | undefined) ?? world.buildings.get(u.targetId);
  if (!t || t.dead) return null;
  if (!areEnemies(world, u.player, t.player)) return null;
  return t;
}

/** Path management toward a point. Returns false when we've arrived. */
function ensurePathTo(world: World, u: Unit, x: number, y: number): boolean {
  if (dist2(u.x, u.y, x, y) < 0.35) return false;
  if (!u.path || !u.pathGoal || dist2(u.pathGoal.x, u.pathGoal.y, x, y) > 1) {
    world.sendTo(u, x, y);
    if (!u.path) return false; // unreachable
  }
  return true;
}

/** Advance along the current path with terrain speed, turning and avoidance. */
function locomote(world: World, u: Unit): void {
  if (!u.path || u.path.length === 0) return;
  const wp = u.path[0];
  const dx = wp.x - u.x;
  const dy = wp.y - u.y;
  const d = Math.hypot(dx, dy);

  const tileX = Math.floor(u.x);
  const tileY = Math.floor(u.y);
  let speed = u.def.speed / TICKS_PER_SEC;
  if (u.def.domain === 'ground' && world.map.inBounds(tileX, tileY)) {
    speed /= world.map.moveCost(tileX, tileY);
  }

  const want = Math.atan2(dy, dx);
  if (u.def.class === 'vehicle' || u.def.class === 'ship') {
    u.facing = turnToward(u.facing, want, TURN_RATE);
    const align = Math.cos(angleDiff(u.facing, want));
    speed *= Math.max(0.35, align);
    if (!u.def.turret) u.turretFacing = u.facing;
  } else {
    u.facing = want;
  }

  if (d <= speed + 0.05) {
    u.x = wp.x;
    u.y = wp.y;
    u.path.shift();
    if (u.path.length === 0) {
      u.path = null;
      u.pathGoal = null;
      if (u.order.kind === 'move') u.nextOrder();
    } else {
      // if a building appeared on the next leg, replan
      const nxt = u.path[0];
      if (!world.map.isPassable(Math.floor(nxt.x), Math.floor(nxt.y), u.def.domain)) {
        const goal = u.pathGoal;
        u.path = null;
        if (goal) world.sendTo(u, goal.x, goal.y);
      }
    }
  } else {
    const nx = u.x + (dx / d) * speed;
    const ny = u.y + (dy / d) * speed;
    if (
      u.def.domain === 'air' ||
      world.map.isPassable(Math.floor(nx), Math.floor(ny), u.def.domain)
    ) {
      u.x = nx;
      u.y = ny;
      u.stuckTicks = 0;
    } else {
      u.stuckTicks++;
      if (u.stuckTicks > 20) {
        const goal = u.pathGoal;
        u.path = null;
        u.stuckTicks = 0;
        if (goal) world.sendTo(u, goal.x, goal.y);
      }
    }
    u.idleTicks = 0;
  }

  if (u.def.domain === 'ground') separate(world, u);
}

const scratchIds: number[] = [];

/** Soft collision: ground units shove each other apart a little each tick. */
function separate(world: World, u: Unit): void {
  world.grid.query(u.x, u.y, SEPARATION + 0.4, scratchIds);
  let pushX = 0;
  let pushY = 0;
  for (const id of scratchIds) {
    if (id === u.id) continue;
    const o = world.units.get(id);
    if (!o || o.dead || o.def.domain !== 'ground') continue;
    const d = dist(u.x, u.y, o.x, o.y);
    if (d > SEPARATION || d === 0) continue;
    const f = (SEPARATION - d) / SEPARATION;
    pushX += ((u.x - o.x) / d) * f;
    pushY += ((u.y - o.y) / d) * f;
  }
  if (pushX === 0 && pushY === 0) return;
  const mag = Math.hypot(pushX, pushY);
  const cap = 0.045;
  const nx = u.x + (pushX / mag) * Math.min(cap, mag * cap);
  const ny = u.y + (pushY / mag) * Math.min(cap, mag * cap);
  if (world.map.isPassable(Math.floor(nx), Math.floor(ny), 'ground')) {
    u.x = nx;
    u.y = ny;
  }
}

/** Heavy vehicles flatten enemy infantry they roll over. */
function crushInfantry(world: World, u: Unit): void {
  if (dist2(u.px, u.py, u.x, u.y) < 1e-8) return; // must be moving
  world.grid.query(u.x, u.y, 0.5, scratchIds);
  for (const id of scratchIds) {
    const o = world.units.get(id);
    if (!o || o.dead || o.def.class !== 'infantry' || o.def.domain === 'air') continue;
    if (!areEnemies(world, u.player, o.player)) continue;
    if (o.aegisUntil > world.tick) continue;
    if (dist2(u.x, u.y, o.x, o.y) < 0.22) {
      world.events.emit({ kind: 'crush', x: o.x, y: o.y });
      killEntity(world, o, u.player, u.id);
    }
  }
}
