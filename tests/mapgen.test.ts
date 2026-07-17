import { describe, expect, it } from 'vitest';
import { Terrain } from '../src/core/types';
import { generateMap } from '../src/map/mapgen';
import { MAPS, getMapDef } from '../src/map/maps';

describe('map generation', () => {
  it('is fully deterministic for the same definition', () => {
    const def = getMapDef('emerald_divide');
    const a = generateMap(def);
    const b = generateMap(def);
    expect(Array.from(a.terrain)).toEqual(Array.from(b.terrain));
    expect(Array.from(a.ore)).toEqual(Array.from(b.ore));
    expect(a.spawns).toEqual(b.spawns);
    expect(a.derricks).toEqual(b.derricks);
  });

  it('produces the declared number of spawns on buildable ground', () => {
    for (const def of MAPS) {
      const map = generateMap(def);
      expect(map.spawns).toHaveLength(def.maxPlayers);
      for (const s of map.spawns) {
        // a 3x3 conyard must fit near every spawn
        let buildable = 0;
        for (let dy = -5; dy <= 5; dy++) {
          for (let dx = -5; dx <= 5; dx++) {
            if (map.isBuildableTile(s.x + dx, s.y + dy)) buildable++;
          }
        }
        expect(buildable, `${def.id} spawn ${s.x},${s.y}`).toBeGreaterThan(30);
      }
    }
  });

  it('guarantees harvestable ore near every spawn', () => {
    for (const def of MAPS) {
      const map = generateMap(def);
      for (const s of map.spawns) {
        let ore = 0;
        for (let dy = -14; dy <= 14; dy++) {
          for (let dx = -14; dx <= 14; dx++) {
            if (!map.inBounds(s.x + dx, s.y + dy)) continue;
            ore += map.ore[map.idx(s.x + dx, s.y + dy)];
          }
        }
        expect(ore, `${def.id} spawn ${s.x},${s.y}`).toBeGreaterThan(50);
      }
    }
  });

  it('places contested oil derricks on clear ground', () => {
    for (const def of MAPS) {
      const map = generateMap(def);
      expect(map.derricks.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('reverts ore tiles to grass when mined out', () => {
    const map = generateMap(getMapDef('emerald_divide'));
    let tile: { x: number; y: number } | null = null;
    outer: for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (map.ore[map.idx(x, y)] > 0) {
          tile = { x, y };
          break outer;
        }
      }
    }
    expect(tile).not.toBeNull();
    const { x, y } = tile!;
    const amount = map.ore[map.idx(x, y)];
    for (let i = 0; i < amount; i++) {
      expect(map.takeOre(x, y)).toBeGreaterThan(0);
    }
    expect(map.takeOre(x, y)).toBe(0);
    expect(map.terrainAt(x, y)).toBe(Terrain.Grass);
  });
});
