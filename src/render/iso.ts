import { TILE_H, TILE_W } from '../core/constants';

/** World (tile-unit) coordinates -> isometric screen pixels. */
export function worldToScreenX(x: number, y: number): number {
  return (x - y) * (TILE_W / 2);
}

export function worldToScreenY(x: number, y: number): number {
  return (x + y) * (TILE_H / 2);
}

/** Screen pixels (world-anchored, before camera) -> world coordinates. */
export function screenToWorld(sx: number, sy: number): { x: number; y: number } {
  const a = sx / (TILE_W / 2);
  const b = sy / (TILE_H / 2);
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/** Scrolling camera over the isometric plane. */
export class Camera {
  /** Screen-space offset of the canvas center. */
  sx = 0;
  sy = 0;
  viewW = 1280;
  viewH = 800;

  centerOn(wx: number, wy: number): void {
    this.sx = worldToScreenX(wx, wy);
    this.sy = worldToScreenY(wx, wy);
  }

  pan(dx: number, dy: number): void {
    this.sx += dx;
    this.sy += dy;
  }

  /** Clamp panning to the map's screen-space bounding diamond (loose). */
  clampTo(mapW: number, mapH: number): void {
    const minX = worldToScreenX(0, mapH);
    const maxX = worldToScreenX(mapW, 0);
    const minY = worldToScreenY(0, 0);
    const maxY = worldToScreenY(mapW, mapH);
    if (this.sx < minX) this.sx = minX;
    if (this.sx > maxX) this.sx = maxX;
    if (this.sy < minY) this.sy = minY;
    if (this.sy > maxY) this.sy = maxY;
  }

  /** World -> canvas pixels. */
  toCanvasX(wx: number, wy: number): number {
    return worldToScreenX(wx, wy) - this.sx + this.viewW / 2;
  }

  toCanvasY(wx: number, wy: number): number {
    return worldToScreenY(wx, wy) - this.sy + this.viewH / 2;
  }

  /** Canvas pixels -> world coordinates. */
  canvasToWorld(cx: number, cy: number): { x: number; y: number } {
    return screenToWorld(cx + this.sx - this.viewW / 2, cy + this.sy - this.viewH / 2);
  }
}

/** Parse '#rrggbb' or 'rgb(r,g,b)' — shade() results must be re-shadeable. */
function parseColor(c: string): [number, number, number] {
  if (c.startsWith('#')) {
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  }
  const m = c.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (m) return [+m[1], +m[2], +m[3]];
  return [128, 128, 128];
}

/** Shade a color by a factor (>1 lighter, <1 darker). Composable. */
export function shade(color: string, f: number): string {
  const [r, g, b] = parseColor(color);
  return `rgb(${Math.min(255, Math.round(r * f))},${Math.min(255, Math.round(g * f))},${Math.min(255, Math.round(b * f))})`;
}

export function withAlpha(color: string, a: number): string {
  const [r, g, b] = parseColor(color);
  return `rgba(${r},${g},${b},${a})`;
}
