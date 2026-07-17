/** Simulation and rendering constants. */

/** Simulation ticks per second (fixed step). */
export const TICKS_PER_SEC = 20;
export const TICK_MS = 1000 / TICKS_PER_SEC;

/** Isometric tile dimensions in screen pixels. */
export const TILE_W = 64;
export const TILE_H = 32;

/** Credits per ore bail. */
export const ORE_VALUE = 25;
export const GEM_VALUE = 50;
/** Harvester capacity in bails. */
export const HARVESTER_CAPACITY = 28;
/** Ticks to mine one bail. */
export const HARVEST_TICKS = 8;
/** Ticks to unload the whole cargo at a refinery. */
export const UNLOAD_TICKS = 30;

/** Build radius (tiles) granted around a construction yard. */
export const CONYARD_BUILD_RADIUS = 10;
/** Default extra radius around other buildings. */
export const BUILDING_BUILD_RADIUS = 4;

/** Fraction of cost refunded when selling. */
export const SELL_REFUND = 0.5;
/** Credits per hp when repairing (cheap but not free). */
export const REPAIR_COST_PER_HP = 0.25;
/** HP repaired per tick while repair is active. */
export const REPAIR_HP_PER_TICK = 2;

/** Low power: production speed multiplier. */
export const LOW_POWER_BUILD_MULT = 0.4;
/** Extra production queues speedup per additional factory of same kind. */
export const EXTRA_FACTORY_MULT = 0.4;
export const MAX_FACTORY_MULT = 2.0;

/** Veterancy: kill value (credits) needed relative to own cost. */
export const VETERAN_KILL_RATIO = 2;
export const ELITE_KILL_RATIO = 5;
export const VETERAN_DAMAGE_MULT = 1.25;
export const ELITE_DAMAGE_MULT = 1.6;
export const VETERAN_ARMOR_MULT = 0.8; // damage taken multiplier
export const ELITE_ARMOR_MULT = 0.65;
/** Elite units self-heal this many hp per second. */
export const ELITE_SELFHEAL_PER_SEC = 2;

/** Fog of war constants. */
export const FOG_SHROUD = 0;
export const FOG_EXPLORED = 1;
export const FOG_VISIBLE = 2;
/** Recompute vision every N ticks. */
export const FOG_INTERVAL = 4;

/** Neutral (unowned) player id for tech buildings. */
export const NEUTRAL = -1;

/** Target scan interval in ticks. */
export const SCAN_INTERVAL = 5;

/** Max A* node expansions before giving up. */
export const ASTAR_MAX_EXPANSIONS = 6000;

/** Starting credits default. */
export const DEFAULT_CREDITS = 10000;

/** Selectable player colors. */
export const PLAYER_COLORS = [
  '#e8b023', // amber
  '#d63c3c', // crimson
  '#3f7fe0', // azure
  '#3cae5c', // green
  '#9550d8', // violet
  '#d977b8', // rose
  '#4fc3c7', // teal
  '#c77b3a', // rust
];
