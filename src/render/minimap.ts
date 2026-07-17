import { Terrain } from '../core/types';
import { FOG_SHROUD, FOG_VISIBLE } from '../core/constants';
import type { World } from '../sim/world';
import type { Camera } from './iso';

/**
 * Minimap: 1 tile = 1 px on a backing canvas, scaled into the sidebar.
 * Without a powered radar the map shows static noise, RA2-style discipline:
 * information is a building you can lose.
 */
export class Minimap {
  readonly canvas: HTMLCanvasElement;
  private back: HTMLCanvasElement;
  private lastRedraw = 0;

  constructor(private world: World, private playerId: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 184;
    this.canvas.height = 184;
    this.canvas.className = 'minimap';
    this.back = document.createElement('canvas');
    this.back.width = world.map.width;
    this.back.height = world.map.height;
  }

  /** Convert a click on the minimap to world coordinates. */
  toWorld(px: number, py: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((px - rect.left) / rect.width) * this.world.map.width;
    const y = ((py - rect.top) / rect.height) * this.world.map.height;
    return { x, y };
  }

  draw(cam: Camera, time: number): void {
    const w = this.world;
    const player = w.players[this.playerId];
    const ctx2 = this.canvas.getContext('2d')!;

    if (!player.radarActive) {
      // radar offline: noise
      ctx2.fillStyle = '#0a0d10';
      ctx2.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx2.fillStyle = 'rgba(90,110,120,0.25)';
      for (let i = 0; i < 90; i++) {
        ctx2.fillRect(
          Math.random() * this.canvas.width,
          Math.random() * this.canvas.height,
          2, 2,
        );
      }
      ctx2.fillStyle = '#4a5a66';
      ctx2.font = '11px monospace';
      ctx2.textAlign = 'center';
      ctx2.fillText('RADAR OFFLINE', this.canvas.width / 2, this.canvas.height / 2);
      return;
    }

    if (time - this.lastRedraw > 160) {
      this.lastRedraw = time;
      const b = this.back.getContext('2d')!;
      const img = b.createImageData(w.map.width, w.map.height);
      const d = img.data;
      for (let i = 0; i < w.map.width * w.map.height; i++) {
        const f = player.fog[i];
        let r = 8;
        let g = 10;
        let bl = 12;
        if (f !== FOG_SHROUD) {
          const t = w.map.terrain[i] as Terrain;
          switch (t) {
            case Terrain.Water: r = 26; g = 62; bl = 105; break;
            case Terrain.Shore: r = 150; g = 140; bl = 96; break;
            case Terrain.Road:
            case Terrain.Bridge: r = 110; g = 100; bl = 84; break;
            case Terrain.Cliff: r = 84; g = 76; bl = 68; break;
            case Terrain.OreBearing:
              if (w.map.oreKind[i] === 2) { r = 60; g = 190; bl = 170; }
              else { r = 190; g = 152; bl = 60; }
              break;
            case Terrain.Trees: r = 30; g = 66; bl = 28; break;
            default: r = 42; g = 82; bl = 38;
          }
          if (f !== FOG_VISIBLE) {
            r = (r * 0.55) | 0;
            g = (g * 0.55) | 0;
            bl = (bl * 0.55) | 0;
          }
        }
        d[i * 4] = r;
        d[i * 4 + 1] = g;
        d[i * 4 + 2] = bl;
        d[i * 4 + 3] = 255;
      }
      b.putImageData(img, 0, 0);
    }

    ctx2.imageSmoothingEnabled = false;
    ctx2.drawImage(this.back, 0, 0, this.canvas.width, this.canvas.height);

    // entities
    const sx = this.canvas.width / w.map.width;
    const sy = this.canvas.height / w.map.height;
    for (const b of w.buildings.values()) {
      if (b.dead) continue;
      const i = Math.floor(b.cy) * w.map.width + Math.floor(b.cx);
      if (player.fog[i] === FOG_SHROUD) continue;
      ctx2.fillStyle = b.player < 0 ? '#cfcf9a' : w.players[b.player].config.color;
      ctx2.fillRect(b.tx * sx, b.ty * sy, Math.max(2, b.def.w * sx), Math.max(2, b.def.h * sy));
    }
    for (const u of w.units.values()) {
      if (u.dead) continue;
      const i = Math.floor(u.y) * w.map.width + Math.floor(u.x);
      const owner = w.players[u.player];
      if (player.fog[i] !== FOG_VISIBLE && !player.isAlliedWith(owner)) continue;
      ctx2.fillStyle = owner.config.color;
      ctx2.fillRect(u.x * sx - 1, u.y * sy - 1, 2.4, 2.4);
    }

    // camera view diamond
    ctx2.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx2.lineWidth = 1;
    const c = [
      cam.canvasToWorld(0, 0),
      cam.canvasToWorld(cam.viewW, 0),
      cam.canvasToWorld(cam.viewW, cam.viewH),
      cam.canvasToWorld(0, cam.viewH),
    ];
    ctx2.beginPath();
    ctx2.moveTo(c[0].x * sx, c[0].y * sy);
    for (let i = 1; i < 4; i++) ctx2.lineTo(c[i].x * sx, c[i].y * sy);
    ctx2.closePath();
    ctx2.stroke();
  }
}
