import { describe, expect, it } from 'vitest';
import { dilate, floodMask, maskBounds } from '../src/engine/tools/fill';

/** Image 5×5 transparente avec une ligne verticale noire en x = 2. */
function image(): Uint8ClampedArray {
  const w = 5;
  const d = new Uint8ClampedArray(w * w * 4);
  for (let y = 0; y < w; y++) d.set([0, 0, 0, 255], (y * w + 2) * 4);
  return d;
}

describe('flood fill', () => {
  it('fills only the connected area, stopping at lines', () => {
    const mask = floodMask(image(), 5, 5, 0, 0, 10)!;
    expect(mask.reduce((a, b) => a + b, 0)).toBe(10); // colonnes 0 et 1
    expect(maskBounds(mask, 5, 5)).toEqual({ x: 0, y: 0, w: 2, h: 5 });
  });

  it('fills the line itself when clicking on it', () => {
    const mask = floodMask(image(), 5, 5, 2, 2, 10)!;
    expect(maskBounds(mask, 5, 5)).toEqual({ x: 2, y: 0, w: 1, h: 5 });
  });

  it('tolerance lets similar colors through', () => {
    const d = image();
    for (let y = 0; y < 5; y++) d.set([0, 0, 0, 20], (y * 5 + 2) * 4); // ligne presque transparente
    expect(floodMask(d, 5, 5, 0, 0, 10)!.reduce((a, b) => a + b, 0)).toBe(10);
    expect(floodMask(d, 5, 5, 0, 0, 30)!.reduce((a, b) => a + b, 0)).toBe(25);
  });

  it('dilates the mask', () => {
    const mask = floodMask(image(), 5, 5, 0, 0, 10)!;
    expect(maskBounds(dilate(mask, 5, 5, 1), 5, 5)).toEqual({ x: 0, y: 0, w: 3, h: 5 });
  });

  it('returns null outside the image', () => {
    expect(floodMask(image(), 5, 5, -1, 0, 0)).toBeNull();
  });
});
