import type { Rect } from '../geometry';

/**
 * Remplissage par diffusion (algorithme par lignes) à partir de (sx, sy).
 * Un pixel est rempli s'il ressemble au pixel de départ à `tolerance` près (0–255 par canal).
 * Renvoie un masque (1 = à remplir) ou null si le point est hors image.
 */
export function floodMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  sx: number,
  sy: number,
  tolerance: number,
): Uint8Array | null {
  sx = Math.floor(sx);
  sy = Math.floor(sy);
  if (sx < 0 || sy < 0 || sx >= width || sy >= height) return null;
  const i0 = (sy * width + sx) * 4;
  const r0 = data[i0];
  const g0 = data[i0 + 1];
  const b0 = data[i0 + 2];
  const a0 = data[i0 + 3];
  const matches = (p: number): boolean => {
    const i = p * 4;
    const a = data[i + 3];
    // Pixels (presque) transparents : leur couleur n'a pas de sens, seul l'alpha compte.
    if (a0 <= tolerance && a <= tolerance) return true;
    return (
      Math.abs(a - a0) <= tolerance &&
      Math.abs(data[i] - r0) <= tolerance &&
      Math.abs(data[i + 1] - g0) <= tolerance &&
      Math.abs(data[i + 2] - b0) <= tolerance
    );
  };

  const mask = new Uint8Array(width * height);
  const stack: number[] = [sx, sy];
  while (stack.length) {
    const y = stack.pop()!;
    let x = stack.pop()!;
    let p = y * width + x;
    while (x > 0 && !mask[p - 1] && matches(p - 1)) {
      x--;
      p--;
    }
    let up = false;
    let down = false;
    for (; x < width && !mask[p] && matches(p); x++, p++) {
      mask[p] = 1;
      if (y > 0) {
        const q = p - width;
        const ok = !mask[q] && matches(q);
        if (ok && !up) stack.push(x, y - 1);
        up = ok;
      }
      if (y < height - 1) {
        const q = p + width;
        const ok = !mask[q] && matches(q);
        if (ok && !down) stack.push(x, y + 1);
        down = ok;
      }
    }
  }
  return mask;
}

/** Agrandit le masque de `radius` pixels (passe sous le bord anticrénelé des traits). */
export function dilate(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  let cur = mask;
  for (let r = 0; r < radius; r++) {
    const next = cur.slice();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = y * width + x;
        if (cur[p]) continue;
        if ((x > 0 && cur[p - 1]) || (x < width - 1 && cur[p + 1]) || (y > 0 && cur[p - width]) || (y < height - 1 && cur[p + width])) {
          next[p] = 1;
        }
      }
    }
    cur = next;
  }
  return cur;
}

export function maskBounds(mask: Uint8Array, width: number, height: number): Rect | null {
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      if (mask[row + x]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
