# Modding Guide

All game rules are plain typed data in `src/data/`. The engine interprets
whatever it finds there — most mods are a value edit and a hot reload
(`npm run dev` auto-refreshes).

## Where the numbers live

| File | Contents |
|---|---|
| `src/data/weapons.ts` | Every weapon: damage, rate of fire, range, warhead, projectile type, splash, AA/AG roles |
| `src/data/armor.ts` | The 13 warhead × 9 armor damage-multiplier matrix |
| `src/data/units.ts` | Unit stats, costs, build times, prerequisites, special flags |
| `src/data/buildings.ts` | Structures, power values, footprints, factory/tech roles |
| `src/data/powers.ts` | Superweapon charge times, radii, damage |
| `src/data/factions.ts` | Faction identity |
| `src/core/constants.ts` | Global knobs: tick rate, ore value, veterancy thresholds, refunds, low-power penalty… |
| `src/map/maps.ts` | The map catalog (size, seed, water/ore richness, player count) |

## Recipes

**Buff a unit** — edit its entry in `units.ts`:

```ts
{
  id: 'wolf', name: 'Wolf Tank',
  cost: 700,        // cheaper ⇒ swarmier
  hp: 320,          // tougher
  speed: 2.2,       // tiles per second
  weapons: ['wolf_cannon'],
  ...
}
```

**Add a new unit** — append a `UnitDef` (and a `WeaponDef` if it needs a new
gun). Set `faction`, `tab`, and `prerequisites` (building ids); the sidebar,
production system, AI availability checks and data validation tests pick it
up automatically. Give it art by extending the `switch` in
`src/render/sprites.ts` — or don't, and it renders with the default chassis.

**Rebalance the meta** — tweak `armor.ts`. Want rifles to threaten tanks?
Raise `sa.heavy`. Every number is a straight multiplier.

**Add a map** — append a `MapDef` to `maps.ts`:

```ts
{
  id: 'my_map', name: 'My Map', desc: '…',
  width: 120, height: 120,
  seed: 0xC0FFEE,      // any 32-bit int; same seed = same map forever
  maxPlayers: 4,
  water: 0.4,          // 0..1 water coverage
  ore: 0.8,            // 0..1 ore richness
}
```

**New superweapon** — add a `SupportPowerDef` in `powers.ts`, point a
building at it via `superweapon: '<id>'`, and handle its `kind` in
`src/sim/superweapons.ts` if it needs a new effect type.

**Global pacing** — `constants.ts`: `TICKS_PER_SEC`, `ORE_VALUE`,
`HARVESTER_CAPACITY`, `SELL_REFUND`, `VETERAN_KILL_RATIO`,
`LOW_POWER_BUILD_MULT`…

## Guardrails

Run `npm test` after any data change. `tests/data.test.ts` re-validates the
whole ruleset: no dangling weapon/prereq references, every unit reachable in
its faction's tech tree, every superweapon charged by a real building, sane
matrix values. If your mod breaks the tech tree, the suite says so in
milliseconds.

Balance-affecting engine constants live in one place on purpose; if you find
yourself editing `src/sim/*` to change a number, it probably belongs in
`src/data/` or `src/core/constants.ts` instead — PRs that move stray numbers
into data are welcome.
