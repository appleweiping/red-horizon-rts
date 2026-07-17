import type { BuildingDef } from '../core/types';

/**
 * All structures: production, economy, tech, defenses, superweapons and
 * capturable neutral tech buildings.
 *
 * Tech tree (both factions):
 *   power -> refinery -> barracks
 *   refinery -> warfactory / radar / shipyard
 *   radar -> airfield, tier-2 units
 *   radar + warfactory -> lab -> tier-3 units + superweapons
 */
export const BUILDINGS: BuildingDef[] = [
  // ------------------------------------------------------------- shared ----
  {
    id: 'conyard', name: 'Construction Yard',
    desc: 'The heart of the base. Builds every structure. Lose it, lose the war.',
    faction: 'both', tab: 'building',
    cost: 3000, buildTime: 375, hp: 1500, armor: 'steel',
    w: 3, h: 3, power: 0, sight: 6,
    prerequisites: [], conyard: true, baseRadius: 10,
  },
  {
    id: 'refinery', name: 'Ore Refinery',
    desc: 'Processes ore into credits. Comes with a free harvester.',
    faction: 'both', tab: 'building',
    cost: 2000, buildTime: 250, hp: 1000, armor: 'steel',
    w: 3, h: 3, power: -30, sight: 5,
    prerequisites: [], refinery: true,
  },
  {
    id: 'barracks', name: 'Barracks',
    desc: 'Trains infantry.',
    faction: 'both', tab: 'building',
    cost: 500, buildTime: 63, hp: 800, armor: 'steel',
    w: 2, h: 2, power: -10, sight: 5,
    prerequisites: [], factory: 'infantry',
  },
  {
    id: 'warfactory', name: 'War Factory',
    desc: 'Builds vehicles.',
    faction: 'both', tab: 'building',
    cost: 2000, buildTime: 250, hp: 1200, armor: 'steel',
    w: 3, h: 3, power: -25, sight: 5,
    prerequisites: ['refinery'], factory: 'vehicle',
  },
  {
    id: 'radar', name: 'Radar Dome',
    desc: 'Reveals the minimap and unlocks tier-2 technology. Needs power.',
    faction: 'both', tab: 'building',
    cost: 1000, buildTime: 125, hp: 900, armor: 'steel',
    w: 2, h: 2, power: -40, sight: 8,
    prerequisites: ['refinery'], radar: true, needsPower: true,
  },
  {
    id: 'airfield', name: 'Airfield',
    desc: 'Builds and rearms aircraft.',
    faction: 'both', tab: 'building',
    cost: 1200, buildTime: 150, hp: 900, armor: 'steel',
    w: 3, h: 2, power: -30, sight: 6,
    prerequisites: ['radar'], factory: 'aircraft', airfield: true,
  },
  {
    id: 'shipyard', name: 'Naval Yard',
    desc: 'Builds warships. Must be placed on the waterline.',
    faction: 'both', tab: 'building',
    cost: 1500, buildTime: 188, hp: 1200, armor: 'steel',
    w: 3, h: 3, power: -25, sight: 6,
    prerequisites: ['refinery'], factory: 'ship', naval: true,
  },
  {
    id: 'lab', name: 'Battle Lab',
    desc: 'Unlocks tier-3 technology and superweapons. Guard it well.',
    faction: 'both', tab: 'building',
    cost: 2000, buildTime: 250, hp: 700, armor: 'steel',
    w: 2, h: 2, power: -60, sight: 5,
    prerequisites: ['radar', 'warfactory'], tech: true,
  },

  // ------------------------------------------------------------ Concord ----
  {
    id: 'fusion_plant', name: 'Fusion Plant',
    desc: 'Clean, dense power. +200.',
    faction: 'concord', tab: 'building',
    cost: 800, buildTime: 100, hp: 600, armor: 'steel',
    w: 2, h: 2, power: 200, sight: 4,
    prerequisites: [],
  },
  {
    id: 'bunker', name: 'Gun Bunker',
    desc: 'Anti-infantry strongpoint. Works without power.',
    faction: 'concord', tab: 'defense',
    cost: 500, buildTime: 63, hp: 500, armor: 'concrete',
    w: 1, h: 1, power: 0, sight: 6,
    weapons: ['bunker_gun'], prerequisites: ['barracks'],
  },
  {
    id: 'sam_site', name: 'SAM Site',
    desc: 'Long-range surface-to-air missiles. Needs power.',
    faction: 'concord', tab: 'defense',
    cost: 800, buildTime: 100, hp: 600, armor: 'concrete',
    w: 1, h: 1, power: -10, sight: 8,
    weapons: ['sam_missile'], prerequisites: ['barracks'], needsPower: true,
  },
  {
    id: 'lance_tower', name: 'Lance Tower',
    desc: 'Tier-2 energy turret. Burns through anything on the ground. Needs power.',
    faction: 'concord', tab: 'defense',
    cost: 1200, buildTime: 150, hp: 600, armor: 'concrete',
    w: 1, h: 1, power: -50, sight: 8,
    weapons: ['lance_tower_gun'], prerequisites: ['radar'], needsPower: true,
  },
  {
    id: 'storm_array', name: 'Tempest Array',
    desc: 'Superweapon. Charges a devastating ion storm strike.',
    faction: 'concord', tab: 'building',
    cost: 3000, buildTime: 375, hp: 1000, armor: 'concrete',
    w: 3, h: 3, power: -100, sight: 5,
    prerequisites: ['lab'], superweapon: 'stormstrike', needsPower: true,
  },
  {
    id: 'chrono_relay', name: 'Chrono Relay',
    desc: 'Support superweapon. Teleports your strike force across the map.',
    faction: 'concord', tab: 'building',
    cost: 2500, buildTime: 313, hp: 900, armor: 'concrete',
    w: 2, h: 2, power: -80, sight: 5,
    prerequisites: ['lab'], superweapon: 'chronoshift', needsPower: true,
  },

  // --------------------------------------------------------------- Pact ----
  {
    id: 'combustion_plant', name: 'Combustion Plant',
    desc: 'Dirty and cheap. +150.',
    faction: 'pact', tab: 'building',
    cost: 600, buildTime: 75, hp: 700, armor: 'steel',
    w: 2, h: 2, power: 150, sight: 4,
    prerequisites: [],
  },
  {
    id: 'sentry', name: 'Sentry Gun',
    desc: 'Automated anti-infantry gun. Works without power.',
    faction: 'pact', tab: 'defense',
    cost: 400, buildTime: 50, hp: 450, armor: 'concrete',
    w: 1, h: 1, power: 0, sight: 6,
    weapons: ['sentry_mg'], prerequisites: ['barracks'],
  },
  {
    id: 'flak_cannon', name: 'Flak Cannon',
    desc: 'Heavy anti-air artillery. Needs power.',
    faction: 'pact', tab: 'defense',
    cost: 700, buildTime: 88, hp: 550, armor: 'concrete',
    w: 1, h: 1, power: -10, sight: 8,
    weapons: ['flak_cannon_gun'], prerequisites: ['barracks'], needsPower: true,
  },
  {
    id: 'arc_tower', name: 'Arc Tower',
    desc: 'Tier-2 electric turret. Chains between targets. Needs power.',
    faction: 'pact', tab: 'defense',
    cost: 1200, buildTime: 150, hp: 600, armor: 'concrete',
    w: 1, h: 1, power: -50, sight: 7,
    weapons: ['arc_tower_gun'], prerequisites: ['radar'], needsPower: true,
  },
  {
    id: 'icbm_silo', name: 'ICBM Silo',
    desc: 'Superweapon. Ten minutes to midnight.',
    faction: 'pact', tab: 'building',
    cost: 3000, buildTime: 375, hp: 1000, armor: 'concrete',
    w: 3, h: 3, power: -100, sight: 5,
    prerequisites: ['lab'], superweapon: 'icbm', needsPower: true,
  },
  {
    id: 'aegis_generator', name: 'Aegis Generator',
    desc: 'Support superweapon. Projects a field of temporary invulnerability.',
    faction: 'pact', tab: 'building',
    cost: 2500, buildTime: 313, hp: 900, armor: 'concrete',
    w: 2, h: 2, power: -80, sight: 5,
    prerequisites: ['lab'], superweapon: 'aegis', needsPower: true,
  },

  // ------------------------------------------------------------ neutral ----
  {
    id: 'oil_derrick', name: 'Oil Derrick',
    desc: 'Neutral tech structure. Capture with an engineer for steady income.',
    faction: 'neutral', tab: 'building',
    cost: 0, buildTime: 1, hp: 600, armor: 'wood',
    w: 2, h: 2, power: 0, sight: 3,
    prerequisites: [], capturable: true, income: 10,
  },
];

export const BUILDING_BY_ID: ReadonlyMap<string, BuildingDef> = new Map(
  BUILDINGS.map((b) => [b.id, b]),
);

export function getBuilding(id: string): BuildingDef {
  const b = BUILDING_BY_ID.get(id);
  if (!b) throw new Error(`Unknown building: ${id}`);
  return b;
}
