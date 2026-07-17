import type { SimEvent } from '../core/types';
import { getWeapon, WEAPON_BY_ID } from '../data/weapons';
import type { Camera } from './iso';

/**
 * Render-side effects: tracers, beams, lightning, explosions, smoke.
 * Deliberately non-deterministic (Math.random) — effects never feed back
 * into the simulation, so visual randomness is free.
 */

interface Particle {
  x: number; y: number;      // world coords
  vx: number; vy: number;
  z: number; vz: number;     // faux altitude in pixels
  life: number; maxLife: number;
  size: number;
  color: string;
  gravity: number;
}

interface Tracer {
  x0: number; y0: number; x1: number; y1: number;
  life: number; maxLife: number;
  kind: 'tracer' | 'beam' | 'arc';
  color: string;
}

interface Flash {
  x: number; y: number;
  life: number; maxLife: number;
  radius: number;
  color: string;
}

export class Effects {
  private particles: Particle[] = [];
  private tracers: Tracer[] = [];
  private flashes: Flash[] = [];
  /** Full-screen white flash strength (nuke). */
  screenFlash = 0;

  /** Ingest one sim event and spawn matching visuals. */
  onEvent(e: SimEvent): void {
    switch (e.kind) {
      case 'shot': {
        const w = WEAPON_BY_ID.get(e.weapon) ?? getWeapon('gauss_rifle');
        if (w.projectile === 'beam') {
          this.tracers.push({
            x0: e.x, y0: e.y, x1: e.tx, y1: e.ty,
            life: 10, maxLife: 10, kind: 'beam', color: '#aef1ff',
          });
        } else if (w.projectile === 'arc') {
          this.tracers.push({
            x0: e.x, y0: e.y, x1: e.tx, y1: e.ty,
            life: 9, maxLife: 9, kind: 'arc', color: '#ffe98f',
          });
        } else if (w.projectile === 'instant') {
          this.tracers.push({
            x0: e.x, y0: e.y, x1: e.tx, y1: e.ty,
            life: 5, maxLife: 5, kind: 'tracer', color: '#ffe9a8',
          });
        }
        break;
      }
      case 'impact': {
        if (e.weapon === 'nuke_blast') {
          this.explosion(e.x, e.y, 3.2, '#ffd27a', 90);
          this.explosion(e.x, e.y, 2.2, '#ff8a3a', 70);
          this.screenFlash = 1;
          this.flashes.push({ x: e.x, y: e.y, life: 60, maxLife: 60, radius: 150, color: '#fff3d0' });
          break;
        }
        if (e.weapon === 'storm_bolt') {
          this.tracers.push({
            x0: e.x, y0: e.y - 14, x1: e.x, y1: e.y,
            life: 12, maxLife: 12, kind: 'arc', color: '#cfe8ff',
          });
          this.explosion(e.x, e.y, 1.0, '#bfe0ff', 24);
          break;
        }
        this.explosion(e.x, e.y, e.big ? 1.6 : 0.8, '#ffab4a', e.big ? 34 : 14);
        break;
      }
      case 'death': {
        const big = e.class === 'building' || e.class === 'aircraft';
        this.explosion(e.x, e.y, big ? 2.2 : 1.1, '#ff8a3a', big ? 50 : 22);
        if (big) this.flashes.push({ x: e.x, y: e.y, life: 18, maxLife: 18, radius: 60, color: '#ffd9a0' });
        break;
      }
      case 'crush': {
        this.explosion(e.x, e.y, 0.4, '#a03030', 8);
        break;
      }
      case 'sold': {
        for (let i = 0; i < 12; i++) {
          this.particles.push({
            x: e.x, y: e.y, vx: (Math.random() - 0.5) * 0.08, vy: (Math.random() - 0.5) * 0.08,
            z: 0, vz: 1.6 + Math.random() * 1.4, life: 28, maxLife: 28,
            size: 2.5, color: '#ffe27a', gravity: 0.08,
          });
        }
        break;
      }
      case 'powerLaunched': {
        this.flashes.push({ x: e.x, y: e.y, life: 40, maxLife: 40, radius: 40, color: '#9fd4ff' });
        break;
      }
      default:
        break;
    }
  }

  /** Radial debris + fire + a lingering smoke column. */
  explosion(x: number, y: number, scale: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = Math.random() * 0.09 * scale;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        z: 2, vz: Math.random() * 3.2 * scale,
        life: 18 + Math.random() * 22, maxLife: 40,
        size: 1.6 + Math.random() * 2.6 * scale,
        color: Math.random() < 0.6 ? color : '#5a5a5a',
        gravity: 0.14,
      });
    }
    this.flashes.push({
      x, y, life: 10, maxLife: 10, radius: 14 * scale, color: '#fff1c8',
    });
  }

  /** Ambient smoke from a damaged thing (called by the renderer). */
  smoke(x: number, y: number, zPx: number): void {
    if (Math.random() > 0.25) return;
    this.particles.push({
      x, y, vx: (Math.random() - 0.5) * 0.008, vy: (Math.random() - 0.5) * 0.008,
      z: zPx, vz: 0.55 + Math.random() * 0.4,
      life: 46, maxLife: 46,
      size: 2.5 + Math.random() * 3.5,
      color: Math.random() < 0.8 ? '#4c4c50' : '#77532e',
      gravity: -0.004,
    });
  }

  update(): void {
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.z += p.vz;
      p.vz -= p.gravity;
      if (p.z < 0) {
        p.z = 0;
        p.vz = 0;
      }
      p.life--;
    }
    for (const t of this.tracers) t.life--;
    for (const f of this.flashes) f.life--;
    if (this.screenFlash > 0) this.screenFlash = Math.max(0, this.screenFlash - 0.03);
    if (this.particles.length > 600) this.particles.splice(0, this.particles.length - 600);
    this.particles = this.particles.filter((p) => p.life > 0);
    this.tracers = this.tracers.filter((t) => t.life > 0);
    this.flashes = this.flashes.filter((f) => f.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D, cam: Camera): void {
    // flashes under everything else in this pass
    for (const f of this.flashes) {
      const a = f.life / f.maxLife;
      const cx = cam.toCanvasX(f.x, f.y);
      const cy = cam.toCanvasY(f.x, f.y);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, f.radius * (1.4 - a * 0.4));
      g.addColorStop(0, f.color + '');
      g.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.globalAlpha = a * 0.8;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, f.radius * (1.4 - a * 0.4), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    for (const t of this.tracers) {
      const a = t.life / t.maxLife;
      const x0 = cam.toCanvasX(t.x0, t.y0);
      const y0 = cam.toCanvasY(t.x0, t.y0) - 10;
      const x1 = cam.toCanvasX(t.x1, t.y1);
      const y1 = cam.toCanvasY(t.x1, t.y1) - 8;
      ctx.globalAlpha = a;
      if (t.kind === 'arc') {
        ctx.strokeStyle = t.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        const segs = 6;
        for (let i = 1; i < segs; i++) {
          const tt = i / segs;
          ctx.lineTo(
            x0 + (x1 - x0) * tt + (Math.random() - 0.5) * 14,
            y0 + (y1 - y0) * tt + (Math.random() - 0.5) * 14,
          );
        }
        ctx.lineTo(x1, y1);
        ctx.stroke();
        ctx.globalAlpha = a * 0.4;
        ctx.lineWidth = 5;
        ctx.stroke();
      } else if (t.kind === 'beam') {
        ctx.strokeStyle = t.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        ctx.globalAlpha = a * 0.5;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.strokeStyle = t.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        // short moving dash toward the target
        const tt = 1 - a;
        const mx = x0 + (x1 - x0) * tt;
        const my = y0 + (y1 - y0) * tt;
        const ex = x0 + (x1 - x0) * Math.min(1, tt + 0.18);
        const ey = y0 + (y1 - y0) * Math.min(1, tt + 0.18);
        ctx.moveTo(mx, my);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    for (const p of this.particles) {
      const a = p.life / p.maxLife;
      ctx.globalAlpha = Math.min(0.9, a);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(cam.toCanvasX(p.x, p.y), cam.toCanvasY(p.x, p.y) - p.z, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (this.screenFlash > 0) {
      ctx.fillStyle = `rgba(255,248,230,${this.screenFlash * 0.8})`;
      ctx.fillRect(0, 0, cam.viewW, cam.viewH);
    }
  }
}
