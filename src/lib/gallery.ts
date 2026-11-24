import type { DrawingDocument } from '../engine/layers';
import type { ProjectData } from '../engine/project';
import { saveProject } from '../engine/project';
import { createSurface } from '../engine/canvas';
import { renderComposite } from '../engine/renderer';
import { dbDelete, dbGet, dbSet } from './db';

/** Un dessin de la galerie locale (les données sont dans IndexedDB, à part). */
export interface DrawingInfo {
  id: string;
  name: string;
  width: number;
  height: number;
  createdAt: number;
  updatedAt: number;
}

const INDEX = 'gallery:index';
const docKey = (id: string) => `gallery:doc:${id}`;
const thumbKey = (id: string) => `gallery:thumb:${id}`;
const LAST = 'dt.lastDrawing';

export const newDrawingId = () => `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Liste des dessins, du plus récent au plus ancien. */
export async function listDrawings(): Promise<DrawingInfo[]> {
  let list = (await dbGet<DrawingInfo[]>(INDEX)) ?? [];
  if (!list.length) {
    // Ancienne sauvegarde automatique unique → premier dessin de la galerie
    const old = await dbGet<ProjectData>('autosave');
    if (old?.layers?.length) {
      const id = newDrawingId();
      await dbSet(docKey(id), old);
      list = [{ id, name: '', width: old.width, height: old.height, createdAt: Date.now(), updatedAt: Date.now() }];
      await dbSet(INDEX, list);
      await dbDelete('autosave');
    }
  }
  return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadDrawing(id: string): Promise<ProjectData | undefined> {
  return dbGet<ProjectData>(docKey(id));
}

export async function loadThumb(id: string): Promise<Blob | undefined> {
  return dbGet<Blob>(thumbKey(id));
}

/** Miniature (320 px max) du dessin, fond compris. */
export function thumbnail(doc: DrawingDocument, max = 320): Promise<Blob | null> {
  const k = Math.min(1, max / Math.max(doc.width, doc.height));
  const s = createSurface(Math.max(1, Math.round(doc.width * k)), Math.max(1, Math.round(doc.height * k)));
  s.ctx.scale(k, k);
  s.ctx.imageSmoothingQuality = 'high';
  if (!doc.background) {
    s.ctx.fillStyle = '#ffffff';
    s.ctx.fillRect(0, 0, doc.width, doc.height);
  }
  renderComposite(s.ctx, doc, true);
  return new Promise((r) => s.canvas.toBlob((b) => r(b), 'image/png'));
}

async function updateIndex(f: (list: DrawingInfo[]) => DrawingInfo[]): Promise<void> {
  const list = (await dbGet<DrawingInfo[]>(INDEX)) ?? [];
  await dbSet(INDEX, f(list));
}

/** Enregistre le dessin (projet complet + miniature) et met la galerie à jour. */
export async function saveDrawing(id: string, doc: DrawingDocument): Promise<boolean> {
  const ok = await dbSet(docKey(id), await saveProject(doc));
  const thumb = await thumbnail(doc);
  if (thumb) await dbSet(thumbKey(id), thumb);
  await updateIndex((list) => {
    const now = Date.now();
    const cur = list.find((d) => d.id === id);
    if (cur) return list.map((d) => (d.id === id ? { ...d, width: doc.width, height: doc.height, updatedAt: now } : d));
    return [...list, { id, name: '', width: doc.width, height: doc.height, createdAt: now, updatedAt: now }];
  });
  rememberLast(id);
  return ok;
}

/** Ajoute un projet existant (fichier .dtproj) comme nouveau dessin. */
export async function addProject(data: ProjectData, name = ''): Promise<string> {
  const id = newDrawingId();
  await dbSet(docKey(id), data);
  await updateIndex((list) => [...list, { id, name, width: data.width, height: data.height, createdAt: Date.now(), updatedAt: Date.now() }]);
  return id;
}

export async function renameDrawing(id: string, name: string): Promise<void> {
  await updateIndex((list) => list.map((d) => (d.id === id ? { ...d, name: name.trim().slice(0, 60) } : d)));
}

export async function duplicateDrawing(id: string, suffix: string): Promise<string | null> {
  const data = await loadDrawing(id);
  if (!data) return null;
  const list = (await dbGet<DrawingInfo[]>(INDEX)) ?? [];
  const src = list.find((d) => d.id === id);
  const copy = await addProject(data, `${src?.name || ''} ${suffix}`.trim());
  const thumb = await loadThumb(id);
  if (thumb) await dbSet(thumbKey(copy), thumb);
  return copy;
}

export async function deleteDrawing(id: string): Promise<void> {
  await dbDelete(docKey(id));
  await dbDelete(thumbKey(id));
  await updateIndex((list) => list.filter((d) => d.id !== id));
  if (lastDrawing() === id) rememberLast(null);
}

export function lastDrawing(): string | null {
  try {
    return localStorage.getItem(LAST);
  } catch {
    return null;
  }
}

function rememberLast(id: string | null): void {
  try {
    if (id) localStorage.setItem(LAST, id);
    else localStorage.removeItem(LAST);
  } catch {
    /* rien */
  }
}
