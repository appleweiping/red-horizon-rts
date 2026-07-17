import { TICK_MS } from './core/constants';
import type { MatchConfig, SimEvent } from './core/types';
import { getBuilding } from './data/buildings';
import { getPower } from './data/powers';
import { getUnit } from './data/units';
import { WEAPON_BY_ID } from './data/weapons';
import { isVisibleTo } from './sim/fog';
import { World } from './sim/world';
import { Renderer } from './render/renderer';
import { Minimap } from './render/minimap';
import { Hud } from './ui/hud';
import { Input } from './ui/input';
import { Menu } from './ui/menu';
import { Messages } from './ui/messages';
import { Selection } from './ui/selection';
import { AudioEngine } from './audio/audio';
import { Eva, EVA_LINES } from './audio/eva';

const SPEEDS = [0.5, 1, 1.5, 2, 3];

/** Wires the sim, renderer, HUD, input and audio into a running match. */
export class Game {
  readonly world: World;
  private renderer: Renderer;
  private minimap: Minimap;
  private hud: Hud;
  private input: Input;
  private selection: Selection;
  private messages: Messages;
  private menu: Menu;

  private humanId = 0;
  private speedIdx = 1;
  private paused = false;
  private acc = 0;
  private lastTime = 0;
  private raf = 0;
  private bgWorker: Worker | null = null;
  private ended = false;

  constructor(
    config: MatchConfig,
    private canvas: HTMLCanvasElement,
    sidebarEl: HTMLElement,
    messagesEl: HTMLElement,
    menuEl: HTMLElement,
    private audio: AudioEngine,
    private eva: Eva,
  ) {
    this.world = new World(config);
    this.selection = new Selection(this.world, this.humanId);
    this.renderer = new Renderer(canvas, this.world, this.humanId, () => this.selection.set);
    this.minimap = new Minimap(this.world, this.humanId);
    this.messages = new Messages(messagesEl);
    this.menu = new Menu(menuEl, () => location.reload());

    this.hud = new Hud(sidebarEl, this.world, this.humanId, this.minimap, this.selection, {
      onPlaceRequest: (defId) => this.input.setMode({ type: 'place', def: defId }),
      onPowerTarget: (powerId) => this.input.setMode({ type: 'power', id: powerId }),
      onSellMode: () => this.input.setMode({ type: 'sell' }),
      onRepairMode: () => this.input.setMode({ type: 'repair' }),
      onMenu: () => this.pauseMenu(),
      onSpeed: (d) => {
        this.speedIdx = Math.max(0, Math.min(SPEEDS.length - 1, this.speedIdx + d));
      },
    });

    this.input = new Input(canvas, this.world, this.humanId, this.renderer, this.minimap, this.selection, {
      onEscape: () => this.pauseMenu(),
      onModeChange: () => undefined,
    });

    const spawn = this.world.map.spawns[this.humanId % this.world.map.spawns.length];
    this.renderer.cam.centerOn(spawn.x, spawn.y);

    window.addEventListener('resize', () => this.renderer.resize());

    this.messages.push('Operation started. Deploy your Pioneer Crawler (select it, press D).', '#9fd4ff', 9000);
    this.eva.say('Battle control online.');

    this.lastTime = performance.now();
    this.loop(this.lastTime);

    // requestAnimationFrame stops in hidden/background tabs, and page timers
    // get throttled down to one wake per minute. A Web Worker's timer is
    // exempt from visibility throttling, so it keeps the war going (sans
    // rendering) through alt-tabs and headless runs.
    try {
      const src = `setInterval(() => postMessage(0), ${TICK_MS});`;
      this.bgWorker = new Worker(URL.createObjectURL(new Blob([src], { type: 'application/javascript' })));
      this.bgWorker.onmessage = () => {
        if (!document.hidden) return;
        const now = performance.now();
        const dt = Math.min(2000, now - this.lastTime);
        this.lastTime = now;
        this.advance(dt, 60);
      };
    } catch {
      this.bgWorker = null; // strict CSP: background stepping unavailable
    }
  }

  /** Advance the fixed-step simulation by dt milliseconds of real time. */
  private advance(dt: number, maxSteps = 6): void {
    if (this.paused || this.world.gameOver) return;
    this.acc += dt * SPEEDS[this.speedIdx];
    let steps = 0;
    while (this.acc >= TICK_MS && steps < maxSteps) {
      this.world.step();
      this.acc -= TICK_MS;
      steps++;
      for (const e of this.world.events.drain()) this.onEvent(e);
    }
    if (steps === maxSteps) this.acc = 0; // machine can't keep up; drop time
  }

  private pauseMenu(): void {
    if (this.ended) return;
    this.paused = true;
    this.menu.showPause({
      onResume: () => {
        this.paused = false;
        this.menu.hide();
      },
      onQuit: () => location.reload(),
      volume: this.audio.volume,
      onVolume: (v) => this.audio.setVolume(v),
      evaOn: this.eva.enabled,
      onEva: (on) => (this.eva.enabled = on),
    });
  }

  private loop = (time: number): void => {
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(100, time - this.lastTime);
    this.lastTime = time;
    this.advance(dt);

    const alpha = Math.max(0, Math.min(1, this.acc / TICK_MS));
    this.renderer.render(time, this.paused ? 1 : alpha);
    this.drawDragRect();
    this.minimap.draw(this.renderer.cam, time);
    this.hud.update(time, SPEEDS[this.speedIdx]);
    if (!this.paused) this.input.update();
  };

  private drawDragRect(): void {
    const r = this.input?.dragRect;
    if (!r) return;
    const ctx = this.canvas.getContext('2d')!;
    ctx.strokeStyle = 'rgba(120,255,140,0.9)';
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w, r.h);
    ctx.fillStyle = 'rgba(120,255,140,0.08)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }

  // ------------------------------------------------------------ sim events --

  private onEvent(e: SimEvent): void {
    // combat visuals inside the shroud must not leak enemy positions
    const human = this.world.players[this.humanId];
    let seen = true;
    if (e.kind === 'shot' || e.kind === 'impact' || e.kind === 'death' || e.kind === 'crush') {
      seen = isVisibleTo(human, this.world.map, e.x, e.y);
    }
    if (seen) this.renderer.effects.onEvent(e);
    const mine = 'player' in e && e.player === this.humanId;

    switch (e.kind) {
      case 'constructionComplete':
        if (mine) {
          this.eva.say(EVA_LINES.constructionComplete);
          this.audio.play('ready');
          this.messages.push(`${getBuilding(e.def).name} ready to place.`);
        }
        break;
      case 'buildingPlaced':
        if (mine) this.audio.play('place');
        break;
      case 'unitReady':
        if (mine) {
          this.eva.say(EVA_LINES.unitReady);
          this.messages.push(`${getUnit(e.def).name} ready.`);
        }
        break;
      case 'insufficientFunds':
        if (mine) {
          this.eva.say(EVA_LINES.insufficientFunds);
          this.audio.play('error');
        }
        break;
      case 'lowPower':
        if (mine) {
          this.eva.say(EVA_LINES.lowPower);
          this.messages.push('Low power: production slowed, defenses offline.', '#ffb04a');
        }
        break;
      case 'powerRestored':
        if (mine) this.messages.push('Power restored.', '#9fd4ff');
        break;
      case 'underAttack':
        if (mine) {
          this.eva.say(e.isBase ? EVA_LINES.baseUnderAttack : EVA_LINES.forcesUnderAttack, true);
          this.audio.play('alarm');
          this.messages.push(e.isBase ? 'Base under attack!' : 'Forces under attack!', '#ff6a4a');
        }
        break;
      case 'unitLost':
        if (mine) this.eva.say(EVA_LINES.unitLost);
        break;
      case 'buildingLost':
        if (mine) {
          this.eva.say(EVA_LINES.buildingLost);
          this.messages.push(`${getBuilding(e.def).name} lost!`, '#ff6a4a');
        }
        break;
      case 'buildingCaptured':
        if (mine) {
          this.eva.say(EVA_LINES.buildingCaptured);
          this.messages.push(`${getBuilding(e.def).name} captured.`, '#7de08a');
        } else if (e.from === this.humanId) {
          this.messages.push(`${getBuilding(e.def).name} captured by the enemy!`, '#ff6a4a');
        }
        break;
      case 'promoted':
        if (mine) {
          this.audio.play('promote');
          this.eva.say(EVA_LINES.unitPromoted);
        }
        break;
      case 'powerCharged': {
        const p = getPower(e.power);
        if (mine) {
          this.eva.say(EVA_LINES.superweaponReady(p.name));
          this.messages.push(`${p.name} ready.`, '#ffd24b');
        } else {
          this.messages.push(`Warning: enemy ${p.name} detected.`, '#ff6a4a');
        }
        break;
      }
      case 'powerLaunched': {
        const p = getPower(e.power);
        if (p.kind === 'chrono') this.audio.play('chrono');
        if (p.kind === 'storm') this.messages.warn('ION STORM INBOUND');
        break;
      }
      case 'nukeWarning':
        this.eva.say(EVA_LINES.nukeWarning, true);
        this.messages.warn('BALLISTIC MISSILE LAUNCH DETECTED');
        this.audio.play('alarm');
        break;
      case 'shot': {
        const w = WEAPON_BY_ID.get(e.weapon);
        if (w?.sound && seen && this.nearCamera(e.x, e.y)) this.audio.play(w.sound);
        break;
      }
      case 'impact':
        if (seen && this.nearCamera(e.x, e.y)) {
          this.audio.play(e.weapon === 'nuke_blast' ? 'bigboom' : e.big ? 'boom' : 'explosion');
        }
        break;
      case 'death':
        if (seen && this.nearCamera(e.x, e.y)) {
          this.audio.play(e.class === 'building' ? 'bigboom' : 'boom');
        }
        break;
      case 'sold':
        if (mine) this.audio.play('sell');
        break;
      case 'playerDefeated': {
        const p = this.world.players[e.player];
        this.messages.push(`${p.config.name} has been eliminated.`, '#d8d8d8');
        if (!mine) this.eva.say(EVA_LINES.playerDefeated);
        break;
      }
      case 'gameOver':
        this.endMatch(e.winners.includes(this.humanId));
        break;
      default:
        break;
    }
  }

  private nearCamera(x: number, y: number): boolean {
    const cx = this.renderer.cam.toCanvasX(x, y);
    const cy = this.renderer.cam.toCanvasY(x, y);
    return cx > -300 && cx < this.renderer.cam.viewW + 300 && cy > -300 && cy < this.renderer.cam.viewH + 300;
  }

  private endMatch(victory: boolean): void {
    if (this.ended) return;
    this.ended = true;
    this.eva.say(victory ? EVA_LINES.victory : EVA_LINES.defeat, true);
    setTimeout(() => {
      this.menu.showEnd(
        victory,
        this.world.players.map((p) => ({
          name: p.config.name,
          color: p.config.color,
          faction: p.config.faction === 'concord' ? 'Atlantic Concord' : 'Crimson Pact',
          stats: p.stats,
          defeated: p.defeated,
        })),
        () => location.reload(),
      );
    }, 1800);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.bgWorker?.terminate();
  }
}
