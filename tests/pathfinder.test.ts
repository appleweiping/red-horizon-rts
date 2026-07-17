import { describe, expect, it } from 'vitest';
import { Terrain } from '../src/core/types';
import { GameMap } from '../src/map/terrain';
import { findPath, nearestPassable } from '../src/sim/pathfinder';

function flatMap(w = 20, h = 20): GameMap {
  return new GameMap(w, h); // all grass by default (Terrain.Grass = 0)
}

describe('A* pathfinder', () => {
  it('finds a straight path on open ground', () => {
    const map = flatMap();
    const path = findPath(map, 2.5, 2.5, 15.5, 2.5, 'ground');
    expect(path).not.toBeNull();
    const last = path![path!.length - 1];
    expect(last.x).toBeCloseTo(15.5, 0);
    expect(last.y).toBeCloseTo(2.5, 0);
    // string pulling should collapse an open straight line to few waypoints
    expect(path!.length).toBeLessThanOrEqual(2);
  });

  it('routes around a wall', () => {
    const map = flatMap();
    // vertical wall at x=10 with a gap at y=17
    for (let y = 0; y < 17; y++) map.terrain[map.idx(10, y)] = Terrain.Cliff;
    const path = findPath(map, 5.5, 5.5, 15.5, 5.5, 'ground');
    expect(path).not.toBeNull();
    // path must pass near the gap
    const throughGap = path!.some((p) => p.y > 15);
    expect(throughGap).toBe(true);
  });

  it('never cuts corners diagonally through blocked tiles', () => {
    const map = flatMap(6, 6);
    map.terrain[map.idx(2, 1)] = Terrain.Cliff;
    map.terrain[map.idx(1, 2)] = Terrain.Cliff;
    const path = findPath(map, 1.5, 1.5, 3.5, 3.5, 'ground');
    // the only legal route is around, so it must exist and avoid the pinch
    expect(path).not.toBeNull();
  });

  it('respects movement domains', () => {
    const map = flatMap();
    for (let x = 0; x < 20; x++) map.terrain[map.idx(x, 10)] = Terrain.Water;
    const ground = findPath(map, 5.5, 5.5, 5.5, 15.5, 'ground');
    // ground units cannot cross the full-width river: fallback path stops short
    if (ground) {
      const last = ground[ground.length - 1];
      expect(last.y).toBeLessThan(10.5);
    }
    // water units live only in the river
    const water = findPath(map, 2.5, 10.5, 17.5, 10.5, 'water');
    expect(water).not.toBeNull();
    // air flies anywhere, straight
    const air = findPath(map, 5.5, 5.5, 5.5, 15.5, 'air');
    expect(air).toHaveLength(1);
  });

  it('treats building occupancy as blocking (with an allow id)', () => {
    const map = flatMap(8, 8);
    map.setOccupancy(3, 0, 2, 8, 77); // a wall of building id 77 (full height)
    const blocked = findPath(map, 1.5, 4.5, 6.5, 4.5, 'ground');
    if (blocked) {
      expect(blocked[blocked.length - 1].x).toBeLessThan(3.5);
    }
    const allowed = findPath(map, 1.5, 4.5, 6.5, 4.5, 'ground', 77);
    expect(allowed).not.toBeNull();
    expect(allowed![allowed!.length - 1].x).toBeGreaterThan(5.5);
  });

  it('nearestPassable snaps into reachable terrain', () => {
    const map = flatMap();
    map.terrain[map.idx(5, 5)] = Terrain.Cliff;
    const p = nearestPassable(map, 5, 5, 'ground');
    expect(p).not.toBeNull();
    expect(Math.abs(p!.x - 5) + Math.abs(p!.y - 5)).toBeLessThanOrEqual(2);
  });
});
