import type { DrawingDocument } from './layers';
import { compositeOp } from './layers';
import type { ViewTransform } from './view';
import type { Point } from './geometry';

export interface RenderOptions {
  workspace: string;
  /** Contour du pinceau sous le pointeur (coordonnées écran), ou null. */
  cursor: { at: Point; diameter: number } | null;
  /** Dessins par-dessus la toile (sélection, poignées…), appelé avec l'échelle dpr. */
  overlay?: (ctx: CanvasRenderingContext2D) => void;
}

let checker: CanvasPattern | null = null;

function checkerPattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (checker) return checker;
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 16, 16);
  g.fillStyle = '#d9d9d9';
  g.fillRect(0, 0, 8, 8);
  g.fillRect(8, 8, 8, 8);
  checker = ctx.createPattern(c, 'repeat');
  return checker;
}

/** Dessine le document à l'écran : espace de travail, fond, calques, contour du pinceau. */
export function render(
  ctx: CanvasRenderingContext2D,
  viewW: number,
  viewH: number,
  dpr: number,
  doc: DrawingDocument,
  view: ViewTransform,
  opts: RenderOptions,
): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = opts.workspace;
  ctx.fillRect(0, 0, viewW, viewH);

  const [a, b, c, d, e, f] = view.matrix();
  ctx.setTransform(a * dpr, b * dpr, c * dpr, d * dpr, e * dpr, f * dpr);

  // Ombre portée + fond du document
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 12 * dpr;
  ctx.fillStyle = doc.background ?? '#ffffff';
  ctx.fillRect(0, 0, doc.width, doc.height);
  ctx.restore();
  if (!doc.background) {
    const pattern = checkerPattern(ctx);
    if (pattern) {
      // Damier de taille constante à l'écran
      pattern.setTransform(new DOMMatrix().scale(1 / view.zoom));
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, doc.width, doc.height);
    }
  }

  // Pixels nets quand on zoome fort, lissés sinon
  ctx.imageSmoothingEnabled = view.zoom < 2;
  for (const layer of doc.layers) {
    if (!layer.visible || layer.opacity <= 0) continue;
    ctx.globalAlpha = layer.opacity;
    ctx.globalCompositeOperation = compositeOp(layer.blend);
    ctx.drawImage(layer.surface.canvas, 0, 0);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  if (opts.overlay) {
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    opts.overlay(ctx);
    ctx.restore();
  }

  if (opts.cursor && opts.cursor.diameter >= 4) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { at, diameter } = opts.cursor;
    ctx.beginPath();
    ctx.arc(at.x, at.y, diameter / 2, 0, Math.PI * 2);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.stroke();
    ctx.lineWidth = 0.75;
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.stroke();
  }
}

/**
 * Dessine les calques visibles (et le fond si demandé) dans `ctx`, en coordonnées du document.
 * Sert au remplissage « tous les calques » et à la pipette.
 */
export function renderComposite(ctx: CanvasRenderingContext2D, doc: DrawingDocument, withBackground: boolean): void {
  if (withBackground && doc.background) {
    ctx.fillStyle = doc.background;
    ctx.fillRect(0, 0, doc.width, doc.height);
  }
  for (const layer of doc.layers) {
    if (!layer.visible || layer.opacity <= 0) continue;
    ctx.globalAlpha = layer.opacity;
    ctx.globalCompositeOperation = compositeOp(layer.blend);
    ctx.drawImage(layer.surface.canvas, 0, 0);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
