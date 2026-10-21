import { killEntity } from './combat';
import type { World } from './world';

/**
 * Classic elimination: a player is out when they hold no structures and no
 * construction vehicle (nothing left to rebuild from). Their remaining
 * forces power down and are removed. The match ends when everyone still
 * standing is on the same side.
 */
export function checkVictory(world: World): void {
  if (world.gameOver) return;

  for (const p of world.players) {
    if (p.defeated) continue;
    let hasBuilding = false;
    let hasCrawler = false;
    for (const b of world.buildings.values()) {
      if (!b.dead && b.player === p.id) {
        hasBuilding = true;
        break;
      }
    }
    if (!hasBuilding) {
      for (const u of world.units.values()) {
        if (!u.dead && u.player === p.id && u.def.deployable === 'base') {
          hasCrawler = true;
          break;
        }
      }
    }
    if (!hasBuilding && !hasCrawler) {
      p.defeated = true;
      world.events.emit({ kind: 'playerDefeated', player: p.id });
      for (const u of world.units.values()) {
        if (!u.dead && u.player === p.id) killEntity(world, u, -1, 0);
      }
    }
  }

  const alive = world.players.filter((p) => !p.defeated);
  if (alive.length === 0) {
    world.gameOver = true;
    world.events.emit({ kind: 'gameOver', winners: [] });
    return;
  }
  const firstTeam = alive[0].config.team ?? 0;
  const sameSide =
    alive.length === 1 ||
    (firstTeam > 0 && alive.every((p) => (p.config.team ?? 0) === firstTeam));
  if (sameSide) {
    world.gameOver = true;
    world.events.emit({ kind: 'gameOver', winners: alive.map((p) => p.id) });
  }
}
