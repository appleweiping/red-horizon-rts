import type { ProductionTab } from '../core/types';
import { buildingsForFaction, unitsForFaction, getBuilding, getUnit } from '../data';
import { BUILDING_BY_ID } from '../data/buildings';
import { UNIT_BY_ID } from '../data/units';
import type { Unit } from '../sim/entity';
import { canQueue } from '../sim/production';
import type { World } from '../sim/world';
import { getBuildingSprite } from '../render/sprites';
import { drawUnit } from '../render/sprites';
import type { Minimap } from '../render/minimap';
import type { Selection } from './selection';

export interface HudCallbacks {
  onPlaceRequest(defId: string): void;
  onPowerTarget(powerId: string): void;
  onSellMode(): void;
  onRepairMode(): void;
  onMenu(): void;
  onSpeed(delta: number): void;
}

const TAB_LABELS: Array<[ProductionTab, string]> = [
  ['building', 'BLD'],
  ['defense', 'DEF'],
  ['infantry', 'INF'],
  ['vehicle', 'VEH'],
  ['air', 'AIR'],
  ['naval', 'NAV'],
];

interface ButtonRefs {
  el: HTMLButtonElement;
  bar: HTMLDivElement;
  badge: HTMLDivElement;
  state: string;
}

/** Right-hand sidebar: economy readouts, radar, build tabs, powers. */
export class Hud {
  private world: World;
  private humanId: number;
  private cb: HudCallbacks;
  private root: HTMLElement;

  private creditsEl!: HTMLElement;
  private powerFill!: HTMLElement;
  private powerText!: HTMLElement;
  private tabBtns = new Map<ProductionTab, HTMLButtonElement>();
  private gridEl!: HTMLElement;
  private powersEl!: HTMLElement;
  private infoEl!: HTMLElement;
  private speedEl!: HTMLElement;

  private activeTab: ProductionTab = 'building';
  private buttons = new Map<string, ButtonRefs>();
  private powerButtons = new Map<string, ButtonRefs>();
  private shownCredits = 0;
  private lastRefresh = 0;
  private iconCache = new Map<string, HTMLCanvasElement>();

  constructor(
    root: HTMLElement, world: World, humanId: number,
    minimap: Minimap, private selection: Selection, cb: HudCallbacks,
  ) {
    this.root = root;
    this.world = world;
    this.humanId = humanId;
    this.cb = cb;
    this.shownCredits = world.players[humanId].credits;
    this.build(minimap);
    this.setTab('building');
  }

  private get player() {
    return this.world.players[this.humanId];
  }

  private build(minimap: Minimap): void {
    this.root.replaceChildren();
    this.root.className = 'sidebar';

    const brand = el('div', 'brand', 'RED HORIZON');
    this.root.appendChild(brand);

    this.creditsEl = el('div', 'credits', '$ 0');
    this.root.appendChild(this.creditsEl);

    const powerWrap = el('div', 'power-wrap');
    this.powerFill = el('div', 'power-fill');
    const powerBar = el('div', 'power-bar');
    powerBar.appendChild(this.powerFill);
    this.powerText = el('div', 'power-text', '⚡ 0 / 0');
    powerWrap.appendChild(powerBar);
    powerWrap.appendChild(this.powerText);
    this.root.appendChild(powerWrap);

    const mapWrap = el('div', 'minimap-wrap');
    mapWrap.appendChild(minimap.canvas);
    this.root.appendChild(mapWrap);

    const tabs = el('div', 'tabs');
    for (const [tab, label] of TAB_LABELS) {
      const b = document.createElement('button');
      b.className = 'tab-btn';
      b.textContent = label;
      b.title = tab;
      b.onclick = () => this.setTab(tab);
      tabs.appendChild(b);
      this.tabBtns.set(tab, b);
    }
    this.root.appendChild(tabs);

    this.gridEl = el('div', 'build-grid');
    this.root.appendChild(this.gridEl);

    this.powersEl = el('div', 'powers');
    this.root.appendChild(this.powersEl);

    const actions = el('div', 'actions');
    const sell = document.createElement('button');
    sell.className = 'action-btn';
    sell.textContent = '$ SELL';
    sell.onclick = () => this.cb.onSellMode();
    const repair = document.createElement('button');
    repair.className = 'action-btn';
    repair.textContent = '🔧 FIX';
    repair.onclick = () => this.cb.onRepairMode();
    const menu = document.createElement('button');
    menu.className = 'action-btn';
    menu.textContent = '☰ MENU';
    menu.onclick = () => this.cb.onMenu();
    actions.append(sell, repair, menu);
    this.root.appendChild(actions);

    const speedWrap = el('div', 'speed-wrap');
    const minus = document.createElement('button');
    minus.className = 'speed-btn';
    minus.textContent = '−';
    minus.onclick = () => this.cb.onSpeed(-1);
    this.speedEl = el('span', 'speed-text', '1.0×');
    const plus = document.createElement('button');
    plus.className = 'speed-btn';
    plus.textContent = '+';
    plus.onclick = () => this.cb.onSpeed(1);
    speedWrap.append(minus, this.speedEl, plus);
    this.root.appendChild(speedWrap);

    this.infoEl = el('div', 'sel-info');
    this.root.appendChild(this.infoEl);
  }

  setTab(tab: ProductionTab): void {
    this.activeTab = tab;
    for (const [t, b] of this.tabBtns) b.classList.toggle('active', t === tab);
    this.rebuildGrid();
  }

  setSpeedLabel(mult: number): void {
    this.speedEl.textContent = `${mult.toFixed(1)}×`;
  }

  private rebuildGrid(): void {
    this.gridEl.replaceChildren();
    this.buttons.clear();
    const faction = this.player.config.faction;
    const defs =
      this.activeTab === 'building' || this.activeTab === 'defense'
        ? buildingsForFaction(faction, this.activeTab)
        : unitsForFaction(faction, this.activeTab);
    const sorted = [...defs].sort((a, b) => a.cost - b.cost);

    for (const def of sorted) {
      const btn = document.createElement('button');
      btn.className = 'build-btn';
      const icon = this.icon(def.id);
      btn.appendChild(icon);
      const nameEl = el('div', 'build-name', def.name);
      const costEl = el('div', 'build-cost', `$${def.cost}`);
      const bar = el('div', 'build-progress') as HTMLDivElement;
      const badge = el('div', 'build-badge') as HTMLDivElement;
      btn.append(nameEl, costEl, bar, badge);
      btn.title = `${def.name} — $${def.cost}\n${def.desc}` +
        (def.prerequisites.length ? `\nRequires: ${def.prerequisites.map(prettyName).join(', ')}` : '');
      btn.onclick = () => this.clickBuild(def.id);
      btn.oncontextmenu = (e) => {
        e.preventDefault();
        this.world.issue({ kind: 'cancelProduction', player: this.humanId, tab: this.activeTab });
      };
      this.gridEl.appendChild(btn);
      this.buttons.set(def.id, { el: btn, bar, badge, state: '' });
    }
  }

  private clickBuild(defId: string): void {
    const tab = this.activeTab;
    const q = this.player.queues[tab];
    if ((tab === 'building' || tab === 'defense') && q.ready === defId) {
      this.cb.onPlaceRequest(defId);
      return;
    }
    this.world.issue({ kind: 'startProduction', player: this.humanId, tab, def: defId });
  }

  /** Per-frame update; DOM refresh is throttled internally. */
  update(time: number, speedMult: number): void {
    // smooth credits ticker every frame
    const target = Math.floor(this.player.credits);
    if (this.shownCredits !== target) {
      const diff = target - this.shownCredits;
      this.shownCredits += Math.sign(diff) * Math.max(1, Math.floor(Math.abs(diff) * 0.12));
      if (Math.abs(target - this.shownCredits) < 2) this.shownCredits = target;
      this.creditsEl.textContent = `$ ${this.shownCredits.toLocaleString()}`;
    }

    if (time - this.lastRefresh < 150) return;
    this.lastRefresh = time;
    this.setSpeedLabel(speedMult);

    // power bar
    const p = this.player;
    const ratio = p.powerProduced === 0 ? 0 : Math.min(1, p.powerProduced / Math.max(1, p.powerConsumed));
    const surplus = p.powerProduced - p.powerConsumed;
    this.powerFill.style.width = `${Math.min(100, (p.powerConsumed / Math.max(1, p.powerProduced)) * 100)}%`;
    this.powerFill.className = 'power-fill' + (p.lowPower ? ' low' : '');
    this.powerText.textContent = `⚡ ${p.powerConsumed} / ${p.powerProduced} (${surplus >= 0 ? '+' : ''}${surplus})`;
    void ratio;

    // tab badges: flash a tab when something is ready there
    for (const [tab, btn] of this.tabBtns) {
      const q = p.queues[tab];
      btn.classList.toggle('ready', !!q.ready);
      btn.classList.toggle('busy', q.items.length > 0);
    }

    // build buttons
    const q = p.queues[this.activeTab];
    for (const [defId, refs] of this.buttons) {
      const buildable = canQueue(this.world, p, this.activeTab, defId);
      const isHead = q.items.length > 0 && q.items[0].def === defId;
      const queued = q.items.filter((i) => i.def === defId).length;
      const ready = q.ready === defId;
      let state = '';
      if (ready) state = 'ready';
      else if (isHead) state = 'building';
      else if (!buildable) state = 'disabled';
      refs.el.classList.toggle('disabled', state === 'disabled' && !ready);
      refs.el.classList.toggle('producing', isHead);
      refs.el.classList.toggle('ready-flash', ready);
      refs.bar.style.width = isHead
        ? `${Math.floor((q.items[0].progress / q.items[0].total) * 100)}%`
        : '0%';
      refs.badge.textContent = ready ? 'READY' : queued > 1 ? `×${queued}` : queued === 1 && !isHead ? '×1' : '';
    }

    // superweapon buttons
    this.refreshPowers();

    // selection info
    const units = this.selection.liveUnits();
    if (units.length > 0) {
      const names = new Map<string, number>();
      for (const u of units) names.set(u.def.name, (names.get(u.def.name) ?? 0) + 1);
      this.infoEl.textContent =
        [...names.entries()].map(([n, c]) => (c > 1 ? `${n} ×${c}` : n)).join(', ');
    } else {
      const bid = [...this.selection.set].find((id) => this.world.buildings.has(id));
      if (bid) {
        const b = this.world.buildings.get(bid)!;
        this.infoEl.textContent = `${b.def.name} — ${Math.ceil(b.hp)}/${b.def.hp}`;
      } else {
        this.infoEl.textContent = '';
      }
    }
  }

  private refreshPowers(): void {
    const p = this.player;
    // create/remove buttons to match owned powers
    for (const [id, pc] of p.powers) {
      if (!this.powerButtons.has(id)) {
        const btn = document.createElement('button');
        btn.className = 'power-btn';
        const label = el('div', 'power-name', pc.def.name);
        const bar = el('div', 'build-progress') as HTMLDivElement;
        const badge = el('div', 'build-badge') as HTMLDivElement;
        btn.append(label, bar, badge);
        btn.title = pc.def.desc;
        btn.onclick = () => {
          if (p.powers.get(id)?.ready) this.cb.onPowerTarget(id);
        };
        this.powersEl.appendChild(btn);
        this.powerButtons.set(id, { el: btn, bar, badge, state: '' });
      }
    }
    for (const [id, refs] of this.powerButtons) {
      const pc = p.powers.get(id);
      if (!pc) {
        refs.el.remove();
        this.powerButtons.delete(id);
        continue;
      }
      const pct = Math.floor((pc.charge / pc.def.chargeTicks) * 100);
      refs.bar.style.width = `${Math.min(100, pct)}%`;
      refs.badge.textContent = pc.ready ? 'READY' : `${pct}%`;
      refs.el.classList.toggle('ready-flash', pc.ready);
    }
  }

  /** Mini icon rendered from the same procedural art as the game world. */
  private icon(defId: string): HTMLCanvasElement {
    // note: cloneNode() on a canvas loses the bitmap, so re-parent the cached
    // canvas instead (each def appears in at most one grid at a time)
    const hit = this.iconCache.get(defId);
    if (hit) return hit;
    const c = document.createElement('canvas');
    c.width = 56;
    c.height = 38;
    c.className = 'build-icon';
    const ctx = c.getContext('2d')!;
    const color = this.player.config.color;
    if (BUILDING_BY_ID.has(defId)) {
      const def = getBuilding(defId);
      const sprite = getBuildingSprite(def, color);
      const scale = Math.min(52 / sprite.canvas.width, 34 / sprite.canvas.height);
      ctx.drawImage(
        sprite.canvas,
        (56 - sprite.canvas.width * scale) / 2,
        (38 - sprite.canvas.height * scale) / 2,
        sprite.canvas.width * scale,
        sprite.canvas.height * scale,
      );
    } else if (UNIT_BY_ID.has(defId)) {
      const def = getUnit(defId);
      // a display-only stand-in; never enters the simulation
      const dummy = {
        def, facing: -0.6, turretFacing: -0.6, id: 3, path: null,
        cargo: 0, deployed: false, weaponDefs: [], rank: 0,
        aegisUntil: 0, disguised: false,
      } as unknown as Unit;
      ctx.save();
      ctx.translate(0, -4);
      drawUnit(ctx, dummy, 28, 26, color, 0);
      ctx.restore();
    }
    this.iconCache.set(defId, c);
    return c;
  }
}

function el(tag: string, cls: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function prettyName(defId: string): string {
  return BUILDING_BY_ID.get(defId)?.name ?? defId;
}
