# Gameplay Manual

## The loop

1. **Deploy.** Every commander starts with a Pioneer Crawler. Select it
   and press `D` (or click Deploy) — it unfolds into your Construction Yard,
   the building that builds buildings. Lose every structure *and* every Pioneer Crawler
   and you are eliminated.
2. **Economy.** Build a power plant, then an Ore Refinery. The refinery
   arrives with a free harvester that automatically mines the nearest ore
   and hauls it home. Gold nuggets are ore (25/bail); teal crystals are gems
   (50/bail). Fields visibly deplete — expand before they run dry.
3. **Power.** Every structure consumes or produces power. If consumption
   exceeds production: production slows to 40%, powered defenses go dark,
   the radar minimap dies, and superweapons stop charging.
4. **Tech.** Barracks and War Factory open tier 1. A Radar Dome unlocks
   tier-2 units and the minimap. The Research Lab unlocks tier 3 and
   superweapon structures.
5. **War.** Scout, take the neutral oil derricks with engineers, harass the
   enemy's harvesters, and counter what your opponent builds.

## Damage & counters

Damage = weapon damage × matrix[warhead][armor] × veterancy modifiers.
The matrix is the whole metagame:

| | Infantry | Light veh. | Heavy veh. | Structures |
|---|---|---|---|---|
| **Small arms** (rifles, MGs) | ★★★ | ★★ | ★ | ★ |
| **AP** (Thicket, Viper) | ★ | ★★★ | ★★★ | ★★ |
| **Shells** (tank cannons) | ★★ | ★★★ | ★★★ | ★★ |
| **HE** (artillery, rockets) | ★★★ | ★★ | ★★ | ★★★★ |
| **Flak** (all AA) | ★★★ *(air)* | ★ | ★ | ★ |
| **Arc / Beam** (tier-2 energy) | ★★★ | ★★★ | ★★★ | ★★ |

Aircraft can only be hurt by anti-air weapons. Ships bombard the shore from
outside most defenses' reach. Heavy tanks crush infantry — micro your
riflemen out of the treads.

## Veterancy

Kills are banked by credit value. At 2× a unit's own cost it becomes a
**Veteran** (+25% damage, −20% damage taken). At 5× it goes **Elite**
(+60% damage, −35% damage taken, self-heals). Chevrons above the health bar.

## Superweapons

Each superweapon structure charges on its own bank (paused while low power;
destroyed structure = charge lost). Everyone on the map is warned when one
is ready and when it fires.

| Power | Faction | Charge | Effect |
|---|---|---|---|
| Tempest Strike | Concord | 8 min | ~14 lightning bolts saturate the target area; the first always hits dead center |
| Phase Gate | Concord | 5 min | Teleports your currently selected units to the target point |
| ICBM Launch | Pact | 10 min | Single warhead, enormous splash; 5-second flight warning |
| Aegis Field | Pact | 5 min | Friendly units in the area become invulnerable for 8 s |

## Special mechanics

- **Thicket Tank** looks exactly like a map tree to your enemy while it sits
  still. Park a few in a forest along the harvester road.
- **Guardsmen** press `D` to brace: +1.5 range, heavier rifle, but rooted.
- **Demolishers** are a guided missile with legs — great vs. clumped armor,
  tragic near your own troops.
- **Engineers** enter enemy or neutral structures and flip ownership
  (consumed on use). Oil derricks pay 10 credits/second forever.
- **Kestrels** fly two-missile sorties and return to the airfield to rearm.
- **Repair** (🔧) drains credits to restore a structure; **Sell** ($) refunds
  half of remaining value.
- **Rally points:** select a factory, right-click the map.

## Skirmish setup

Six maps (2–4 players), three AI difficulties, adjustable starting funds,
superweapons toggle, and 0.5×–3× game speed (change it mid-match from the
sidebar). Difficulty changes AI tempo, army size and defense depth; *hard*
additionally gets a small income trickle (+2 credits/tick) — documented
here, no hidden cheats.

## Reading the battlefield

- Health bars: green → yellow → red; buildings smoke below 50%.
- The minimap needs a powered Radar Dome — protect it, kill theirs.
- The fog remembers structures you've seen (dimmed), never units.
- The announcer calls out what matters: construction, low power, attacks, superweapons.
