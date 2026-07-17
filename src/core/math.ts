/** Deterministic math helpers used by the simulation. */

export interface Vec2 {
  x: number;
  y: number;
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Shortest signed angular difference a→b in radians (-PI..PI]. */
export function angleDiff(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Rotate `facing` toward `target` by at most `maxStep` radians. */
export function turnToward(facing: number, target: number, maxStep: number): number {
  const d = angleDiff(facing, target);
  if (Math.abs(d) <= maxStep) return target;
  return facing + Math.sign(d) * maxStep;
}

/** Map an angle to one of 8 sprite facings (0 = east, counter-clockwise on grid). */
export function facing8(angle: number): number {
  const seg = Math.round(angle / (Math.PI / 4));
  return ((seg % 8) + 8) % 8;
}

/** Deterministic integer hash (for jitter without consuming RNG state). */
export function hash2(x: number, y: number): number {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263;
  h = (h ^ (h >>> 13)) * 1274126177;
  return (h ^ (h >>> 16)) >>> 0;
}
