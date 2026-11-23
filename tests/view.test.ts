import { describe, expect, it } from 'vitest';
import { ViewTransform, normalizeAngle } from '../src/engine/view';

const close = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  expect(a.x).toBeCloseTo(b.x, 6);
  expect(a.y).toBeCloseTo(b.y, 6);
};

describe('ViewTransform', () => {
  it('round-trips screen ↔ document with zoom, rotation and pan', () => {
    const v = new ViewTransform();
    v.zoom = 2.5;
    v.rotation = 0.7;
    v.x = 120;
    v.y = -40;
    const p = { x: 33, y: 77 };
    close(v.toDoc(v.toScreen(p)), p);
  });

  it('keeps the point under the cursor fixed when zooming and rotating', () => {
    const v = new ViewTransform();
    const at = { x: 300, y: 200 };
    const doc = v.toDoc(at);
    v.zoomAt(3, at);
    close(v.toScreen(doc), at);
    v.rotateAt(1.2, at);
    close(v.toScreen(doc), at);
  });

  it('fits the document centered in the view', () => {
    const v = new ViewTransform();
    v.fit(1000, 500, 800, 600, 0);
    expect(v.zoom).toBeCloseTo(0.8);
    close(v.toScreen({ x: 500, y: 250 }), { x: 400, y: 300 });
  });

  it('two-finger gesture: document follows the fingers', () => {
    const start = new ViewTransform();
    const v = start.clone();
    const s0 = { x: 100, y: 100 };
    const s1 = { x: 200, y: 100 };
    // Les doigts s'écartent ×2, tournent de 90° et se déplacent
    const p0 = { x: 400, y: 300 };
    const p1 = { x: 400, y: 500 };
    v.applyGesture(start, s0, s1, p0, p1);
    expect(v.zoom).toBeCloseTo(2);
    expect(v.rotation).toBeCloseTo(Math.PI / 2);
    close(v.toScreen(start.toDoc(s0)), p0);
    close(v.toScreen(start.toDoc(s1)), p1);
  });

  it('normalizes angles', () => {
    expect(normalizeAngle(Math.PI * 3)).toBeCloseTo(Math.PI);
    expect(normalizeAngle(-Math.PI / 2)).toBeCloseTo(-Math.PI / 2);
  });
});
