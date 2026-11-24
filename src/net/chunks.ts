/** Taille max d'un morceau de message (caractères base64) : les messages temps réel sont limités en taille. */
export const CHUNK_SIZE = 100_000;

export function splitChunks(data: string, size = CHUNK_SIZE): string[] {
  if (!data.length) return [''];
  const out: string[] = [];
  for (let i = 0; i < data.length; i += size) out.push(data.slice(i, i + size));
  return out;
}

/** Recolle les morceaux d'un message découpé (identifiés par `id`). */
export class ChunkAssembler {
  private parts = new Map<string, { got: (string | undefined)[]; count: number; at: number }>();

  /** Renvoie le message complet quand le dernier morceau arrive, sinon null. */
  add(id: string, index: number, total: number, data: string, now = Date.now()): string | null {
    if (total <= 1) return data;
    let e = this.parts.get(id);
    if (!e) {
      e = { got: new Array(total), count: 0, at: now };
      this.parts.set(id, e);
    }
    if (e.got[index] === undefined) {
      e.got[index] = data;
      e.count++;
    }
    if (e.count < total) {
      this.prune(now);
      return null;
    }
    this.parts.delete(id);
    return e.got.join('');
  }

  /** Oublie les messages incomplets trop anciens (morceau perdu). */
  private prune(now: number): void {
    for (const [id, e] of this.parts) if (now - e.at > 60_000) this.parts.delete(id);
  }
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export function base64ToBlob(b64: string, type = 'image/png'): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}
