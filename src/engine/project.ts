import { DrawingDocument, Layer, BLEND_MODES, type BlendMode } from './layers';
import { createSurface } from './canvas';
import { renderComposite } from './renderer';

export interface LayerData {
  name: string | null;
  number: number;
  visible: boolean;
  opacity: number;
  blend: BlendMode;
  locked: boolean;
  /** Image PNG du calque. */
  image: Blob;
}

/** Projet complet (calques séparés), pour la sauvegarde locale et les fichiers .dtproj. */
export interface ProjectData {
  version: 1;
  width: number;
  height: number;
  background: string | null;
  active: number;
  layers: LayerData[];
}

export const PROJECT_EXTENSION = '.dtproj';

function toBlob(canvas: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), type, quality),
  );
}

export async function saveProject(doc: DrawingDocument): Promise<ProjectData> {
  const layers: LayerData[] = [];
  for (const l of doc.layers) {
    layers.push({
      name: l.name,
      number: l.number,
      visible: l.visible,
      opacity: l.opacity,
      blend: l.blend,
      locked: l.locked,
      image: await toBlob(l.surface.canvas),
    });
  }
  return { version: 1, width: doc.width, height: doc.height, background: doc.background, active: doc.indexOf(doc.activeId), layers };
}

/** Charge les calques du projet dans un document de même taille. */
export async function loadProject(doc: DrawingDocument, data: ProjectData): Promise<void> {
  if (data.width !== doc.width || data.height !== doc.height) throw new Error('Document size mismatch');
  const layers: Layer[] = [];
  for (const ld of data.layers) {
    const layer = new Layer(doc.width, doc.height, ld.number);
    Object.assign(layer, {
      name: ld.name,
      visible: ld.visible,
      opacity: ld.opacity,
      blend: (BLEND_MODES as readonly string[]).includes(ld.blend) ? ld.blend : 'normal',
      locked: ld.locked,
    });
    const bmp = await createImageBitmap(ld.image);
    layer.surface.ctx.drawImage(bmp, 0, 0);
    bmp.close?.();
    layers.push(layer);
  }
  doc.background = data.background;
  doc.replaceLayers(layers, data.active);
}

/** Image aplatie (tous les calques visibles + fond). JPEG : fond blanc si transparent. */
export async function exportImage(doc: DrawingDocument, type: 'png' | 'jpeg', quality = 0.92): Promise<Blob> {
  const s = createSurface(doc.width, doc.height);
  if (type === 'jpeg') {
    s.ctx.fillStyle = '#ffffff';
    s.ctx.fillRect(0, 0, doc.width, doc.height);
  }
  renderComposite(s.ctx, doc, true);
  return toBlob(s.canvas, `image/${type}`, quality);
}

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}

/** Fichier projet (JSON, images en base64). */
export async function projectToFile(data: ProjectData): Promise<Blob> {
  const layers = await Promise.all(data.layers.map(async (l) => ({ ...l, image: await blobToDataUrl(l.image) })));
  return new Blob([JSON.stringify({ app: 'DrawingTogether', ...data, layers })], { type: 'application/json' });
}

export async function projectFromFile(file: Blob): Promise<ProjectData> {
  const json = JSON.parse(await file.text());
  if (json.app !== 'DrawingTogether' || json.version !== 1 || !Array.isArray(json.layers)) {
    throw new Error('Not a DrawingTogether project');
  }
  const layers: LayerData[] = await Promise.all(
    json.layers.map(async (l: LayerData & { image: string }) => ({ ...l, image: await (await fetch(l.image)).blob() })),
  );
  return { version: 1, width: json.width, height: json.height, background: json.background, active: json.active ?? 0, layers };
}
