export type LiquifyMode = 'push' | 'twirlRight' | 'twirlLeft' | 'pinch' | 'expand';

export interface LiquifyOptions {
  mode: LiquifyMode;
  /** Diamètre en pixels du document. */
  size: number;
  /** 0 à 1 */
  strength: number;
}

function sample(src: Uint8ClampedArray, w: number, h: number, x: number, y: number, out: Uint8ClampedArray, o: number): void {
  // Interpolation bilinéaire en couleurs prémultipliées
  x = Math.max(0, Math.min(w - 1, x));
  y = Math.max(0, Math.min(h - 1, y));
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
  const fx = x - x0, fy = y - y0;
  const wts = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy];
  const idx = [(y0 * w + x0) * 4, (y0 * w + x1) * 4, (y1 * w + x0) * 4, (y1 * w + x1) * 4];
  let r = 0, g = 0, b = 0, a = 0;
  for (let k = 0; k < 4; k++) {
    const i = idx[k];
    const al = src[i + 3] * wts[k];
    r += src[i] * al; g += src[i + 1] * al; b += src[i + 2] * al; a += al;
  }
  const inv = a > 0 ? 1 / a : 0;
  out[o] = r * inv; out[o + 1] = g * inv; out[o + 2] = b * inv; out[o + 3] = a;
}

/**
 * Déforme une zone de pixels (w × h) autour de (cx, cy).
 * (dx, dy) = déplacement du pinceau depuis le tampon précédent (mode « pousser »).
 */
export function liquify(
  src: Uint8ClampedArray,
  out: Uint8ClampedArray,
  w: number,
  h: number,
  cx: number,
  cy: number,
  o: LiquifyOptions,
  dx: number,
  dy: number,
): void {
  out.set(src);
  const radius = o.size / 2;
  const r2 = radius * radius;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5 - cx;
      const py = y + 0.5 - cy;
      const d2 = px * px + py * py;
      if (d2 >= r2) continue;
      const t = 1 - d2 / r2;
      const f = t * t * o.strength;
      let sx: number, sy: number;
      switch (o.mode) {
        case 'push':
          sx = px - dx * f; sy = py - dy * f;
          break;
        case 'twirlRight':
        case 'twirlLeft': {
          const a = (o.mode === 'twirlRight' ? -1 : 1) * f * 0.25;
          const c = Math.cos(a), s = Math.sin(a);
          sx = px * c - py * s; sy = px * s + py * c;
          break;
        }
        case 'pinch':
          sx = px * (1 + f * 0.1); sy = py * (1 + f * 0.1);
          break;
        case 'expand':
          sx = px * (1 - f * 0.1); sy = py * (1 - f * 0.1);
          break;
      }
      sample(src, w, h, cx + sx - 0.5, cy + sy - 0.5, out, (y * w + x) * 4);
    }
  }
}
