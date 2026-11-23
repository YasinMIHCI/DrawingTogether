import { createSurface, type Surface } from '../canvas';
import { PixelPatch } from '../commands';
import { clampRect, unionRect, type Rect } from '../geometry';
import type { Layer } from '../layers';

/**
 * Modification réversible d'un calque avec aperçu en direct (formes) :
 * chaque mise à jour restaure la zone précédente depuis une copie, puis redessine.
 */
export class LiveEdit {
  private snapshot: Surface | null = null;
  private layer: Layer | null = null;
  private prev: Rect | null = null;
  private total: Rect | null = null;

  constructor(private readonly width: number, private readonly height: number) {}

  get active(): boolean {
    return this.layer !== null;
  }

  begin(layer: Layer): void {
    this.snapshot ??= createSurface(this.width, this.height);
    this.snapshot.ctx.clearRect(0, 0, this.width, this.height);
    this.snapshot.ctx.drawImage(layer.surface.canvas, 0, 0);
    this.layer = layer;
    this.prev = null;
    this.total = null;
  }

  /** Redessine : `rect` = zone que `draw` va toucher. */
  update(rect: Rect | null, draw: (ctx: CanvasRenderingContext2D) => void): void {
    if (!this.layer) return;
    this.restore(this.prev);
    const r = rect && clampRect(rect, this.width, this.height);
    if (r) {
      const ctx = this.layer.surface.ctx;
      ctx.save();
      draw(ctx);
      ctx.restore();
    }
    this.prev = r;
    this.total = unionRect(this.total, r);
  }

  commit(label: string): PixelPatch | null {
    const layer = this.layer;
    const r = this.prev;
    this.layer = null;
    if (!layer || !r || !this.snapshot) return null;
    const before = this.snapshot.ctx.getImageData(r.x, r.y, r.w, r.h);
    const after = layer.surface.ctx.getImageData(r.x, r.y, r.w, r.h);
    return new PixelPatch(label, layer, r, before, after);
  }

  cancel(): void {
    this.restore(this.prev);
    this.layer = null;
  }

  private restore(r: Rect | null): void {
    if (!r || !this.layer || !this.snapshot) return;
    const ctx = this.layer.surface.ctx;
    ctx.clearRect(r.x, r.y, r.w, r.h);
    ctx.drawImage(this.snapshot.canvas, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
  }
}
