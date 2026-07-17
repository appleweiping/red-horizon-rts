import type { BuildingDef } from '../core/types';
import { TILE_H, TILE_W } from '../core/constants';
import type { Building, Unit } from '../sim/entity';
import { shade, withAlpha } from './iso';

const HW = TILE_W / 2;
const HH = TILE_H / 2;

/**
 * Every sprite in the game is drawn procedurally — no image assets exist.
 * Units are rendered live in "top-down space" then squashed onto the iso
 * plane (scale 1,0.5 + rotate), which gives smooth 360° facings for free.
 * Buildings are prerendered once per (def, player color) into offscreen
 * canvases as stacks of isometric boxes with per-type detailing.
 */

// ---------------------------------------------------------------- units ----

/** Enter top-down space at (cx, cy) facing `angle` (world radians). */
function topDown(ctx: CanvasRenderingContext2D, cx: number, cy: number, angle: number): void {
  ctx.translate(cx, cy);
  ctx.scale(1, 0.5);
  ctx.rotate(angle + Math.PI / 4);
}

export function drawShadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawUnit(
  ctx: CanvasRenderingContext2D, u: Unit,
  cx: number, cy: number, color: string, time: number,
): void {
  const id = u.def.id;
  const air = u.def.domain === 'air';
  const alt = air ? 34 : 0;
  drawShadow(ctx, cx, cy, air ? 10 : u.def.class === 'infantry' ? 5 : 13);
  const y = cy - alt - (air ? Math.sin(time * 0.003 + u.id) * 2 : 0);

  switch (u.def.class) {
    case 'infantry':
      drawInfantry(ctx, u, cx, y, color, time);
      return;
    case 'aircraft':
      if (id === 'leviathan') drawLeviathan(ctx, u, cx, y, color, time);
      else drawJet(ctx, u, cx, y, color);
      return;
    case 'ship':
      drawShip(ctx, u, cx, cy, color);
      return;
    case 'vehicle':
      drawVehicle(ctx, u, cx, y, color, time);
      return;
  }
}

function drawVehicle(
  ctx: CanvasRenderingContext2D, u: Unit,
  cx: number, cy: number, color: string, time: number,
): void {
  const id = u.def.id;
  const body = shade(color, 0.9);
  const dark = shade(color, 0.55);
  const lite = shade(color, 1.25);

  ctx.save();
  topDown(ctx, cx, cy - 6, u.facing);

  const heavy = id === 'behemoth' || id === 'bear' || id === 'pioneer';
  const L = heavy ? 30 : id === 'excavator' || id === 'prospector' ? 28 : 24; // length
  const W = heavy ? 22 : 16; // width

  // treads / wheels
  ctx.fillStyle = '#2c2c30';
  ctx.fillRect(-L / 2, -W / 2 - 3, L, 6);
  ctx.fillRect(-L / 2, W / 2 - 3, L, 6);

  // hull
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(L / 2, 0);
  ctx.lineTo(L / 2 - 6, -W / 2);
  ctx.lineTo(-L / 2, -W / 2);
  ctx.lineTo(-L / 2, W / 2);
  ctx.lineTo(L / 2 - 6, W / 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = withAlpha('#ffffff', 0.14);
  ctx.fillRect(-L / 2 + 2, -W / 2 + 2, L - 8, 4);

  // per-chassis detail
  if (id === 'prospector' || id === 'excavator') {
    ctx.fillStyle = dark;
    ctx.fillRect(-L / 2 + 2, -W / 2 + 3, 12, W - 6); // hopper
    if (u.cargo > 0) {
      ctx.fillStyle = '#e3b64f';
      ctx.fillRect(-L / 2 + 4, -W / 2 + 5, 8, W - 10);
    }
    ctx.fillStyle = lite;
    ctx.fillRect(L / 2 - 10, -4, 8, 8); // scoop cab
  } else if (id === 'pioneer') {
    ctx.fillStyle = dark;
    ctx.fillRect(-6, -W / 2 + 2, 14, W - 4); // container
    ctx.fillStyle = '#c9c9c9';
    ctx.fillRect(-L / 2 + 3, -3, 8, 6); // crane base
  } else if (id === 'hailstorm') {
    ctx.fillStyle = dark;
    ctx.fillRect(-8, -W / 2 + 1, 16, W - 2); // launcher box
    ctx.fillStyle = '#222';
    for (let i = -1; i <= 1; i++) ctx.fillRect(-6, i * 4 - 1.5, 12, 3); // tubes
  } else if (id === 'viper') {
    ctx.fillStyle = lite; // sensor eye
    ctx.beginPath();
    ctx.arc(L / 2 - 4, 0, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (id === 'lance') {
    ctx.fillStyle = '#dfe8ff';
    ctx.beginPath();
    ctx.arc(-4, 0, 5, 0, Math.PI * 2); // capacitor dish
    ctx.fill();
  }
  ctx.restore();

  // turret on its own rotation
  if (u.def.turret || id === 'lance') {
    ctx.save();
    topDown(ctx, cx, cy - 9, u.def.turret ? u.turretFacing : u.facing);
    ctx.fillStyle = shade(color, 1.05);
    const tr = id === 'behemoth' ? 8 : 6;
    ctx.beginPath();
    ctx.arc(0, 0, tr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = dark;
    ctx.stroke();
    ctx.fillStyle = '#333';
    if (id === 'behemoth') {
      ctx.fillRect(0, -4.5, 20, 3);
      ctx.fillRect(0, 1.5, 20, 3);
    } else if (id === 'ifv') {
      ctx.fillStyle = dark;
      ctx.fillRect(-3, -5, 8, 10); // missile pod
      ctx.fillStyle = '#222';
      ctx.fillRect(2, -4, 8, 2.5);
      ctx.fillRect(2, 1.5, 8, 2.5);
    } else if (id === 'lance') {
      ctx.fillRect(0, -1.5, 22, 3);
      ctx.fillStyle = '#9fd4ff';
      ctx.fillRect(18, -2.5, 5, 5);
    } else {
      ctx.fillRect(0, -1.5, 16, 3); // barrel
    }
    ctx.restore();
  }

  void time;
}

function drawInfantry(
  ctx: CanvasRenderingContext2D, u: Unit,
  cx: number, cy: number, color: string, time: number,
): void {
  const moving = u.path !== null;
  const bob = moving ? Math.sin(time * 0.02 + u.id * 3) * 1.5 : 0;
  const y = cy - 6 + bob;
  const id = u.def.id;

  // jet trooper flame
  if (id === 'jettrooper') {
    ctx.fillStyle = `rgba(255,${150 + Math.round(Math.sin(time * 0.03) * 60)},40,0.8)`;
    ctx.beginPath();
    ctx.ellipse(cx, y + 9, 2.5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // legs
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 2;
  const step = moving ? Math.sin(time * 0.025 + u.id) * 3 : 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, y + 2);
  ctx.lineTo(cx - step, y + 8);
  ctx.moveTo(cx, y + 2);
  ctx.lineTo(cx + step, y + 8);
  ctx.stroke();

  // torso
  ctx.fillStyle = shade(color, id === 'naomi' ? 1.2 : 0.95);
  ctx.fillRect(cx - 3, y - 6, 6, 9);
  // head
  ctx.fillStyle = '#e8c49a';
  ctx.beginPath();
  ctx.arc(cx, y - 9, 3, 0, Math.PI * 2);
  ctx.fill();
  // helmet / cap
  ctx.fillStyle = id === 'engineer' ? '#f2d24b' : shade(color, 0.7);
  ctx.beginPath();
  ctx.arc(cx, y - 10, 3, Math.PI, 0);
  ctx.fill();

  // weapon line pointing at facing
  if (u.weaponDefs.length > 0) {
    const a = u.facing;
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx, y - 3);
    ctx.lineTo(cx + Math.cos(a) * 8, y - 3 + Math.sin(a) * 4);
    ctx.stroke();
  }

  // deployed guardsman sandbags
  if (u.deployed) {
    ctx.fillStyle = 'rgba(194,178,128,0.9)';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 2, 11, 5.5, 0, 0, Math.PI, false);
    ctx.fill();
  }
  // demolisher blinking charge
  if (id === 'demolisher' && Math.floor(time / 300) % 2 === 0) {
    ctx.fillStyle = '#ff4040';
    ctx.fillRect(cx - 1.5, y - 5, 3, 3);
  }
}

function drawJet(
  ctx: CanvasRenderingContext2D, u: Unit, cx: number, cy: number, color: string,
): void {
  ctx.save();
  topDown(ctx, cx, cy, u.facing);
  ctx.fillStyle = shade(color, 1.05);
  // fuselage
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(-8, -4);
  ctx.lineTo(-12, 0);
  ctx.lineTo(-8, 4);
  ctx.closePath();
  ctx.fill();
  // wings
  ctx.beginPath();
  ctx.moveTo(2, 0);
  ctx.lineTo(-6, -12);
  ctx.lineTo(-9, -10);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-9, 10);
  ctx.lineTo(-6, 12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#9fd4ff';
  ctx.beginPath();
  ctx.arc(6, 0, 2.6, 0, Math.PI * 2); // canopy
  ctx.fill();
  // afterburner
  ctx.fillStyle = 'rgba(255,170,60,0.85)';
  ctx.fillRect(-16, -1.5, 5, 3);
  ctx.restore();
}

function drawLeviathan(
  ctx: CanvasRenderingContext2D, u: Unit, cx: number, cy: number, color: string, time: number,
): void {
  ctx.save();
  topDown(ctx, cx, cy, u.facing);
  const sway = Math.sin(time * 0.001 + u.id) * 1;
  ctx.fillStyle = shade(color, 0.85);
  ctx.beginPath();
  ctx.ellipse(0, sway, 30, 14, 0, 0, Math.PI * 2); // envelope
  ctx.fill();
  ctx.fillStyle = shade(color, 1.15);
  ctx.beginPath();
  ctx.ellipse(4, sway - 4, 20, 7, 0, 0, Math.PI * 2); // top highlight
  ctx.fill();
  ctx.fillStyle = '#333';
  ctx.fillRect(-10, sway + 10, 20, 6); // gondola
  // tail fins
  ctx.fillStyle = shade(color, 0.6);
  ctx.beginPath();
  ctx.moveTo(-28, sway);
  ctx.lineTo(-38, sway - 8);
  ctx.lineTo(-38, sway + 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // menacing red running light
  ctx.fillStyle = Math.floor(time / 400) % 2 === 0 ? '#ff5050' : '#802020';
  ctx.beginPath();
  ctx.arc(cx, cy - 14, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawShip(
  ctx: CanvasRenderingContext2D, u: Unit, cx: number, cy: number, color: string,
): void {
  const id = u.def.id;
  const big = id === 'dreadnought' || id === 'cruiser';
  ctx.save();
  topDown(ctx, cx, cy - 4, u.facing);
  const L = big ? 40 : 28;
  const W = big ? 14 : 10;
  // wake
  ctx.fillStyle = 'rgba(220,240,255,0.25)';
  ctx.beginPath();
  ctx.moveTo(-L / 2, 0);
  ctx.lineTo(-L / 2 - 12, -5);
  ctx.lineTo(-L / 2 - 12, 5);
  ctx.closePath();
  ctx.fill();
  // hull
  ctx.fillStyle = shade(color, 0.8);
  ctx.beginPath();
  ctx.moveTo(L / 2, 0);
  ctx.lineTo(L / 2 - 8, -W / 2);
  ctx.lineTo(-L / 2, -W / 2 + 2);
  ctx.lineTo(-L / 2, W / 2 - 2);
  ctx.lineTo(L / 2 - 8, W / 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = shade(color, 0.5);
  ctx.stroke();
  // superstructure
  ctx.fillStyle = shade(color, 1.1);
  ctx.fillRect(-6, -W / 2 + 3, big ? 14 : 9, W - 6);
  if (id === 'dreadnought') {
    ctx.fillStyle = '#222';
    ctx.fillRect(6, -4, 10, 3);
    ctx.fillRect(6, 1, 10, 3); // missile ramps
  }
  ctx.restore();

  if (u.def.turret) {
    ctx.save();
    topDown(ctx, cx, cy - 8, u.turretFacing);
    ctx.fillStyle = shade(color, 1.05);
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#333';
    ctx.fillRect(0, -1.5, 14, 3);
    ctx.restore();
  }
}

// ------------------------------------------------------------- buildings ----

const buildingCache = new Map<string, { canvas: HTMLCanvasElement; ox: number; oy: number }>();

/**
 * Prerendered building sprite anchored so that drawing it at the screen
 * position of the footprint's (tx, ty) corner lines up with the grid.
 */
export function getBuildingSprite(
  def: BuildingDef, color: string,
): { canvas: HTMLCanvasElement; ox: number; oy: number } {
  const key = `${def.id}|${color}`;
  const hit = buildingCache.get(key);
  if (hit) return hit;

  const wallH = buildingHeight(def);
  const w = (def.w + def.h) * HW + 8;
  const h = (def.w + def.h) * HH + wallH + 26;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  // sprite-local origin: the (tx,ty) corner of the footprint sits at:
  const ox = def.h * HW + 4; // px from left
  const oy = wallH + 22; // px from top
  ctx.translate(ox, oy);
  paintBuilding(ctx, def, color, wallH);
  const entry = { canvas, ox, oy };
  buildingCache.set(key, entry);
  return entry;
}

function buildingHeight(def: BuildingDef): number {
  if (def.tab === 'defense') return 18;
  if (def.conyard || def.superweapon) return 34;
  if (def.factory === 'vehicle' || def.refinery) return 30;
  return 24;
}

/** Local iso helpers inside sprite space (origin = footprint corner). */
function ptX(lx: number, ly: number): number {
  return (lx - ly) * HW;
}
function ptY(lx: number, ly: number): number {
  return (lx + ly) * HH;
}

function isoBox(
  ctx: CanvasRenderingContext2D,
  lx: number, ly: number, lw: number, lh: number, hpx: number,
  base: string,
): void {
  const topL = { x: ptX(lx, ly), y: ptY(lx, ly) - hpx };
  const topR = { x: ptX(lx + lw, ly), y: ptY(lx + lw, ly) - hpx };
  const topB = { x: ptX(lx + lw, ly + lh), y: ptY(lx + lw, ly + lh) - hpx };
  const topLB = { x: ptX(lx, ly + lh), y: ptY(lx, ly + lh) - hpx };
  // top face
  ctx.fillStyle = shade(base, 1.15);
  ctx.beginPath();
  ctx.moveTo(topL.x, topL.y);
  ctx.lineTo(topR.x, topR.y);
  ctx.lineTo(topB.x, topB.y);
  ctx.lineTo(topLB.x, topLB.y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = shade(base, 0.5);
  ctx.lineWidth = 1;
  ctx.stroke();
  // right face (screen-right = +lx edge)
  ctx.fillStyle = shade(base, 0.8);
  ctx.beginPath();
  ctx.moveTo(topR.x, topR.y);
  ctx.lineTo(topB.x, topB.y);
  ctx.lineTo(topB.x, topB.y + hpx);
  ctx.lineTo(topR.x, topR.y + hpx);
  ctx.closePath();
  ctx.fill();
  // left face
  ctx.fillStyle = shade(base, 0.6);
  ctx.beginPath();
  ctx.moveTo(topLB.x, topLB.y);
  ctx.lineTo(topB.x, topB.y);
  ctx.lineTo(topB.x, topB.y + hpx);
  ctx.lineTo(topLB.x, topLB.y + hpx);
  ctx.closePath();
  ctx.fill();
}

function paintBuilding(
  ctx: CanvasRenderingContext2D, def: BuildingDef, color: string, wallH: number,
): void {
  const { w, h } = def;
  // base plate
  ctx.fillStyle = 'rgba(58,64,70,0.9)';
  ctx.beginPath();
  ctx.moveTo(ptX(0, 0), ptY(0, 0));
  ctx.lineTo(ptX(w, 0), ptY(w, 0));
  ctx.lineTo(ptX(w, h), ptY(w, h));
  ctx.lineTo(ptX(0, h), ptY(0, h));
  ctx.closePath();
  ctx.fill();

  const body = shade(color, 0.95);
  const grey = '#8a9096';

  switch (def.id) {
    case 'conyard': {
      isoBox(ctx, 0.2, 0.2, 2.6, 2.6, wallH * 0.6, grey);
      isoBox(ctx, 0.5, 1.3, 2.0, 1.2, wallH, body);
      // crane arm
      ctx.strokeStyle = '#f2d24b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(ptX(1.5, 1.9), ptY(1.5, 1.9) - wallH);
      ctx.lineTo(ptX(2.4, 0.6), ptY(2.4, 0.6) - wallH - 14);
      ctx.stroke();
      break;
    }
    case 'refinery': {
      isoBox(ctx, 0.2, 0.2, 1.4, 2.6, wallH, body);
      // ore silo
      circleTank(ctx, 2.2, 1.0, 16, wallH * 0.9, '#c98f2e');
      // stack
      chimney(ctx, 2.3, 2.3, wallH + 12);
      break;
    }
    case 'barracks': {
      isoBox(ctx, 0.15, 0.15, 1.7, 1.7, wallH * 0.8, body);
      roofTent(ctx, 0.15, 0.15, 1.7, 1.7, wallH * 0.8, shade(color, 1.0));
      break;
    }
    case 'warfactory': {
      isoBox(ctx, 0.15, 0.15, 2.7, 2.7, wallH, grey);
      // big door on the south face
      ctx.fillStyle = '#3d4348';
      ctx.beginPath();
      const dx0 = ptX(0.7, 2.85);
      const dy0 = ptY(0.7, 2.85);
      const dx1 = ptX(2.2, 2.85);
      const dy1 = ptY(2.2, 2.85);
      ctx.moveTo(dx0, dy0);
      ctx.lineTo(dx1, dy1);
      ctx.lineTo(dx1, dy1 - wallH * 0.75);
      ctx.lineTo(dx0, dy0 - wallH * 0.75);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = withAlpha(color, 0.9);
      ctx.fillRect(ptX(1.4, 0.4) - 3, ptY(1.4, 0.4) - wallH - 8, 6, 8); // beacon
      break;
    }
    case 'radar': {
      isoBox(ctx, 0.2, 0.2, 1.6, 1.6, wallH * 0.7, body);
      // dish
      ctx.fillStyle = '#d5dade';
      ctx.beginPath();
      ctx.ellipse(ptX(1, 1), ptY(1, 1) - wallH - 8, 13, 7, -0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#888';
      ctx.stroke();
      break;
    }
    case 'airfield': {
      isoBox(ctx, 0.1, 0.1, 2.8, 1.8, 6, '#565c62'); // runway pad
      isoBox(ctx, 0.2, 0.2, 0.8, 0.8, wallH, body); // tower
      ctx.fillStyle = '#ffd24b';
      ctx.beginPath();
      ctx.arc(ptX(0.6, 0.6), ptY(0.6, 0.6) - wallH - 4, 3, 0, Math.PI * 2);
      ctx.fill();
      // helipad circle
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(ptX(1.9, 1.0), ptY(1.9, 1.0) - 6, 18, 9, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'shipyard': {
      isoBox(ctx, 0.1, 0.1, 2.8, 1.2, wallH * 0.8, body);
      // dry dock rails
      ctx.strokeStyle = '#9aa3ab';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(ptX(0.3 + i, 1.4), ptY(0.3 + i, 1.4));
        ctx.lineTo(ptX(0.3 + i, 2.8), ptY(0.3 + i, 2.8));
        ctx.stroke();
      }
      break;
    }
    case 'lab': {
      isoBox(ctx, 0.2, 0.2, 1.6, 1.6, wallH * 0.75, body);
      // dome
      ctx.fillStyle = '#bfe6ff';
      ctx.beginPath();
      ctx.arc(ptX(1, 1), ptY(1, 1) - wallH * 0.75 - 2, 11, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = '#6d90a8';
      ctx.stroke();
      break;
    }
    case 'fusion_plant': {
      isoBox(ctx, 0.2, 0.2, 1.6, 1.6, wallH * 0.7, body);
      circleTank(ctx, 0.7, 0.7, 9, wallH, '#dfe4e8');
      circleTank(ctx, 1.4, 1.4, 9, wallH, '#dfe4e8');
      break;
    }
    case 'combustion_plant': {
      isoBox(ctx, 0.2, 0.2, 1.6, 1.6, wallH * 0.7, body);
      chimney(ctx, 0.7, 0.7, wallH + 14);
      chimney(ctx, 1.4, 1.0, wallH + 8);
      break;
    }
    case 'bunker':
    case 'sentry': {
      isoBox(ctx, 0.15, 0.15, 0.7, 0.7, 12, '#8f9499');
      ctx.fillStyle = '#2f3338';
      ctx.fillRect(ptX(0.5, 0.5) - 7, ptY(0.5, 0.5) - 18, 14, 6); // slit
      break;
    }
    case 'sam_site':
    case 'flak_cannon': {
      isoBox(ctx, 0.15, 0.15, 0.7, 0.7, 8, '#8f9499');
      ctx.fillStyle = shade(color, 1.0);
      ctx.beginPath();
      ctx.arc(ptX(0.5, 0.5), ptY(0.5, 0.5) - 14, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#26292d';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(ptX(0.5, 0.5) - 4, ptY(0.5, 0.5) - 16);
      ctx.lineTo(ptX(0.5, 0.5) + 7, ptY(0.5, 0.5) - 26);
      ctx.moveTo(ptX(0.5, 0.5) + 1, ptY(0.5, 0.5) - 13);
      ctx.lineTo(ptX(0.5, 0.5) + 11, ptY(0.5, 0.5) - 22);
      ctx.stroke();
      break;
    }
    case 'lance_tower': {
      pylon(ctx, 0.5, 0.5, 30, '#9fb6c9');
      ctx.fillStyle = '#e8f4ff';
      ctx.beginPath();
      ctx.arc(ptX(0.5, 0.5), ptY(0.5, 0.5) - 34, 5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'arc_tower': {
      pylon(ctx, 0.5, 0.5, 30, '#8b6f52');
      ctx.fillStyle = '#ffe98f';
      ctx.beginPath();
      ctx.arc(ptX(0.5, 0.5), ptY(0.5, 0.5) - 34, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffe98f';
      ctx.beginPath();
      ctx.arc(ptX(0.5, 0.5), ptY(0.5, 0.5) - 34, 7, 0.3, 2.6);
      ctx.stroke();
      break;
    }
    case 'storm_array': {
      isoBox(ctx, 0.3, 0.3, 2.4, 2.4, wallH * 0.5, body);
      for (const [ax, ay] of [[0.7, 0.7], [2.3, 0.7], [0.7, 2.3], [2.3, 2.3]] as const) {
        pylon(ctx, ax, ay, 26, '#aebfd2');
      }
      ctx.fillStyle = '#cfe8ff';
      ctx.beginPath();
      ctx.arc(ptX(1.5, 1.5), ptY(1.5, 1.5) - wallH * 0.5 - 10, 7, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'chrono_relay': {
      isoBox(ctx, 0.2, 0.2, 1.6, 1.6, wallH * 0.4, body);
      ctx.strokeStyle = '#9fd4ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(ptX(1, 1), ptY(1, 1) - wallH * 0.4 - 12, 15, 8, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'icbm_silo': {
      isoBox(ctx, 0.3, 0.3, 2.4, 2.4, wallH * 0.4, grey);
      // silo doors
      ctx.fillStyle = '#5b6167';
      ctx.beginPath();
      ctx.ellipse(ptX(1.5, 1.5), ptY(1.5, 1.5) - wallH * 0.4, 20, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#d63c3c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ptX(1.5, 1.5) - 20, ptY(1.5, 1.5) - wallH * 0.4);
      ctx.lineTo(ptX(1.5, 1.5) + 20, ptY(1.5, 1.5) - wallH * 0.4);
      ctx.stroke();
      break;
    }
    case 'aegis_generator': {
      isoBox(ctx, 0.2, 0.2, 1.6, 1.6, wallH * 0.5, body);
      pylon(ctx, 1.0, 1.0, 30, '#b78fd6');
      ctx.fillStyle = 'rgba(190,140,230,0.65)';
      ctx.beginPath();
      ctx.arc(ptX(1, 1), ptY(1, 1) - 36, 8, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'oil_derrick': {
      isoBox(ctx, 0.2, 0.2, 1.0, 1.6, 10, '#6d6152');
      // derrick tower
      ctx.strokeStyle = '#4a4238';
      ctx.lineWidth = 2.5;
      const bx = ptX(1.2, 0.8);
      const by = ptY(1.2, 0.8);
      ctx.beginPath();
      ctx.moveTo(bx - 8, by);
      ctx.lineTo(bx, by - 30);
      ctx.lineTo(bx + 8, by);
      ctx.moveTo(bx - 5, by - 12);
      ctx.lineTo(bx + 5, by - 12);
      ctx.stroke();
      break;
    }
    default: {
      isoBox(ctx, 0.2, 0.2, w - 0.4, h - 0.4, wallH, body);
    }
  }

  // player color trim along the south edge
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(ptX(0, h), ptY(0, h));
  ctx.lineTo(ptX(w, h), ptY(w, h));
  ctx.stroke();
}

function circleTank(
  ctx: CanvasRenderingContext2D, lx: number, ly: number, r: number, hpx: number, colr: string,
): void {
  const x = ptX(lx, ly);
  const y = ptY(lx, ly);
  ctx.fillStyle = shade(colr, 0.75);
  ctx.fillRect(x - r, y - hpx, r * 2, hpx);
  ctx.fillStyle = shade(colr, 1.1);
  ctx.beginPath();
  ctx.ellipse(x, y - hpx, r, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(colr, 0.75);
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.5, 0, 0, Math.PI);
  ctx.fill();
}

function chimney(ctx: CanvasRenderingContext2D, lx: number, ly: number, hpx: number): void {
  const x = ptX(lx, ly);
  const y = ptY(lx, ly);
  ctx.fillStyle = '#5b5148';
  ctx.fillRect(x - 3, y - hpx, 6, hpx);
  ctx.fillStyle = '#8a2f2f';
  ctx.fillRect(x - 3, y - hpx, 6, 4);
}

function pylon(ctx: CanvasRenderingContext2D, lx: number, ly: number, hpx: number, colr: string): void {
  const x = ptX(lx, ly);
  const y = ptY(lx, ly);
  ctx.strokeStyle = colr;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - hpx);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - 5, y - hpx * 0.4);
  ctx.lineTo(x + 5, y - hpx * 0.55);
  ctx.stroke();
}

function roofTent(
  ctx: CanvasRenderingContext2D,
  lx: number, ly: number, lw: number, lh: number, hpx: number, colr: string,
): void {
  const ridge0 = { x: ptX(lx + lw * 0.5, ly), y: ptY(lx + lw * 0.5, ly) - hpx - 8 };
  const ridge1 = { x: ptX(lx + lw * 0.5, ly + lh), y: ptY(lx + lw * 0.5, ly + lh) - hpx - 8 };
  ctx.fillStyle = shade(colr, 0.95);
  ctx.beginPath();
  ctx.moveTo(ptX(lx, ly), ptY(lx, ly) - hpx);
  ctx.lineTo(ridge0.x, ridge0.y);
  ctx.lineTo(ridge1.x, ridge1.y);
  ctx.lineTo(ptX(lx, ly + lh), ptY(lx, ly + lh) - hpx);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(colr, 1.2);
  ctx.beginPath();
  ctx.moveTo(ptX(lx + lw, ly), ptY(lx + lw, ly) - hpx);
  ctx.lineTo(ridge0.x, ridge0.y);
  ctx.lineTo(ridge1.x, ridge1.y);
  ctx.lineTo(ptX(lx + lw, ly + lh), ptY(lx + lw, ly + lh) - hpx);
  ctx.closePath();
  ctx.fill();
}

/** Construction animation: buildings rise out of the ground under scaffolds. */
export function drawBuildingRising(
  ctx: CanvasRenderingContext2D, b: Building, cx: number, cy: number,
  sprite: { canvas: HTMLCanvasElement; ox: number; oy: number }, progress: number,
): void {
  const lift = (1 - progress) * 26;
  ctx.save();
  ctx.globalAlpha = 0.5 + progress * 0.5;
  const clipH = sprite.canvas.height * (0.3 + 0.7 * progress);
  ctx.drawImage(
    sprite.canvas,
    0, sprite.canvas.height - clipH, sprite.canvas.width, clipH,
    cx - sprite.ox, cy - sprite.oy + (sprite.canvas.height - clipH) + lift * 0,
    sprite.canvas.width, clipH,
  );
  ctx.restore();
  void b;
  void lift;
}
