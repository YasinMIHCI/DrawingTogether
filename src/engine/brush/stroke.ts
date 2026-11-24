import { createSurface, type Surface } from '../canvas';
import { clampRect, unionRect, type Rect } from '../geometry';
import type { Layer } from '../layers';
import { PixelPatch } from '../commands';
import { inDisk, rng } from '../random';
import { StrokeSampler, type Dab, type InputPoint } from './sampler';
import type { BrushSettings } from './settings';
import { drawTip, getTip, getTipMask, TIP_VARIANTS } from './tips';
import { grainCanvas } from './grain';
import { clipToSelection, TempSurface } from '../selection';

/** Une empreinte concrète d'un tampon (particule, dispersion…), relative au tampon. */
interface Mark {
  ox: number;
  oy: number;
  size: number;
  alpha: number;
  angle: number;
  variant: number;
}

const DEG = Math.PI / 180;

/**
 * Dessine un trait sur un calque.
 * - Peindre / gommer : les tampons vont dans un tampon de trait, et le calque est recomposé
 *   à partir d'une copie prise au début : opacité uniforme, grain du papier, annulation exacte.
 * - Étaler / flouter : chaque tampon modifie directement le calque.
 */
export class StrokeRenderer {
  private _buffer: Surface | null = null;
  private _snapshot: Surface | null = null;
  private layer: Layer | null = null;
  private s: BrushSettings | null = null;
  private color = '#000000';
  private simulate = false;
  private sampler: StrokeSampler | null = null;
  private dabs: Dab[] = [];
  private marks: Mark[][] = [];
  private rand = rng(1);
  private pending: Rect | null = null;
  private total: Rect | null = null;
  private grainPattern: CanvasPattern | null = null;
  private grainTmp = new TempSurface();
  private carrier: Surface | null = null;
  private maskTmp = new TempSurface();
  private smallTmp = new TempSurface();
  private clipTmp = new TempSurface();
  private selection: HTMLCanvasElement | null = null;

  constructor(private readonly width: number, private readonly height: number) {}

  // Créés à la première utilisation : une grande toile partagée ne coûte pas de mémoire inutile.
  private get buffer(): Surface {
    return (this._buffer ??= createSurface(this.width, this.height));
  }
  private get snapshot(): Surface {
    return (this._snapshot ??= createSurface(this.width, this.height));
  }

  get active(): boolean {
    return this.layer !== null;
  }

  private get direct(): boolean {
    return this.s?.mode === 'smudge' || this.s?.mode === 'blur';
  }

  /**
   * `simulatePressure` : souris ou doigt, le début et la fin du trait sont affinés artificiellement.
   * `selection` : canvas de sélection, le trait ne sort pas de la zone sélectionnée.
   */
  begin(
    layer: Layer,
    settings: BrushSettings,
    color: string,
    p: InputPoint,
    simulatePressure = false,
    selection: HTMLCanvasElement | null = null,
  ): void {
    this.layer = layer;
    this.selection = selection;
    this.s = { ...settings };
    this.color = color;
    this.simulate = simulatePressure;
    this.sampler = new StrokeSampler(this.s, simulatePressure);
    this.rand = rng((Math.random() * 2 ** 32) >>> 0);
    this.dabs = [];
    this.marks = [];
    this.carrier = null;
    this.buffer.ctx.clearRect(0, 0, this.width, this.height);
    const snap = this.snapshot.ctx;
    snap.clearRect(0, 0, this.width, this.height);
    snap.drawImage(layer.surface.canvas, 0, 0);
    this.pending = null;
    this.total = null;
    this.addDabs(this.sampler.begin(p));
  }

  add(points: InputPoint[]): void {
    if (!this.sampler) return;
    for (const p of points) this.addDabs(this.sampler.add(p));
  }

  /** Applique au calque les zones modifiées depuis le dernier appel. */
  flush(): Rect | null {
    const r = this.pending;
    if (!r || !this.layer || !this.s) return null;
    this.pending = null;
    if (this.direct) return r;
    const ctx = this.layer.surface.ctx;
    ctx.save();
    ctx.clearRect(r.x, r.y, r.w, r.h);
    ctx.drawImage(this.snapshot.canvas, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
    let src: CanvasImageSource = this.buffer.canvas;
    let sx = r.x;
    let sy = r.y;
    if (this.s.grain > 0) {
      const tmp = this.grainTmp.get(r.w, r.h);
      tmp.ctx.drawImage(this.buffer.canvas, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
      tmp.ctx.globalCompositeOperation = 'destination-out';
      tmp.ctx.globalAlpha = this.s.grain;
      const pattern = this.getGrainPattern(tmp.ctx);
      if (pattern) {
        // Grain fixé au document : il ne bouge pas d'un trait à l'autre.
        pattern.setTransform(new DOMMatrix().translate(-r.x, -r.y).scale(this.s.grainScale));
        tmp.ctx.fillStyle = pattern;
        tmp.ctx.fillRect(0, 0, r.w, r.h);
      }
      tmp.ctx.globalAlpha = 1;
      tmp.ctx.globalCompositeOperation = 'source-over';
      src = tmp.canvas;
      sx = 0;
      sy = 0;
    }
    ctx.globalAlpha = this.s.opacity;
    ctx.globalCompositeOperation = this.s.mode === 'erase' ? 'destination-out' : 'source-over';
    ctx.drawImage(src, sx, sy, r.w, r.h, r.x, r.y, r.w, r.h);
    ctx.restore();
    if (this.selection) clipToSelection(ctx, this.snapshot.canvas, this.selection, r, this.clipTmp.get(r.w, r.h));
    return r;
  }

  /** Termine le trait et renvoie la commande d'annulation (null si rien n'a été dessiné). */
  end(): PixelPatch | null {
    if (!this.sampler || !this.layer) return null;
    this.addDabs(this.sampler.end());
    if (!this.direct && this.simulate && this.s!.taperOut > 0) this.applyTaperOut();
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
    this.dabs = [];
    this.marks = [];
    this.carrier = null;
    this.selection = null;
  }

  private getGrainPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
    this.grainPattern ??= ctx.createPattern(grainCanvas(), 'repeat');
    return this.grainPattern;
  }

  private touch(x: number, y: number, size: number): void {
    const half = size / 2 + 2;
    const r = clampRect({ x: x - half, y: y - half, w: half * 2, h: half * 2 }, this.width, this.height);
    this.pending = unionRect(this.pending, r);
    this.total = unionRect(this.total, r);
  }

  private addDabs(dabs: Dab[]): void {
    if (!this.s) return;
    for (const d of dabs) {
      if (this.direct) {
        if (this.s.mode === 'blur') this.blurDab(d);
        else this.smudgeDab(d);
        continue;
      }
      const marks = this.makeMarks(d);
      this.dabs.push(d);
      this.marks.push(marks);
      this.drawMarks(d, marks);
    }
  }

  private makeMarks(d: Dab): Mark[] {
    const s = this.s!;
    const r = this.rand;
    const out: Mark[] = [];
    for (let k = 0; k < s.count; k++) {
      const [ox, oy] = s.count > 1 ? inDisk(r, 0.5 * s.scatter) : s.scatter > 0 ? inDisk(r, s.scatter) : [0, 0];
      let angle = s.angle * DEG;
      if (s.angleMode === 'direction') angle += d.dir;
      else if (s.angleMode === 'random') angle += r() * Math.PI * 2;
      if (s.angleJitter) angle += (r() - 0.5) * s.angleJitter * DEG;
      out.push({
        ox,
        oy,
        size: (s.count > 1 ? s.particleSize : 1) * (1 - s.sizeJitter * r()),
        alpha: 1 - s.opacityJitter * r(),
        angle,
        variant: Math.floor(r() * TIP_VARIANTS[s.tip]),
      });
    }
    return out;
  }

  private drawMarks(d: Dab, marks: Mark[]): void {
    const s = this.s!;
    const ctx = this.buffer.ctx;
    const color = s.mode === 'erase' ? '#000000' : this.color;
    for (const m of marks) {
      const raw = d.size * m.size;
      // Traits très fins : on garde 1 px et on réduit la densité, sinon le trait disparaît.
      const size = Math.max(1, raw);
      const x = d.x + m.ox * d.size;
      const y = d.y + m.oy * d.size;
      ctx.globalAlpha = Math.min(1, d.alpha * m.alpha * Math.min(1, raw));
      drawTip(ctx, getTip(s.tip, s.hardness, size, color, m.variant), x, y, size, m.angle, s.roundness);
      this.touch(x, y, size);
    }
    ctx.globalAlpha = 1;
  }

  /** Fin de trait affinée (souris/doigt) : on réduit les derniers tampons et on redessine. */
  private applyTaperOut(): void {
    const s = this.s!;
    const last = this.dabs[this.dabs.length - 1];
    if (!last) return;
    const len = s.taperOut * s.size;
    for (let i = this.dabs.length - 1; i >= 0; i--) {
      const d = this.dabs[i];
      const from = last.dist - d.dist;
      if (from >= len) break;
      d.size *= Math.max(0.08, Math.sqrt(from / len));
    }
    this.buffer.ctx.clearRect(0, 0, this.width, this.height);
    this.dabs.forEach((d, i) => this.drawMarks(d, this.marks[i]));
    this.pending = this.total;
  }

  // ---------- Étaler / flouter ----------

  /** Masque la surface `src` (taille S) par la pointe, puis la mélange dans le calque avec la force `a`. */
  private blendIntoLayer(src: Surface, S: number, rx: number, ry: number, d: Dab, a: number): void {
    const s = this.s!;
    const ctx = this.layer!.surface.ctx;
    const tip = getTipMask(s.tip, s.hardness, d.size);
    const angle = (s.angleMode === 'direction' ? d.dir : 0) + s.angle * DEG;
    const masked = this.maskTmp.get(S, S);
    masked.ctx.drawImage(src.canvas, 0, 0, S, S, 0, 0, S, S);
    masked.ctx.globalCompositeOperation = 'destination-in';
    drawTip(masked.ctx, tip, d.x - rx, d.y - ry, d.size, angle, s.roundness);
    masked.ctx.globalCompositeOperation = 'source-over';
    // calque = calque × (1 − a·masque) + source·a·masque
    ctx.save();
    ctx.globalAlpha = a;
    ctx.globalCompositeOperation = 'destination-out';
    drawTip(ctx, tip, d.x, d.y, d.size, angle, s.roundness);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(masked.canvas, 0, 0, S, S, rx, ry, S, S);
    ctx.restore();
    this.touch(d.x, d.y, d.size);
    if (this.selection) {
      const r = clampRect({ x: rx, y: ry, w: S, h: S }, this.width, this.height);
      if (r) clipToSelection(ctx, this.snapshot.canvas, this.selection, r, this.clipTmp.get(r.w, r.h));
    }
  }

  /** Mélange progressivement `ctx` (taille S) vers une image ou une couleur. */
  private static lerpTo(ctx: CanvasRenderingContext2D, S: number, rate: number, draw: () => void): void {
    ctx.save();
    ctx.globalAlpha = rate;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(0, 0, S, S);
    ctx.globalCompositeOperation = 'lighter';
    draw();
    ctx.restore();
  }

  private smudgeDab(d: Dab): void {
    const s = this.s!;
    const layer = this.layer!;
    const S = Math.ceil(d.size) + 2;
    const rx = Math.round(d.x - S / 2);
    const ry = Math.round(d.y - S / 2);
    const pick = () => this.carrier!.ctx.drawImage(layer.surface.canvas, rx, ry, S, S, 0, 0, S, S);
    const mixColor = (rate: number) => {
      if (rate <= 0) return;
      const c = this.carrier!.ctx;
      StrokeRenderer.lerpTo(c, S, rate, () => {
        c.fillStyle = this.color;
        c.fillRect(0, 0, S, S);
      });
    };

    if (!this.carrier || this.carrier.canvas.width !== S) {
      const prev = this.carrier;
      this.carrier = createSurface(S, S);
      if (prev) {
        this.carrier.ctx.drawImage(prev.canvas, 0, 0, S, S);
      } else {
        pick();
        mixColor(s.colorMix);
        return; // le premier tampon ne fait que charger le pinceau
      }
    }
    this.blendIntoLayer(this.carrier, S, rx, ry, d, s.strength * d.alpha);
    StrokeRenderer.lerpTo(this.carrier.ctx, S, s.pickup, pick);
    mixColor(s.colorMix * 0.15);
  }

  private blurDab(d: Dab): void {
    const s = this.s!;
    const layer = this.layer!;
    const S = Math.ceil(d.size) + 2;
    const rx = Math.round(d.x - S / 2);
    const ry = Math.round(d.y - S / 2);
    const k = Math.max(2, Math.round(S / 5));
    const small = this.smallTmp.get(k, k);
    small.ctx.imageSmoothingQuality = 'high';
    small.ctx.drawImage(layer.surface.canvas, rx, ry, S, S, 0, 0, k, k);
    const big = createBlurTarget(S);
    big.ctx.clearRect(0, 0, S, S);
    big.ctx.imageSmoothingQuality = 'high';
    big.ctx.drawImage(small.canvas, 0, 0, k, k, 0, 0, S, S);
    this.blendIntoLayer(big, S, rx, ry, d, s.strength * d.alpha);
  }
}

let blurTarget: Surface | null = null;
function createBlurTarget(S: number): Surface {
  if (!blurTarget || blurTarget.canvas.width < S) blurTarget = createSurface(Math.max(S, 64), Math.max(S, 64));
  return blurTarget;
}
