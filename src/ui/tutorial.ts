import { buildingsForFaction } from '../data';
import type { Building } from '../sim/entity';
import type { World } from '../sim/world';

/** localStorage key: set once the player finishes or hides the tips. */
export const TIPS_DONE_KEY = 'rh_tips_done';

export function tipsWanted(): boolean {
  try {
    return localStorage.getItem(TIPS_DONE_KEY) !== '1';
  } catch {
    return true;
  }
}

export function setTipsWanted(on: boolean): void {
  try {
    if (on) localStorage.removeItem(TIPS_DONE_KEY);
    else localStorage.setItem(TIPS_DONE_KEY, '1');
  } catch {
    /* storage blocked: tips just show every match */
  }
}

interface Step {
  html: string;
  done: (w: World, me: number) => boolean;
}

function owns(w: World, me: number, test: (b: Building) => boolean): boolean {
  for (const b of w.buildings.values()) if (b.player === me && !b.dead && test(b)) return true;
  return false;
}

/**
 * First-match walkthrough: a small panel in the corner of the battlefield
 * that watches the world and advances when the player has done each step.
 * It reads state only; it never issues commands.
 */
export class Tutorial {
  private el: HTMLElement;
  private textEl: HTMLElement;
  private countEl: HTMLElement;
  private steps: Step[];
  private idx = 0;
  private finished = false;
  private lastCheck = 0;

  constructor(parent: HTMLElement, private world: World, private me: number) {
    const faction = world.players[me].config.faction;
    const plant = buildingsForFaction(faction).find((b) => b.power > 0)?.name ?? 'power plant';

    this.steps = [
      {
        html: 'Click your <b>Pioneer Crawler</b> (the vehicle in the middle of the screen), ' +
          'then press <kbd>D</kbd> to unpack it into a Construction Yard.',
        done: (w, me) => owns(w, me, (b) => !!b.def.conyard),
      },
      {
        html: `In the sidebar, open <b>BLD</b> and click <b>${plant}</b>. ` +
          'When its button flashes READY, click a green spot next to your base to place it.',
        done: (w, me) => owns(w, me, (b) => b.def.power > 0),
      },
      {
        html: 'Build an <b>Ore Refinery</b> the same way. It comes with a free harvester ' +
          'that mines ore and brings back credits on its own.',
        done: (w, me) => owns(w, me, (b) => !!b.def.refinery),
      },
      {
        html: 'Build a <b>Barracks</b> or a <b>War Factory</b>, then train units from the ' +
          '<b>INF</b> or <b>VEH</b> tab. If the power bar turns red, add another plant.',
        done: (w, me) => owns(w, me, (b) => !!b.def.factory),
      },
      {
        html: 'Train at least five combat units. Arrow keys or the screen edge scroll the map; ' +
          '<kbd>H</kbd> jumps back to your base.',
        done: (w, me) => {
          let n = 0;
          for (const u of w.units.values()) {
            if (u.player === me && !u.dead && !u.def.harvester && u.def.deployable !== 'base') n++;
          }
          return n >= 5;
        },
      },
      {
        html: 'Drag a box around your army, press <kbd>A</kbd>, then click toward the enemy ' +
          'to attack-move. You win when every enemy structure is gone.',
        done: (w, me) => {
          for (const u of w.units.values()) {
            if (u.player === me && !u.dead &&
                (u.order.kind === 'attackMove' || u.order.kind === 'attack')) return true;
          }
          return false;
        },
      },
    ];

    this.el = document.createElement('div');
    this.el.className = 'tutorial';
    const head = document.createElement('div');
    head.className = 'tutorial-head';
    this.countEl = document.createElement('span');
    const hide = document.createElement('button');
    hide.className = 'tutorial-hide';
    hide.textContent = 'Hide tips';
    hide.onclick = () => this.close(true);
    head.append(this.countEl, hide);
    this.textEl = document.createElement('div');
    this.textEl.className = 'tutorial-text';
    this.el.append(head, this.textEl);
    parent.appendChild(this.el);
    this.render();
  }

  /** Called every frame; checks progress a few times per second. */
  update(now: number): void {
    if (this.finished || now - this.lastCheck < 300) return;
    this.lastCheck = now;
    let advanced = false;
    while (this.idx < this.steps.length && this.steps[this.idx].done(this.world, this.me)) {
      this.idx++;
      advanced = true;
    }
    if (!advanced) return;
    if (this.idx >= this.steps.length) {
      this.finished = true;
      this.countEl.textContent = 'TIPS';
      this.textEl.innerHTML = 'That is the whole loop. Good luck, commander.';
      setTimeout(() => this.close(true), 6000);
    } else {
      this.render();
    }
  }

  private render(): void {
    this.countEl.textContent = `TIP ${this.idx + 1} / ${this.steps.length}`;
    this.textEl.innerHTML = this.steps[this.idx].html;
    this.el.classList.remove('flash');
    void this.el.offsetWidth; // restart the highlight animation
    this.el.classList.add('flash');
  }

  close(remember: boolean): void {
    this.finished = true;
    if (remember) setTipsWanted(false);
    this.el.remove();
  }
}
