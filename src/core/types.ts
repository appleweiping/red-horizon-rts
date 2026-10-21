/**
 * Shared type contracts for the whole engine.
 *
 * The simulation (src/sim) is data-driven: every unit, building, weapon and
 * superweapon is described by the plain-data definitions below (in the spirit
 * of classic RTS rules files). Balance changes never require engine changes.
 */

// ---------------------------------------------------------------- factions --

export type FactionId = 'concord' | 'pact';

export interface FactionDef {
  id: FactionId;
  name: string;
  tagline: string;
  /** Faction-wide flavor color used in menus (player color is separate). */
  color: string;
}

// ------------------------------------------------------------------- armor --

/** Armor classes. Damage taken = weapon damage x matrix[warhead][armor]. */
export type ArmorType =
  | 'none'      // infantry flesh
  | 'flak'      // light anti-air-ish infantry gear
  | 'plate'     // heavy infantry armor
  | 'light'     // light vehicles
  | 'medium'    // main battle tanks
  | 'heavy'     // super-heavy vehicles / ships
  | 'wood'      // light structures
  | 'steel'     // production structures
  | 'concrete'; // fortified structures

export type WarheadType =
  | 'sa'        // small arms
  | 'shell'     // tank cannon
  | 'ap'        // armor piercing / autocannon
  | 'he'        // high explosive (artillery, rockets)
  | 'arc'       // electric discharge
  | 'beam'      // energy lance
  | 'bomb'      // aerial bomb
  | 'nuke'      // superweapon warhead
  | 'sniper'    // anti-personnel precision
  | 'c4'        // demolition charge
  | 'suicide'   // demolisher blast
  | 'flakhead'  // anti-air flak burst
  | 'depth';    // anti-ship charge

// ----------------------------------------------------------------- weapons --

export type ProjectileKind =
  | 'instant'   // hitscan (guns); tracer drawn by renderer
  | 'shell'     // ballistic arc to a ground point, splash
  | 'missile'   // homing at an entity
  | 'arc'       // instant chain lightning
  | 'beam'      // instant line beam
  | 'bomb'      // dropped from the carrier's position, falls to ground
  | 'wave';     // slow AoE pulse (aegis/nuke visuals handled by renderer)

export interface WeaponDef {
  id: string;
  name: string;
  damage: number;
  /** Ticks between shots. */
  rof: number;
  /** Range in tiles. */
  range: number;
  minRange?: number;
  warhead: WarheadType;
  projectile: ProjectileKind;
  /** Tiles per tick, for non-instant projectiles. */
  speed?: number;
  /** Splash radius in tiles (damage falls off linearly to the edge). */
  splash?: number;
  antiGround: boolean;
  antiAir: boolean;
  /** Shots fired per volley (e.g. twin cannons). */
  burst?: number;
  /** Arc lightning: number of extra chain targets. */
  chain?: number;
  /** Sound cue key for the audio synth. */
  sound?: string;
}

// ------------------------------------------------------------------- units --

export type MoveDomain = 'ground' | 'air' | 'water';
export type UnitClass = 'infantry' | 'vehicle' | 'aircraft' | 'ship';
export type ProductionTab = 'building' | 'defense' | 'infantry' | 'vehicle' | 'air' | 'naval';

export interface UnitDef {
  id: string;
  name: string;
  /** One-line description shown in the sidebar tooltip. */
  desc: string;
  faction: FactionId | 'both';
  class: UnitClass;
  domain: MoveDomain;
  tab: ProductionTab;
  cost: number;
  /** Build time in ticks at normal speed. */
  buildTime: number;
  hp: number;
  armor: ArmorType;
  /** Tiles per second. */
  speed: number;
  /** Sight radius in tiles. */
  sight: number;
  /** Weapon ids. Empty = unarmed. */
  weapons: string[];
  /** Building def ids that must exist before this can be built. */
  prerequisites: string[];
  /** Rotating turret drawn separately from the hull. */
  turret?: boolean;
  /** Harvests ore. */
  harvester?: boolean;
  /** Captures enemy/neutral buildings (consumed on use). */
  engineer?: boolean;
  /** 'base' deploys into a building; 'fortify' toggles a dug-in stance. */
  deployable?: 'base' | 'fortify';
  /** Def id of the building a crawler deploys into. */
  deploysInto?: string;
  /** Detonates on contact with the target for `damage` of its first weapon. */
  suicide?: boolean;
  /** Heavy vehicles crush enemy infantry they drive over. */
  crushes?: boolean;
  /** Aircraft ammo before it must return to an airfield (0 = unlimited). */
  ammo?: number;
  /** Renders as a tree to enemies while idle. */
  treeDisguise?: boolean;
  /** Commando: plants charges that level buildings instantly. */
  c4?: boolean;
  /** Only one may exist per player at a time. */
  unique?: boolean;
  /** Fixed-wing: keeps moving, strafes targets (vs hover-in-place). */
  strafes?: boolean;
}

// --------------------------------------------------------------- buildings --

export interface BuildingDef {
  id: string;
  name: string;
  desc: string;
  faction: FactionId | 'both' | 'neutral';
  tab: ProductionTab; // 'building' | 'defense'
  cost: number;
  buildTime: number;
  hp: number;
  armor: ArmorType;
  /** Footprint in tiles. */
  w: number;
  h: number;
  /** Positive = generates power, negative = consumes. */
  power: number;
  sight: number;
  weapons?: string[];
  prerequisites: string[];
  /** Construction yard: enables building tab + provides build radius. */
  conyard?: boolean;
  /** Extra build radius granted around this structure (default small). */
  baseRadius?: number;
  /** Ore refinery: harvesters dock here. */
  refinery?: boolean;
  /** Produces units of this class. */
  factory?: UnitClass;
  /** Enables the minimap radar view. */
  radar?: boolean;
  /** Tier-3 tech unlock. */
  tech?: boolean;
  /** Aircraft land here to rearm. */
  airfield?: boolean;
  /** Must be placed on water (shipyards). */
  naval?: boolean;
  /** Engineers can walk in and take it over. */
  capturable?: boolean;
  /** Credits granted per second while owned (oil derrick). */
  income?: number;
  /** Superweapon this building charges (SupportPowerDef id). */
  superweapon?: string;
  /** Base defenses auto-engage and shut down on low power. */
  needsPower?: boolean;
}

// ------------------------------------------------------------ superweapons --

export type PowerKind = 'storm' | 'nuke' | 'phase' | 'aegis';

export interface SupportPowerDef {
  id: string;
  name: string;
  desc: string;
  kind: PowerKind;
  faction: FactionId;
  /** Charge time in ticks. */
  chargeTicks: number;
  /** Effect radius in tiles. */
  radius: number;
  /** Total damage delivered (storm: split across bolts; nuke: center hit). */
  damage: number;
  /** Announcer line when launched. */
  announce: string;
}

// ---------------------------------------------------------------- commands --

/** Player intents fed into the deterministic simulation. */
export type Command =
  | { kind: 'move'; units: number[]; x: number; y: number; queued?: boolean }
  | { kind: 'attackMove'; units: number[]; x: number; y: number }
  | { kind: 'attack'; units: number[]; target: number }
  | { kind: 'stop'; units: number[] }
  | { kind: 'deploy'; units: number[] }
  | { kind: 'harvest'; units: number[]; tx: number; ty: number }
  | { kind: 'capture'; units: number[]; target: number }
  | { kind: 'startProduction'; player: number; tab: ProductionTab; def: string }
  | { kind: 'cancelProduction'; player: number; tab: ProductionTab }
  | { kind: 'pauseProduction'; player: number; tab: ProductionTab }
  | { kind: 'placeBuilding'; player: number; def: string; tx: number; ty: number }
  | { kind: 'sell'; player: number; building: number }
  | { kind: 'repair'; player: number; building: number }
  | { kind: 'setRally'; building: number; x: number; y: number }
  | { kind: 'firePower'; player: number; power: string; x: number; y: number; units?: number[] };

// -------------------------------------------------------------- sim events --

/** Events emitted by the simulation for UI / audio / AI consumption. */
export type SimEvent =
  | { kind: 'unitReady'; player: number; unit: number; def: string }
  | { kind: 'buildingReady'; player: number; def: string }
  | { kind: 'buildingPlaced'; player: number; building: number; def: string }
  | { kind: 'constructionComplete'; player: number; def: string }
  | { kind: 'insufficientFunds'; player: number }
  | { kind: 'lowPower'; player: number }
  | { kind: 'powerRestored'; player: number }
  | { kind: 'underAttack'; player: number; x: number; y: number; isBase: boolean }
  | { kind: 'unitLost'; player: number; def: string; x: number; y: number }
  | { kind: 'buildingLost'; player: number; def: string; x: number; y: number }
  | { kind: 'buildingCaptured'; player: number; from: number; def: string }
  | { kind: 'promoted'; player: number; unit: number; rank: 1 | 2 }
  | { kind: 'shot'; weapon: string; x: number; y: number; tx: number; ty: number }
  | { kind: 'impact'; weapon: string; x: number; y: number; big: boolean }
  | { kind: 'death'; class: UnitClass | 'building'; x: number; y: number }
  | { kind: 'crush'; x: number; y: number }
  | { kind: 'powerCharged'; player: number; power: string }
  | { kind: 'powerLaunched'; player: number; power: string; x: number; y: number }
  | { kind: 'nukeWarning'; player: number }
  | { kind: 'harvested'; player: number; amount: number }
  | { kind: 'sold'; player: number; x: number; y: number }
  | { kind: 'playerDefeated'; player: number }
  | { kind: 'gameOver'; winners: number[] };

// ----------------------------------------------------------------- players --

export type AIDifficulty = 'easy' | 'normal' | 'hard';

export interface PlayerConfig {
  name: string;
  faction: FactionId;
  color: string;
  isAI: boolean;
  difficulty?: AIDifficulty;
  /** Team number; players on the same team are allies. 0 = FFA. */
  team?: number;
}

export interface MatchConfig {
  mapId: string;
  seed: number;
  players: PlayerConfig[];
  startingCredits: number;
  /** Sim speed multiplier applied by the render loop (1 = 20 tps). */
  speed: number;
  superweapons: boolean;
}

export interface PlayerStats {
  unitsBuilt: number;
  unitsLost: number;
  unitsKilled: number;
  buildingsBuilt: number;
  buildingsLost: number;
  buildingsKilled: number;
  creditsHarvested: number;
  creditsSpent: number;
}

// ----------------------------------------------------------------- terrain --

export const enum Terrain {
  Grass = 0,
  Road = 1,
  Water = 2,
  Cliff = 3,
  OreBearing = 4, // grass with ore markers painted on it
  Shore = 5,
  Bridge = 6,
  Trees = 7,
}

export interface MapDef {
  id: string;
  name: string;
  desc: string;
  width: number;
  height: number;
  seed: number;
  maxPlayers: number;
  /** 0..1 how much water the generator carves. */
  water: number;
  /** 0..1 ore richness. */
  ore: number;
}
