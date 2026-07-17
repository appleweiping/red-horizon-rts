import type { Unit } from '../sim/entity';
import type { World } from '../sim/world';

/** Selection + control groups (Ctrl+0..9). UI-side only; never touches sim. */
export class Selection {
  readonly ids = new Set<number>();
  private groups = new Map<number, number[]>();

  constructor(private world: World, private humanId: number) {}

  get set(): ReadonlySet<number> {
    return this.ids;
  }

  clear(): void {
    this.ids.clear();
  }

  /** Prune dead ids; returns surviving unit objects (owned units only). */
  liveUnits(): Unit[] {
    const out: Unit[] = [];
    for (const id of [...this.ids]) {
      const u = this.world.units.get(id);
      if (u && !u.dead && u.player === this.humanId) out.push(u);
      else if (!this.world.buildings.has(id)) this.ids.delete(id);
    }
    return out;
  }

  selectOne(id: number, additive: boolean): void {
    if (!additive) this.ids.clear();
    if (this.ids.has(id) && additive) this.ids.delete(id);
    else this.ids.add(id);
  }

  selectMany(ids: number[], additive: boolean): void {
    if (!additive) this.ids.clear();
    for (const id of ids) this.ids.add(id);
  }

  assignGroup(n: number): void {
    this.groups.set(n, [...this.ids]);
  }

  recallGroup(n: number, additive: boolean): void {
    const g = this.groups.get(n) ?? [];
    const alive = g.filter((id) => {
      const u = this.world.units.get(id);
      return u && !u.dead;
    });
    this.groups.set(n, alive);
    if (alive.length > 0) this.selectMany(alive, additive);
  }

  /** Center-of-mass of the selected units (for H / group double-tap). */
  centroid(): { x: number; y: number } | null {
    const units = this.liveUnits();
    if (units.length === 0) return null;
    let x = 0;
    let y = 0;
    for (const u of units) {
      x += u.x;
      y += u.y;
    }
    return { x: x / units.length, y: y / units.length };
  }
}
