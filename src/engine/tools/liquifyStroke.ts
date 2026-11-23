import { createSurface, type Surface } from '../canvas';
import { PixelPatch } from '../commands';
import { clampRect, unionRect, type Point, type Rect } from '../geometry';
import type { Layer } from '../layers';
import { clipToSelection, TempSurface } from '../selection';
import { liquify, type LiquifyOptions } from './liquify';

/** Un geste de l'outil Liquéfier : déformations successives le long du trajet. */
export class LiquifyStroke {
  private snapshot: Surface | null = null;
  private layer: Layer | null = null;
  private opts: LiquifyOptions | null = null;
  private selection: HTMLCanvasElement | null = null;
  private last: Point | null = null;
  private total: Rect | null = null;
  private tmp = new TempSurface();

  constructor(private readonly width: number, private readonly height: number) {}

  get active(): boolean {
    return this.layer !== null;
  }

  begin(layer: Layer, opts: LiquifyOptions, p: Point, selection: HTMLCanvasElement | null): void {
    this.snapshot ??= createSurface(this.width, this.height);
    this.snapshot.ctx.clearRect(0, 0, this.width, this.height);
    this.snapshot.ctx.drawImage(layer.surface.canvas, 0, 0);
    this.layer = layer;
    this.opts = { ...opts };
    this.selection = selection;
    this.last = p;
    this.total = null;
    if (opts.mode !== 'push') this.dab(p, 0, 0);
  }

  move(p: Point): void {
    if (!this.last || !this.opts) return;
    const step = Math.max(1, this.opts.size * 0.1);
    let from = this.last;
    let dist = Math.hypot(p.x - from.x, p.y - from.y);
    while (dist >= step) {
      const k = step / dist;
      const next = { x: from.x + (p.x - from.x) * k, y: from.y + (p.y - from.y) * k };
      this.dab(next, next.x - from.x, next.y - from.y);
      from = next;
      dist -= step;
    }
    this.last = from;
  }

  private dab(p: Point, dx: number, dy: number): void {
    const o = this.opts!;
    const ctx = this.layer!.surface.ctx;
    const half = o.size / 2 + 2;
    const r = clampRect({ x: p.x - half, y: p.y - half, w: half * 2, h: half * 2 }, this.width, this.height);
    if (!r) return;
    const src = ctx.getImageData(r.x, r.y, r.w, r.h);
    const out = ctx.createImageData(r.w, r.h);
    liquify(src.data, out.data, r.w, r.h, p.x - r.x, p.y - r.y, o, dx, dy);
    ctx.putImageData(out, r.x, r.y);
    if (this.selection) clipToSelection(ctx, this.snapshot!.canvas, this.selection, r, this.tmp.get(r.w, r.h));
    this.total = unionRect(this.total, r);
  }

  end(): PixelPatch | null {
    const layer = this.layer;
    const r = this.total;
    this.layer = null;
    if (!layer || !r) return null;
    const before = this.snapshot!.ctx.getImageData(r.x, r.y, r.w, r.h);
    const after = layer.surface.ctx.getImageData(r.x, r.y, r.w, r.h);
    return new PixelPatch('liquify', layer, r, before, after);
  }

  cancel(): void {
    const layer = this.layer;
    const r = this.total;
    this.layer = null;
    if (!layer || !r) return;
    layer.surface.ctx.clearRect(r.x, r.y, r.w, r.h);
    layer.surface.ctx.drawImage(this.snapshot!.canvas, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
  }
}
