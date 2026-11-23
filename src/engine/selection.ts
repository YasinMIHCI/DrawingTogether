import { createSurface, type Surface } from './canvas';
import type { Point, Rect } from './geometry';
import type { Command } from './history';

export type SelectMode = 'replace' | 'add' | 'subtract' | 'intersect';

/** Combine un nouveau masque avec la sélection existante. */
export function combineMasks(current: Uint8Array | null, next: Uint8Array, mode: SelectMode): Uint8Array {
  if (!current || mode === 'replace') return next;
  const out = new Uint8Array(next.length);
  for (let i = 0; i < next.length; i++) {
    const a = current[i];
    const b = next[i];
    out[i] = mode === 'add' ? a | b : mode === 'subtract' ? a & (b ^ 1) : a & b;
  }
  return out;
}

export function maskIsEmpty(mask: Uint8Array): boolean {
  for (let i = 0; i < mask.length; i++) if (mask[i]) return false;
  return true;
}

/**
 * Contour d'un masque : segments [x1, y1, x2, y2, …] sur les bords des pixels,
 * les segments alignés consécutifs étant fusionnés.
 */
export function outlineSegments(mask: Uint8Array, w: number, h: number): number[] {
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < w && y < h ? mask[y * w + x] : 0);
  const out: number[] = [];
  for (let y = 0; y <= h; y++) {
    let start = -1;
    for (let x = 0; x <= w; x++) {
      const edge = x < w && at(x, y - 1) !== at(x, y);
      if (edge && start < 0) start = x;
      if (!edge && start >= 0) {
        out.push(start, y, x, y);
        start = -1;
      }
    }
  }
  for (let x = 0; x <= w; x++) {
    let start = -1;
    for (let y = 0; y <= h; y++) {
      const edge = y < h && at(x - 1, y) !== at(x, y);
      if (edge && start < 0) start = y;
      if (!edge && start >= 0) {
        out.push(x, start, x, y);
        start = -1;
      }
    }
  }
  return out;
}

export function maskBoundsOf(mask: Uint8Array, w: number, h: number): Rect | null {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (!mask[row + x]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      y1 = y;
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Rastérise une forme (tracée par `draw`) en masque binaire. */
export function rasterMask(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): Uint8Array {
  const s = createSurface(w, h);
  s.ctx.fillStyle = '#fff';
  draw(s.ctx);
  const data = s.ctx.getImageData(0, 0, w, h).data;
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i++) mask[i] = data[i * 4 + 3] >= 128 ? 1 : 0;
  return mask;
}

export function polygonMask(points: Point[], w: number, h: number): Uint8Array {
  return rasterMask(w, h, (ctx) => {
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fill();
  });
}

/** Sélection du document : masque binaire + canvas alpha (pour découper) + contour (pour l'affichage). */
export class Selection {
  mask: Uint8Array | null = null;
  bounds: Rect | null = null;
  segments: number[] = [];
  private surface: Surface | null = null;

  constructor(readonly width: number, readonly height: number) {}

  get active(): boolean {
    return this.mask !== null;
  }

  /** Canvas dont l'alpha vaut 255 dans la sélection (null si rien n'est sélectionné). */
  get canvas(): HTMLCanvasElement | null {
    return this.mask ? this.surface!.canvas : null;
  }

  copyMask(): Uint8Array | null {
    return this.mask ? this.mask.slice() : null;
  }

  set(mask: Uint8Array | null): void {
    if (!mask || maskIsEmpty(mask)) {
      this.mask = null;
      this.bounds = null;
      this.segments = [];
      return;
    }
    const { width: w, height: h } = this;
    this.mask = mask;
    this.bounds = maskBoundsOf(mask, w, h);
    this.segments = outlineSegments(mask, w, h);
    this.surface ??= createSurface(w, h);
    const img = this.surface.ctx.createImageData(w, h);
    for (let i = 0; i < mask.length; i++) {
      if (mask[i]) img.data[i * 4 + 3] = 255;
    }
    this.surface.ctx.putImageData(img, 0, 0);
  }

  isSelected(x: number, y: number): boolean {
    if (!this.mask) return true;
    x = Math.floor(x);
    y = Math.floor(y);
    return x >= 0 && y >= 0 && x < this.width && y < this.height && this.mask[y * this.width + x] === 1;
  }
}

export class SelectionChange implements Command {
  readonly label = 'selection';
  readonly bytes: number;
  constructor(
    private readonly sel: Selection,
    private readonly before: Uint8Array | null,
    private readonly after: Uint8Array | null,
  ) {
    this.bytes = (before?.length ?? 0) + (after?.length ?? 0) + 64;
  }
  undo(): void {
    this.sel.set(this.before);
  }
  redo(): void {
    this.sel.set(this.after);
  }
}

/**
 * Limite une modification à la sélection : dans la zone `r`,
 * calque = calque × sélection + original × (1 − sélection).
 */
export function clipToSelection(
  ctx: CanvasRenderingContext2D,
  original: CanvasImageSource,
  selection: HTMLCanvasElement,
  r: Rect,
  tmp: Surface,
): void {
  const t = tmp.ctx;
  t.clearRect(0, 0, r.w, r.h);
  t.drawImage(original, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
  t.globalCompositeOperation = 'destination-out';
  t.drawImage(selection, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
  t.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(selection, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(tmp.canvas, 0, 0, r.w, r.h, r.x, r.y, r.w, r.h);
  ctx.restore();
}

/** Surface temporaire réutilisable, agrandie à la demande. */
export class TempSurface {
  private s: Surface | null = null;
  get(w: number, h: number): Surface {
    if (!this.s || this.s.canvas.width < w || this.s.canvas.height < h) {
      this.s = createSurface(Math.max(w, this.s?.canvas.width ?? 0), Math.max(h, this.s?.canvas.height ?? 0));
    }
    this.s.ctx.clearRect(0, 0, w, h);
    return this.s;
  }
}
