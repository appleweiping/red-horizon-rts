# Architecture

Red Horizon is built as **two strictly separated halves**: a deterministic
simulation that *is* the game, and a presentation layer that merely watches it.

```
┌────────────────────────────────────────────────────────────────────┐
│  Presentation (browser only)                                       │
│  render/  renderer · procedural sprites · terrain · fx · minimap   │
│  ui/      sidebar HUD · input · selection · menus · messages       │
│  audio/   WebAudio synth · speech announcer                        │
└──────────────▲──────────────────────────────┬──────────────────────┘
               │ reads state / SimEvents      │ issues Commands
┌──────────────┴──────────────────────────────▼──────────────────────┐
│  Simulation (runs anywhere, incl. Node for tests)                  │
│  sim/   world · movement · combat · economy · production · power   │
│         pathfinder (A*) · fog · superweapons · victory · commands  │
│  ai/    skirmish AI (issues the same Commands a human does)        │
│  map/   seeded generator · terrain queries                         │
│  data/  the "rules": units · buildings · weapons · armor matrix    │
│  core/  types · constants · math · seeded RNG · event queue        │
└────────────────────────────────────────────────────────────────────┘
```

## The deterministic core

* **Fixed timestep.** The world advances in 50 ms ticks (20 tps). The render
  loop accumulates real time, steps the sim when a full tick is owed, and
  interpolates unit positions between the previous and current tick for
  smooth 60+ fps visuals.
* **One RNG.** All simulation randomness flows through a single seeded
  mulberry32 instance (`core/rng.ts`). Map generation uses the map seed;
  battle randomness uses `seed ^ 0xa5a5a5a5`.
* **Commands in, events out.** Every intent — human clicks, AI decisions —
  enters as a `Command` through `World.issue()` and is applied at the top of
  the next tick. The sim never reads the DOM, the clock, or `Math.random`.
  Consequences surface as `SimEvent`s that the UI drains once per tick.
* **Why:** the same seed and the same command stream replay the same battle,
  bit for bit. The test suite asserts this (`tests/determinism.test.ts`),
  including full AI-vs-AI matches. This is the foundation lockstep
  multiplayer would build on.

Entity ids are allocated **per world** so that two simultaneously alive
worlds (menus, tests, future replays) can never contaminate each other.

## Data-driven rules

Everything balance-related lives in `src/data/` as typed plain objects:
weapons, warheads, the 13×9 warhead-vs-armor damage matrix, unit and building
stats, prerequisites and superweapons. The engine interprets; the data
decides. `validateData()` (exercised by tests) proves every weapon reference,
prerequisite chain and superweapon link resolves, and that every unit is
actually reachable in each faction's tech tree.

## Subsystem notes

| Subsystem | File(s) | Approach |
|---|---|---|
| Pathfinding | `sim/pathfinder.ts` | 8-way A* over tiles, terrain costs, building occupancy, no diagonal corner-cutting, LOS string-pulling; capped expansions with closest-approach fallback so units never freeze |
| Local avoidance | `sim/movement.ts` | soft separation forces between ground units + stuck detection with re-path |
| Fog of war | `sim/fog.ts` | per-player `Uint8Array` (shroud / explored / visible), precomputed sight circles, staggered updates every 4 ticks |
| Combat | `sim/combat.ts` | target acquisition via spatial hash, per-weapon cooldowns/domains, projectiles (hitscan, ballistic, homing, chain-arc, beam, bomb), splash with linear falloff, veterancy |
| Economy | `sim/economy.ts` | harvester state machine (seek → mine → haul → unload), ore/gem tiles deplete back to grass, oil derrick trickle |
| Production | `sim/production.ts` | parallel tabs, pay-as-you-go financing, multi-factory speedup, low-power slowdown, ready-to-place structures |
| Superweapons | `sim/superweapons.ts` | charge banks tied to living structures, storm / nuke strikes scheduled over future ticks, phase-jump teleport, aegis shield |
| AI | `ai/ai.ts` | priority-ladder base building, spiral placement probes, economy targets, threat response, wave attacks, power usage; difficulty tunes tempo and size (hard gets a small documented income trickle) |

## Rendering without assets

There are no image or audio files in the repository — everything is
synthesized at runtime:

* **Units** are drawn as vector shapes in a "top-down space" that is squashed
  onto the isometric plane (`scale(1, 0.5)` + rotate). One drawing per
  chassis; smooth 360° facings and independent turret rotation come free.
* **Buildings** are prerendered once per (type, player color) into offscreen
  canvases as stacks of isometric boxes with per-type detailing (refinery
  silo, radar dish, silo doors, crane…), then blitted every frame.
* **Terrain** renders visible tiles only, with per-tile hash variation,
  animated water, ore/gem nuggets and procedural trees.
* **Audio** cues are tiny oscillator + filtered-noise recipes (`audio/audio.ts`);
  the battlefield announcer is the browser's SpeechSynthesis voice.

The renderer depth-sorts drawables by `x + y` (painter's algorithm), draws
fog above entities, then effects above fog so explosions glow through.

## Background execution

`requestAnimationFrame` freezes in hidden tabs and page timers get throttled
to one wake per minute. A tiny inline **Web Worker** (exempt from visibility
throttling) keeps posting tick messages, so the simulation keeps running —
rendering simply pauses. This also makes headless/E2E automation possible.

## Testing strategy

`tests/` covers the sim from below (unit: RNG, matrix, pathfinder) and from
above (integration: full worlds run thousands of ticks — harvesting economy,
production chains, superweapon strikes, victory sweeps, ten-minute AI-vs-AI
stability, and byte-identical determinism replays). The suite runs in Node —
no browser needed — precisely because the sim half never touches the DOM.
