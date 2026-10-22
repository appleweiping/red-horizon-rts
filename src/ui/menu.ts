import type { AIDifficulty, FactionId, MatchConfig } from '../core/types';
import { DEFAULT_CREDITS, PLAYER_COLORS } from '../core/constants';
import { FACTIONS } from '../data/factions';
import { MAPS } from '../map/maps';
import type { PlayerStats } from '../core/types';
import { setTipsWanted, tipsWanted } from './tutorial';

/** Main menu, pause overlay and end-of-match screen (plain DOM). */
export class Menu {
  private root: HTMLElement;

  constructor(root: HTMLElement, private onStart: (cfg: MatchConfig) => void) {
    this.root = root;
  }

  showMain(): void {
    const faction: { v: FactionId } = { v: 'concord' };
    const mapId = { v: MAPS[0].id };
    const difficulty: { v: AIDifficulty } = { v: 'normal' };
    const enemies = { v: 1 };
    const credits = { v: DEFAULT_CREDITS };
    const superweapons = { v: true };
    const tips = { v: tipsWanted() };

    this.root.className = 'menu-root';
    this.root.replaceChildren();

    const panel = div('menu-panel');
    panel.appendChild(div('menu-title', 'RED HORIZON'));
    panel.appendChild(div('menu-subtitle', 'A skirmish RTS against computer opponents'));

    // faction cards
    const fRow = div('faction-row');
    const fCards: HTMLElement[] = [];
    for (const f of FACTIONS) {
      const card = div('faction-card');
      card.style.borderColor = f.color;
      card.appendChild(div('faction-name', f.name));
      card.appendChild(div('faction-tag', f.tagline));
      card.onclick = () => {
        faction.v = f.id;
        fCards.forEach((c) => c.classList.remove('active'));
        card.classList.add('active');
      };
      if (f.id === faction.v) card.classList.add('active');
      fCards.push(card);
      fRow.appendChild(card);
    }
    panel.appendChild(fRow);

    // map select
    panel.appendChild(div('menu-label', 'BATTLEFIELD'));
    const mapRow = div('map-row');
    const mapCards: HTMLElement[] = [];
    for (const m of MAPS) {
      const card = div('map-card');
      card.appendChild(div('map-name', m.name));
      card.appendChild(div('map-desc', `${m.maxPlayers}P · ${m.desc}`));
      card.onclick = () => {
        mapId.v = m.id;
        enemies.v = Math.min(enemies.v, m.maxPlayers - 1);
        mapCards.forEach((c) => c.classList.remove('active'));
        card.classList.add('active');
        syncEnemyButtons();
      };
      if (m.id === mapId.v) card.classList.add('active');
      mapCards.push(card);
      mapRow.appendChild(card);
    }
    panel.appendChild(mapRow);

    // options row
    const optRow = div('opt-row');
    optRow.appendChild(this.optionGroup('DIFFICULTY', ['easy', 'normal', 'hard'], difficulty.v,
      (v) => (difficulty.v = v as AIDifficulty)));
    const enemyGroup = this.optionGroup('OPPONENTS', ['1', '2', '3'], String(enemies.v),
      (v) => (enemies.v = parseInt(v, 10)));
    optRow.appendChild(enemyGroup);
    optRow.appendChild(this.optionGroup('FUNDS', ['5000', '10000', '20000'], String(credits.v),
      (v) => (credits.v = parseInt(v, 10))));
    optRow.appendChild(this.optionGroup('SUPERWEAPONS', ['on', 'off'], 'on',
      (v) => (superweapons.v = v === 'on')));
    optRow.appendChild(this.optionGroup('TIPS', ['on', 'off'], tips.v ? 'on' : 'off',
      (v) => (tips.v = v === 'on')));
    panel.appendChild(optRow);

    const syncEnemyButtons = () => {
      const max = (MAPS.find((m) => m.id === mapId.v)?.maxPlayers ?? 2) - 1;
      enemyGroup.querySelectorAll('button').forEach((b) => {
        const n = parseInt(b.textContent ?? '1', 10);
        (b as HTMLButtonElement).disabled = n > max;
        if (n > max) b.classList.remove('active');
      });
    };
    syncEnemyButtons();

    const start = document.createElement('button');
    start.className = 'start-btn';
    start.textContent = '▶  START OPERATION';
    start.onclick = () => {
      const players: MatchConfig['players'] = [{
        name: 'Commander',
        faction: faction.v,
        color: PLAYER_COLORS[0],
        isAI: false,
      }];
      for (let i = 0; i < enemies.v; i++) {
        players.push({
          name: `Enemy ${i + 1}`,
          faction: (i % 2 === 0) === (faction.v === 'concord') ? 'pact' : 'concord',
          color: PLAYER_COLORS[i + 1],
          isAI: true,
          difficulty: difficulty.v,
        });
      }
      setTipsWanted(tips.v);
      this.hide();
      this.onStart({
        mapId: mapId.v,
        seed: (Math.random() * 0xffffffff) >>> 0,
        players,
        startingCredits: credits.v,
        speed: 1,
        superweapons: superweapons.v,
      });
    };
    panel.appendChild(start);

    panel.appendChild(div('menu-help',
      'Left-drag: select · Right-click: move / attack · A: attack-move · S: stop · ' +
      'D: deploy · H: base · Ctrl+0-9: groups · Esc: menu'));
    panel.appendChild(div('menu-footer',
      'Inspired by the isometric RTS games of the early 2000s. All code, names and art are original. ' +
      'Source: github.com/appleweiping/red-horizon-rts'));

    this.root.appendChild(panel);
    this.root.style.display = 'flex';
  }

  private optionGroup(
    label: string, options: string[], active: string, onPick: (v: string) => void,
  ): HTMLElement {
    const g = div('opt-group');
    g.appendChild(div('menu-label', label));
    const row = div('opt-btns');
    const btns: HTMLButtonElement[] = [];
    for (const o of options) {
      const b = document.createElement('button');
      b.className = 'opt-btn' + (o === active ? ' active' : '');
      b.textContent = o;
      b.onclick = () => {
        btns.forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        onPick(o);
      };
      btns.push(b);
      row.appendChild(b);
    }
    g.appendChild(row);
    return g;
  }

  /** In-game pause menu. Returns handlers wired by the caller. */
  showPause(handlers: {
    onResume: () => void; onQuit: () => void;
    volume: number; onVolume: (v: number) => void;
    voiceOn: boolean; onVoice: (on: boolean) => void;
  }): void {
    this.root.className = 'menu-root translucent';
    this.root.replaceChildren();
    const panel = div('menu-panel small');
    panel.appendChild(div('menu-title', 'PAUSED'));

    const resume = button('start-btn', '▶  RESUME', handlers.onResume);
    panel.appendChild(resume);

    const volWrap = div('opt-group');
    volWrap.appendChild(div('menu-label', `SFX VOLUME`));
    const vol = document.createElement('input');
    vol.type = 'range';
    vol.min = '0';
    vol.max = '100';
    vol.value = String(Math.round(handlers.volume * 100));
    vol.oninput = () => handlers.onVolume(parseInt(vol.value, 10) / 100);
    volWrap.appendChild(vol);
    panel.appendChild(volWrap);

    const voiceBtn = button('opt-btn wide', handlers.voiceOn ? 'ANNOUNCER: ON' : 'ANNOUNCER: OFF', () => {
      handlers.onVoice(!(voiceBtn.textContent ?? '').includes('ON'));
      voiceBtn.textContent = (voiceBtn.textContent ?? '').includes('ON') ? 'ANNOUNCER: OFF' : 'ANNOUNCER: ON';
    });
    panel.appendChild(voiceBtn);

    panel.appendChild(button('opt-btn wide danger', 'ABANDON OPERATION', handlers.onQuit));
    this.root.appendChild(panel);
    this.root.style.display = 'flex';
  }

  /** Victory / defeat screen with the after-action report. */
  showEnd(
    victory: boolean,
    rows: Array<{ name: string; color: string; faction: string; stats: PlayerStats; defeated: boolean }>,
    onMenu: () => void,
  ): void {
    this.root.className = 'menu-root translucent';
    this.root.replaceChildren();
    const panel = div('menu-panel wide-panel');
    panel.appendChild(div(victory ? 'menu-title victory' : 'menu-title defeat',
      victory ? 'VICTORY' : 'DEFEAT'));

    const table = document.createElement('table');
    table.className = 'stats-table';
    const head = document.createElement('tr');
    for (const h of ['Commander', 'Faction', 'Units built', 'Units lost', 'Kills', 'Structures', 'Harvested']) {
      const th = document.createElement('th');
      th.textContent = h;
      head.appendChild(th);
    }
    table.appendChild(head);
    for (const r of rows) {
      const tr = document.createElement('tr');
      if (r.defeated) tr.className = 'defeated';
      const name = document.createElement('td');
      name.textContent = r.name;
      name.style.color = r.color;
      tr.appendChild(name);
      for (const v of [
        r.faction,
        String(r.stats.unitsBuilt),
        String(r.stats.unitsLost),
        String(r.stats.unitsKilled + r.stats.buildingsKilled),
        String(r.stats.buildingsBuilt),
        `$${Math.floor(r.stats.creditsHarvested).toLocaleString()}`,
      ]) {
        const td = document.createElement('td');
        td.textContent = v;
        tr.appendChild(td);
      }
      table.appendChild(tr);
    }
    panel.appendChild(table);
    panel.appendChild(button('start-btn', 'RETURN TO HQ', onMenu));
    this.root.appendChild(panel);
    this.root.style.display = 'flex';
  }

  hide(): void {
    this.root.style.display = 'none';
    this.root.replaceChildren();
  }
}

function div(cls: string, text?: string): HTMLElement {
  const e = document.createElement('div');
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function button(cls: string, text: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = cls;
  b.textContent = text;
  b.onclick = onClick;
  return b;
}
