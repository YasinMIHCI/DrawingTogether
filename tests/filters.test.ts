import { describe, expect, it } from 'vitest';
import { applyFilter, defaultParams, FILTERS, type FilterKind } from '../src/engine/tools/filters';
import { liquify } from '../src/engine/tools/liquify';

const px = (...v: number[]) => Uint8ClampedArray.from(v);

describe('filters', () => {
  it('inverts and converts to grayscale, keeping alpha', () => {
    const out = new Uint8ClampedArray(4);
    applyFilter('invert', px(10, 20, 30, 128), out, 1, 1, {});
    expect([...out]).toEqual([245, 235, 225, 128]);
    applyFilter('grayscale', px(255, 0, 0, 255), out, 1, 1, {});
    expect(out[0]).toBe(out[1]);
    expect(out[1]).toBe(out[2]);
  });

  it('default parameters leave brightness/contrast and hue/saturation unchanged', () => {
    const src = px(12, 130, 250, 255);
    const out = new Uint8ClampedArray(4);
    for (const k of ['brightnessContrast', 'hueSaturation'] as FilterKind[]) {
      applyFilter(k, src, out, 1, 1, defaultParams(k));
      for (let i = 0; i < 4; i++) expect(Math.abs(out[i] - src[i])).toBeLessThanOrEqual(1);
    }
  });

  it('blur keeps a uniform image uniform', () => {
    const w = 8, h = 8;
    const src = new Uint8ClampedArray(w * h * 4).fill(200);
    const out = new Uint8ClampedArray(src.length);
    applyFilter('blur', src, out, w, h, { radius: 3 });
    for (const v of out) expect(Math.abs(v - 200)).toBeLessThanOrEqual(1);
  });

  it('every filter runs on a small image', () => {
    const w = 6, h = 5;
    const src = new Uint8ClampedArray(w * h * 4).map((_, i) => (i * 37) % 256);
    for (const k of Object.keys(FILTERS) as FilterKind[]) {
      const out = new Uint8ClampedArray(src.length);
      applyFilter(k, src, out, w, h, defaultParams(k));
      expect(out.some((v) => v > 0)).toBe(true);
    }
  });

  it('liquify with zero strength changes nothing', () => {
    const w = 10, h = 10;
    const src = new Uint8ClampedArray(w * h * 4).map((_, i) => (i * 13) % 256 | 0);
    for (let i = 3; i < src.length; i += 4) src[i] = 255;
    const out = new Uint8ClampedArray(src.length);
    liquify(src, out, w, h, 5, 5, { mode: 'push', size: 8, strength: 0 }, 3, 0);
    expect([...out]).toEqual([...src]);
  });
});
