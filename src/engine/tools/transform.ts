import type { Point, Rect } from '../geometry';

/**
 * Contenu flottant en cours de transformation : rectangle source (bx, by, bw, bh)
 * placé avec un centre, une échelle (négative = retourné) et un angle.
 */
export interface TransformState {
  bx: number;
  by: number;
  bw: number;
  bh: number;
  cx: number;
  cy: number;
  sx: number;
  sy: number;
  angle: number;
}

export type Matrix = [number, number, number, number, number, number];

export function initialTransform(r: Rect): TransformState {
  return { bx: r.x, by: r.y, bw: r.w, bh: r.h, cx: r.x + r.w / 2, cy: r.y + r.h / 2, sx: 1, sy: 1, angle: 0 };
}

/** Matrice qui envoie les coordonnées locales (0..bw, 0..bh) vers le document. */
export function transformMatrix(t: TransformState): Matrix {
  const cos = Math.cos(t.angle);
  const sin = Math.sin(t.angle);
  const a = cos * t.sx;
  const b = sin * t.sx;
  const c = -sin * t.sy;
  const d = cos * t.sy;
  return [a, b, c, d, t.cx - a * (t.bw / 2) - c * (t.bh / 2), t.cy - b * (t.bw / 2) - d * (t.bh / 2)];
}

export function applyMatrix(m: Matrix, p: Point): Point {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
}

/** Coins dans l'ordre : haut-gauche, haut-droit, bas-droit, bas-gauche (repère local). */
export function corners(t: TransformState): Point[] {
  const m = transformMatrix(t);
  return [
    { x: 0, y: 0 },
    { x: t.bw, y: 0 },
    { x: t.bw, y: t.bh },
    { x: 0, y: t.bh },
  ].map((p) => applyMatrix(m, p));
}

export function transformedBounds(t: TransformState): Rect {
  const c = corners(t);
  const xs = c.map((p) => p.x);
  const ys = c.map((p) => p.y);
  const x = Math.floor(Math.min(...xs)) - 2;
  const y = Math.floor(Math.min(...ys)) - 2;
  return { x, y, w: Math.ceil(Math.max(...xs)) + 2 - x, h: Math.ceil(Math.max(...ys)) + 2 - y };
}

/** Poignées de redimensionnement : position relative (-1, 0, 1) sur chaque axe. */
export const HANDLES: [number, number][] = [
  [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0],
];

export function handlePoint(t: TransformState, hx: number, hy: number): Point {
  return applyMatrix(transformMatrix(t), { x: ((hx + 1) / 2) * t.bw, y: ((hy + 1) / 2) * t.bh });
}

/**
 * Redimensionnement en tirant la poignée (hx, hy) jusqu'au point `p` (document),
 * le côté ou coin opposé restant fixe. `proportional` garde les proportions (coins).
 */
export function dragHandle(start: TransformState, hx: number, hy: number, p: Point, proportional: boolean): TransformState {
  const cos = Math.cos(start.angle);
  const sin = Math.sin(start.angle);
  const vx = p.x - start.cx;
  const vy = p.y - start.cy;
  const lx = cos * vx + sin * vy;
  const ly = -sin * vx + cos * vy;
  const ex = (Math.abs(start.sx) * start.bw) / 2;
  const ey = (Math.abs(start.sy) * start.bh) / 2;
  let nex = hx ? Math.max(0.5, (hx * lx + ex) / 2) : ex;
  let ney = hy ? Math.max(0.5, (hy * ly + ey) / 2) : ey;
  if (proportional && hx && hy) {
    const k = Math.max(nex / ex, ney / ey);
    nex = ex * k;
    ney = ey * k;
  }
  const clx = hx ? -hx * ex + hx * nex : 0;
  const cly = hy ? -hy * ey + hy * ney : 0;
  return {
    ...start,
    cx: start.cx + cos * clx - sin * cly,
    cy: start.cy + sin * clx + cos * cly,
    sx: Math.sign(start.sx) * ((nex * 2) / start.bw),
    sy: Math.sign(start.sy) * ((ney * 2) / start.bh),
  };
}

/** Point dans le quadrilatère (convexe) des coins. */
export function insideTransform(t: TransformState, p: Point): boolean {
  const c = corners(t);
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = c[i];
    const b = c[(i + 1) % 4];
    const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
    if (cross !== 0) {
      if (sign && Math.sign(cross) !== sign) return false;
      sign = Math.sign(cross);
    }
  }
  return true;
}
