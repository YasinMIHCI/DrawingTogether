import { describe, expect, it } from 'vitest';
import { StrokeSampler } from '../src/engine/brush/sampler';
import { DEFAULT_BRUSH } from '../src/engine/brush/settings';

describe('StrokeSampler', () => {
  it('places dabs at regular spacing along a line', () => {
    const s = new StrokeSampler({ ...DEFAULT_BRUSH, size: 10, spacing: 0.5, smoothing: 0, pressureSize: false });
    const dabs = [...s.begin({ x: 0, y: 0, pressure: 1 }), ...s.add({ x: 100, y: 0, pressure: 1 }), ...s.end()];
    expect(dabs.length).toBe(21); // 0, 5, 10 … 100
    for (let i = 1; i < dabs.length; i++) expect(dabs[i].x - dabs[i - 1].x).toBeCloseTo(5);
  });

  it('scales size with pressure', () => {
    const s = new StrokeSampler({ ...DEFAULT_BRUSH, size: 20, minSize: 0, pressureSize: true });
    expect(s.dab(0, 0, 0.5).size).toBeCloseTo(10);
    expect(s.dab(0, 0, 1).size).toBeCloseTo(20);
  });

  it('smoothing lags behind, then catches up at the end', () => {
    const s = new StrokeSampler({ ...DEFAULT_BRUSH, size: 4, spacing: 0.25, smoothing: 0.8, pressureSize: false });
    s.begin({ x: 0, y: 0, pressure: 1 });
    const mid = s.add({ x: 100, y: 0, pressure: 1 });
    expect(mid[mid.length - 1].x).toBeLessThan(30);
    const end = s.end();
    expect(end[end.length - 1].x).toBeGreaterThan(98);
  });
});
