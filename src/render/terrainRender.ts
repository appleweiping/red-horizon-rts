import { Terrain } from '../core/types';
import { FOG_EXPLORED, FOG_SHROUD, TILE_H, TILE_W } from '../core/constants';
import { hash2 } from '../core/math';
import type { GameMap } from '../map/terrain';
import type { PlayerState } from '../sim/player';
import type { Camera } from './iso';

const HW = TILE_W / 2;
const HH = TILE_H / 2;

/** Base palette per terrain type; per-tile hash variation keeps it organic. */
function tileColor(t: Terrain, tx: number, ty: number, time: number): string {
  const h = hash2(tx, ty) % 100;
  switch (t) {
    case Terrain.Grass: {
      const g = 96 + (h % 14);
      return `rgb(${52 + (h % 8)},${g},${44 + (h % 10)})`;
    }
    case Terrain.Road:
      return `rgb(${116 + (h % 8)},${104 + (h % 8)},${88 + (h % 6)})`;
    case Terrain.Bridge:
      return `rgb(${134 + (h % 6)},${108 + (h % 6)},${72})`;
    case Terrain.Water: {
      const w = Math.sin(time * 0.0012 + (tx + ty) * 0.7) * 8;
      return `rgb(${30},${72 + (h % 8) + w},${118 + (h % 10) + w})`;
    }
    case Terrain.Shore:
      return `rgb(${168 + (h % 10)},${156 + (h % 8)},${108})`;
    case Terrain.Cliff:
      return `rgb(${92 + (h % 10)},${82 + (h % 8)},${74})`;
    case Terrain.OreBearing:
      return `rgb(${70 + (h % 8)},${92 + (h % 10)},${46})`;
    case Terrain.Trees:
      return `rgb(${40 + (h % 6)},${78 + (h % 10)},${38})`;
  }
}

function diamond(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - HH);
  ctx.lineTo(cx + HW, cy);
  ctx.lineTo(cx, cy + HH);
  ctx.lineTo(cx - HW, cy);
  ctx.closePath();
}

/** Draw all terrain tiles intersecting the viewport (painter order safe: flat). */
export function drawTerrain(
  ctx: CanvasRenderingContext2D, map: GameMap, cam: Camera, time: number,
): void {
  const corners = [
    cam.canvasToWorld(0, 0),
    cam.canvasToWorld(cam.viewW, 0),
    cam.canvasToWorld(0, cam.viewH),
    cam.canvasToWorld(cam.viewW, cam.viewH),
  ];
  const x0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c.x))) - 1);
  const x1 = Math.min(map.width - 1, Math.ceil(Math.max(...corners.map((c) => c.x))) + 1);
  const y0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c.y))) - 1);
  const y1 = Math.min(map.height - 1, Math.ceil(Math.max(...corners.map((c) => c.y))) + 1);

  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const t = map.terrain[map.idx(tx, ty)] as Terrain;
      const cx = cam.toCanvasX(tx + 0.5, ty + 0.5);
      const cy = cam.toCanvasY(tx + 0.5, ty + 0.5);
      if (cx < -TILE_W || cx > cam.viewW + TILE_W || cy < -TILE_H * 2 || cy > cam.viewH + TILE_H * 2) {
        continue;
      }
      diamond(ctx, cx, cy);
      ctx.fillStyle = tileColor(t, tx, ty, time);
      ctx.fill();

      // decorations
      if (t === Terrain.OreBearing) {
        const kind = map.oreKind[map.idx(tx, ty)];
        const n = Math.min(5, 1 + (map.ore[map.idx(tx, ty)] >> 2));
        ctx.fillStyle = kind === 2 ? '#5fe3d0' : '#e3b64f';
        for (let i = 0; i < n; i++) {
          const hx = ((hash2(tx * 7 + i, ty * 13 + i) % 100) / 100 - 0.5) * (TILE_W * 0.5);
          const hy = ((hash2(tx * 3 + i * 5, ty * 11 + i) % 100) / 100 - 0.5) * (TILE_H * 0.5);
          ctx.beginPath();
          ctx.ellipse(cx + hx, cy + hy, 3.2, 2.1, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (t === Terrain.Trees) {
        drawTree(ctx, cx, cy, hash2(tx, ty));
      } else if (t === Terrain.Cliff) {
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.beginPath();
        ctx.moveTo(cx - HW * 0.6, cy - 2);
        ctx.lineTo(cx + HW * 0.4, cy - HH * 0.5);
        ctx.stroke();
      } else if (t === Terrain.Bridge) {
        ctx.strokeStyle = 'rgba(60,42,20,0.55)';
        ctx.beginPath();
        ctx.moveTo(cx - HW * 0.8, cy);
        ctx.lineTo(cx + HW * 0.8, cy);
        ctx.stroke();
      }
    }
  }
}

/** A tree: also used to disguise thicket tanks, so keep it distinctive-free. */
export function drawTree(ctx: CanvasRenderingContext2D, cx: number, cy: number, seed: number): void {
  const s = 0.85 + (seed % 30) / 100;
  ctx.fillStyle = '#54381e';
  ctx.fillRect(cx - 1.5, cy - 8 * s, 3, 8 * s);
  ctx.fillStyle = `rgb(${30 + (seed % 12)},${88 + (seed % 20)},${34})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy - 13 * s, 8 * s, 10 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.beginPath();
  ctx.ellipse(cx - 2 * s, cy - 16 * s, 4 * s, 4.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Fog overlay pass: explored tiles dim, unexplored tiles solid black. */
export function drawFog(
  ctx: CanvasRenderingContext2D, map: GameMap, cam: Camera, player: PlayerState,
): void {
  const corners = [
    cam.canvasToWorld(0, 0),
    cam.canvasToWorld(cam.viewW, 0),
    cam.canvasToWorld(0, cam.viewH),
    cam.canvasToWorld(cam.viewW, cam.viewH),
  ];
  const x0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c.x))) - 1);
  const x1 = Math.min(map.width - 1, Math.ceil(Math.max(...corners.map((c) => c.x))) + 1);
  const y0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c.y))) - 1);
  const y1 = Math.min(map.height - 1, Math.ceil(Math.max(...corners.map((c) => c.y))) + 1);

  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const f = player.fog[ty * map.width + tx];
      if (f !== FOG_SHROUD && f !== FOG_EXPLORED) continue;
      const cx = cam.toCanvasX(tx + 0.5, ty + 0.5);
      const cy = cam.toCanvasY(tx + 0.5, ty + 0.5);
      diamond(ctx, cx, cy);
      ctx.fillStyle = f === FOG_SHROUD ? 'rgb(6,8,10)' : 'rgba(6,8,10,0.45)';
      ctx.fill();
    }
  }
}
