import { describe, expect, it } from 'vitest';
import { combineMasks, maskBoundsOf, outlineSegments } from '../src/engine/selection';

const m = (...v: number[]) => Uint8Array.from(v);

describe('selection masks', () => {
  it('combines with add / subtract / intersect / replace', () => {
    const a = m(1, 1, 0, 0);
    const b = m(0, 1, 1, 0);
    expect([...combineMasks(a, b, 'add')]).toEqual([1, 1, 1, 0]);
    expect([...combineMasks(a, b, 'subtract')]).toEqual([1, 0, 0, 0]);
    expect([...combineMasks(a, b, 'intersect')]).toEqual([0, 1, 0, 0]);
    expect([...combineMasks(a, b, 'replace')]).toEqual([0, 1, 1, 0]);
    expect([...combineMasks(null, b, 'subtract')]).toEqual([0, 1, 1, 0]);
  });

  it('computes bounds and a merged outline', () => {
    // 4×3, rectangle 2×2 en (1,1)
    const mask = m(0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 0);
    expect(maskBoundsOf(mask, 4, 3)).toEqual({ x: 1, y: 1, w: 2, h: 2 });
    // 4 côtés, chacun fusionné en un seul segment
    expect(outlineSegments(mask, 4, 3)).toEqual([1, 1, 3, 1, 1, 3, 3, 3, 1, 1, 1, 3, 3, 1, 3, 3]);
  });
});
