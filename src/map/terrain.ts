import { Terrain } from '../core/types';
import type { MoveDomain } from '../core/types';

/**
 * The game map: terrain layer, ore layer and building occupancy.
 * Pure data + queries; mutation happens through the simulation.
 */
export class GameMap {
  readonly width: number;
  readonly height: number;
  /** Terrain enum per tile. */
  readonly terrain: Uint8Array;
  /** Ore bails remaining per tile. */
  readonly ore: Uint16Array;
  /** 0 = none, 1 = ore, 2 = gems. */
  readonly oreKind: Uint8Array;
  /** Building id + 1 occupying each tile (0 = free). */
  readonly occupancy: Int32Array;
  /** Starting positions (tile coords). */
  spawns: { x: number; y: number }[] = [];
  /** Neutral tech building sites (tile coords, top-left). */
  derricks: { x: number; y: number }[] = [];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.terrain = new Uint8Array(width * height);
    this.ore = new Uint16Array(width * height);
    this.oreKind = new Uint8Array(width * height);
    this.occupancy = new Int32Array(width * height);
  }

  idx(tx: number, ty: number): number {
    return ty * this.width + tx;
  }

  inBounds(tx: number, ty: number): boolean {
    return tx >= 0 && ty >= 0 && tx < this.width && ty < this.height;
  }

  terrainAt(tx: number, ty: number): Terrain {
    return this.terrain[this.idx(tx, ty)] as Terrain;
  }

  /** Building id occupying the tile, or 0. */
  occupierAt(tx: number, ty: number): number {
    return this.occupancy[this.idx(tx, ty)];
  }

  setOccupancy(tx: number, ty: number, w: number, h: number, id: number): void {
    for (let y = ty; y < ty + h; y++) {
      for (let x = tx; x < tx + w; x++) {
        if (this.inBounds(x, y)) this.occupancy[this.idx(x, y)] = id;
      }
    }
  }

  /** Terrain passability for a movement domain (ignores buildings). */
  isTerrainPassable(tx: number, ty: number, domain: MoveDomain): boolean {
    if (!this.inBounds(tx, ty)) return false;
    const t = this.terrain[this.idx(tx, ty)] as Terrain;
    switch (domain) {
      case 'air':
        return true;
      case 'water':
        return t === Terrain.Water;
      case 'ground':
        return t !== Terrain.Water && t !== Terrain.Cliff;
    }
  }

  /** Full passability: terrain + building occupancy (allowId may pass, for docking). */
  isPassable(tx: number, ty: number, domain: MoveDomain, allowId = 0): boolean {
    if (!this.isTerrainPassable(tx, ty, domain)) return false;
    if (domain === 'air') return true;
    const occ = this.occupancy[this.idx(tx, ty)];
    return occ === 0 || occ === allowId;
  }

  /** Movement cost multiplier for ground units (roads are fast, woods slow). */
  moveCost(tx: number, ty: number): number {
    const t = this.terrain[this.idx(tx, ty)] as Terrain;
    switch (t) {
      case Terrain.Road:
      case Terrain.Bridge:
        return 0.72;
      case Terrain.Trees:
        return 1.45;
      case Terrain.OreBearing:
      case Terrain.Shore:
        return 1.12;
      default:
        return 1.0;
    }
  }

  /** Can a standard structure footprint tile go here? */
  isBuildableTile(tx: number, ty: number): boolean {
    if (!this.inBounds(tx, ty)) return false;
    const t = this.terrain[this.idx(tx, ty)] as Terrain;
    if (
      t === Terrain.Water || t === Terrain.Cliff ||
      t === Terrain.Trees || t === Terrain.Bridge
    ) {
      return false;
    }
    return this.occupancy[this.idx(tx, ty)] === 0;
  }

  /** Naval structures sit on open water. */
  isWaterBuildableTile(tx: number, ty: number): boolean {
    if (!this.inBounds(tx, ty)) return false;
    return (
      (this.terrain[this.idx(tx, ty)] as Terrain) === Terrain.Water &&
      this.occupancy[this.idx(tx, ty)] === 0
    );
  }

  /** Remove one bail of ore; reverts tile to grass when exhausted. */
  takeOre(tx: number, ty: number): number {
    const i = this.idx(tx, ty);
    if (this.ore[i] === 0) return 0;
    this.ore[i]--;
    const kind = this.oreKind[i];
    if (this.ore[i] === 0) {
      this.oreKind[i] = 0;
      this.terrain[i] = Terrain.Grass;
    }
    return kind;
  }
}
