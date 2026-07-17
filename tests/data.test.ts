import { describe, expect, it } from 'vitest';
import { validateData, unitsForFaction, buildingsForFaction, WEAPONS } from '../src/data';
import { DAMAGE_MATRIX } from '../src/data/armor';
import { FACTIONS } from '../src/data/factions';
import { POWERS } from '../src/data/powers';
import type { ArmorType, WarheadType } from '../src/core/types';

describe('game data integrity', () => {
  it('has no dangling references or unreachable tech', () => {
    expect(validateData()).toEqual([]);
  });

  it('gives every faction units in every production tab', () => {
    for (const f of FACTIONS) {
      for (const tab of ['infantry', 'vehicle', 'air', 'naval'] as const) {
        expect(unitsForFaction(f.id, tab).length, `${f.id}/${tab}`).toBeGreaterThan(0);
      }
      expect(buildingsForFaction(f.id, 'building').length).toBeGreaterThan(5);
      expect(buildingsForFaction(f.id, 'defense').length).toBeGreaterThanOrEqual(3);
    }
  });

  it('gives each faction exactly two superweapons', () => {
    for (const f of FACTIONS) {
      expect(POWERS.filter((p) => p.faction === f.id)).toHaveLength(2);
    }
  });

  it('covers the full warhead x armor damage matrix with sane values', () => {
    const armors: ArmorType[] = [
      'none', 'flak', 'plate', 'light', 'medium', 'heavy', 'wood', 'steel', 'concrete',
    ];
    for (const [warhead, row] of Object.entries(DAMAGE_MATRIX)) {
      for (const a of armors) {
        const v = row[a];
        expect(v, `${warhead} vs ${a}`).toBeGreaterThan(0);
        expect(v, `${warhead} vs ${a}`).toBeLessThanOrEqual(5);
      }
    }
    // rock-paper-scissors sanity
    const m = DAMAGE_MATRIX as Record<WarheadType, Record<ArmorType, number>>;
    expect(m.sa.none).toBeGreaterThan(m.sa.heavy); // rifles poor vs tanks
    expect(m.ap.medium).toBeGreaterThan(m.ap.none); // AP built for armor
    expect(m.flakhead.flak).toBeGreaterThan(m.flakhead.heavy); // flak owns the sky
    expect(m.he.wood).toBeGreaterThan(m.he.heavy); // HE cracks buildings
  });

  it('gives every weapon positive damage, range and rof', () => {
    for (const w of WEAPONS) {
      expect(w.damage, w.id).toBeGreaterThan(0);
      expect(w.range, w.id).toBeGreaterThan(0);
      expect(w.rof, w.id).toBeGreaterThan(0);
      expect(w.antiAir || w.antiGround, w.id).toBe(true);
    }
  });
});
