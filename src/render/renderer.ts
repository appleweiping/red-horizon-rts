import { lerp } from '../core/math';
import type { BuildingDef } from '../core/types';
import type { Building, Unit } from '../sim/entity';
import { isVisibleTo, isExploredBy } from '../sim/fog';
import type { World } from '../sim/world';
import { Camera, withAlpha } from './iso';
import { Effects } from './effects';
import { drawFog, drawTerrain, drawTree } from './terrainRender';
import { drawBuildingRising, drawUnit, getBuildingSprite } from './sprites';
import { hash2 } from '../core/math';

export interface PlacementGhost {
  def: BuildingDef;
  tx: number;
  ty: number;
}

/** Draws the world every animation frame; reads sim state, never mutates it. */
export class Renderer {
  readonly cam = new Camera();
  readonly effects = new Effects();
  /** Current building placement preview (set by input). */
  ghost: PlacementGhost | null = null;
  /** Superweapon target ring radius (world tiles) while targeting. */
  targetRing = 0;
  mouseWorld = { x: 0, y: 0 };

  constructor(
    private canvas: HTMLCanvasElement,
    private world: World,
    private humanId: number,
    private selection: () => ReadonlySet<number>,
  ) {
    this.resize();
  }

  resize(): void {
    const sidebar = 200;
    this.canvas.width = Math.max(320, window.innerWidth - sidebar);
    this.canvas.height = window.innerHeight;
    this.cam.viewW = this.canvas.width;
    this.cam.viewH = this.canvas.height;
  }

  /** alpha: 0..1 interpolation between previous and current sim tick. */
  render(time: number, alpha: number): void {
    const ctx = this.canvas.getContext('2d')!;
    const w = this.world;
    const human = w.players[this.humanId];
    this.cam.clampTo(w.map.width, w.map.height);

    ctx.fillStyle = '#06080a';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    drawTerrain(ctx, w.map, this.cam, time);

    // rally lines for selected factories
    for (const id of this.selection()) {
      const b = w.buildings.get(id);
      if (!b || b.dead || !b.def.factory) continue;
      ctx.strokeStyle = 'rgba(120,255,140,0.5)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(this.cam.toCanvasX(b.cx, b.cy), this.cam.toCanvasY(b.cx, b.cy));
      ctx.lineTo(this.cam.toCanvasX(b.rally.x, b.rally.y), this.cam.toCanvasY(b.rally.x, b.rally.y));
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // --------------------------- entities, painter-sorted -------------------
    interface Drawable {
      depth: number;
      draw: () => void;
    }
    const drawables: Drawable[] = [];

    for (const b of w.buildings.values()) {
      if (b.dead) continue;
      if (!isExploredBy(human, w.map, b.cx, b.cy)) continue;
      const color = b.player < 0 ? '#b8b890' : w.players[b.player].config.color;
      const sprite = getBuildingSprite(b.def, color);
      const sx = this.cam.toCanvasX(b.tx, b.ty);
      const sy = this.cam.toCanvasY(b.tx, b.ty);
      if (sx < -400 || sx > this.cam.viewW + 400 || sy < -400 || sy > this.cam.viewH + 400) continue;
      const visibleNow = isVisibleTo(human, w.map, b.cx, b.cy) || b.player === this.humanId;
      drawables.push({
        depth: b.cx + b.cy + Math.max(b.def.w, b.def.h) * 0.5,
        draw: () => {
          ctx.globalAlpha = visibleNow ? 1 : 0.55;
          if (b.constructTicks > 0) {
            drawBuildingRising(ctx, b, sx, sy, sprite, 1 - b.constructTicks / 40);
          } else {
            ctx.drawImage(sprite.canvas, sx - sprite.ox, sy - sprite.oy);
          }
          ctx.globalAlpha = 1;
          // damage smoke
          if (b.hp < b.def.hp * 0.5 && visibleNow) {
            this.effects.smoke(
              b.tx + 0.3 + ((hash2(b.id, 7) % 100) / 100) * b.def.w * 0.6,
              b.ty + 0.3 + ((hash2(b.id, 13) % 100) / 100) * b.def.h * 0.6,
              24,
            );
          }
          if (this.selection().has(b.id)) this.drawBuildingSelection(ctx, b);
          if (b.repairing) this.drawRepairWrench(ctx, b, time);
        },
      });
    }

    for (const u of w.units.values()) {
      if (u.dead) continue;
      const ux = lerp(u.px, u.x, alpha);
      const uy = lerp(u.py, u.y, alpha);
      const owner = w.players[u.player];
      const isOwn = human.isAlliedWith(owner);
      if (!isOwn && !isVisibleTo(human, w.map, ux, uy)) continue;
      const cx = this.cam.toCanvasX(ux, uy);
      const cy = this.cam.toCanvasY(ux, uy);
      if (cx < -80 || cx > this.cam.viewW + 80 || cy < -120 || cy > this.cam.viewH + 120) continue;
      drawables.push({
        depth: ux + uy + (u.def.domain === 'air' ? 90 : 0),
        draw: () => {
          // phantom disguise: enemies see a tree
          if (u.disguised && !isOwn) {
            drawTree(ctx, cx, cy, hash2(u.id, 31));
            return;
          }
          if (u.disguised && isOwn) ctx.globalAlpha = 0.6;
          drawUnit(ctx, u, cx, cy, owner.config.color, time);
          ctx.globalAlpha = 1;
          if (u.aegisUntil > w.tick) {
            ctx.strokeStyle = withAlpha('#b98fd6', 0.5 + 0.3 * Math.sin(time * 0.01));
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(cx, cy - 8, 16, 11, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
          if (this.selection().has(u.id)) this.drawUnitSelection(ctx, u, cx, cy);
          if (this.selection().has(u.id) || u.hp < u.def.hp) {
            this.drawHealthBar(ctx, cx, cy - (u.def.domain === 'air' ? 52 : 26), u.hp / u.def.hp, 20);
          }
          if (u.rank > 0) this.drawRank(ctx, cx, cy - (u.def.domain === 'air' ? 46 : 20), u.rank);
          if (u.hp < u.def.hp * 0.4) this.effects.smoke(ux, uy, 10);
        },
      });
    }

    // projectiles
    for (const p of w.projectiles) {
      if (p.dead) continue;
      if (!isVisibleTo(human, w.map, p.x, p.y)) continue;
      const arcH = p.weapon.projectile === 'shell'
        ? Math.sin(Math.PI * Math.min(1, p.t)) * Math.min(60, p.totalDist * 7)
        : p.weapon.projectile === 'bomb'
          ? (1 - p.t) * 34
          : 6;
      const cx = this.cam.toCanvasX(p.x, p.y);
      const cy = this.cam.toCanvasY(p.x, p.y) - 8 - arcH;
      drawables.push({
        depth: p.x + p.y + 50,
        draw: () => {
          ctx.fillStyle = p.weapon.projectile === 'missile' ? '#ffd9a0' : '#2e2e30';
          ctx.beginPath();
          ctx.arc(cx, cy, p.weapon.projectile === 'bomb' ? 3.5 : 2.5, 0, Math.PI * 2);
          ctx.fill();
          if (p.weapon.projectile === 'missile') {
            ctx.fillStyle = 'rgba(255,160,60,0.7)';
            ctx.beginPath();
            ctx.arc(cx - 4, cy + 1, 1.8, 0, Math.PI * 2);
            ctx.fill();
          }
        },
      });
    }

    drawables.sort((a, b) => a.depth - b.depth);
    for (const d of drawables) d.draw();

    // fog above entities
    drawFog(ctx, w.map, this.cam, human);

    // effects on top of fog (explosions glow through)
    this.effects.update();
    this.effects.draw(ctx, this.cam);

    // placement ghost
    if (this.ghost) this.drawGhost(ctx, this.ghost);

    // superweapon target ring
    if (this.targetRing > 0) {
      ctx.strokeStyle = 'rgba(255,80,80,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(
        this.cam.toCanvasX(this.mouseWorld.x, this.mouseWorld.y),
        this.cam.toCanvasY(this.mouseWorld.x, this.mouseWorld.y),
        this.targetRing * 32, this.targetRing * 16, 0, 0, Math.PI * 2,
      );
      ctx.stroke();
    }
  }

  private drawUnitSelection(ctx: CanvasRenderingContext2D, u: Unit, cx: number, cy: number): void {
    void u;
    ctx.strokeStyle = 'rgba(120,255,140,0.9)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 15, 8, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  private drawBuildingSelection(ctx: CanvasRenderingContext2D, b: Building): void {
    ctx.strokeStyle = 'rgba(120,255,140,0.9)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(this.cam.toCanvasX(b.tx, b.ty), this.cam.toCanvasY(b.tx, b.ty));
    ctx.lineTo(this.cam.toCanvasX(b.tx + b.def.w, b.ty), this.cam.toCanvasY(b.tx + b.def.w, b.ty));
    ctx.lineTo(this.cam.toCanvasX(b.tx + b.def.w, b.ty + b.def.h), this.cam.toCanvasY(b.tx + b.def.w, b.ty + b.def.h));
    ctx.lineTo(this.cam.toCanvasX(b.tx, b.ty + b.def.h), this.cam.toCanvasY(b.tx, b.ty + b.def.h));
    ctx.closePath();
    ctx.stroke();
    this.drawHealthBar(
      ctx,
      this.cam.toCanvasX(b.cx, b.cy),
      this.cam.toCanvasY(b.tx + b.def.w, b.ty) - 30,
      b.hp / b.def.hp, 34,
    );
  }

  private drawHealthBar(
    ctx: CanvasRenderingContext2D, cx: number, cy: number, ratio: number, width: number,
  ): void {
    const r = Math.max(0, Math.min(1, ratio));
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(cx - width / 2 - 1, cy - 1, width + 2, 5);
    ctx.fillStyle = r > 0.5 ? '#46d148' : r > 0.25 ? '#e8c22e' : '#e04a2a';
    ctx.fillRect(cx - width / 2, cy, width * r, 3);
  }

  private drawRank(ctx: CanvasRenderingContext2D, cx: number, cy: number, rank: number): void {
    ctx.fillStyle = rank === 2 ? '#ffd24b' : '#c9d8e8';
    for (let i = 0; i < rank; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + 12, cy - i * 5);
      ctx.lineTo(cx + 16, cy - i * 5 - 4);
      ctx.lineTo(cx + 20, cy - i * 5);
      ctx.closePath();
      ctx.fill();
    }
  }

  private drawRepairWrench(ctx: CanvasRenderingContext2D, b: Building, time: number): void {
    if (Math.floor(time / 350) % 2 !== 0) return;
    const cx = this.cam.toCanvasX(b.cx, b.cy);
    const cy = this.cam.toCanvasY(b.cx, b.cy) - 40;
    ctx.fillStyle = '#ffd24b';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('🔧', cx, cy);
  }

  private drawGhost(ctx: CanvasRenderingContext2D, ghost: PlacementGhost): void {
    const w = this.world;
    const ok = w.canPlaceBuilding(this.humanId, ghost.def, ghost.tx, ghost.ty, {});
    for (let dy = 0; dy < ghost.def.h; dy++) {
      for (let dx = 0; dx < ghost.def.w; dx++) {
        const tx = ghost.tx + dx;
        const ty = ghost.ty + dy;
        const tileOk = ghost.def.naval
          ? w.map.isWaterBuildableTile(tx, ty)
          : w.map.isBuildableTile(tx, ty);
        const cx = this.cam.toCanvasX(tx + 0.5, ty + 0.5);
        const cy = this.cam.toCanvasY(tx + 0.5, ty + 0.5);
        ctx.fillStyle = ok && tileOk ? 'rgba(90,230,110,0.4)' : 'rgba(230,80,60,0.45)';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 16);
        ctx.lineTo(cx + 32, cy);
        ctx.lineTo(cx, cy + 16);
        ctx.lineTo(cx - 32, cy);
        ctx.closePath();
        ctx.fill();
      }
    }
    // translucent sprite preview
    const color = this.world.players[this.humanId].config.color;
    const sprite = getBuildingSprite(ghost.def, color);
    ctx.globalAlpha = 0.55;
    ctx.drawImage(
      sprite.canvas,
      this.cam.toCanvasX(ghost.tx, ghost.ty) - sprite.ox,
      this.cam.toCanvasY(ghost.tx, ghost.ty) - sprite.oy,
    );
    ctx.globalAlpha = 1;
  }
}
