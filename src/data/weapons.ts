import type { WeaponDef } from '../core/types';

/** All weapons in the game, both factions plus base defenses. */
export const WEAPONS: WeaponDef[] = [
  // ------------------------------------------------- Concord infantry arms --
  {
    id: 'gauss_rifle', name: 'Gauss Rifle',
    damage: 12, rof: 15, range: 4.5, warhead: 'sa', projectile: 'instant',
    antiGround: true, antiAir: false, sound: 'rifle',
  },
  {
    id: 'gauss_rifle_deployed', name: 'Braced Gauss Rifle',
    damage: 18, rof: 12, range: 6, warhead: 'sa', projectile: 'instant',
    antiGround: true, antiAir: false, sound: 'rifle',
  },
  {
    id: 'jet_carbine', name: 'Jet Carbine',
    damage: 10, rof: 10, range: 4.5, warhead: 'sa', projectile: 'instant',
    antiGround: true, antiAir: true, sound: 'rifle',
  },
  {
    id: 'silenced_pistol', name: 'Silenced Pistol',
    damage: 70, rof: 18, range: 5, warhead: 'sniper', projectile: 'instant',
    antiGround: true, antiAir: false, sound: 'sniper',
  },

  // ----------------------------------------------- Concord vehicle weapons --
  {
    id: 'ifv_rockets', name: 'Skystrike Rockets',
    damage: 22, rof: 26, range: 5.5, warhead: 'he', projectile: 'missile',
    speed: 0.45, burst: 2, antiGround: true, antiAir: true, sound: 'missile',
  },
  {
    id: 'wolf_cannon', name: '90mm Cannon',
    damage: 42, rof: 30, range: 5, warhead: 'shell', projectile: 'shell',
    speed: 0.5, splash: 0.4, antiGround: true, antiAir: false, sound: 'cannon',
  },
  {
    id: 'thicket_gun', name: 'Ambush Cannon',
    damage: 58, rof: 36, range: 5.5, warhead: 'ap', projectile: 'instant',
    antiGround: true, antiAir: false, sound: 'cannon',
  },
  {
    id: 'lance_beam', name: 'Lance Projector',
    damage: 72, rof: 46, range: 8, minRange: 1, warhead: 'beam', projectile: 'beam',
    antiGround: true, antiAir: false, sound: 'beam',
  },
  {
    id: 'kestrel_missiles', name: 'Talon Missiles',
    damage: 70, rof: 10, range: 3.5, warhead: 'he', projectile: 'missile',
    speed: 0.55, splash: 0.6, antiGround: true, antiAir: false, sound: 'missile',
  },

  // -------------------------------------------------- Concord navy weapons --
  {
    id: 'corvette_gun', name: '5in Naval Gun',
    damage: 36, rof: 25, range: 6, warhead: 'shell', projectile: 'shell',
    speed: 0.5, splash: 0.5, antiGround: true, antiAir: false, sound: 'cannon',
  },
  {
    id: 'cruiser_gun', name: 'Siege Battery',
    damage: 65, rof: 55, range: 11, minRange: 3, warhead: 'he', projectile: 'shell',
    speed: 0.35, splash: 1.2, antiGround: true, antiAir: false, sound: 'artillery',
  },

  // ----------------------------------------------- Concord base defenses ---
  {
    id: 'bunker_gun', name: 'Bunker MG',
    damage: 16, rof: 8, range: 5.5, warhead: 'sa', projectile: 'instant',
    antiGround: true, antiAir: false, sound: 'mg',
  },
  {
    id: 'sam_missile', name: 'Aegis SAM',
    damage: 55, rof: 20, range: 8.5, warhead: 'flakhead', projectile: 'missile',
    speed: 0.6, antiGround: false, antiAir: true, sound: 'missile',
  },
  {
    id: 'lance_tower_gun', name: 'Lance Emitter',
    damage: 90, rof: 40, range: 7.5, warhead: 'beam', projectile: 'beam',
    antiGround: true, antiAir: false, sound: 'beam',
  },

  // ---------------------------------------------------- Pact infantry arms --
  {
    id: 'militia_rifle', name: 'Cheap Carbine',
    damage: 10, rof: 15, range: 4, warhead: 'sa', projectile: 'instant',
    antiGround: true, antiAir: false, sound: 'rifle',
  },
  {
    id: 'arc_gauntlet', name: 'Arc Gauntlet',
    damage: 38, rof: 30, range: 3.5, warhead: 'arc', projectile: 'arc',
    antiGround: true, antiAir: false, sound: 'zap',
  },
  {
    id: 'flak_rifle', name: 'Flak Rifle',
    damage: 16, rof: 18, range: 5.5, warhead: 'flakhead', projectile: 'instant',
    antiGround: true, antiAir: true, sound: 'flak',
  },
  {
    id: 'demo_charge', name: 'Demolition Pack',
    damage: 260, rof: 1, range: 0.7, warhead: 'suicide', projectile: 'instant',
    splash: 1.8, antiGround: true, antiAir: false, sound: 'boom',
  },

  // -------------------------------------------------- Pact vehicle weapons --
  {
    id: 'viper_shredder', name: 'Shredder Claws',
    damage: 30, rof: 12, range: 0.9, warhead: 'ap', projectile: 'instant',
    antiGround: true, antiAir: false, sound: 'drill',
  },
  {
    id: 'bear_cannon', name: '120mm Cannon',
    damage: 55, rof: 35, range: 5, warhead: 'shell', projectile: 'shell',
    speed: 0.5, splash: 0.4, antiGround: true, antiAir: false, sound: 'cannon',
  },
  {
    id: 'behemoth_cannons', name: 'Twin 130mm Cannons',
    damage: 52, rof: 32, range: 5.5, warhead: 'shell', projectile: 'shell',
    speed: 0.5, burst: 2, splash: 0.4, antiGround: true, antiAir: false, sound: 'cannon',
  },
  {
    id: 'behemoth_aa', name: 'Guardian Flak',
    damage: 28, rof: 16, range: 6, warhead: 'flakhead', projectile: 'instant',
    antiGround: false, antiAir: true, sound: 'flak',
  },
  {
    id: 'hailstorm_rockets', name: 'Hailstorm Barrage',
    damage: 95, rof: 95, range: 10, minRange: 2, warhead: 'he', projectile: 'shell',
    speed: 0.28, splash: 1.5, antiGround: true, antiAir: false, sound: 'artillery',
  },
  {
    id: 'leviathan_bomb', name: 'Gravity Bombs',
    damage: 160, rof: 40, range: 1.6, warhead: 'bomb', projectile: 'bomb',
    speed: 0.25, splash: 1.2, antiGround: true, antiAir: false, sound: 'boom',
  },

  // ----------------------------------------------------- Pact navy weapons --
  {
    id: 'barracuda_flak', name: 'Naval Flak',
    damage: 26, rof: 18, range: 6, warhead: 'flakhead', projectile: 'instant',
    antiGround: true, antiAir: true, sound: 'flak',
  },
  {
    id: 'citadel_missiles', name: 'Fortress Missiles',
    damage: 105, rof: 100, range: 12, minRange: 3, warhead: 'he', projectile: 'shell',
    speed: 0.3, splash: 1.5, antiGround: true, antiAir: false, sound: 'artillery',
  },

  // ------------------------------------------------------ Pact defenses ----
  {
    id: 'picket_mg', name: 'Picket MG',
    damage: 18, rof: 8, range: 5.5, warhead: 'sa', projectile: 'instant',
    antiGround: true, antiAir: false, sound: 'mg',
  },
  {
    id: 'flak_battery_gun', name: 'Heavy Flak',
    damage: 48, rof: 18, range: 8.5, warhead: 'flakhead', projectile: 'instant',
    splash: 0.5, antiGround: false, antiAir: true, sound: 'flak',
  },
  {
    id: 'arc_tower_gun', name: 'Arc Discharger',
    damage: 95, rof: 35, range: 6, warhead: 'arc', projectile: 'arc',
    chain: 1, antiGround: true, antiAir: false, sound: 'zap',
  },
];

export const WEAPON_BY_ID: ReadonlyMap<string, WeaponDef> = new Map(
  WEAPONS.map((w) => [w.id, w]),
);

export function getWeapon(id: string): WeaponDef {
  const w = WEAPON_BY_ID.get(id);
  if (!w) throw new Error(`Unknown weapon: ${id}`);
  return w;
}
