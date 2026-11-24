import type { BlendMode } from '../engine/layers';
import { SUPABASE_KEY, SUPABASE_URL } from './config';

export const BUCKET = 'shared-canvases';

export interface SavedLayer {
  owner: string;
  name: string | null;
  opacity: number;
  blend: BlendMode;
  seq: number;
}

/** Dernière sauvegarde d'une toile partagée (une seule par salle : chaque sauvegarde remplace la précédente). */
export interface SavedCanvas {
  v: 1;
  width: number;
  height: number;
  background: string | null;
  layers: SavedLayer[];
  savedAt: number;
}

export interface CanvasStore {
  load(code: string): Promise<{ meta: SavedCanvas; images: Map<string, Blob> } | null>;
  saveLayer(code: string, owner: string, png: Blob): Promise<void>;
  saveMeta(code: string, meta: SavedCanvas): Promise<void>;
  remove(code: string): Promise<void>;
}

const path = (code: string, file: string) => `rooms/${code}/${file}`;

/** Stockage Supabase (bucket « shared-canvases », à créer avec supabase/setup.sql). */
export const supabaseCanvasStore: CanvasStore = {
  async load(code) {
    const bucket = await storage();
    const { data, error } = await bucket.download(path(code, 'meta.json'));
    if (error || !data) {
      // « Objet introuvable » = pas encore de sauvegarde ; autre erreur = stockage indisponible
      if (isNotFound(error)) return null;
      throw error ?? new Error('download failed');
    }
    const meta = JSON.parse(await data.text()) as SavedCanvas;
    const images = new Map<string, Blob>();
    await Promise.all(
      meta.layers.map(async (l) => {
        const r = await bucket.download(path(code, `${l.owner}.png`));
        if (r.data) images.set(l.owner, r.data);
      }),
    );
    return { meta, images };
  },
  async saveLayer(code, owner, png) {
    const { error } = await (await storage()).upload(path(code, `${owner}.png`), png, { upsert: true, contentType: 'image/png' });
    if (error) throw error;
  },
  async saveMeta(code, meta) {
    const blob = new Blob([JSON.stringify(meta)], { type: 'application/json' });
    const { error } = await (await storage()).upload(path(code, 'meta.json'), blob, { upsert: true, contentType: 'application/json' });
    if (error) throw error;
  },
  async remove(code) {
    const bucket = await storage();
    const { data } = await bucket.list(`rooms/${code}`);
    if (data?.length) await bucket.remove(data.map((f) => path(code, f.name)));
  },
};

function isNotFound(error: unknown): boolean {
  const e = error as { status?: number; statusCode?: string | number; message?: string; originalError?: { status?: number } } | null;
  if (!e) return false;
  const status = Number(e.status ?? e.statusCode ?? e.originalError?.status);
  return status === 400 || status === 404 || /not found/i.test(e.message ?? '');
}

async function storage() {
  const { createClient } = await import('@supabase/supabase-js');
  client ??= createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return client.storage.from(BUCKET);
}
let client: import('@supabase/supabase-js').SupabaseClient | null = null;
