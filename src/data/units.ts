import type { UnitDef } from '../core/types';

/**
 * Complete unit roster for both factions: infantry, vehicles, aircraft and
 * ships. Archetypes follow the classic RTS mold (basic rifleman, engineer,
 * medium vs heavy tank doctrine, long-range artillery, harvester economy,
 * a deployable construction vehicle) with original art and stats. Names are
 * my own apart from generic terms such as Engineer, Militia or IFV.
 */
export const UNITS: UnitDef[] = [
  // =================================================== shared (both sides) --
  {
    id: 'engineer', name: 'Engineer',
    desc: 'Captures enemy and neutral structures. Unarmed. Consumed on use.',
    faction: 'both', class: 'infantry', domain: 'ground', tab: 'infantry',
    cost: 500, buildTime: 63, hp: 45, armor: 'none', speed: 1.5, sight: 4,
    weapons: [], prerequisites: ['barracks'], engineer: true,
  },
  {
    id: 'pioneer', name: 'Pioneer Crawler',
    desc: 'Mobile HQ. Deploys into a Construction Yard — the heart of any base.',
    faction: 'both', class: 'vehicle', domain: 'ground', tab: 'vehicle',
    cost: 3000, buildTime: 375, hp: 600, armor: 'heavy', speed: 1.2, sight: 4,
    weapons: [], prerequisites: ['warfactory', 'lab'],
    deployable: 'base', deploysInto: 'conyard',
  },

  // ======================================================= Atlantic Concord --
  // infantry
  {
    id: 'guardsman', name: 'Guardsman',
    desc: 'Standard rifle infantry. Deploy to brace: more range, more damage.',
    faction: 'concord', class: 'infantry', domain: 'ground', tab: 'infantry',
    cost: 200, buildTime: 25, hp: 60, armor: 'none', speed: 1.6, sight: 5,
    weapons: ['gauss_rifle'], prerequisites: ['barracks'], deployable: 'fortify',
  },
  {
    id: 'jettrooper', name: 'Jet Trooper',
    desc: 'Flying infantry. Harasses ground troops and intercepts aircraft.',
    faction: 'concord', class: 'infantry', domain: 'air', tab: 'infantry',
    cost: 600, buildTime: 75, hp: 70, armor: 'flak', speed: 3.2, sight: 6,
    weapons: ['jet_carbine'], prerequisites: ['barracks', 'radar'],
  },
  {
    id: 'naomi', name: 'Agent Naomi',
    desc: 'Commando. One shot, one kill vs infantry; plants charges that level buildings.',
    faction: 'concord', class: 'infantry', domain: 'ground', tab: 'infantry',
    cost: 1500, buildTime: 188, hp: 120, armor: 'plate', speed: 1.9, sight: 7,
    weapons: ['silenced_pistol'], prerequisites: ['barracks', 'lab'],
    c4: true, unique: true,
  },
  // vehicles
  {
    id: 'prospector', name: 'Prospector',
    desc: 'Ore harvester. The engine of your economy — protect it.',
    faction: 'concord', class: 'vehicle', domain: 'ground', tab: 'vehicle',
    cost: 1400, buildTime: 175, hp: 600, armor: 'medium', speed: 1.7, sight: 4,
    weapons: [], prerequisites: ['warfactory', 'refinery'], harvester: true,
  },
  {
    id: 'ifv', name: 'Strike IFV',
    desc: 'Fast rocket vehicle. Hits ground and air. Fragile but everywhere.',
    faction: 'concord', class: 'vehicle', domain: 'ground', tab: 'vehicle',
    cost: 600, buildTime: 75, hp: 180, armor: 'light', speed: 3.0, sight: 6,
    weapons: ['ifv_rockets'], prerequisites: ['warfactory'], turret: true,
  },
  {
    id: 'wolf', name: 'Wolf Tank',
    desc: 'Medium main battle tank. Cheap, quick, reliable.',
    faction: 'concord', class: 'vehicle', domain: 'ground', tab: 'vehicle',
    cost: 700, buildTime: 88, hp: 320, armor: 'medium', speed: 2.2, sight: 5.5,
    weapons: ['wolf_cannon'], prerequisites: ['warfactory'],
    turret: true, crushes: true,
  },
  {
    id: 'thicket', name: 'Thicket Tank',
    desc: 'Disguises itself as a tree while idle. A tank-hunting ambush predator.',
    faction: 'concord', class: 'vehicle', domain: 'ground', tab: 'vehicle',
    cost: 1000, buildTime: 125, hp: 240, armor: 'light', speed: 2.4, sight: 6,
    weapons: ['thicket_gun'], prerequisites: ['warfactory', 'lab'],
    treeDisguise: true,
  },
  {
    id: 'lance', name: 'Lance Artillery',
    desc: 'Long-range energy projector. Melts armor and fortifications alike.',
    faction: 'concord', class: 'vehicle', domain: 'ground', tab: 'vehicle',
    cost: 1200, buildTime: 150, hp: 160, armor: 'light', speed: 1.8, sight: 6,
    weapons: ['lance_beam'], prerequisites: ['warfactory', 'lab'],
  },
  // aircraft
  {
    id: 'kestrel', name: 'Kestrel Jet',
    desc: 'Strike fighter. Two missiles per sortie, then returns to rearm.',
    faction: 'concord', class: 'aircraft', domain: 'air', tab: 'air',
    cost: 1200, buildTime: 150, hp: 160, armor: 'light', speed: 5.0, sight: 7,
    weapons: ['kestrel_missiles'], prerequisites: ['airfield'],
    ammo: 2, strafes: true,
  },
  // navy
  {
    id: 'corvette', name: 'Corvette',
    desc: 'Fast patrol ship. Naval gun for surface and shore targets.',
    faction: 'concord', class: 'ship', domain: 'water', tab: 'naval',
    cost: 900, buildTime: 113, hp: 300, armor: 'medium', speed: 3.0, sight: 6,
    weapons: ['corvette_gun'], prerequisites: ['shipyard'], turret: true,
  },
  {
    id: 'cruiser', name: 'Siege Cruiser',
    desc: 'Shore bombardment platform. Cracks bases open from the waterline.',
    faction: 'concord', class: 'ship', domain: 'water', tab: 'naval',
    cost: 1800, buildTime: 225, hp: 420, armor: 'heavy', speed: 2.0, sight: 5,
    weapons: ['cruiser_gun'], prerequisites: ['shipyard', 'lab'], turret: true,
  },

  // ========================================================= Crimson Pact --
  // infantry
  {
    id: 'militia', name: 'Militia',
    desc: 'Dirt-cheap conscripted rifleman. Quantity is its own quality.',
    faction: 'pact', class: 'infantry', domain: 'ground', tab: 'infantry',
    cost: 120, buildTime: 15, hp: 50, armor: 'none', speed: 1.5, sight: 4.5,
    weapons: ['militia_rifle'], prerequisites: ['barracks'],
  },
  {
    id: 'arctrooper', name: 'Arc Trooper',
    desc: 'Armored shock infantry. Short-range electric discharge wrecks anything.',
    faction: 'pact', class: 'infantry', domain: 'ground', tab: 'infantry',
    cost: 450, buildTime: 56, hp: 85, armor: 'plate', speed: 1.4, sight: 4.5,
    weapons: ['arc_gauntlet'], prerequisites: ['barracks'],
  },
  {
    id: 'skygunner', name: 'Sky Gunner',
    desc: 'Man-portable flak. The infantry answer to enemy air power.',
    faction: 'pact', class: 'infantry', domain: 'ground', tab: 'infantry',
    cost: 300, buildTime: 38, hp: 55, armor: 'flak', speed: 1.4, sight: 5,
    weapons: ['flak_rifle'], prerequisites: ['barracks'],
  },
  {
    id: 'demolisher', name: 'Demolisher',
    desc: 'Strapped with explosives. Runs at the target. Does not come back.',
    faction: 'pact', class: 'infantry', domain: 'ground', tab: 'infantry',
    cost: 700, buildTime: 88, hp: 60, armor: 'none', speed: 1.7, sight: 4,
    weapons: ['demo_charge'], prerequisites: ['barracks', 'radar'], suicide: true,
  },
  // vehicles
  {
    id: 'excavator', name: 'Excavator',
    desc: 'Armored ore harvester. Slower than its rival, far tougher.',
    faction: 'pact', class: 'vehicle', domain: 'ground', tab: 'vehicle',
    cost: 1400, buildTime: 175, hp: 700, armor: 'heavy', speed: 1.5, sight: 4,
    weapons: [], prerequisites: ['warfactory', 'refinery'], harvester: true,
  },
  {
    id: 'viper', name: 'Viper Drone',
    desc: 'Fast robotic hunter. Shreds vehicles up close; useless at range.',
    faction: 'pact', class: 'vehicle', domain: 'ground', tab: 'vehicle',
    cost: 500, buildTime: 63, hp: 140, armor: 'light', speed: 3.4, sight: 6,
    weapons: ['viper_shredder'], prerequisites: ['warfactory'],
  },
  {
    id: 'bear', name: 'Bear Tank',
    desc: 'Heavy main battle tank. Wins the head-on fight, every time.',
    faction: 'pact', class: 'vehicle', domain: 'ground', tab: 'vehicle',
    cost: 900, buildTime: 113, hp: 420, armor: 'heavy', speed: 1.9, sight: 5.5,
    weapons: ['bear_cannon'], prerequisites: ['warfactory'],
    turret: true, crushes: true,
  },
  {
    id: 'hailstorm', name: 'Hailstorm Launcher',
    desc: 'Long-range rocket artillery. Devastating volleys, paper armor.',
    faction: 'pact', class: 'vehicle', domain: 'ground', tab: 'vehicle',
    cost: 1200, buildTime: 150, hp: 180, armor: 'light', speed: 1.7, sight: 6,
    weapons: ['hailstorm_rockets'], prerequisites: ['warfactory', 'radar'],
  },
  {
    id: 'behemoth', name: 'Behemoth Tank',
    desc: 'Twin-cannon flagship tank with its own flak. A rolling fortress.',
    faction: 'pact', class: 'vehicle', domain: 'ground', tab: 'vehicle',
    cost: 1750, buildTime: 219, hp: 800, armor: 'heavy', speed: 1.4, sight: 5.5,
    weapons: ['behemoth_cannons', 'behemoth_aa'], prerequisites: ['warfactory', 'lab'],
    turret: true, crushes: true,
  },
  // aircraft
  {
    id: 'leviathan', name: 'Leviathan',
    desc: 'Colossal bomber airship. Slow as dread, and just as inevitable.',
    faction: 'pact', class: 'aircraft', domain: 'air', tab: 'air',
    cost: 2000, buildTime: 250, hp: 1200, armor: 'heavy', speed: 1.1, sight: 6,
    weapons: ['leviathan_bomb'], prerequisites: ['airfield', 'lab'],
  },
  // navy
  {
    id: 'barracuda', name: 'Barracuda Gunboat',
    desc: 'Flak gunboat. Escorts the fleet and rakes the shoreline.',
    faction: 'pact', class: 'ship', domain: 'water', tab: 'naval',
    cost: 800, buildTime: 100, hp: 280, armor: 'medium', speed: 3.2, sight: 6,
    weapons: ['barracuda_flak'], prerequisites: ['shipyard'], turret: true,
  },
  {
    id: 'citadel', name: 'Citadel Battleship',
    desc: 'Missile battleship. Erases coastal bases from beyond reply.',
    faction: 'pact', class: 'ship', domain: 'water', tab: 'naval',
    cost: 2000, buildTime: 250, hp: 500, armor: 'heavy', speed: 1.8, sight: 5,
    weapons: ['citadel_missiles'], prerequisites: ['shipyard', 'lab'],
  },
];

export const UNIT_BY_ID: ReadonlyMap<string, UnitDef> = new Map(
  UNITS.map((u) => [u.id, u]),
);

export function getUnit(id: string): UnitDef {
  const u = UNIT_BY_ID.get(id);
  if (!u) throw new Error(`Unknown unit: ${id}`);
  return u;
}
