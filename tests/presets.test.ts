import { describe, expect, it } from 'vitest';
import { BRUSH_CATEGORIES, BRUSH_PRESETS } from '../src/engine/brush/presets';
import { fr } from '../src/lib/i18n/fr';
import { constrain } from '../src/engine/tools/shapes';

describe('brush presets', () => {
  it('have unique ids, a translated name and a known category', () => {
    const ids = BRUSH_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of BRUSH_PRESETS) {
      expect(fr).toHaveProperty(`brushes.${p.id}`);
      expect(BRUSH_CATEGORIES).toContain(p.category);
    }
  });

  it('every category has brushes, erasers erase', () => {
    for (const c of BRUSH_CATEGORIES) expect(BRUSH_PRESETS.some((p) => p.category === c)).toBe(true);
    for (const p of BRUSH_PRESETS.filter((p) => p.category === 'eraser')) expect(p.settings.mode).toBe('erase');
  });
});

describe('shape constraints', () => {
  it('snaps lines to 45° and rectangles to squares', () => {
    const l = constrain('line', { x: 0, y: 0 }, { x: 10, y: 1 });
    expect(l.y).toBeCloseTo(0);
    const r = constrain('rect', { x: 0, y: 0 }, { x: 10, y: -4 });
    expect(r).toEqual({ x: 10, y: -10 });
  });
});
