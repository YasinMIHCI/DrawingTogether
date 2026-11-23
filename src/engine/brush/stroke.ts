import { createSurface, type Surface } from '../canvas';
import { clampRect, unionRect, type Rect } from '../geometry';
import type { Layer } from '../layers';
import { PixelPatch } from '../commands';
import { StrokeSampler, type Dab, type InputPoint } from './sampler';
import type { BrushSettings } from './settings';
import { getStamp } from './stamp';

/**
 * Dessine un trait sur un calque.
 * Les tampons vont dans un tampon de trait ; le calque est recomposé à partir d'une copie
 * prise au début du trait : l'opacité du trait reste uniforme et l'annulation est exacte.
 */
export class StrokeRenderer {
  private buffer: Surface;
  private snapshot: Surface;
  private layer: Layer | null = null;
  private settings: BrushSettings | null = null;
  private sampler: StrokeSampler | null = null;
  private pending: Rect | null = null;
  private total: Rect | null = null;

  constructor(private readonly width: number, private readonly height: number) {
    this.buffer = createSurface(width, height);
    this.snapshot = createSurface(width, height);
  }

  get active(): boolean {
    return this.layer !== null;
  }

  begin(layer: Layer, settings: BrushSettings, p: InputPoint): void {
    this.layer = layer;
    this.settings = { ...settings };
    this.sampler = new StrokeSampler(this.settings);
    this.buffer.ctx.clearRect(0, 0, this.width, this.height);
    const snap = this.snapshot.ctx;
    snap.clearRect(0, 0, this.width, this.height);
    snap.drawImage(layer.surface.canvas, 0, 0);
    this.pending = null;
    this.total = null;
    this.drawDabs(this.sampler.begin(p));
  }

  add(points: InputPoint[]): void {
    if (!this.sampler) return;
    for (const p of points) this.drawDabs(this.sampler.add(p));
  }

  /** Applique au calque les zones modifiées depuis le dernier appel. */
  flush(): Rect | null {
    const r = this.pending;
    if (!r || !this.layer || !this.settings) return null;
    this.pending = null;
    const ctx = this.layer.surface.ctx;
    ctx.save();
    ctx.clearRect(r.x, r.y, r.w, r.h);
    ctx.drawImage(this.snapshot.canvas, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
    ctx.globalAlpha = this.settings.opacity;
    ctx.globalCompositeOperation = this.settings.eraser ? 'destination-out' : 'source-over';
    ctx.drawImage(this.buffer.canvas, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
    ctx.restore();
    return r;
  }

  /** Termine le trait et renvoie la commande d'annulation (null si rien n'a été dessiné). */
  end(): PixelPatch | null {
    if (!this.sampler || !this.layer) return null;
    this.drawDabs(this.sampler.end());
    this.flush();
    const layer = this.layer;
    const r = this.total;
    this.reset();
    if (!r) return null;
    const before = this.snapshot.ctx.getImageData(r.x, r.y, r.w, r.h);
    const after = layer.surface.ctx.getImageData(r.x, r.y, r.w, r.h);
    return new PixelPatch('stroke', layer, r, before, after);
  }

  /** Annule le trait en cours (ex. le 2e doigt arrive : c'était un geste, pas un trait). */
  cancel(): void {
    const r = this.total;
    const layer = this.layer;
    this.reset();
    if (!r || !layer) return;
    const ctx = layer.surface.ctx;
    ctx.clearRect(r.x, r.y, r.w, r.h);
    ctx.drawImage(this.snapshot.canvas, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
  }

  private reset(): void {
    this.layer = null;
    this.sampler = null;
    this.pending = null;
    this.total = null;
  }

  private drawDabs(dabs: Dab[]): void {
    if (!dabs.length || !this.settings) return;
    const s = this.settings;
    const ctx = this.buffer.ctx;
    for (const d of dabs) {
      // Traits très fins : on garde 1 px et on réduit la densité, sinon le trait disparaît.
      const size = Math.max(1, d.size);
      const alpha = d.alpha * Math.min(1, d.size);
      const stamp = getStamp(s.eraser ? '#000000' : s.color, s.hardness, size);
      ctx.globalAlpha = alpha;
      ctx.drawImage(stamp.canvas, d.x - size / 2, d.y - size / 2, size, size);
      const r = clampRect({ x: d.x - size / 2 - 1, y: d.y - size / 2 - 1, w: size + 2, h: size + 2 }, this.width, this.height);
      this.pending = unionRect(this.pending, r);
      this.total = unionRect(this.total, r);
    }
    ctx.globalAlpha = 1;
  }
}
