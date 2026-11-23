import type { Point, Rect } from '../geometry';

export type ShapeKind = 'line' | 'rect' | 'ellipse' | 'polygon';

export interface ShapeOptions {
  kind: ShapeKind;
  /** true = forme pleine, false = contour */
  fill: boolean;
  /** Épaisseur du contour en pixels du document. */
  width: number;
}

/** Contrainte Maj : ligne à 45°, carré, cercle. */
export function constrain(kind: ShapeKind, a: Point, b: Point): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (kind === 'line' || kind === 'polygon') {
    const step = Math.PI / 4;
    const ang = Math.round(Math.atan2(dy, dx) / step) * step;
    const len = Math.hypot(dx, dy);
    return { x: a.x + Math.cos(ang) * len, y: a.y + Math.sin(ang) * len };
  }
  const s = Math.max(Math.abs(dx), Math.abs(dy));
  return { x: a.x + Math.sign(dx || 1) * s, y: a.y + Math.sign(dy || 1) * s };
}

export function shapeBounds(points: Point[], width: number): Rect {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const pad = width / 2 + 2;
  const x = Math.min(...xs) - pad;
  const y = Math.min(...ys) - pad;
  return { x, y, w: Math.max(...xs) + pad - x, h: Math.max(...ys) + pad - y };
}

/** Trace la forme (points : 2 pour ligne/rectangle/ellipse, n pour polygone). */
export function drawShape(
  ctx: CanvasRenderingContext2D,
  opts: ShapeOptions,
  points: Point[],
  color: string,
  closed = true,
): void {
  if (points.length < 2) return;
  const [a, b] = points;
  ctx.beginPath();
  switch (opts.kind) {
    case 'line':
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      break;
    case 'rect':
      ctx.rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      break;
    case 'ellipse':
      ctx.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2, 0, 0, Math.PI * 2);
      break;
    case 'polygon':
      ctx.moveTo(a.x, a.y);
      for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
      if (closed) ctx.closePath();
      break;
  }
  const fill = opts.fill && opts.kind !== 'line' && closed;
  if (fill) {
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = opts.width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}
