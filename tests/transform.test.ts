import { describe, expect, it } from 'vitest';
import { corners, dragHandle, initialTransform, insideTransform, transformedBounds } from '../src/engine/tools/transform';

describe('transform', () => {
  const start = initialTransform({ x: 10, y: 20, w: 100, h: 50 });

  it('starts as identity on the source rectangle', () => {
    const c = corners(start);
    expect(c[0].x).toBeCloseTo(10);
    expect(c[0].y).toBeCloseTo(20);
    expect(c[2].x).toBeCloseTo(110);
    expect(c[2].y).toBeCloseTo(70);
  });

  it('dragging the right edge keeps the left edge fixed', () => {
    const t = dragHandle(start, 1, 0, { x: 210, y: 45 }, false);
    const c = corners(t);
    expect(c[0].x).toBeCloseTo(10);
    expect(c[1].x).toBeCloseTo(210);
    expect(t.sx).toBeCloseTo(2);
    expect(t.sy).toBeCloseTo(1);
  });

  it('proportional corner drag scales both axes', () => {
    const t = dragHandle(start, 1, 1, { x: 210, y: 70 }, true);
    expect(t.sx).toBeCloseTo(2);
    expect(t.sy).toBeCloseTo(2);
    expect(corners(t)[0].x).toBeCloseTo(10);
    expect(corners(t)[0].y).toBeCloseTo(20);
  });

  it('works when rotated and detects inside points', () => {
    const r = { ...start, angle: Math.PI / 2 };
    expect(insideTransform(r, { x: 60, y: 45 })).toBe(true);
    expect(insideTransform(r, { x: 0, y: 0 })).toBe(false);
    const b = transformedBounds(r);
    expect(b.w).toBeGreaterThanOrEqual(50);
    expect(b.h).toBeGreaterThanOrEqual(100);
  });
});
