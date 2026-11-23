import type { Point } from './geometry';

export const MIN_ZOOM = 0.02;
export const MAX_ZOOM = 64;

/**
 * Position de la toile à l'écran : écran = translation(x, y) · rotation · zoom · document.
 * Coordonnées écran en pixels CSS, relatives à l'élément canvas.
 */
export class ViewTransform {
  zoom = 1;
  /** radians */
  rotation = 0;
  x = 0;
  y = 0;

  clone(): ViewTransform {
    return Object.assign(new ViewTransform(), this);
  }

  /** Matrice 2×3 [a, b, c, d, e, f] compatible avec ctx.setTransform. */
  matrix(): [number, number, number, number, number, number] {
    const cos = Math.cos(this.rotation) * this.zoom;
    const sin = Math.sin(this.rotation) * this.zoom;
    return [cos, sin, -sin, cos, this.x, this.y];
  }

  toScreen(p: Point): Point {
    const [a, b, c, d, e, f] = this.matrix();
    return { x: a * p.x + c * p.y + e, y: b * p.x + d * p.y + f };
  }

  toDoc(p: Point): Point {
    const dx = p.x - this.x;
    const dy = p.y - this.y;
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    return { x: (cos * dx + sin * dy) / this.zoom, y: (-sin * dx + cos * dy) / this.zoom };
  }

  /** Ajuste la translation pour que le point `doc` du document soit sous le point `screen`. */
  anchor(doc: Point, screen: Point): void {
    this.x = 0;
    this.y = 0;
    const s = this.toScreen(doc);
    this.x = screen.x - s.x;
    this.y = screen.y - s.y;
  }

  panBy(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
  }

  setZoomAt(zoom: number, screen: Point): void {
    const doc = this.toDoc(screen);
    this.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
    this.anchor(doc, screen);
  }

  zoomAt(factor: number, screen: Point): void {
    this.setZoomAt(this.zoom * factor, screen);
  }

  setRotationAt(rotation: number, screen: Point): void {
    const doc = this.toDoc(screen);
    this.rotation = normalizeAngle(rotation);
    this.anchor(doc, screen);
  }

  rotateAt(delta: number, screen: Point): void {
    this.setRotationAt(this.rotation + delta, screen);
  }

  /** Centre le document dans la vue, sans rotation, avec une marge. */
  fit(docW: number, docH: number, viewW: number, viewH: number, margin = 24): void {
    const zoom = Math.min((viewW - margin * 2) / docW, (viewH - margin * 2) / docH);
    this.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
    this.rotation = 0;
    this.anchor({ x: docW / 2, y: docH / 2 }, { x: viewW / 2, y: viewH / 2 });
  }

  /**
   * Geste à deux doigts : les points du document qui étaient sous les doigts au début
   * du geste (s0, s1) suivent les doigts (p0, p1) → zoom, rotation et déplacement en même temps.
   */
  applyGesture(start: ViewTransform, s0: Point, s1: Point, p0: Point, p1: Point): void {
    const startDist = Math.hypot(s1.x - s0.x, s1.y - s0.y) || 1;
    const dist = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1;
    const startAngle = Math.atan2(s1.y - s0.y, s1.x - s0.x);
    const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    const startMid = { x: (s0.x + s1.x) / 2, y: (s0.y + s1.y) / 2 };
    const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
    const docMid = start.toDoc(startMid);
    this.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, start.zoom * (dist / startDist)));
    this.rotation = normalizeAngle(start.rotation + angle - startAngle);
    this.anchor(docMid, mid);
  }
}

/** Ramène un angle dans ]-π, π]. */
export function normalizeAngle(a: number): number {
  const t = Math.PI * 2;
  let r = ((a % t) + t) % t;
  if (r > Math.PI) r -= t;
  return r;
}
