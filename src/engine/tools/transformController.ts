import { createSurface, type Surface } from '../canvas';
import { CompoundCommand } from '../commands';
import type { Point, Rect } from '../geometry';
import type { Command } from '../history';
import type { Layer } from '../layers';
import { rasterMask, SelectionChange, type Selection } from '../selection';
import type { ViewTransform } from '../view';
import { LiveEdit } from './liveEdit';
import {
  corners, dragHandle, HANDLES, handlePoint, initialTransform, insideTransform,
  transformedBounds, transformMatrix, type TransformState,
} from './transform';

const HIT = 22;
const ROTATE_OFFSET = 30;

type Drag =
  | { kind: 'move'; start: TransformState; from: Point }
  | { kind: 'rotate'; start: TransformState; from: Point }
  | { kind: 'scale'; start: TransformState; hx: number; hy: number };

/** Déplacer / transformer : le contenu (sélection ou calque entier) flotte jusqu'à validation. */
export class TransformController {
  state: TransformState | null = null;
  /** Garder les proportions en tirant les coins. */
  proportional = true;
  private floating: Surface | null = null;
  private selCrop: Surface | null = null;
  private orig: Rect | null = null;
  private layer: Layer | null = null;
  private drag: Drag | null = null;
  private live: LiveEdit;

  constructor(private readonly width: number, private readonly height: number) {
    this.live = new LiveEdit(width, height);
  }

  get active(): boolean {
    return this.state !== null;
  }

  /** Soulève le contenu à transformer. Renvoie false s'il n'y a rien. */
  begin(layer: Layer, selection: Selection): boolean {
    const bounds = selection.bounds ?? contentBounds(layer, this.width, this.height);
    if (!bounds) return false;
    const { x, y, w, h } = bounds;
    this.floating = createSurface(w, h);
    this.floating.ctx.drawImage(layer.surface.canvas, x, y, w, h, 0, 0, w, h);
    this.selCrop = null;
    if (selection.canvas) {
      this.selCrop = createSurface(w, h);
      this.selCrop.ctx.drawImage(selection.canvas, x, y, w, h, 0, 0, w, h);
      this.floating.ctx.globalCompositeOperation = 'destination-in';
      this.floating.ctx.drawImage(this.selCrop.canvas, 0, 0);
      this.floating.ctx.globalCompositeOperation = 'source-over';
    }
    this.layer = layer;
    this.orig = bounds;
    this.state = initialTransform(bounds);
    this.live.begin(layer);
    this.redraw();
    return true;
  }

  redraw(): void {
    const t = this.state;
    const o = this.orig;
    if (!t || !o || !this.floating) return;
    const nb = transformedBounds(t);
    const x = Math.min(o.x, nb.x);
    const y = Math.min(o.y, nb.y);
    const rect = { x, y, w: Math.max(o.x + o.w, nb.x + nb.w) - x, h: Math.max(o.y + o.h, nb.y + nb.h) - y };
    this.live.update(rect, (ctx) => {
      // Efface le contenu d'origine, puis pose le contenu transformé
      if (this.selCrop) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.drawImage(this.selCrop.canvas, o.x, o.y);
        ctx.globalCompositeOperation = 'source-over';
      } else {
        ctx.clearRect(o.x, o.y, o.w, o.h);
      }
      ctx.setTransform(...transformMatrix(t));
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(this.floating!.canvas, 0, 0);
    });
  }

  /** Clic sur une poignée, dans la boîte (déplacer) ou en dehors (pivoter). */
  pointerDown(p: Point, screen: Point, view: ViewTransform): void {
    const t = this.state;
    if (!t) return;
    const rot = this.rotateHandle(view);
    if (Math.hypot(rot.x - screen.x, rot.y - screen.y) < HIT) {
      this.drag = { kind: 'rotate', start: { ...t }, from: p };
      return;
    }
    for (const [hx, hy] of HANDLES) {
      const s = view.toScreen(handlePoint(t, hx, hy));
      if (Math.hypot(s.x - screen.x, s.y - screen.y) < HIT) {
        this.drag = { kind: 'scale', start: { ...t }, hx, hy };
        return;
      }
    }
    this.drag = insideTransform(t, p)
      ? { kind: 'move', start: { ...t }, from: p }
      : { kind: 'rotate', start: { ...t }, from: p };
  }

  pointerMove(p: Point, shift: boolean): void {
    const d = this.drag;
    if (!d || !this.state) return;
    if (d.kind === 'move') {
      this.state = { ...d.start, cx: d.start.cx + p.x - d.from.x, cy: d.start.cy + p.y - d.from.y };
    } else if (d.kind === 'rotate') {
      const a0 = Math.atan2(d.from.y - d.start.cy, d.from.x - d.start.cx);
      const a1 = Math.atan2(p.y - d.start.cy, p.x - d.start.cx);
      let angle = d.start.angle + a1 - a0;
      if (shift) angle = Math.round(angle / (Math.PI / 12)) * (Math.PI / 12);
      this.state = { ...d.start, angle };
    } else {
      this.state = dragHandle(d.start, d.hx, d.hy, p, this.proportional !== shift);
    }
    this.redraw();
  }

  pointerUp(): void {
    this.drag = null;
  }

  flip(horizontal: boolean): void {
    if (!this.state) return;
    this.state = horizontal ? { ...this.state, sx: -this.state.sx } : { ...this.state, sy: -this.state.sy };
    this.redraw();
  }

  rotate90(dir: 1 | -1): void {
    if (!this.state) return;
    this.state = { ...this.state, angle: this.state.angle + (dir * Math.PI) / 2 };
    this.redraw();
  }

  /** Valide : renvoie la commande (pixels + sélection déplacée). */
  commit(selection: Selection): Command | null {
    const t = this.state;
    if (!t) return null;
    const patch = this.live.commit('transform');
    let cmd: Command | null = patch;
    if (this.selCrop && patch) {
      const before = selection.copyMask();
      const crop = this.selCrop;
      const after = rasterMask(this.width, this.height, (ctx) => {
        ctx.setTransform(...transformMatrix(t));
        ctx.drawImage(crop.canvas, 0, 0);
      });
      selection.set(after);
      cmd = new CompoundCommand('transform', [patch, new SelectionChange(selection, before, selection.copyMask())]);
    }
    this.reset();
    return cmd;
  }

  cancel(): void {
    if (this.state) this.live.cancel();
    this.reset();
  }

  private reset(): void {
    this.state = null;
    this.floating = null;
    this.selCrop = null;
    this.layer = null;
    this.orig = null;
    this.drag = null;
  }

  private rotateHandle(view: ViewTransform): Point {
    const t = this.state!;
    const top = view.toScreen(handlePoint(t, 0, t.sy < 0 ? 1 : -1));
    const c = view.toScreen({ x: t.cx, y: t.cy });
    const len = Math.hypot(top.x - c.x, top.y - c.y) || 1;
    return { x: top.x + ((top.x - c.x) / len) * ROTATE_OFFSET, y: top.y + ((top.y - c.y) / len) * ROTATE_OFFSET };
  }

  /** Cadre, poignées et poignée de rotation (coordonnées écran). */
  drawOverlay(ctx: CanvasRenderingContext2D, view: ViewTransform): void {
    const t = this.state;
    if (!t) return;
    const pts = corners(t).map((p) => view.toScreen(p));
    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#1f8fff';
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.stroke();
    const rot = this.rotateHandle(view);
    const topMid = view.toScreen(handlePoint(t, 0, t.sy < 0 ? 1 : -1));
    ctx.beginPath();
    ctx.moveTo(topMid.x, topMid.y);
    ctx.lineTo(rot.x, rot.y);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    for (const [hx, hy] of HANDLES) {
      const s = view.toScreen(handlePoint(t, hx, hy));
      ctx.fillRect(s.x - 6, s.y - 6, 12, 12);
      ctx.strokeRect(s.x - 6, s.y - 6, 12, 12);
    }
    ctx.beginPath();
    ctx.arc(rot.x, rot.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

/** Rectangle englobant les pixels non transparents d'un calque. */
export function contentBounds(layer: Layer, w: number, h: number): Rect | null {
  const data = layer.surface.ctx.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!data[(y * w + x) * 4 + 3]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      y1 = y;
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
