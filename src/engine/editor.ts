import { History, type Command } from './history';
import { DrawingDocument, type Layer, type LayerProps } from './layers';
import { AddLayer, MergeDown, MoveLayer, PixelPatch, RemoveLayer, SetLayerProps } from './commands';
import { ViewTransform } from './view';
import { StrokeRenderer } from './brush/stroke';
import { DEFAULT_BRUSH, type BrushSettings } from './brush/settings';
import { getPreset } from './brush/presets';
import type { InputPoint } from './brush/sampler';
import { attachInput } from './input';
import { render, renderComposite } from './renderer';
import { createSurface, type Surface } from './canvas';
import { rgbToHex, hexToRgb } from './color';
import type { Point } from './geometry';
import { dilate, floodMask, maskBounds } from './tools/fill';
import { LiveEdit } from './tools/liveEdit';
import { constrain, drawShape, shapeBounds, type ShapeOptions } from './tools/shapes';
import { drawText, measureText, type TextOptions } from './tools/text';

export type ToolId = 'brush' | 'eraser' | 'fill' | 'eyedropper' | 'shape' | 'text';
export type Notice = 'layerLocked' | 'layerHidden' | null;

export interface FillOptions {
  /** 0 à 255 */
  tolerance: number;
  /** layer = calque actif, canvas = tous les calques visibles */
  source: 'layer' | 'canvas';
  /** Agrandissement de la zone en pixels (passe sous les bords des traits). */
  expand: number;
  opacity: number;
}

export interface EditorOptions {
  width: number;
  height: number;
  /** Mémoire max de l'historique (octets). */
  historyBytes?: number;
  historySteps?: number;
}

/** Distance (px écran) sous laquelle un clic ferme le polygone sur son premier point. */
const CLOSE_DIST = 14;

/** Point d'entrée du moteur : document + historique + vue + outils, branché sur un <canvas>. */
export class Editor {
  readonly doc: DrawingDocument;
  readonly history: History;
  readonly view = new ViewTransform();
  tool: ToolId = 'brush';
  /** Couleur principale, commune à tous les outils. */
  color = '#000000';
  brush: BrushSettings = { ...DEFAULT_BRUSH };
  eraser: BrushSettings = { ...(getPreset('eraser-hard')?.settings ?? DEFAULT_BRUSH) };
  fill: FillOptions = { tolerance: 32, source: 'layer', expand: 1, opacity: 1 };
  shape: ShapeOptions = { kind: 'rect', fill: false, width: 6 };
  text: TextOptions = { font: 'sans-serif', size: 64, bold: false, italic: false };
  /** Position (document) où l'utilisateur veut écrire : l'interface affiche une saisie. */
  textRequest: Point | null = null;
  notice: Notice = null;

  private stroke: StrokeRenderer;
  private live: LiveEdit;
  private shapeStart: Point | null = null;
  private poly: Point[] = [];
  private polyFloat: Point | null = null;
  private lastPolyUp = 0;
  private temp: Surface | null = null;
  private pixel: Surface | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private viewW = 0;
  private viewH = 0;
  private dpr = 1;
  private workspace = '#8a8f99';
  private hoverAt: Point | null = null;
  private raf = 0;
  private listeners = new Set<() => void>();
  private fitted = false;

  constructor(opts: EditorOptions) {
    this.doc = new DrawingDocument(opts.width, opts.height);
    this.history = new History({ maxBytes: opts.historyBytes ?? 256 * 2 ** 20, maxSteps: opts.historySteps ?? 200 });
    this.stroke = new StrokeRenderer(opts.width, opts.height);
    this.live = new LiveEdit(opts.width, opts.height);
  }

  /** Abonnement aux changements (calques, historique, vue, couleur). Renvoie la fonction de désabonnement. */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private changed(): void {
    this.requestRender();
    for (const fn of this.listeners) fn();
  }

  // ---------- Affichage ----------

  attach(canvas: HTMLCanvasElement): () => void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const prev = { w: this.viewW, h: this.viewH };
      this.dpr = window.devicePixelRatio || 1;
      this.viewW = r.width;
      this.viewH = r.height;
      canvas.width = Math.max(1, Math.round(r.width * this.dpr));
      canvas.height = Math.max(1, Math.round(r.height * this.dpr));
      this.workspace = getComputedStyle(canvas).getPropertyValue('--workspace').trim() || this.workspace;
      if (!this.fitted && r.width > 0) {
        this.fit();
        this.fitted = true;
      } else {
        // Garde le centre de la vue au même endroit (rotation d'écran, barre d'adresse mobile…)
        this.view.panBy((r.width - prev.w) / 2, (r.height - prev.h) / 2);
      }
      this.changed();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const detachInput = attachInput(canvas, {
      view: this.view,
      viewChanged: () => this.changed(),
      strokeStart: (p, type) => this.pointerDown(p, type),
      strokeMove: (ps) => this.pointerMove(ps),
      strokeEnd: () => this.pointerUp(),
      strokeCancel: () => this.pointerCancel(),
      hover: (p) => this.hover(p),
      undo: () => this.undo(),
      redo: () => this.redo(),
      key: (e) => this.key(e),
    });

    return () => {
      ro.disconnect();
      detachInput();
      cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.canvas = null;
      this.ctx = null;
    };
  }

  requestRender(): void {
    if (this.raf || !this.ctx) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.renderNow();
    });
  }

  private renderNow(): void {
    if (!this.ctx) return;
    this.stroke.flush();
    const b = this.activeBrush;
    render(this.ctx, this.viewW, this.viewH, this.dpr, this.doc, this.view, {
      workspace: this.workspace,
      cursor: this.hoverAt && b ? { at: this.hoverAt, diameter: b.size * this.view.zoom } : null,
    });
  }

  fit(): void {
    this.view.fit(this.doc.width, this.doc.height, this.viewW, this.viewH);
    this.changed();
  }

  setZoom(zoom: number): void {
    this.view.setZoomAt(zoom, { x: this.viewW / 2, y: this.viewH / 2 });
    this.changed();
  }

  setRotation(radians: number): void {
    this.view.setRotationAt(radians, { x: this.viewW / 2, y: this.viewH / 2 });
    this.changed();
  }

  // ---------- Outils ----------

  /** Réglages du pinceau de l'outil actif (null si l'outil n'est pas un pinceau). */
  get activeBrush(): BrushSettings | null {
    return this.tool === 'brush' ? this.brush : this.tool === 'eraser' ? this.eraser : null;
  }

  setTool(tool: ToolId): void {
    if (tool === this.tool) return;
    this.finishPolygon(true);
    this.textRequest = null;
    this.tool = tool;
    this.changed();
  }

  /** Remplace les réglages du pinceau (`which` = pinceau ou gomme). */
  setBrush(settings: Partial<BrushSettings>, which: 'brush' | 'eraser' = 'brush'): void {
    Object.assign(which === 'eraser' ? this.eraser : this.brush, settings);
    this.changed();
  }

  setColor(color: string): void {
    this.color = color;
    this.changed();
  }

  /** Vérifie que le calque actif accepte le dessin ; sinon affiche un message. */
  private editableLayer(): Layer | null {
    const layer = this.doc.active;
    const notice: Notice = layer.locked ? 'layerLocked' : !layer.visible ? 'layerHidden' : null;
    if (notice !== this.notice) {
      this.notice = notice;
      this.changed();
    }
    return notice ? null : layer;
  }

  private pointerDown(screen: InputPoint, pointerType: string): boolean {
    const p = this.toDocPoint(screen);
    switch (this.tool) {
      case 'brush':
      case 'eraser': {
        const layer = this.editableLayer();
        if (!layer) return false;
        this.stroke.begin(layer, this.activeBrush!, this.color, p, pointerType !== 'pen');
        this.requestRender();
        return true;
      }
      case 'eyedropper':
        this.pick(p);
        return true;
      case 'fill': {
        const layer = this.editableLayer();
        if (layer) this.floodFill(layer, p);
        return false;
      }
      case 'shape': {
        const layer = this.editableLayer();
        if (!layer) return false;
        if (this.shape.kind === 'polygon') {
          if (!this.poly.length) {
            this.live.begin(layer);
            this.poly = [p];
          }
          this.polyFloat = this.constrainPoly(p, screen.shift);
          this.drawPolygon(false);
        } else {
          this.live.begin(layer);
          this.shapeStart = p;
          this.drawShapePreview(p, false);
        }
        return true;
      }
      case 'text': {
        if (!this.editableLayer()) return false;
        this.textRequest = p;
        this.changed();
        return false;
      }
    }
  }

  private pointerMove(points: InputPoint[]): void {
    const last = points[points.length - 1];
    switch (this.tool) {
      case 'brush':
      case 'eraser':
        this.stroke.add(points.map((p) => this.toDocPoint(p)));
        this.requestRender();
        break;
      case 'eyedropper':
        this.pick(this.toDocPoint(last));
        break;
      case 'shape':
        if (this.shape.kind === 'polygon') {
          this.polyFloat = this.constrainPoly(this.toDocPoint(last), last.shift);
          this.drawPolygon(false);
        } else {
          this.drawShapePreview(this.toDocPoint(last), !!last.shift);
        }
        break;
    }
  }

  private pointerUp(): void {
    switch (this.tool) {
      case 'brush':
      case 'eraser': {
        const cmd = this.stroke.end();
        if (cmd) this.history.push(cmd);
        this.changed();
        break;
      }
      case 'shape':
        if (this.shape.kind === 'polygon') this.polygonVertex();
        else {
          this.shapeStart = null;
          this.pushCommand(this.live.commit('shape'));
        }
        break;
    }
  }

  private pointerCancel(): void {
    if (this.stroke.active) this.stroke.cancel();
    if (this.tool === 'shape' && this.shape.kind !== 'polygon') {
      this.shapeStart = null;
      this.live.cancel();
    }
    this.changed();
  }

  private hover(p: Point | null): void {
    this.hoverAt = p;
    if (p && this.tool === 'shape' && this.shape.kind === 'polygon' && this.poly.length) {
      this.polyFloat = this.view.toDoc(p);
      this.drawPolygon(false);
    }
    this.requestRender();
  }

  private key(e: KeyboardEvent): boolean {
    if (this.poly.length && (e.key === 'Enter' || e.key === 'Escape')) {
      this.finishPolygon(e.key === 'Enter');
      return true;
    }
    return false;
  }

  private toDocPoint(p: InputPoint): InputPoint {
    return { ...this.view.toDoc(p), pressure: p.pressure, shift: p.shift };
  }

  private pushCommand(cmd: Command | null): void {
    if (cmd) this.history.push(cmd);
    this.changed();
  }

  // --- Pipette ---

  /** Couleur visible (tous les calques + fond) au point du document, ou null si transparent. */
  colorAt(p: Point): string | null {
    const x = Math.floor(p.x);
    const y = Math.floor(p.y);
    if (x < 0 || y < 0 || x >= this.doc.width || y >= this.doc.height) return null;
    this.pixel ??= createSurface(1, 1);
    const ctx = this.pixel.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, 1, 1);
    ctx.setTransform(1, 0, 0, 1, -x, -y);
    renderComposite(ctx, this.doc, true);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return d[3] === 0 ? null : rgbToHex(d[0], d[1], d[2]);
  }

  private pick(p: Point): void {
    const c = this.colorAt(p);
    if (c && c !== this.color) this.setColor(c);
  }

  // --- Remplissage ---

  private floodFill(layer: Layer, p: Point): void {
    const { width: w, height: h } = this.doc;
    let src: ImageData;
    if (this.fill.source === 'canvas') {
      this.temp ??= createSurface(w, h);
      this.temp.ctx.clearRect(0, 0, w, h);
      renderComposite(this.temp.ctx, this.doc, false);
      src = this.temp.ctx.getImageData(0, 0, w, h);
    } else {
      src = layer.surface.ctx.getImageData(0, 0, w, h);
    }
    let mask = floodMask(src.data, w, h, p.x, p.y, this.fill.tolerance);
    if (!mask) return;
    if (this.fill.expand > 0) mask = dilate(mask, w, h, this.fill.expand);
    const r = maskBounds(mask, w, h);
    if (!r) return;

    const patch = createSurface(r.w, r.h);
    const img = patch.ctx.createImageData(r.w, r.h);
    const [cr, cg, cb] = hexToRgb(this.color);
    for (let y = 0; y < r.h; y++) {
      for (let x = 0; x < r.w; x++) {
        if (!mask[(r.y + y) * w + r.x + x]) continue;
        const i = (y * r.w + x) * 4;
        img.data[i] = cr;
        img.data[i + 1] = cg;
        img.data[i + 2] = cb;
        img.data[i + 3] = 255;
      }
    }
    patch.ctx.putImageData(img, 0, 0);
    const ctx = layer.surface.ctx;
    const before = ctx.getImageData(r.x, r.y, r.w, r.h);
    ctx.save();
    ctx.globalAlpha = this.fill.opacity;
    ctx.drawImage(patch.canvas, r.x, r.y);
    ctx.restore();
    const after = ctx.getImageData(r.x, r.y, r.w, r.h);
    this.pushCommand(new PixelPatch('fill', layer, r, before, after));
  }

  // --- Formes ---

  private drawShapePreview(to: Point, shift: boolean): void {
    if (!this.shapeStart) return;
    const a = this.shapeStart;
    const b = shift ? constrain(this.shape.kind, a, to) : to;
    this.live.update(shapeBounds([a, b], this.shape.width), (ctx) => drawShape(ctx, this.shape, [a, b], this.color));
    this.requestRender();
  }

  private constrainPoly(p: Point, shift?: boolean): Point {
    const last = this.poly[this.poly.length - 1];
    return shift && last ? constrain('polygon', last, p) : p;
  }

  private drawPolygon(closed: boolean): void {
    const pts = this.polyFloat && !closed ? [...this.poly, this.polyFloat] : this.poly;
    if (pts.length < 2) {
      this.live.update(null, () => {});
    } else {
      const opts = closed ? this.shape : { ...this.shape, fill: false };
      this.live.update(shapeBounds(pts, this.shape.width), (ctx) => drawShape(ctx, opts, pts, this.color, closed));
    }
    this.requestRender();
  }

  /** Doigt / clic relâché : fixe un sommet ; ferme si on revient au premier point ou double-clic. */
  private polygonVertex(): void {
    const p = this.polyFloat;
    if (!p) return;
    const now = performance.now();
    const screenDist = (a: Point, b: Point) => {
      const sa = this.view.toScreen(a);
      const sb = this.view.toScreen(b);
      return Math.hypot(sa.x - sb.x, sa.y - sb.y);
    };
    const last = this.poly[this.poly.length - 1];
    const doubleClick = now - this.lastPolyUp < 350 && screenDist(p, last) < CLOSE_DIST;
    this.lastPolyUp = now;
    if (this.poly.length >= 3 && (screenDist(p, this.poly[0]) < CLOSE_DIST || doubleClick)) {
      this.finishPolygon(true);
      return;
    }
    if (this.poly.length === 1 && screenDist(p, last) < 2) return; // simple appui sur le premier point
    if (!doubleClick) this.poly.push(p);
    this.drawPolygon(false);
  }

  /** Termine le polygone (commit = l'enregistrer, sinon l'abandonner). */
  finishPolygon(commit: boolean): void {
    if (!this.poly.length) return;
    this.polyFloat = null;
    if (commit && this.poly.length >= 2) {
      this.drawPolygon(this.poly.length >= 3);
      this.pushCommand(this.live.commit('shape'));
    } else {
      this.live.cancel();
      this.changed();
    }
    this.poly = [];
  }

  // --- Texte ---

  /** Écrit le texte à la position demandée (textRequest), en une étape annulable. */
  commitText(text: string): void {
    const at = this.textRequest;
    this.textRequest = null;
    const layer = this.doc.active;
    if (!at || !text.trim() || layer.locked) {
      this.changed();
      return;
    }
    const size = measureText(layer.surface.ctx, text, this.text);
    this.live.begin(layer);
    this.live.update({ x: at.x - 2, y: at.y - 2, w: size.w + 4 + this.text.size * 0.3, h: size.h + 4 }, (ctx) =>
      drawText(ctx, text, at.x, at.y, this.text, this.color),
    );
    this.pushCommand(this.live.commit('text'));
  }

  cancelText(): void {
    this.textRequest = null;
    this.changed();
  }

  // ---------- Historique ----------

  undo(): void {
    if (this.stroke.active || this.live.active) return;
    if (this.history.undo()) this.changed();
  }

  redo(): void {
    if (this.stroke.active || this.live.active) return;
    if (this.history.redo()) this.changed();
  }

  // ---------- Calques ----------

  setActiveLayer(id: number): void {
    if (this.doc.get(id)) {
      this.finishPolygon(true);
      this.doc.activeId = id;
      this.changed();
    }
  }

  addLayer(): Layer {
    const layer = this.doc.createLayer();
    const index = this.doc.indexOf(this.doc.activeId) + 1;
    this.exec(new AddLayer(this.doc, layer, index, this.doc.activeId));
    return layer;
  }

  duplicateLayer(id = this.doc.activeId): void {
    const src = this.doc.get(id);
    if (!src) return;
    const copy = this.doc.createLayer();
    copy.surface.ctx.drawImage(src.surface.canvas, 0, 0);
    Object.assign(copy, { name: src.name, number: src.number, opacity: src.opacity, blend: src.blend, visible: src.visible });
    this.exec(new AddLayer(this.doc, copy, this.doc.indexOf(id) + 1, this.doc.activeId));
  }

  removeLayer(id = this.doc.activeId): void {
    const layer = this.doc.get(id);
    if (!layer || this.doc.layers.length <= 1) return;
    this.exec(new RemoveLayer(this.doc, layer));
  }

  /** Déplace un calque d'un cran vers le haut (+1) ou le bas (-1). */
  moveLayer(id: number, dir: 1 | -1): void {
    const from = this.doc.indexOf(id);
    const to = from + dir;
    if (from < 0 || to < 0 || to >= this.doc.layers.length) return;
    this.exec(new MoveLayer(this.doc, id, from, to));
  }

  mergeDown(id = this.doc.activeId): void {
    const index = this.doc.indexOf(id);
    if (index <= 0) return;
    this.exec(new MergeDown(this.doc, this.doc.layers[index], this.doc.layers[index - 1]));
  }

  clearLayer(id = this.doc.activeId): void {
    const layer = this.doc.get(id);
    if (!layer || layer.locked) return;
    const { width: w, height: h } = this.doc;
    const ctx = layer.surface.ctx;
    const before = ctx.getImageData(0, 0, w, h);
    ctx.clearRect(0, 0, w, h);
    const after = ctx.getImageData(0, 0, w, h);
    this.pushCommand(new PixelPatch('clear', layer, { x: 0, y: 0, w, h }, before, after));
  }

  setLayerProps(id: number, props: LayerProps): void {
    const layer = this.doc.get(id);
    if (!layer) return;
    const before: LayerProps = {};
    for (const k of Object.keys(props) as (keyof LayerProps)[]) {
      (before as Record<string, unknown>)[k] = layer[k];
    }
    this.exec(new SetLayerProps(layer, before, props));
  }

  setBackground(color: string | null): void {
    this.doc.background = color;
    this.changed();
  }

  private exec(cmd: Command & { redo(): void }): void {
    cmd.redo();
    this.history.push(cmd);
    this.changed();
  }
}
