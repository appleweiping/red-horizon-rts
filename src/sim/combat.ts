import type { WeaponDef } from '../core/types';
import {
  ELITE_ARMOR_MULT, ELITE_DAMAGE_MULT, ELITE_KILL_RATIO,
  VETERAN_ARMOR_MULT, VETERAN_DAMAGE_MULT, VETERAN_KILL_RATIO,
} from '../core/constants';
import { damageMultiplier } from '../data/armor';
import { dist, dist2 } from '../core/math';
import { Building, Unit, makeProjectile } from './entity';
import type { World } from './world';

export type Entity = Unit | Building;

export function isUnit(e: Entity): e is Unit {
  return e instanceof Unit;
}

export function entityPos(e: Entity): { x: number; y: number } {
  return isUnit(e) ? { x: e.x, y: e.y } : { x: e.cx, y: e.cy };
}

/** Distance from a point to an entity (buildings use their footprint). */
export function distToEntity(x: number, y: number, e: Entity): number {
  return isUnit(e) ? dist(x, y, e.x, e.y) : e.distTo(x, y);
}

export function isAirborne(e: Entity): boolean {
  return isUnit(e) && e.def.domain === 'air';
}

/** Hostility test between two player ids (neutral is never an aggressor/target of auto-scan). */
export function areEnemies(world: World, a: number, b: number): boolean {
  if (a === b) return false;
  if (a < 0 || b < 0) return false;
  return !world.players[a].isAlliedWith(world.players[b]);
}

function weaponCanHit(w: WeaponDef, target: Entity): boolean {
  return isAirborne(target) ? w.antiAir : w.antiGround;
}

/** Any of the shooter's weapons able to engage this target? */
export function canEngage(shooter: Entity, target: Entity): boolean {
  const weapons = shooter.weaponDefs;
  if (weapons.length === 0) return false;
  if (isUnit(target) && target.disguised) return false;
  return weapons.some((w) => weaponCanHit(w, target));
}

/**
 * Auto-acquire: nearest hostile within `range` that at least one weapon can
 * hit. Units come from the spatial grid; buildings from a direct sweep.
 */
const scratch: number[] = [];
export function acquireTarget(world: World, shooter: Entity, range: number): number {
  const pos = entityPos(shooter);
  let best = 0;
  let bestD = range * range;

  world.grid.query(pos.x, pos.y, range, scratch);
  for (const id of scratch) {
    const u = world.units.get(id);
    if (!u || u.dead) continue;
    if (!areEnemies(world, shooter.player, u.player)) continue;
    if (!canEngage(shooter, u)) continue;
    const d = dist2(pos.x, pos.y, u.x, u.y);
    if (d < bestD) {
      bestD = d;
      best = u.id;
    }
  }

  // defenses and armed units also engage structures (slight preference to units
  // via the strict < above on equal distance ordering)
  for (const b of world.buildings.values()) {
    if (b.dead || b.constructTicks > 0) continue;
    if (!areEnemies(world, shooter.player, b.player)) continue;
    if (!canEngage(shooter, b)) continue;
    const d = b.distTo(pos.x, pos.y);
    if (d * d < bestD) {
      bestD = d * d;
      best = b.id;
    }
  }
  return best;
}

/** Attacker damage multiplier from veterancy. */
export function rankDamageMult(e: Entity): number {
  if (!isUnit(e)) return 1;
  return e.rank === 2 ? ELITE_DAMAGE_MULT : e.rank === 1 ? VETERAN_DAMAGE_MULT : 1;
}

/** Fire one weapon at a target: spawns a projectile or applies instant damage. */
export function fireWeapon(
  world: World, shooter: Entity, wIndex: number, target: Entity,
): void {
  const w = shooter.weaponDefs[wIndex];
  const from = entityPos(shooter);
  const to = entityPos(target);
  const burst = w.burst ?? 1;
  shooter.cooldowns[wIndex] = w.rof;
  if (isUnit(shooter)) shooter.idleTicks = 0;

  for (let b = 0; b < burst; b++) {
    const jx = b === 0 ? 0 : world.rng.jitter(0.25);
    const jy = b === 0 ? 0 : world.rng.jitter(0.25);
    switch (w.projectile) {
      case 'instant':
      case 'beam': {
        world.events.emit({ kind: 'shot', weapon: w.id, x: from.x, y: from.y, tx: to.x, ty: to.y });
        dealDamage(world, target, w.damage * rankDamageMult(shooter), w, shooter.player, shooter.id);
        if (w.splash) {
          splash(world, to.x, to.y, w, w.damage * rankDamageMult(shooter), shooter.player, shooter.id, target.id);
        }
        break;
      }
      case 'arc': {
        world.events.emit({ kind: 'shot', weapon: w.id, x: from.x, y: from.y, tx: to.x, ty: to.y });
        dealDamage(world, target, w.damage * rankDamageMult(shooter), w, shooter.player, shooter.id);
        // chain to nearby extra victims at reduced power
        let chains = w.chain ?? 0;
        let prev = target;
        const seen = new Set<number>([target.id]);
        while (chains-- > 0) {
          const prevPos = entityPos(prev);
          let next: Entity | null = null;
          let nd = 2.5 * 2.5;
          world.grid.query(prevPos.x, prevPos.y, 2.5, scratch);
          for (const id of scratch) {
            const u = world.units.get(id);
            if (!u || u.dead || seen.has(u.id)) continue;
            if (!areEnemies(world, shooter.player, u.player)) continue;
            if (isAirborne(u) && !w.antiAir) continue;
            const d = dist2(prevPos.x, prevPos.y, u.x, u.y);
            if (d < nd) {
              nd = d;
              next = u;
            }
          }
          if (!next) break;
          seen.add(next.id);
          const np = entityPos(next);
          world.events.emit({ kind: 'shot', weapon: w.id, x: prevPos.x, y: prevPos.y, tx: np.x, ty: np.y });
          dealDamage(world, next, w.damage * 0.6 * rankDamageMult(shooter), w, shooter.player, shooter.id);
          prev = next;
        }
        break;
      }
      case 'missile': {
        world.projectiles.push(
          makeProjectile(w, shooter.player, shooter.id, from.x, from.y, target.id, to.x + jx, to.y + jy),
        );
        world.events.emit({ kind: 'shot', weapon: w.id, x: from.x, y: from.y, tx: to.x, ty: to.y });
        break;
      }
      case 'shell':
      case 'bomb':
      case 'wave': {
        world.projectiles.push(
          makeProjectile(w, shooter.player, shooter.id, from.x, from.y, 0, to.x + jx, to.y + jy),
        );
        world.events.emit({ kind: 'shot', weapon: w.id, x: from.x, y: from.y, tx: to.x, ty: to.y });
        break;
      }
    }
  }
}

/** Apply warhead damage to an entity, handling veterancy, death and stats. */
export function dealDamage(
  world: World, target: Entity, amount: number,
  weapon: WeaponDef, attackerPlayer: number, sourceId: number,
): void {
  if (target.dead) return;
  if (isUnit(target) && target.aegisUntil > world.tick) return;

  let dmg = amount * damageMultiplier(weapon.warhead, target.def.armor);
  if (isUnit(target)) {
    if (target.rank === 1) dmg *= VETERAN_ARMOR_MULT;
    else if (target.rank === 2) dmg *= ELITE_ARMOR_MULT;
  }
  if (dmg <= 0) return;
  target.hp -= dmg;

  // "under attack" warning, throttled per player
  if (target.player >= 0) {
    const owner = world.players[target.player];
    if (owner.attackNagCooldown <= 0 && attackerPlayer !== target.player) {
      owner.attackNagCooldown = 200;
      const pos = entityPos(target);
      world.events.emit({
        kind: 'underAttack', player: target.player,
        x: pos.x, y: pos.y, isBase: !isUnit(target),
      });
    }
  }

  if (target.hp <= 0) killEntity(world, target, attackerPlayer, sourceId);
}

export function killEntity(
  world: World, target: Entity, killerPlayer: number, sourceId: number,
): void {
  if (target.dead) return;
  target.dead = true;
  const pos = entityPos(target);

  if (isUnit(target)) {
    world.events.emit({ kind: 'death', class: target.def.class, x: pos.x, y: pos.y });
    if (target.player >= 0) {
      const owner = world.players[target.player];
      owner.stats.unitsLost++;
      world.events.emit({
        kind: 'unitLost', player: target.player, def: target.def.id, x: pos.x, y: pos.y,
      });
    }
    if (killerPlayer >= 0 && killerPlayer !== target.player) {
      world.players[killerPlayer].stats.unitsKilled++;
      creditKill(world, sourceId, target.def.cost);
    }
  } else {
    world.events.emit({ kind: 'death', class: 'building', x: pos.x, y: pos.y });
    world.map.setOccupancy(target.tx, target.ty, target.def.w, target.def.h, 0);
    if (target.player >= 0) {
      const owner = world.players[target.player];
      owner.stats.buildingsLost++;
      world.events.emit({
        kind: 'buildingLost', player: target.player, def: target.def.id, x: pos.x, y: pos.y,
      });
    }
    if (killerPlayer >= 0 && killerPlayer !== target.player) {
      world.players[killerPlayer].stats.buildingsKilled++;
      creditKill(world, sourceId, target.def.cost);
    }
  }
}

/** Give the killing unit veterancy credit and handle promotions. */
function creditKill(world: World, sourceId: number, value: number): void {
  const u = world.units.get(sourceId);
  if (!u || u.dead) return;
  u.killValue += value;
  const cost = Math.max(100, u.def.cost);
  if (u.rank === 0 && u.killValue >= cost * VETERAN_KILL_RATIO) {
    u.rank = 1;
    world.events.emit({ kind: 'promoted', player: u.player, unit: u.id, rank: 1 });
  } else if (u.rank === 1 && u.killValue >= cost * ELITE_KILL_RATIO) {
    u.rank = 2;
    world.events.emit({ kind: 'promoted', player: u.player, unit: u.id, rank: 2 });
  }
}

/** Area damage with linear falloff; skips the shooter itself. */
export function splash(
  world: World, x: number, y: number, weapon: WeaponDef,
  amount: number, attackerPlayer: number, sourceId: number, directHitId = 0,
): void {
  const r = weapon.splash ?? 0;
  if (r <= 0) return;
  world.grid.query(x, y, r, scratch);
  const victims = [...scratch];
  for (const id of victims) {
    const u = world.units.get(id);
    if (!u || u.dead || u.id === sourceId || u.id === directHitId) continue;
    if (isAirborne(u) && !weapon.antiAir && weapon.projectile !== 'bomb') continue;
    const d = dist(x, y, u.x, u.y);
    if (d > r) continue;
    dealDamage(world, u, amount * (1 - 0.7 * (d / r)), weapon, attackerPlayer, sourceId);
  }
  for (const b of world.buildings.values()) {
    if (b.dead || b.id === sourceId || b.id === directHitId) continue;
    const d = b.distTo(x, y);
    if (d > r) continue;
    dealDamage(world, b, amount * (1 - 0.7 * (d / r)), weapon, attackerPlayer, sourceId);
  }
}

/** Advance all projectiles one tick. */
export function updateProjectiles(world: World): void {
  for (const p of world.projectiles) {
    if (p.dead) continue;
    const w = p.weapon;

    if (w.projectile === 'missile' && p.targetId) {
      const target = world.units.get(p.targetId) ?? world.buildings.get(p.targetId);
      if (target && !target.dead) {
        const tp = entityPos(target);
        p.tx = tp.x;
        p.ty = tp.y;
      } else {
        p.targetId = 0; // target died: missile flies to last known point
      }
      const d = dist(p.x, p.y, p.tx, p.ty);
      const step = w.speed ?? 0.4;
      if (d <= step + 0.2) {
        p.dead = true;
        world.events.emit({ kind: 'impact', weapon: w.id, x: p.tx, y: p.ty, big: (w.splash ?? 0) > 0.8 });
        const target = p.targetId
          ? world.units.get(p.targetId) ?? world.buildings.get(p.targetId)
          : null;
        if (target && !target.dead) {
          dealDamage(world, target, w.damage, w, p.player, p.sourceId);
          if (w.splash) splash(world, p.tx, p.ty, w, w.damage, p.player, p.sourceId, target.id);
        } else if (w.splash) {
          splash(world, p.tx, p.ty, w, w.damage, p.player, p.sourceId);
        }
      } else {
        p.x += ((p.tx - p.x) / d) * step;
        p.y += ((p.ty - p.y) / d) * step;
      }
      continue;
    }

    // ballistic shells / bombs travel by normalized progress
    const step = (w.speed ?? 0.35) / p.totalDist;
    p.t += step;
    if (p.t >= 1) {
      p.dead = true;
      p.x = p.tx;
      p.y = p.ty;
      world.events.emit({ kind: 'impact', weapon: w.id, x: p.tx, y: p.ty, big: (w.splash ?? 0) > 0.8 });
      // point detonation: direct damage to whatever sits on the point + splash
      if (w.splash) {
        splash(world, p.tx, p.ty, w, w.damage, p.player, p.sourceId);
      }
      // hit any entity standing right at the impact point for full damage
      world.grid.query(p.tx, p.ty, 0.5, scratch);
      let hit = false;
      for (const id of scratch) {
        const u = world.units.get(id);
        if (!u || u.dead) continue;
        if (isAirborne(u) && !w.antiAir && w.projectile !== 'bomb') continue;
        if (dist2(p.tx, p.ty, u.x, u.y) < 0.36) {
          dealDamage(world, u, w.damage, w, p.player, p.sourceId);
          hit = true;
          break;
        }
      }
      if (!hit) {
        for (const b of world.buildings.values()) {
          if (b.dead) continue;
          if (b.distTo(p.tx, p.ty) < 0.4) {
            dealDamage(world, b, w.damage, w, p.player, p.sourceId);
            break;
          }
        }
      }
    } else {
      p.x = p.startX + (p.tx - p.startX) * p.t;
      p.y = p.startY + (p.ty - p.startY) * p.t;
    }
  }
  // compact the list occasionally
  if (world.projectiles.length > 64) {
    world.projectiles = world.projectiles.filter((p) => !p.dead);
  }
}
