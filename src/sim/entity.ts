import type { BuildingDef, UnitDef, WeaponDef } from '../core/types';
import type { Vec2 } from '../core/math';
import { getWeapon } from '../data/weapons';

/** Current standing order for a unit. */
export type Order =
  | { kind: 'none' }
  | { kind: 'move'; x: number; y: number }
  | { kind: 'attackMove'; x: number; y: number }
  | { kind: 'attack'; target: number }
  | { kind: 'harvest'; tx: number; ty: number }
  | { kind: 'returnOre' }
  | { kind: 'capture'; target: number }
  | { kind: 'deploy' }
  | { kind: 'rearm' };

export type HarvestPhase = 'seek' | 'toOre' | 'mining' | 'toRefinery' | 'unloading';

export class Unit {
  readonly id: number;
  readonly def: UnitDef;
  readonly weaponDefs: WeaponDef[];
  player: number;

  // position & motion (world coords, 1 tile = 1.0)
  x: number;
  y: number;
  /** Previous-tick position, for render interpolation. */
  px: number;
  py: number;
  facing = 0;
  turretFacing = 0;

  hp: number;
  /** 0 = regular, 1 = veteran, 2 = elite. */
  rank: 0 | 1 | 2 = 0;
  /** Credits' worth of enemies destroyed (drives promotion). */
  killValue = 0;

  order: Order = { kind: 'none' };
  orderQueue: Order[] = [];
  path: Vec2[] | null = null;
  /** Where the current path leads (for staleness checks). */
  pathGoal: Vec2 | null = null;
  repathCooldown = 0;
  stuckTicks = 0;

  targetId = 0;
  scanCooldown = 0;
  cooldowns: number[];

  // harvester
  hphase: HarvestPhase = 'seek';
  cargo = 0;
  cargoValue = 0;
  mineTicks = 0;
  mineTile: { x: number; y: number } | null = null;
  refineryId = 0;

  // aircraft
  ammo: number;
  airfieldId = 0;

  // states
  deployed = false;
  idleTicks = 0; // mirage disguise timer
  aegisUntil = 0;
  dead = false;
  /** Guard anchor: units pursue targets only a short leash from here. */
  guardX = 0;
  guardY = 0;
  rearmTicks = 0;
  /** Commando C4 plant cooldown. */
  c4Cooldown = 0;

  /** Phantom tanks read as scenery to enemies while sitting still. */
  get disguised(): boolean {
    return !!this.def.mirage && this.idleTicks > 40;
  }

  /** ids are allocated by the owning World so parallel worlds never interfere. */
  constructor(id: number, def: UnitDef, player: number, x: number, y: number) {
    this.id = id;
    this.def = def;
    this.player = player;
    this.x = x;
    this.y = y;
    this.px = x;
    this.py = y;
    this.hp = def.hp;
    this.weaponDefs = def.weapons.map(getWeapon);
    this.cooldowns = def.weapons.map(() => 0);
    this.ammo = def.ammo ?? 0;
  }

  get isAir(): boolean {
    return this.def.domain === 'air';
  }

  get maxRange(): number {
    let r = 0;
    for (const w of this.weaponDefs) r = Math.max(r, w.range);
    return r;
  }

  setOrder(o: Order): void {
    this.order = o;
    this.orderQueue.length = 0;
    this.path = null;
    this.pathGoal = null;
    if (o.kind !== 'attack') this.targetId = 0;
  }

  queueOrder(o: Order): void {
    if (this.order.kind === 'none') this.setOrder(o);
    else this.orderQueue.push(o);
  }

  nextOrder(): void {
    this.path = null;
    this.pathGoal = null;
    this.targetId = 0;
    this.order = this.orderQueue.shift() ?? { kind: 'none' };
  }
}

export class Building {
  readonly id: number;
  readonly def: BuildingDef;
  readonly weaponDefs: WeaponDef[];
  player: number;

  /** Footprint top-left tile. */
  readonly tx: number;
  readonly ty: number;
  /** World-space center. */
  readonly cx: number;
  readonly cy: number;

  hp: number;
  /** Cosmetic construction animation countdown; can't fire while > 0. */
  constructTicks: number;
  targetId = 0;
  scanCooldown = 0;
  cooldowns: number[];

  rally: Vec2;
  repairing = false;
  incomeAccum = 0;
  dead = false;

  constructor(id: number, def: BuildingDef, player: number, tx: number, ty: number, instant = false) {
    this.id = id;
    this.def = def;
    this.player = player;
    this.tx = tx;
    this.ty = ty;
    this.cx = tx + def.w / 2;
    this.cy = ty + def.h / 2;
    this.hp = def.hp;
    this.weaponDefs = (def.weapons ?? []).map(getWeapon);
    this.cooldowns = (def.weapons ?? []).map(() => 0);
    this.constructTicks = instant ? 0 : 40;
    this.rally = { x: this.cx, y: this.cy + def.h / 2 + 1 };
  }

  get maxRange(): number {
    let r = 0;
    for (const w of this.weaponDefs) r = Math.max(r, w.range);
    return r;
  }

  /** Distance from a point to the building's footprint rectangle. */
  distTo(x: number, y: number): number {
    const dx = Math.max(this.tx - x, 0, x - (this.tx + this.def.w));
    const dy = Math.max(this.ty - y, 0, y - (this.ty + this.def.h));
    return Math.hypot(dx, dy);
  }
}

export interface Projectile {
  id: number;
  weapon: WeaponDef;
  player: number;
  /** Shooter entity id (veterancy credit). */
  sourceId: number;
  x: number;
  y: number;
  /** Homing target entity (missiles) — 0 for point shots. */
  targetId: number;
  /** Destination point (shells/bombs). */
  tx: number;
  ty: number;
  /** For arcing shells: 0..1 progress plus total distance. */
  t: number;
  totalDist: number;
  startX: number;
  startY: number;
  dead: boolean;
}

let nextProjectileId = 1;

export function makeProjectile(
  weapon: WeaponDef, player: number, sourceId: number,
  x: number, y: number, targetId: number, tx: number, ty: number,
): Projectile {
  return {
    id: nextProjectileId++,
    weapon, player, sourceId,
    x, y, targetId, tx, ty,
    t: 0,
    totalDist: Math.max(0.001, Math.hypot(tx - x, ty - y)),
    startX: x,
    startY: y,
    dead: false,
  };
}
