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
import { combineMasks, polygonMask, rasterMask, Selection, SelectionChange, type SelectMode } from './selection';
import { contentBounds, TransformController } from './tools/transformController';
import { LiquifyStroke } from './tools/liquifyStroke';
import type { LiquifyOptions } from './tools/liquify';
import { applyFilter as runFilter, defaultParams, type FilterKind } from './tools/filters';
import { loadProject, type ProjectData } from './project';

export type ToolId = 'brush' | 'eraser' | 'fill' | 'eyedropper' | 'shape' | 'text' | 'select' | 'transform' | 'liquify';
export type Notice = 'layerLocked' | 'layerHidden' | 'transformEmpty' | null;

export interface FillOptions {
  /** 0 à 255 */
  tolerance: number;
  /** layer = calque actif, canvas = tous les calques visibles */
  source: 'layer' | 'canvas';
  /** Agrandissement de la zone en pixels (passe sous les bords des traits). */
  expand: number;
  opacity: number;
}

export interface SelectOptions {
  kind: 'rect' | 'ellipse' | 'lasso' | 'wand';
  mode: SelectMode;
  /** Baguette magique */
  tolerance: number;
  source: 'layer' | 'canvas';
}

export interface FilterSession {
  kind: FilterKind;
  params: Record<string, number>;
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
  selectOpts: SelectOptions = { kind: 'rect', mode: 'replace', tolerance: 32, source: 'layer' };
  liquifyOpts: LiquifyOptions = { mode: 'push', size: 80, strength: 0.6 };
  readonly selection: Selection;
  readonly transform: TransformController;
  notice: Notice = null;

  private stroke: StrokeRenderer;
  private live: LiveEdit;
  private shapeStart: Point | null = null;
  private poly: Point[] = [];
  private polyFloat: Point | null = null;
  private lastPolyUp = 0;
  private liquifyStroke: LiquifyStroke;
  private selectDraft: { mode: SelectMode; points: Point[] } | null = null;
  private filter: (FilterSession & { layer: Layer; rect: { x: number; y: number; w: number; h: number }; orig: ImageData; out: ImageData; pending: boolean }) | null = null;
  private clipboard: { surface: Surface; x: number; y: number } | null = null;
  private selPath: { src: number[]; path: Path2D } | null = null;
  private temp: Surface | null = null;
  private pixel: Surface | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private viewW = 0;
  private viewH = 0;
  private dpr = 1;
  private workspace = '#8a8f99';
  private workspaceOverride: string | null = null;
  private hoverAt: Point | null = null;
  /** Pipette temporaire en cours (point écran), pour afficher la loupe. */
  private pickAt: Point | null = null;
  private raf = 0;
  private listeners = new Set<() => void>();
  private hoverListeners = new Set<() => void>();
  private fitted = false;

  constructor(opts: EditorOptions) {
    this.doc = new DrawingDocument(opts.width, opts.height);
    this.history = new History({ maxBytes: opts.historyBytes ?? 256 * 2 ** 20, maxSteps: opts.historySteps ?? 200 });
    this.stroke = new StrokeRenderer(opts.width, opts.height);
    this.live = new LiveEdit(opts.width, opts.height);
    this.selection = new Selection(opts.width, opts.height);
    this.transform = new TransformController(opts.width, opts.height);
    this.liquifyStroke = new LiquifyStroke(opts.width, opts.height);
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

  /** Abonnement aux déplacements du pointeur (barre d'état). */
  subscribeHover(fn: () => void): () => void {
    this.hoverListeners.add(fn);
    return () => this.hoverListeners.delete(fn);
  }

  /** Prévient l'interface et redessine (après un changement fait de l'extérieur). */
  notify(): void {
    this.changed();
  }

  /** Change les options d'un outil. */
  configure<K extends 'fill' | 'shape' | 'text' | 'selectOpts' | 'liquifyOpts'>(key: K, patch: Partial<Editor[K]>): void {
    if (key === 'shape') this.finishPolygon(true);
    Object.assign(this[key], patch);
    this.changed();
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
      this.workspace = this.workspaceOverride ?? (getComputedStyle(canvas).getPropertyValue('--workspace').trim() || this.workspace);
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
      canPick: () => this.tool === 'brush' || this.tool === 'eraser' || this.tool === 'fill',
      pick: (p) => {
        this.pickAt = p;
        if (p) this.pick(this.view.toDoc(p));
        this.requestRender();
      },
      multiTap: (n) => (n === 2 ? this.undo() : n === 3 ? this.redo() : undefined),
    });

    // Animation des « fourmis » autour de la sélection
    const ants = setInterval(() => {
      if (this.selection.active || this.selectDraft) this.requestRender();
    }, 120);

    return () => {
      clearInterval(ants);
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
    const size = this.activeBrush?.size ?? (this.tool === 'liquify' ? this.liquifyOpts.size : 0);
    render(this.ctx, this.viewW, this.viewH, this.dpr, this.doc, this.view, {
      workspace: this.workspace,
      cursor: this.hoverAt && size ? { at: this.hoverAt, diameter: size * this.view.zoom } : null,
      overlay: (ctx) => this.drawOverlay(ctx),
    });
  }

  fit(): void {
    this.view.fit(this.doc.width, this.doc.height, this.viewW, this.viewH);
    this.changed();
  }

  /** Taille de la zone d'affichage (px CSS). */
  get viewSize(): { width: number; height: number } {
    return { width: this.viewW, height: this.viewH };
  }

  /** Centre la vue sur un point du document (navigateur). */
  centerOn(p: Point): void {
    this.view.anchor(p, { x: this.viewW / 2, y: this.viewH / 2 });
    this.changed();
  }

  /** Position du pointeur dans le document (barre d'état), ou null hors de la toile. */
  get pointerDoc(): Point | null {
    return this.hoverAt ? this.view.toDoc(this.hoverAt) : null;
  }

  /** Couleur de l'espace autour de la toile (suivant le thème). */
  setWorkspaceColor(color: string): void {
    this.workspaceOverride = color;
    this.workspace = color;
    this.requestRender();
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
    this.finishTransform(true);
    this.textRequest = null;
    this.tool = tool;
    if (tool === 'transform') this.startTransform();
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
        this.stroke.begin(layer, this.activeBrush!, this.color, p, pointerType !== 'pen', this.selection.canvas);
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
      case 'select': {
        const mode: SelectMode = screen.shift ? 'add' : screen.alt ? 'subtract' : this.selectOpts.mode;
        if (this.selectOpts.kind === 'wand') {
          this.magicWand(p, mode);
          return false;
        }
        this.selectDraft = { mode, points: [p, p] };
        this.requestRender();
        return true;
      }
      case 'transform': {
        if (!this.transform.active && !this.startTransform()) return false;
        this.transform.pointerDown(p, screen, this.view);
        return true;
      }
      case 'liquify': {
        const layer = this.editableLayer();
        if (!layer) return false;
        this.liquifyStroke.begin(layer, this.liquifyOpts, p, this.selection.canvas);
        this.requestRender();
        return true;
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
      case 'select':
        if (this.selectDraft) {
          const pts = this.selectDraft.points;
          for (const q of points) {
            const d = this.toDocPoint(q);
            if (this.selectOpts.kind === 'lasso') pts.push(d);
            else pts[1] = d;
          }
          this.requestRender();
        }
        break;
      case 'transform':
        this.transform.pointerMove(this.toDocPoint(last), !!last.shift);
        this.requestRender();
        break;
      case 'liquify':
        for (const q of points) this.liquifyStroke.move(this.toDocPoint(q));
        this.requestRender();
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
      case 'select':
        this.finishSelectDraft();
        break;
      case 'transform':
        this.transform.pointerUp();
        break;
      case 'liquify':
        this.pushCommand(this.liquifyStroke.end());
        break;
    }
  }

  private pointerCancel(): void {
    if (this.stroke.active) this.stroke.cancel();
    if (this.liquifyStroke.active) this.liquifyStroke.cancel();
    this.selectDraft = null;
    this.transform.pointerUp();
    if (this.tool === 'shape' && this.shape.kind !== 'polygon') {
      this.shapeStart = null;
      this.live.cancel();
    }
    this.changed();
  }

  private hover(p: Point | null): void {
    this.hoverAt = p;
    for (const fn of this.hoverListeners) fn();
    if (p && this.tool === 'shape' && this.shape.kind === 'polygon' && this.poly.length) {
      this.polyFloat = this.view.toDoc(p);
      this.drawPolygon(false);
    }
    this.requestRender();
  }

  private key(e: KeyboardEvent): boolean {
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (e.key === 'Enter' || e.key === 'Escape') {
      if (this.poly.length) this.finishPolygon(e.key === 'Enter');
      else if (this.transform.active) this.finishTransform(e.key === 'Enter');
      else return false;
      return true;
    }
    if (mod && k === 'a' && !e.shiftKey) this.selectAll();
    else if (mod && (k === 'd' || (k === 'a' && e.shiftKey))) this.deselect();
    else if (mod && k === 'i' && e.shiftKey) this.invertSelection();
    else if (mod && k === 'c') this.copy();
    else if (mod && k === 'x') this.cut();
    else if (mod && k === 't') this.setTool('transform');
    else if (!mod && (e.key === 'Delete' || e.key === 'Backspace')) this.deleteSelection();
    else return false;
    return true;
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
    if (!this.selection.isSelected(p.x, p.y)) return;
    let mask = floodMask(src.data, w, h, p.x, p.y, this.fill.tolerance);
    if (!mask) return;
    if (this.fill.expand > 0) mask = dilate(mask, w, h, this.fill.expand);
    const sel = this.selection.mask;
    if (sel) for (let i = 0; i < mask.length; i++) mask[i] &= sel[i];
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
    this.live.update(shapeBounds([a, b], this.shape.width), (ctx) => drawShape(ctx, this.shape, [a, b], this.color), this.selection.canvas);
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
      this.live.update(shapeBounds(pts, this.shape.width), (ctx) => drawShape(ctx, opts, pts, this.color, closed), this.selection.canvas);
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
      this.selection.canvas,
    );
    this.pushCommand(this.live.commit('text'));
  }

  cancelText(): void {
    this.textRequest = null;
    this.changed();
  }


  // --- Sélection ---

  /** Remplace la sélection (étape annulable). */
  setSelection(mask: Uint8Array | null): void {
    this.finishTransform(true);
    const before = this.selection.copyMask();
    this.selection.set(mask);
    this.pushCommand(new SelectionChange(this.selection, before, this.selection.copyMask()));
  }

  selectAll(): void {
    this.setSelection(new Uint8Array(this.doc.width * this.doc.height).fill(1));
  }

  deselect(): void {
    if (this.selection.active) this.setSelection(null);
  }

  invertSelection(): void {
    const n = this.doc.width * this.doc.height;
    const cur = this.selection.mask;
    const inv = new Uint8Array(n);
    for (let i = 0; i < n; i++) inv[i] = cur ? cur[i] ^ 1 : 0;
    this.setSelection(inv);
  }

  private finishSelectDraft(): void {
    const d = this.selectDraft;
    this.selectDraft = null;
    if (!d) return;
    const { width: w, height: h } = this.doc;
    const [a, b] = d.points;
    let mask: Uint8Array | null = null;
    if (this.selectOpts.kind === 'lasso') {
      if (d.points.length > 3) mask = polygonMask(d.points, w, h);
    } else if (Math.abs(b.x - a.x) >= 1 && Math.abs(b.y - a.y) >= 1) {
      mask = rasterMask(w, h, (ctx) => {
        ctx.beginPath();
        if (this.selectOpts.kind === 'ellipse') {
          ctx.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2, 0, 0, Math.PI * 2);
        } else {
          ctx.rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
        }
        ctx.fill();
      });
    }
    if (!mask) {
      // Simple clic : désélectionne (en mode « remplacer »)
      if (d.mode === 'replace') this.deselect();
      else this.changed();
      return;
    }
    this.setSelection(combineMasks(this.selection.mask, mask, d.mode));
  }

  private magicWand(p: Point, mode: SelectMode): void {
    const { width: w, height: h } = this.doc;
    let data: ImageData;
    if (this.selectOpts.source === 'canvas') {
      this.temp ??= createSurface(w, h);
      this.temp.ctx.clearRect(0, 0, w, h);
      renderComposite(this.temp.ctx, this.doc, false);
      data = this.temp.ctx.getImageData(0, 0, w, h);
    } else {
      data = this.doc.active.surface.ctx.getImageData(0, 0, w, h);
    }
    const mask = floodMask(data.data, w, h, p.x, p.y, this.selectOpts.tolerance);
    // +1 px : inclut le bord anticrénelé (sinon un liseré reste en place quand on déplace)
    if (mask) this.setSelection(combineMasks(this.selection.mask, dilate(mask, w, h, 1), mode));
  }

  /** Efface le contenu sélectionné (ou tout le calque) du calque actif. */
  deleteSelection(): void {
    const layer = this.editableLayer();
    if (!layer) return;
    const { width: w, height: h } = this.doc;
    const r = this.selection.bounds ?? { x: 0, y: 0, w, h };
    const ctx = layer.surface.ctx;
    const before = ctx.getImageData(r.x, r.y, r.w, r.h);
    if (this.selection.canvas) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.drawImage(this.selection.canvas, 0, 0);
      ctx.restore();
    } else {
      ctx.clearRect(r.x, r.y, r.w, r.h);
    }
    this.pushCommand(new PixelPatch('delete', layer, r, before, ctx.getImageData(r.x, r.y, r.w, r.h)));
  }

  /** Remplit la sélection (ou tout le calque) avec la couleur actuelle. */
  fillSelection(): void {
    const layer = this.editableLayer();
    if (!layer) return;
    const { width: w, height: h } = this.doc;
    const r = this.selection.bounds ?? { x: 0, y: 0, w, h };
    const ctx = layer.surface.ctx;
    const before = ctx.getImageData(r.x, r.y, r.w, r.h);
    const tmp = createSurface(r.w, r.h);
    tmp.ctx.fillStyle = this.color;
    tmp.ctx.fillRect(0, 0, r.w, r.h);
    if (this.selection.canvas) {
      tmp.ctx.globalCompositeOperation = 'destination-in';
      tmp.ctx.drawImage(this.selection.canvas, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    }
    ctx.drawImage(tmp.canvas, r.x, r.y);
    this.pushCommand(new PixelPatch('fill', layer, r, before, ctx.getImageData(r.x, r.y, r.w, r.h)));
  }

  // --- Presse-papiers (interne) ---

  get hasClipboard(): boolean {
    return this.clipboard !== null;
  }

  copy(): boolean {
    this.finishTransform(true);
    const layer = this.doc.active;
    const r = this.selection.bounds ?? contentBounds(layer, this.doc.width, this.doc.height);
    if (!r) return false;
    const s = createSurface(r.w, r.h);
    s.ctx.drawImage(layer.surface.canvas, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    if (this.selection.canvas) {
      s.ctx.globalCompositeOperation = 'destination-in';
      s.ctx.drawImage(this.selection.canvas, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
    }
    this.clipboard = { surface: s, x: r.x, y: r.y };
    this.changed();
    return true;
  }

  cut(): void {
    if (this.copy()) this.deleteSelection();
  }

  /** Colle dans un nouveau calque, à la même position, prêt à être déplacé. */
  paste(): void {
    const c = this.clipboard;
    if (!c) return;
    this.placeOnNewLayer(c.surface.canvas, c.x, c.y);
  }

  /** Importe une image dans un nouveau calque (réduite si plus grande que le document), puis la transforme. */
  importImage(img: CanvasImageSource, width: number, height: number): void {
    const { width: w, height: h } = this.doc;
    const k = Math.min(1, w / width, h / height);
    const s = createSurface(Math.max(1, Math.round(width * k)), Math.max(1, Math.round(height * k)));
    s.ctx.imageSmoothingQuality = 'high';
    s.ctx.drawImage(img, 0, 0, s.canvas.width, s.canvas.height);
    this.placeOnNewLayer(s.canvas, Math.round((w - s.canvas.width) / 2), Math.round((h - s.canvas.height) / 2));
  }

  private placeOnNewLayer(src: HTMLCanvasElement, x: number, y: number): void {
    this.finishTransform(true);
    this.finishPolygon(true);
    if (this.selection.active) this.setSelection(null);
    const layer = this.addLayer();
    layer.surface.ctx.drawImage(src, x, y);
    this.tool = 'transform';
    this.startTransform();
    this.changed();
  }

  // --- Déplacer / transformer ---

  private startTransform(): boolean {
    if (this.transform.active) return true;
    const layer = this.editableLayer();
    if (!layer) return false;
    const ok = this.transform.begin(layer, this.selection);
    if (!ok) this.notice = 'transformEmpty';
    this.changed();
    return ok;
  }

  /** Valide (commit) ou annule la transformation en cours. */
  finishTransform(commit: boolean): void {
    if (!this.transform.active) return;
    if (commit) this.pushCommand(this.transform.commit(this.selection));
    else {
      this.transform.cancel();
      this.changed();
    }
  }

  // --- Filtres et effets ---

  get filterSession(): FilterSession | null {
    return this.filter ? { kind: this.filter.kind, params: { ...this.filter.params } } : null;
  }

  /** Ouvre un filtre avec aperçu en direct sur le calque actif (dans la sélection). */
  beginFilter(kind: FilterKind): boolean {
    this.cancelFilter();
    this.finishTransform(true);
    const layer = this.editableLayer();
    if (!layer) return false;
    const { width: w, height: h } = this.doc;
    const rect = this.selection.bounds ?? { x: 0, y: 0, w, h };
    const ctx = layer.surface.ctx;
    this.filter = {
      kind,
      params: defaultParams(kind),
      layer,
      rect,
      orig: ctx.getImageData(rect.x, rect.y, rect.w, rect.h),
      out: ctx.createImageData(rect.w, rect.h),
      pending: false,
    };
    this.computeFilter();
    return true;
  }

  setFilterParams(params: Record<string, number>): void {
    const f = this.filter;
    if (!f) return;
    f.params = { ...f.params, ...params };
    if (f.pending) return;
    f.pending = true;
    requestAnimationFrame(() => this.computeFilter());
  }

  private computeFilter(): void {
    const f = this.filter;
    if (!f) return;
    f.pending = false;
    const { rect: r, orig, out } = f;
    runFilter(f.kind, orig.data, out.data, r.w, r.h, f.params);
    const sel = this.selection.mask;
    if (sel) {
      const W = this.doc.width;
      for (let y = 0; y < r.h; y++) {
        for (let x = 0; x < r.w; x++) {
          if (sel[(r.y + y) * W + r.x + x]) continue;
          const i = (y * r.w + x) * 4;
          out.data[i] = orig.data[i];
          out.data[i + 1] = orig.data[i + 1];
          out.data[i + 2] = orig.data[i + 2];
          out.data[i + 3] = orig.data[i + 3];
        }
      }
    }
    f.layer.surface.ctx.putImageData(out, r.x, r.y);
    this.changed();
  }

  applyFilter(): void {
    const f = this.filter;
    if (!f) return;
    if (f.pending) this.computeFilter();
    this.filter = null;
    const r = f.rect;
    this.pushCommand(new PixelPatch('filter', f.layer, r, f.orig, f.layer.surface.ctx.getImageData(r.x, r.y, r.w, r.h)));
  }

  cancelFilter(): void {
    const f = this.filter;
    if (!f) return;
    this.filter = null;
    f.layer.surface.ctx.putImageData(f.orig, f.rect.x, f.rect.y);
    this.changed();
  }

  // --- Projet ---

  /** Remplace le contenu par un projet enregistré (même taille de document). */
  async loadProject(data: ProjectData): Promise<void> {
    await loadProject(this.doc, data);
    this.history.clear();
    this.selection.set(null);
    this.changed();
  }

  // --- Affichage par-dessus la toile ---

  private drawOverlay(ctx: CanvasRenderingContext2D): void {
    const z = this.view.zoom;
    const [a, b, c, d, e, f] = this.view.matrix();
    ctx.save();
    ctx.transform(a, b, c, d, e, f);
    // « Fourmis » : trait sombre continu + tirets blancs qui défilent (visible sur tout fond)
    const ants = (path: Path2D) => {
      const dash = 4 / z;
      ctx.lineWidth = 1 / z;
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.stroke(path);
      ctx.setLineDash([dash, dash]);
      ctx.lineDashOffset = ((performance.now() / 60) % 8) / z;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke(path);
    };
    const segs = this.selection.segments;
    if (segs.length && !this.transform.active) {
      if (this.selPath?.src !== segs) {
        const path = new Path2D();
        for (let i = 0; i < segs.length; i += 4) {
          path.moveTo(segs[i], segs[i + 1]);
          path.lineTo(segs[i + 2], segs[i + 3]);
        }
        this.selPath = { src: segs, path };
      }
      ants(this.selPath.path);
    }
    const draft = this.selectDraft;
    if (draft) {
      const path = new Path2D();
      const [p, q] = draft.points;
      if (this.selectOpts.kind === 'lasso') {
        draft.points.forEach((pt, i) => (i ? path.lineTo(pt.x, pt.y) : path.moveTo(pt.x, pt.y)));
        path.closePath();
      } else if (this.selectOpts.kind === 'ellipse') {
        path.ellipse((p.x + q.x) / 2, (p.y + q.y) / 2, Math.abs(q.x - p.x) / 2, Math.abs(q.y - p.y) / 2, 0, 0, Math.PI * 2);
      } else {
        path.rect(Math.min(p.x, q.x), Math.min(p.y, q.y), Math.abs(q.x - p.x), Math.abs(q.y - p.y));
      }
      ants(path);
    }
    ctx.restore();
    this.transform.drawOverlay(ctx, this.view);
    if (this.pickAt) {
      // Anneau de la pipette, au-dessus du doigt pour rester visible
      const { x, y } = this.pickAt;
      const cy = y - 70;
      ctx.save();
      ctx.lineWidth = 14;
      ctx.strokeStyle = this.color;
      ctx.beginPath();
      ctx.arc(x, cy, 34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      for (const r of [27, 41]) {
        ctx.beginPath();
        ctx.arc(x, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // ---------- Historique ----------

  undo(): void {
    if (this.transform.active) {
      this.finishTransform(false);
      return;
    }
    if (this.filter) this.cancelFilter();
    if (this.stroke.active || this.live.active) return;
    if (this.history.undo()) this.changed();
  }

  redo(): void {
    if (this.stroke.active || this.live.active || this.transform.active) return;
    if (this.history.redo()) this.changed();
  }

  // ---------- Calques ----------

  setActiveLayer(id: number): void {
    if (this.doc.get(id)) {
      this.finishPolygon(true);
      this.finishTransform(true);
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

  /** Déplace un calque à une position donnée (index 0 = en bas). */
  moveLayerTo(id: number, to: number): void {
    const from = this.doc.indexOf(id);
    to = Math.max(0, Math.min(this.doc.layers.length - 1, to));
    if (from < 0 || from === to) return;
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
    this.history.version++; // pour la sauvegarde automatique
    this.changed();
  }

  private exec(cmd: Command & { redo(): void }): void {
    cmd.redo();
    this.history.push(cmd);
    this.changed();
  }
}
