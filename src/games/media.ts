import { createSurface } from '../engine/canvas';
import { rng } from '../engine/random';
import { base64ToBlob, blobToBase64 } from '../net/chunks';
import { CORPSE_H, CORPSE_STRIP, GAME_H, GAME_W } from './modes';
import type { Entry, GameState } from './game';

/** Gribouillis de départ (mode Gribouillis), identique chez tous grâce à la graine. */
export function drawScribble(ctx: CanvasRenderingContext2D, seed: number, w = GAME_W, h = GAME_H): void {
  const r = rng(seed);
  ctx.save();
  ctx.strokeStyle = '#1f2430';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const strokes = 2 + Math.floor(r() * 2);
  for (let s = 0; s < strokes; s++) {
    ctx.beginPath();
    let x = w * (0.25 + r() * 0.5);
    let y = h * (0.25 + r() * 0.5);
    ctx.moveTo(x, y);
    const segs = 2 + Math.floor(r() * 3);
    for (let i = 0; i < segs; i++) {
      const nx = w * (0.15 + r() * 0.7);
      const ny = h * (0.15 + r() * 0.7);
      ctx.bezierCurveTo(x + (r() - 0.5) * w * 0.5, y + (r() - 0.5) * h * 0.5, nx + (r() - 0.5) * w * 0.5, ny + (r() - 0.5) * h * 0.5, nx, ny);
      x = nx;
      y = ny;
    }
    ctx.stroke();
  }
  ctx.restore();
}

export function canvasToBase64(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? blobToBase64(b).then(resolve, reject) : reject(new Error('png'))), 'image/png'),
  );
}

const cache = new Map<string, Promise<ImageBitmap>>();
/** Image d'une contribution (mise en cache). */
export function entryImage(e: Entry): Promise<ImageBitmap> | null {
  if (e.kind !== 'image' || !e.data) return null;
  let p = cache.get(e.data);
  if (!p) {
    if (cache.size > 80) cache.clear();
    p = createImageBitmap(base64ToBlob(e.data));
    cache.set(e.data, p);
  }
  return p;
}

/** Cadavre exquis : les parties empilées, chacune recouvrant la bande du bas de la précédente. */
export async function composeStack(entries: Entry[]): Promise<HTMLCanvasElement> {
  const step = CORPSE_H - CORPSE_STRIP;
  const s = createSurface(GAME_W, step * Math.max(1, entries.length) + CORPSE_STRIP);
  s.ctx.fillStyle = '#ffffff';
  s.ctx.fillRect(0, 0, s.canvas.width, s.canvas.height);
  for (let i = 0; i < entries.length; i++) {
    const img = await entryImage(entries[i]);
    if (img) s.ctx.drawImage(img, 0, i * step);
  }
  return s.canvas;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Une chaîne en une seule image verticale (téléchargement). */
export async function composeChain(entries: Entry[], names: (id: string) => string, empty: string): Promise<HTMLCanvasElement> {
  const W = 960;
  const pad = 32;
  const blocks: { h: number; draw: (ctx: CanvasRenderingContext2D, y: number) => Promise<void> | void }[] = [];
  const measure = createSurface(1, 1).ctx;
  measure.font = '600 34px system-ui, sans-serif';
  for (const e of entries) {
    const label = names(e.author);
    if (e.kind === 'image') {
      const img = await entryImage(e);
      const h = img ? Math.round((img.height * (W - pad * 2)) / img.width) : 200;
      blocks.push({
        h: h + 60,
        draw: (ctx, y) => {
          ctx.fillStyle = '#5b6170';
          ctx.font = '500 22px system-ui, sans-serif';
          ctx.fillText(label, pad, y + 28);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(pad, y + 40, W - pad * 2, h);
          ctx.strokeStyle = '#e3d9c8';
          ctx.strokeRect(pad, y + 40, W - pad * 2, h);
          if (img) ctx.drawImage(img, pad, y + 40, W - pad * 2, h);
        },
      });
    } else {
      const lines = wrapText(measure, e.kind === 'text' ? e.data : empty, W - pad * 2 - 40);
      blocks.push({
        h: lines.length * 44 + 80,
        draw: (ctx, y) => {
          ctx.fillStyle = '#5b6170';
          ctx.font = '500 22px system-ui, sans-serif';
          ctx.fillText(label, pad, y + 28);
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.roundRect(pad, y + 40, W - pad * 2, lines.length * 44 + 28, 18);
          ctx.fill();
          ctx.fillStyle = '#1f2430';
          ctx.font = '600 34px system-ui, sans-serif';
          lines.forEach((l, i) => ctx.fillText(l, pad + 20, y + 84 + i * 44));
        },
      });
    }
  }
  const H = blocks.reduce((n, b) => n + b.h + 16, pad);
  const s = createSurface(W, H);
  s.ctx.fillStyle = '#fbf6ee';
  s.ctx.fillRect(0, 0, W, H);
  let y = pad / 2;
  for (const b of blocks) {
    await b.draw(s.ctx, y);
    y += b.h + 16;
  }
  return s.canvas;
}

/** Flip-book : GIF animé des images de la chaîne. */
export async function flipbookGif(entries: Entry[], delay = 250): Promise<Blob> {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
  const W = GAME_W / 2;
  const H = GAME_H / 2;
  const s = createSurface(W, H);
  const gif = GIFEncoder();
  for (const e of entries) {
    s.ctx.fillStyle = '#ffffff';
    s.ctx.fillRect(0, 0, W, H);
    const img = await entryImage(e);
    if (img) s.ctx.drawImage(img, 0, 0, W, H);
    const data = s.ctx.getImageData(0, 0, W, H).data;
    const palette = quantize(data, 256);
    gif.writeFrame(applyPalette(data, palette), W, H, { palette, delay });
  }
  gif.finish();
  return new Blob([gif.bytes().slice()], { type: 'image/gif' });
}

/** Contributions d'une chaîne, dans l'ordre (cases manquantes = vides). */
export function chainEntries(state: GameState, get: (c: number, r: number) => Entry | undefined, chain: number): Entry[] {
  return Array.from({ length: state.rounds }, (_, r) => get(chain, r) ?? { kind: 'empty', data: '', author: '' });
}
