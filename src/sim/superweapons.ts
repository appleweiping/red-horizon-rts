import { getPower } from '../data/powers';
import { getWeapon } from '../data/weapons';
import { dist } from '../core/math';
import { dealDamage, splash } from './combat';
import type { PlayerState } from './player';
import type { World } from './world';

/** An in-flight superweapon effect. */
export interface Strike {
  power: string;
  player: number;
  x: number;
  y: number;
  firedAt: number;
  boltsLeft: number;
  done: boolean;
}

/** Synthetic warheads used by superweapon impacts. */
const STORM_BOLT = { ...getWeapon('arc_tower_gun'), id: 'storm_bolt', damage: 0, splash: 2.2, warhead: 'arc' as const };
const NUKE_BLAST = { ...getWeapon('hailstorm_rockets'), id: 'nuke_blast', damage: 0, splash: 5, warhead: 'nuke' as const };

/**
 * Keep each player's charge bank in sync with the superweapon structures
 * they own, then advance charges (paused while low power).
 */
export function updatePowerCharges(world: World, player: PlayerState): void {
  if (!world.config.superweapons) return;
  const owned = new Set<string>();
  for (const b of world.buildings.values()) {
    if (b.dead || b.player !== player.id || !b.def.superweapon || b.constructTicks > 0) continue;
    owned.add(b.def.superweapon);
    if (!player.powers.has(b.def.superweapon)) {
      player.powers.set(b.def.superweapon, {
        def: getPower(b.def.superweapon), charge: 0, ready: false,
      });
    }
  }
  for (const id of [...player.powers.keys()]) {
    if (!owned.has(id)) player.powers.delete(id); // structure lost: charge lost
  }
  for (const pc of player.powers.values()) {
    if (pc.ready || player.lowPower) continue;
    pc.charge++;
    if (pc.charge >= pc.def.chargeTicks) {
      pc.ready = true;
      world.events.emit({ kind: 'powerCharged', player: player.id, power: pc.def.id });
    }
  }
}

/** Validate and launch. `units` carries the phase-jump strike force. */
export function firePower(
  world: World, player: PlayerState, powerId: string,
  x: number, y: number, units: number[] = [],
): void {
  const pc = player.powers.get(powerId);
  if (!pc || !pc.ready || !world.config.superweapons) return;
  pc.ready = false;
  pc.charge = 0;
  world.events.emit({ kind: 'powerLaunched', player: player.id, power: powerId, x, y });

  switch (pc.def.kind) {
    case 'storm':
      world.strikes.push({
        power: powerId, player: player.id, x, y,
        firedAt: world.tick, boltsLeft: 14, done: false,
      });
      break;
    case 'nuke':
      world.events.emit({ kind: 'nukeWarning', player: player.id });
      world.strikes.push({
        power: powerId, player: player.id, x, y,
        firedAt: world.tick, boltsLeft: 1, done: false,
      });
      break;
    case 'phase': {
      // teleport the strike force in a spiral around the destination
      let placed = 0;
      for (const id of units) {
        const u = world.units.get(id);
        if (!u || u.dead || u.player !== player.id) continue;
        if (u.def.domain === 'water') continue; // ships stay wet
        const spot = world.freeTileNear(x, y, u.def.domain, placed);
        if (!spot) continue;
        u.x = spot.x + 0.5;
        u.y = spot.y + 0.5;
        u.px = u.x;
        u.py = u.y;
        u.path = null;
        u.pathGoal = null;
        u.setOrder({ kind: 'none' });
        u.guardX = u.x;
        u.guardY = u.y;
        placed++;
      }
      break;
    }
    case 'aegis': {
      for (const u of world.units.values()) {
        if (u.dead) continue;
        if (!world.players[u.player]?.isAlliedWith(player)) continue;
        if (dist(u.x, u.y, x, y) <= pc.def.radius) {
          u.aegisUntil = world.tick + 160; // 8 seconds
        }
      }
      break;
    }
  }
}

/** Advance queued storm/nuke strikes. */
export function updateStrikes(world: World): void {
  for (const s of world.strikes) {
    if (s.done) continue;
    const def = getPower(s.power);
    const age = world.tick - s.firedAt;

    if (def.kind === 'storm') {
      if (age < 40) continue; // gathering clouds
      if (s.boltsLeft > 0 && (age - 40) % 8 === 0) {
        // the opening bolt strikes dead center; the rest scatter
        const first = s.boltsLeft === 14;
        s.boltsLeft--;
        const bx = first ? s.x : s.x + world.rng.jitter(def.radius);
        const by = first ? s.y : s.y + world.rng.jitter(def.radius);
        world.events.emit({ kind: 'impact', weapon: 'storm_bolt', x: bx, y: by, big: true });
        boltDamage(world, bx, by, def.damage, s.player);
        splash(world, bx, by, STORM_BOLT, def.damage, s.player, 0);
      }
      if (s.boltsLeft <= 0) s.done = true;
    } else if (def.kind === 'nuke') {
      if (age >= 100) {
        s.done = true;
        world.events.emit({ kind: 'impact', weapon: 'nuke_blast', x: s.x, y: s.y, big: true });
        const w = { ...NUKE_BLAST, splash: def.radius };
        // center takes full damage; splash handles the falloff ring
        splash(world, s.x, s.y, w, def.damage, s.player, 0);
        boltDamage(world, s.x, s.y, def.damage, s.player, 0.8);
      }
    }
  }
  if (world.strikes.length > 8) {
    world.strikes = world.strikes.filter((s) => !s.done);
  }
}

/** Direct hit at a point: damages whatever is right there (bolt center). */
function boltDamage(world: World, x: number, y: number, damage: number, player: number, r = 0.9): void {
  const w = { ...STORM_BOLT };
  for (const u of world.units.values()) {
    if (u.dead) continue;
    if (dist(u.x, u.y, x, y) <= r) dealDamage(world, u, damage, w, player, 0);
  }
  for (const b of world.buildings.values()) {
    if (b.dead) continue;
    if (b.distTo(x, y) <= r) dealDamage(world, b, damage, w, player, 0);
  }
}
