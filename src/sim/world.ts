import type { BuildingDef, Command, MatchConfig, MoveDomain } from '../core/types';
import {
  DEFAULT_CREDITS, FOG_INTERVAL, REPAIR_COST_PER_HP, REPAIR_HP_PER_TICK,
  SCAN_INTERVAL, NEUTRAL, CONYARD_BUILD_RADIUS, BUILDING_BUILD_RADIUS,
} from '../core/constants';
import { EventQueue } from '../core/events';
import { Rng } from '../core/rng';
import { getBuilding } from '../data/buildings';
import { getUnit } from '../data/units';
import { generateMap } from '../map/mapgen';
import { getMapDef } from '../map/maps';
import type { GameMap } from '../map/terrain';
import { updateAI } from '../ai/ai';
import {
  acquireTarget, canEngage, distToEntity, fireWeapon, isUnit, updateProjectiles,
} from './combat';
import type { Entity } from './combat';
import { Building, Projectile, Unit } from './entity';
import { updateIncome, dockPoint } from './economy';
import { updateFog } from './fog';
import { findPath, nearestPassable } from './pathfinder';
import { PlayerState } from './player';
import { updateProduction } from './production';
import { applyCommand } from './commands';
import { SpatialGrid } from './spatial';
import { updateUnit } from './movement';
import { updatePowerCharges, updateStrikes } from './superweapons';
import type { Strike } from './superweapons';
import { checkVictory } from './victory';

export interface PlaceOpts {
  ignoreRadius?: boolean;
  ignoreUnit?: number;
}

/**
 * The deterministic simulation. Everything the game *is* lives here; the
 * renderer and UI only read state and enqueue Commands.
 */
export class World {
  readonly config: MatchConfig;
  readonly map: GameMap;
  readonly rng: Rng;
  readonly events = new EventQueue();
  readonly players: PlayerState[] = [];

  units = new Map<number, Unit>();
  buildings = new Map<number, Building>();
  projectiles: Projectile[] = [];
  strikes: Strike[] = [];
  readonly grid: SpatialGrid;

  tick = 0;
  gameOver = false;

  private pendingCommands: Command[] = [];
  private nextEntityId = 1;

  constructor(config: MatchConfig) {
    this.config = config;
    const mapDef = getMapDef(config.mapId);
    this.map = generateMap({ ...mapDef, seed: config.seed || mapDef.seed });
    this.rng = new Rng((config.seed || mapDef.seed) ^ 0xa5a5a5a5);
    this.grid = new SpatialGrid(this.map.width);

    for (let i = 0; i < config.players.length; i++) {
      this.players.push(new PlayerState(
        i, config.players[i],
        config.startingCredits || DEFAULT_CREDITS,
        this.map.width * this.map.height,
      ));
    }

    // neutral oil derricks
    const derrick = getBuilding('oil_derrick');
    for (const d of this.map.derricks) {
      this.addBuilding(derrick, NEUTRAL, d.x, d.y, true);
    }

    // every player starts with a Pioneer Crawler at their spawn
    for (let i = 0; i < this.players.length; i++) {
      const s = this.map.spawns[i % this.map.spawns.length];
      const mcv = this.addUnit(getUnit('pioneer'), i, s.x + 0.5, s.y + 0.5);
      mcv.facing = Math.atan2(this.map.height / 2 - s.y, this.map.width / 2 - s.x);
    }

    // initial fog
    for (const p of this.players) {
      updateFog(this.map, p, this.players, this.units.values(), this.buildings.values());
    }
  }

  // ------------------------------------------------------------- commands --

  issue(cmd: Command): void {
    this.pendingCommands.push(cmd);
  }

  // ------------------------------------------------------------- entities --

  addUnit(def: ReturnType<typeof getUnit>, player: number, x: number, y: number): Unit {
    const u = new Unit(this.nextEntityId++, def, player, x, y);
    u.guardX = x;
    u.guardY = y;
    this.units.set(u.id, u);
    if (player >= 0) this.players[player].stats.unitsBuilt++;
    return u;
  }

  addBuilding(def: BuildingDef, player: number, tx: number, ty: number, instant = false): Building {
    const b = new Building(this.nextEntityId++, def, player, tx, ty, instant);
    this.buildings.set(b.id, b);
    this.map.setOccupancy(tx, ty, def.w, def.h, b.id);
    this.events.emit({ kind: 'buildingPlaced', player, building: b.id, def: def.id });
    // a refinery ships with its own harvester
    if (def.refinery && player >= 0) {
      const harvDef = getUnit(this.players[player].config.faction === 'pact' ? 'excavator' : 'prospector');
      const dock = dockPoint(b);
      const spot = this.freeTileNear(dock.x, dock.y, 'ground');
      if (spot) this.addUnit(harvDef, player, spot.x + 0.5, spot.y + 0.5);
    }
    return b;
  }

  /** Move a unit toward a destination through the pathfinder. */
  sendTo(u: Unit, x: number, y: number, allowId = 0): void {
    const path = findPath(this.map, u.x, u.y, x, y, u.def.domain, allowId);
    u.path = path;
    u.pathGoal = path ? { x, y } : null;
    u.stuckTicks = 0;
  }

  // ------------------------------------------------------------ placement --

  canPlaceBuilding(
    player: number, def: BuildingDef, tx: number, ty: number, opts: PlaceOpts,
  ): boolean {
    // terrain + occupancy for every footprint tile
    for (let y = ty; y < ty + def.h; y++) {
      for (let x = tx; x < tx + def.w; x++) {
        if (def.naval) {
          if (!this.map.isWaterBuildableTile(x, y)) return false;
        } else if (!this.map.isBuildableTile(x, y)) {
          return false;
        }
      }
    }
    // no ground/water units standing in the footprint
    for (const u of this.units.values()) {
      if (u.dead || u.def.domain === 'air' || u.id === opts.ignoreUnit) continue;
      if (
        u.x >= tx - 0.2 && u.x <= tx + def.w + 0.2 &&
        u.y >= ty - 0.2 && u.y <= ty + def.h + 0.2
      ) {
        return false;
      }
    }
    if (opts.ignoreRadius) return true;
    // must touch the builder's base footprint network
    const ccx = tx + def.w / 2;
    const ccy = ty + def.h / 2;
    for (const b of this.buildings.values()) {
      if (b.dead || b.player !== player) continue;
      const radius = b.def.conyard
        ? (b.def.baseRadius ?? CONYARD_BUILD_RADIUS)
        : BUILDING_BUILD_RADIUS;
      if (b.distTo(ccx, ccy) <= radius + Math.max(def.w, def.h) / 2) return true;
    }
    return false;
  }

  /** Spiral search for a deployable footprint near a unit (MCV redeploy). */
  findDeploySpot(u: Unit, def: BuildingDef): { x: number; y: number } | null {
    const baseX = Math.round(u.x - def.w / 2);
    const baseY = Math.round(u.y - def.h / 2);
    for (let r = 1; r <= 5; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (this.canPlaceBuilding(u.player, def, baseX + dx, baseY + dy,
            { ignoreRadius: true, ignoreUnit: u.id })) {
            return { x: baseX + dx, y: baseY + dy };
          }
        }
      }
    }
    return null;
  }

  /** N-th free passable tile near a point (spiral); used by spawns/teleports. */
  freeTileNear(x: number, y: number, domain: MoveDomain, skip = 0): { x: number; y: number } | null {
    const bx = Math.floor(x);
    const by = Math.floor(y);
    let found = 0;
    for (let r = 0; r <= 8; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (this.map.isPassable(bx + dx, by + dy, domain)) {
            if (found++ >= skip) return { x: bx + dx, y: by + dy };
          }
        }
      }
    }
    return null;
  }

  nearestAirfield(player: number, x: number, y: number): Building | null {
    let best: Building | null = null;
    let bestD = Infinity;
    for (const b of this.buildings.values()) {
      if (b.dead || b.player !== player || !b.def.airfield || b.constructTicks > 0) continue;
      const d = b.distTo(x, y);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  /** A finished unit rolls out of its factory and heads to the rally point. */
  spawnProducedUnit(player: PlayerState, defId: string): void {
    const def = getUnit(defId);
    const factoryClass = def.class;
    let factory: Building | null = null;
    for (const b of this.buildings.values()) {
      if (!b.dead && b.player === player.id && b.def.factory === factoryClass && b.constructTicks <= 0) {
        factory = b;
        break;
      }
    }
    if (!factory) return; // factory destroyed at the last moment: unit lost

    const exitY = factory.ty + factory.def.h + 0.5;
    const spot =
      def.domain === 'air'
        ? { x: Math.floor(factory.cx), y: Math.floor(factory.cy) }
        : this.freeTileNear(factory.cx, exitY, def.domain);
    if (!spot) return;
    const u = this.addUnit(def, player.id, spot.x + 0.5, spot.y + 0.5);
    this.events.emit({ kind: 'unitReady', player: player.id, unit: u.id, def: defId });
    // fresh units clear the factory door toward the rally point
    u.setOrder({ kind: 'move', x: factory.rally.x, y: factory.rally.y });
  }

  // ----------------------------------------------------------------- tick --

  step(): void {
    if (this.gameOver) return;
    this.tick++;

    // 1. player intents
    const cmds = this.pendingCommands;
    this.pendingCommands = [];
    for (const c of cmds) applyCommand(this, c);

    // 2. economy / production / power bookkeeping
    for (const p of this.players) {
      if (p.attackNagCooldown > 0) p.attackNagCooldown--;
      if (p.defeated) continue;
      this.recomputePower(p);
      updateProduction(this, p);
      updatePowerCharges(this, p);
    }
    updateStrikes(this);

    // 3. spatial index for this tick
    this.grid.clear();
    for (const u of this.units.values()) {
      if (!u.dead) this.grid.insert(u.id, u.x, u.y);
    }

    // 4. units
    for (const u of this.units.values()) {
      if (!u.dead) updateUnit(this, u);
    }

    // 5. buildings: defenses, repair, income, construction
    for (const b of this.buildings.values()) {
      if (b.dead) continue;
      if (b.constructTicks > 0) {
        b.constructTicks--;
        continue;
      }
      updateIncome(this, b);
      this.updateBuildingCombat(b);
      this.updateRepair(b);
    }

    // 6. projectiles
    updateProjectiles(this);

    // 7. cleanup
    for (const [id, u] of this.units) {
      if (u.dead) this.units.delete(id);
    }
    for (const [id, b] of this.buildings) {
      if (b.dead) this.buildings.delete(id);
    }

    // 8. fog (staggered across players)
    for (const p of this.players) {
      if ((this.tick + p.id) % FOG_INTERVAL === 0) {
        updateFog(this.map, p, this.players, this.units.values(), this.buildings.values());
      }
    }

    // 9. AI + victory
    for (const p of this.players) {
      if (p.config.isAI && !p.defeated && (this.tick + p.id * 3) % 10 === 0) {
        updateAI(this, p);
      }
    }
    if (this.tick % 20 === 0) checkVictory(this);
  }

  private recomputePower(p: PlayerState): void {
    let prod = 0;
    let cons = 0;
    for (const b of this.buildings.values()) {
      if (b.dead || b.player !== p.id || b.constructTicks > 0) continue;
      if (b.def.power >= 0) prod += b.def.power;
      else cons += -b.def.power;
    }
    const wasLow = p.lowPower;
    p.powerProduced = prod;
    p.powerConsumed = cons;
    if (p.lowPower && !wasLow) {
      this.events.emit({ kind: 'lowPower', player: p.id });
      p.lowPowerNagged = true;
    } else if (!p.lowPower && wasLow && p.lowPowerNagged) {
      this.events.emit({ kind: 'powerRestored', player: p.id });
      p.lowPowerNagged = false;
    }
    p.radarActive = false;
    if (!p.lowPower) {
      for (const b of this.buildings.values()) {
        if (!b.dead && b.player === p.id && b.def.radar && b.constructTicks <= 0) {
          p.radarActive = true;
          break;
        }
      }
    }
  }

  private updateBuildingCombat(b: Building): void {
    if (b.weaponDefs.length === 0) return;
    if (b.def.needsPower && b.player >= 0 && this.players[b.player].lowPower) return;
    for (let i = 0; i < b.cooldowns.length; i++) {
      if (b.cooldowns[i] > 0) b.cooldowns[i]--;
    }
    // validate / refresh target
    let target: Entity | undefined =
      this.units.get(b.targetId) ?? this.buildings.get(b.targetId);
    if (
      !target || target.dead ||
      distToEntity(b.cx, b.cy, target) > b.maxRange ||
      (isUnit(target) && target.disguised)
    ) {
      target = undefined;
      b.targetId = 0;
    }
    if (!target) {
      if (b.scanCooldown-- > 0) return;
      b.scanCooldown = SCAN_INTERVAL;
      b.targetId = acquireTarget(this, b, b.maxRange);
      target = this.units.get(b.targetId) ?? this.buildings.get(b.targetId);
      if (!target) return;
    }
    if (!canEngage(b, target)) return;
    const d = distToEntity(b.cx, b.cy, target);
    for (let i = 0; i < b.weaponDefs.length; i++) {
      const w = b.weaponDefs[i];
      const airborne = isUnit(target) && target.def.domain === 'air';
      if (airborne ? !w.antiAir : !w.antiGround) continue;
      if (d > w.range || d < (w.minRange ?? 0)) continue;
      if (b.cooldowns[i] <= 0) fireWeapon(this, b, i, target);
    }
  }

  private updateRepair(b: Building): void {
    if (!b.repairing || b.player < 0) return;
    if (b.hp >= b.def.hp) {
      b.repairing = false;
      return;
    }
    const player = this.players[b.player];
    const cost = REPAIR_HP_PER_TICK * REPAIR_COST_PER_HP;
    if (player.credits < cost) return;
    player.credits -= cost;
    b.hp = Math.min(b.def.hp, b.hp + REPAIR_HP_PER_TICK);
  }
}
