import { Terrain } from '../core/types';
import { getBuilding } from '../data/buildings';
import { getPower } from '../data/powers';
import type { Unit } from '../sim/entity';
import { isVisibleTo } from '../sim/fog';
import type { World } from '../sim/world';
import type { Renderer } from '../render/renderer';
import type { Minimap } from '../render/minimap';
import type { Selection } from './selection';

type Mode =
  | { type: 'normal' }
  | { type: 'attackMove' }
  | { type: 'place'; def: string }
  | { type: 'power'; id: string }
  | { type: 'sell' }
  | { type: 'repair' };

export interface InputCallbacks {
  onEscape(): void;
  onModeChange(mode: string): void;
}

const EDGE = 24; // px of edge-scroll zone
const SCROLL_SPEED = 14;

/** Mouse + keyboard command layer. Translates gestures into sim Commands. */
export class Input {
  mode: Mode = { type: 'normal' };
  private keys = new Set<string>();
  private mouse = { x: 0, y: 0, inside: false };
  private drag: { x0: number; y0: number; x1: number; y1: number } | null = null;
  private lastClickTime = 0;
  private lastClickId = 0;
  private minimapDrag = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private world: World,
    private humanId: number,
    private renderer: Renderer,
    private minimap: Minimap,
    private selection: Selection,
    private cb: InputCallbacks,
  ) {
    this.bind();
  }

  setMode(mode: Mode): void {
    this.mode = mode;
    this.renderer.ghost = mode.type === 'place'
      ? { def: getBuilding(mode.def), tx: 0, ty: 0 }
      : null;
    this.renderer.targetRing = mode.type === 'power' ? getPower(mode.id).radius : 0;
    this.canvas.style.cursor =
      mode.type === 'attackMove' || mode.type === 'power' ? 'crosshair'
        : mode.type === 'sell' || mode.type === 'repair' ? 'pointer'
          : 'default';
    this.cb.onModeChange(mode.type);
  }

  private bind(): void {
    const c = this.canvas;
    c.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('mouseup', (e) => this.onMouseUp(e));
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('mouseleave', () => (this.mouse.inside = false));
    document.addEventListener('mouseenter', () => (this.mouse.inside = true));

    this.minimap.canvas.addEventListener('mousedown', (e) => {
      this.minimapDrag = true;
      this.panToMinimap(e);
    });
    window.addEventListener('mousemove', (e) => {
      if (this.minimapDrag) this.panToMinimap(e);
    });
    window.addEventListener('mouseup', () => (this.minimapDrag = false));
  }

  private panToMinimap(e: MouseEvent): void {
    if (!this.world.players[this.humanId].radarActive) return;
    const w = this.minimap.toWorld(e.clientX, e.clientY);
    this.renderer.cam.centerOn(w.x, w.y);
  }

  private canvasPos(e: MouseEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private onMouseDown(e: MouseEvent): void {
    const p = this.canvasPos(e);
    if (e.button === 0) {
      switch (this.mode.type) {
        case 'place': {
          const g = this.renderer.ghost;
          if (g && this.world.canPlaceBuilding(this.humanId, g.def, g.tx, g.ty, {})) {
            this.world.issue({
              kind: 'placeBuilding', player: this.humanId,
              def: this.mode.def, tx: g.tx, ty: g.ty,
            });
            this.setMode({ type: 'normal' });
          }
          return;
        }
        case 'power': {
          const w = this.renderer.cam.canvasToWorld(p.x, p.y);
          this.world.issue({
            kind: 'firePower', player: this.humanId, power: this.mode.id,
            x: w.x, y: w.y,
            units: this.selection.liveUnits().map((u) => u.id),
          });
          this.setMode({ type: 'normal' });
          return;
        }
        case 'sell': {
          const b = this.pickBuilding(p.x, p.y);
          if (b && b.player === this.humanId) {
            this.world.issue({ kind: 'sell', player: this.humanId, building: b.id });
          }
          this.setMode({ type: 'normal' });
          return;
        }
        case 'repair': {
          const b = this.pickBuilding(p.x, p.y);
          if (b && b.player === this.humanId) {
            this.world.issue({ kind: 'repair', player: this.humanId, building: b.id });
          }
          this.setMode({ type: 'normal' });
          return;
        }
        case 'attackMove': {
          const w = this.renderer.cam.canvasToWorld(p.x, p.y);
          const units = this.selection.liveUnits().map((u) => u.id);
          if (units.length > 0) {
            this.world.issue({ kind: 'attackMove', units, x: w.x, y: w.y });
          }
          this.setMode({ type: 'normal' });
          return;
        }
        case 'normal':
          this.drag = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
          return;
      }
    }
    if (e.button === 2) {
      if (this.mode.type !== 'normal') {
        this.setMode({ type: 'normal' });
        return;
      }
      this.rightClick(p.x, p.y, e.shiftKey);
    }
  }

  private onMouseMove(e: MouseEvent): void {
    const p = this.canvasPos(e);
    this.mouse.x = p.x;
    this.mouse.y = p.y;
    this.mouse.inside =
      e.clientX >= 0 && e.clientY >= 0 &&
      e.clientX < window.innerWidth && e.clientY < window.innerHeight;
    const w = this.renderer.cam.canvasToWorld(p.x, p.y);
    this.renderer.mouseWorld = w;
    if (this.drag) {
      this.drag.x1 = p.x;
      this.drag.y1 = p.y;
    }
    if (this.renderer.ghost) {
      const def = this.renderer.ghost.def;
      this.renderer.ghost.tx = Math.round(w.x - def.w / 2);
      this.renderer.ghost.ty = Math.round(w.y - def.h / 2);
    }
  }

  private onMouseUp(e: MouseEvent): void {
    if (e.button !== 0 || !this.drag) return;
    const d = this.drag;
    this.drag = null;
    const w = Math.abs(d.x1 - d.x0);
    const h = Math.abs(d.y1 - d.y0);
    if (w > 6 || h > 6) {
      this.boxSelect(Math.min(d.x0, d.x1), Math.min(d.y0, d.y1), w, h, e.shiftKey);
    } else {
      this.clickSelect(d.x0, d.y0, e.shiftKey);
    }
  }

  /** Selection rectangle currently being dragged (for the renderer overlay). */
  get dragRect(): { x: number; y: number; w: number; h: number } | null {
    if (!this.drag) return null;
    return {
      x: Math.min(this.drag.x0, this.drag.x1),
      y: Math.min(this.drag.y0, this.drag.y1),
      w: Math.abs(this.drag.x1 - this.drag.x0),
      h: Math.abs(this.drag.y1 - this.drag.y0),
    };
  }

  private clickSelect(cx: number, cy: number, additive: boolean): void {
    const u = this.pickUnit(cx, cy);
    const now = performance.now();
    if (u) {
      // double-click: select all of the same type on screen
      if (now - this.lastClickTime < 350 && this.lastClickId === u.id) {
        const same: number[] = [];
        for (const o of this.world.units.values()) {
          if (o.dead || o.player !== this.humanId || o.def.id !== u.def.id) continue;
          const sx = this.renderer.cam.toCanvasX(o.x, o.y);
          const sy = this.renderer.cam.toCanvasY(o.x, o.y);
          if (sx >= 0 && sy >= 0 && sx <= this.canvas.width && sy <= this.canvas.height) {
            same.push(o.id);
          }
        }
        this.selection.selectMany(same, additive);
      } else if (u.player === this.humanId) {
        this.selection.selectOne(u.id, additive);
      } else {
        this.selection.clear();
        this.selection.ids.add(u.id); // enemy: info-only selection
      }
      this.lastClickTime = now;
      this.lastClickId = u.id;
      return;
    }
    const b = this.pickBuilding(cx, cy);
    if (b) {
      this.selection.selectOne(b.id, false);
      this.lastClickTime = now;
      this.lastClickId = b.id;
      return;
    }
    if (!additive) this.selection.clear();
  }

  private boxSelect(x: number, y: number, w: number, h: number, additive: boolean): void {
    const hits: number[] = [];
    for (const u of this.world.units.values()) {
      if (u.dead || u.player !== this.humanId) continue;
      const sx = this.renderer.cam.toCanvasX(u.x, u.y);
      const sy = this.renderer.cam.toCanvasY(u.x, u.y) - (u.def.domain === 'air' ? 34 : 0);
      if (sx >= x && sx <= x + w && sy >= y && sy <= y + h) hits.push(u.id);
    }
    if (hits.length > 0) {
      // prefer combat units: drop harvesters/crawlers when mixed
      const units = hits.map((id) => this.world.units.get(id)!);
      const combat = units.filter((u) => !u.def.harvester && u.def.deployable !== 'base');
      this.selection.selectMany((combat.length > 0 ? combat : units).map((u) => u.id), additive);
    } else if (!additive) {
      this.selection.clear();
    }
  }

  private rightClick(cx: number, cy: number, queued: boolean): void {
    const units = this.selection.liveUnits();
    const w = this.renderer.cam.canvasToWorld(cx, cy);

    // factory selected: right-click sets the rally point
    if (units.length === 0) {
      for (const id of this.selection.set) {
        const b = this.world.buildings.get(id);
        if (b && !b.dead && b.player === this.humanId && b.def.factory) {
          this.world.issue({ kind: 'setRally', building: b.id, x: w.x, y: w.y });
          return;
        }
      }
      return;
    }

    const ids = units.map((u) => u.id);
    const targetUnit = this.pickUnit(cx, cy);
    const targetBuilding = targetUnit ? null : this.pickBuilding(cx, cy);

    if (targetUnit && targetUnit.player !== this.humanId) {
      this.world.issue({ kind: 'attack', units: ids, target: targetUnit.id });
      return;
    }
    if (targetBuilding) {
      const engineers = units.filter((u) => u.def.engineer);
      const isEnemy = targetBuilding.player >= 0 &&
        targetBuilding.player !== this.humanId &&
        !this.world.players[this.humanId].isAlliedWith(this.world.players[targetBuilding.player]);
      const isNeutralTech = targetBuilding.player < 0 && targetBuilding.def.capturable;
      if (engineers.length > 0 && (isEnemy || isNeutralTech)) {
        this.world.issue({ kind: 'capture', units: [engineers[0].id], target: targetBuilding.id });
        const rest = ids.filter((id) => id !== engineers[0].id);
        if (rest.length > 0) this.world.issue({ kind: 'move', units: rest, x: w.x, y: w.y, queued });
        return;
      }
      if (isEnemy || (targetBuilding.player < 0 && !targetBuilding.def.capturable)) {
        this.world.issue({ kind: 'attack', units: ids, target: targetBuilding.id });
        return;
      }
    }

    // ore tile with a harvester selected -> harvest
    const tx = Math.floor(w.x);
    const ty = Math.floor(w.y);
    if (this.world.map.inBounds(tx, ty)) {
      const t = this.world.map.terrainAt(tx, ty);
      const harvesters = units.filter((u) => u.def.harvester);
      if (t === Terrain.OreBearing && harvesters.length > 0) {
        this.world.issue({ kind: 'harvest', units: harvesters.map((u) => u.id), tx, ty });
        const rest = ids.filter((id) => !harvesters.some((h) => h.id === id));
        if (rest.length > 0) this.world.issue({ kind: 'move', units: rest, x: w.x, y: w.y, queued });
        return;
      }
    }

    this.world.issue({ kind: 'move', units: ids, x: w.x, y: w.y, queued });
  }

  private onKeyDown(e: KeyboardEvent): void {
    const k = e.key.toLowerCase();
    this.keys.add(k);
    if (e.repeat) return;

    if (k === 'escape') {
      if (this.mode.type !== 'normal') this.setMode({ type: 'normal' });
      else this.cb.onEscape();
      return;
    }
    // control groups
    if (/^[0-9]$/.test(k)) {
      const n = parseInt(k, 10);
      if (e.ctrlKey) {
        this.selection.assignGroup(n);
      } else {
        this.selection.recallGroup(n, e.shiftKey);
        const c = this.selection.centroid();
        if (c && performance.now() - this.lastClickTime < 350) {
          this.renderer.cam.centerOn(c.x, c.y);
        }
        this.lastClickTime = performance.now();
      }
      e.preventDefault();
      return;
    }
    const units = this.selection.liveUnits().map((u) => u.id);
    switch (k) {
      case 'a':
        if (units.length > 0) this.setMode({ type: 'attackMove' });
        break;
      case 's':
        if (units.length > 0) this.world.issue({ kind: 'stop', units });
        break;
      case 'd':
        if (units.length > 0) this.world.issue({ kind: 'deploy', units });
        break;
      case 'h': {
        for (const b of this.world.buildings.values()) {
          if (!b.dead && b.player === this.humanId && b.def.conyard) {
            this.renderer.cam.centerOn(b.cx, b.cy);
            return;
          }
        }
        const s = this.world.map.spawns[this.humanId % this.world.map.spawns.length];
        this.renderer.cam.centerOn(s.x, s.y);
        break;
      }
    }
  }

  /** Called every frame: edge scroll + arrow keys. */
  update(): void {
    const cam = this.renderer.cam;
    let dx = 0;
    let dy = 0;
    if (this.keys.has('arrowleft')) dx -= 1;
    if (this.keys.has('arrowright')) dx += 1;
    if (this.keys.has('arrowup')) dy -= 1;
    if (this.keys.has('arrowdown')) dy += 1;
    if (this.mouse.inside && document.hasFocus()) {
      if (this.mouse.x < EDGE) dx -= 1;
      if (this.mouse.x > this.canvas.width - EDGE && this.mouse.x < this.canvas.width + 4) dx += 1;
      if (this.mouse.y < EDGE) dy -= 1;
      if (this.mouse.y > this.canvas.height - EDGE) dy += 1;
    }
    if (dx !== 0 || dy !== 0) cam.pan(dx * SCROLL_SPEED, dy * SCROLL_SPEED);
  }

  // -------------------------------------------------------------- picking --

  private pickUnit(cx: number, cy: number): Unit | null {
    const human = this.world.players[this.humanId];
    let best: Unit | null = null;
    let bestD = 18 * 18;
    for (const u of this.world.units.values()) {
      if (u.dead) continue;
      const own = u.player === this.humanId;
      if (!own && !isVisibleTo(human, this.world.map, u.x, u.y)) continue;
      if (!own && u.disguised) continue;
      const alt = u.def.domain === 'air' ? 34 : 0;
      const sx = this.renderer.cam.toCanvasX(u.x, u.y);
      const sy = this.renderer.cam.toCanvasY(u.x, u.y) - alt - 8;
      const d = (sx - cx) * (sx - cx) + (sy - cy) * (sy - cy);
      if (d < bestD) {
        bestD = d;
        best = u;
      }
    }
    return best;
  }

  private pickBuilding(cx: number, cy: number) {
    const w = this.renderer.cam.canvasToWorld(cx, cy);
    const tx = Math.floor(w.x);
    const ty = Math.floor(w.y);
    if (!this.world.map.inBounds(tx, ty)) return null;
    const id = this.world.map.occupierAt(tx, ty);
    if (!id) return null;
    const b = this.world.buildings.get(id);
    if (!b || b.dead) return null;
    const human = this.world.players[this.humanId];
    if (b.player !== this.humanId && !isVisibleTo(human, this.world.map, b.cx, b.cy)) {
      // allow clicking remembered buildings in explored fog
      if (human.fog[ty * this.world.map.width + tx] === 0) return null;
    }
    return b;
  }
}
