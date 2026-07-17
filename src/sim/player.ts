import type {
  PlayerConfig, PlayerStats, ProductionTab, SupportPowerDef,
} from '../core/types';

export interface QueueItem {
  def: string;
  /** Ticks of progress banked so far. */
  progress: number;
  /** Credits already paid toward this item. */
  paid: number;
  total: number; // build time in ticks
  cost: number;
}

export interface ProductionQueue {
  items: QueueItem[];
  /** Completed building def waiting for placement (building/defense tabs). */
  ready: string | null;
  hold: boolean;
  /** Throttles the "insufficient funds" nag. */
  fundsNagCooldown: number;
}

export interface PowerCharge {
  def: SupportPowerDef;
  charge: number;
  ready: boolean;
}

export const ALL_TABS: ProductionTab[] = [
  'building', 'defense', 'infantry', 'vehicle', 'air', 'naval',
];

export class PlayerState {
  readonly id: number;
  readonly config: PlayerConfig;
  credits: number;
  defeated = false;

  powerProduced = 0;
  powerConsumed = 0;

  queues: Record<ProductionTab, ProductionQueue>;
  powers = new Map<string, PowerCharge>();

  /** Fog of war: 0 shroud, 1 explored, 2 visible. */
  fog: Uint8Array;
  radarActive = false;

  stats: PlayerStats = {
    unitsBuilt: 0, unitsLost: 0, unitsKilled: 0,
    buildingsBuilt: 0, buildingsLost: 0, buildingsKilled: 0,
    creditsHarvested: 0, creditsSpent: 0,
  };

  /** Ticks until the next "under attack" warning may fire. */
  attackNagCooldown = 0;
  lowPowerNagged = false;

  constructor(id: number, config: PlayerConfig, credits: number, mapTiles: number) {
    this.id = id;
    this.config = config;
    this.credits = credits;
    this.fog = new Uint8Array(mapTiles);
    const queues = {} as Record<ProductionTab, ProductionQueue>;
    for (const t of ALL_TABS) {
      queues[t] = { items: [], ready: null, hold: false, fundsNagCooldown: 0 };
    }
    this.queues = queues;
  }

  get lowPower(): boolean {
    return this.powerConsumed > this.powerProduced;
  }

  /** Are two players allied (same team, teams > 0) or the same player? */
  isAlliedWith(other: PlayerState): boolean {
    if (other.id === this.id) return true;
    const a = this.config.team ?? 0;
    const b = other.config.team ?? 0;
    return a > 0 && a === b;
  }
}
