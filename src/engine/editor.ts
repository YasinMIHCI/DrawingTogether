import { History } from './history';
import { DrawingDocument, type Layer, type LayerProps } from './layers';
import { AddLayer, MergeDown, MoveLayer, PixelPatch, RemoveLayer, SetLayerProps } from './commands';
import { ViewTransform } from './view';
import { StrokeRenderer } from './brush/stroke';
import { DEFAULT_BRUSH, type BrushSettings } from './brush/settings';
import type { InputPoint } from './brush/sampler';
import { attachInput } from './input';
import { render } from './renderer';
import type { Point } from './geometry';

export type Notice = 'layerLocked' | 'layerHidden' | null;

export interface EditorOptions {
  width: number;
  height: number;
  /** Mémoire max de l'historique (octets). */
  historyBytes?: number;
  historySteps?: number;
}

/** Point d'entrée du moteur : document + historique + vue + pinceau, branché sur un <canvas>. */
export class Editor {
  readonly doc: DrawingDocument;
  readonly history: History;
  readonly view = new ViewTransform();
  brush: BrushSettings = { ...DEFAULT_BRUSH };
  notice: Notice = null;

  private stroke: StrokeRenderer;
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
  }

  /** Abonnement aux changements (calques, historique, vue). Renvoie la fonction de désabonnement. */
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
      strokeStart: (p) => this.strokeStart(p),
      strokeMove: (ps) => this.strokeMove(ps),
      strokeEnd: () => this.strokeEnd(),
      strokeCancel: () => this.strokeCancel(),
      hover: (p) => {
        this.hoverAt = p;
        this.requestRender();
      },
      undo: () => this.undo(),
      redo: () => this.redo(),
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
    render(this.ctx, this.viewW, this.viewH, this.dpr, this.doc, this.view, {
      workspace: this.workspace,
      cursor: this.hoverAt ? { at: this.hoverAt, diameter: this.brush.size * this.view.zoom } : null,
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

  // ---------- Dessin ----------

  private strokeStart(screen: InputPoint): boolean {
    const layer = this.doc.active;
    const notice: Notice = layer.locked ? 'layerLocked' : !layer.visible ? 'layerHidden' : null;
    if (notice) {
      this.notice = notice;
      this.changed();
      return false;
    }
    if (this.notice) {
      this.notice = null;
      this.changed();
    }
    this.stroke.begin(layer, this.brush, this.toDocPoint(screen));
    this.requestRender();
    return true;
  }

  private strokeMove(points: InputPoint[]): void {
    this.stroke.add(points.map((p) => this.toDocPoint(p)));
    this.requestRender();
  }

  private strokeEnd(): void {
    const cmd = this.stroke.end();
    if (cmd) this.history.push(cmd);
    this.changed();
  }

  private strokeCancel(): void {
    this.stroke.cancel();
    this.changed();
  }

  private toDocPoint(p: InputPoint): InputPoint {
    return { ...this.view.toDoc(p), pressure: p.pressure };
  }

  setBrush(settings: Partial<BrushSettings>): void {
    Object.assign(this.brush, settings);
    this.requestRender();
  }

  // ---------- Historique ----------

  undo(): void {
    if (this.stroke.active) return;
    if (this.history.undo()) this.changed();
  }

  redo(): void {
    if (this.stroke.active) return;
    if (this.history.redo()) this.changed();
  }

  // ---------- Calques ----------

  setActiveLayer(id: number): void {
    if (this.doc.get(id)) {
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
    this.history.push(new PixelPatch('clear', layer, { x: 0, y: 0, w, h }, before, after));
    this.changed();
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

  private exec(cmd: { redo(): void } & Parameters<History['push']>[0]): void {
    cmd.redo();
    this.history.push(cmd);
    this.changed();
  }
}
