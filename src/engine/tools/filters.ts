import { rng } from '../random';

export type FilterKind =
  | 'brightnessContrast' | 'hueSaturation' | 'blur' | 'invert' | 'grayscale'
  | 'sepia' | 'posterize' | 'pixelate' | 'noise' | 'sharpen';

export interface FilterParam {
  id: string;
  min: number;
  max: number;
  step: number;
  value: number;
}

/** Filtres (T1.8) et effets (T1.10), avec leurs réglages par défaut. */
export const FILTERS: Record<FilterKind, { group: 'filter' | 'effect'; params: FilterParam[] }> = {
  brightnessContrast: {
    group: 'filter',
    params: [
      { id: 'brightness', min: -100, max: 100, step: 1, value: 0 },
      { id: 'contrast', min: -100, max: 100, step: 1, value: 0 },
    ],
  },
  hueSaturation: {
    group: 'filter',
    params: [
      { id: 'hue', min: -180, max: 180, step: 1, value: 0 },
      { id: 'saturation', min: -100, max: 100, step: 1, value: 0 },
      { id: 'lightness', min: -100, max: 100, step: 1, value: 0 },
    ],
  },
  blur: { group: 'filter', params: [{ id: 'radius', min: 0, max: 50, step: 0.5, value: 4 }] },
  invert: { group: 'filter', params: [] },
  grayscale: { group: 'filter', params: [] },
  sepia: { group: 'effect', params: [{ id: 'amount', min: 0, max: 100, step: 1, value: 100 }] },
  posterize: { group: 'effect', params: [{ id: 'levels', min: 2, max: 16, step: 1, value: 4 }] },
  pixelate: { group: 'effect', params: [{ id: 'size', min: 2, max: 64, step: 1, value: 8 }] },
  noise: { group: 'effect', params: [{ id: 'amount', min: 0, max: 100, step: 1, value: 20 }] },
  sharpen: { group: 'effect', params: [{ id: 'amount', min: 0, max: 300, step: 1, value: 100 }] },
};

export function defaultParams(kind: FilterKind): Record<string, number> {
  return Object.fromEntries(FILTERS[kind].params.map((p) => [p.id, p.value]));
}

const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

/** Flou gaussien approché par 3 flous en boîte, sur des couleurs prémultipliées par l'alpha. */
function gaussianBlur(src: Uint8ClampedArray, out: Uint8ClampedArray, w: number, h: number, radius: number): void {
  if (radius <= 0) {
    out.set(src);
    return;
  }
  const n = w * h;
  const ch = [0, 1, 2, 3].map(() => new Float32Array(n));
  for (let i = 0; i < n; i++) {
    const a = src[i * 4 + 3] / 255;
    ch[0][i] = src[i * 4] * a;
    ch[1][i] = src[i * 4 + 1] * a;
    ch[2][i] = src[i * 4 + 2] * a;
    ch[3][i] = src[i * 4 + 3];
  }
  // Tailles de boîtes pour approcher un gaussien d'écart-type `radius`
  const sigma = radius;
  const wIdeal = Math.sqrt((12 * sigma * sigma) / 3 + 1);
  let wl = Math.floor(wIdeal);
  if (wl % 2 === 0) wl--;
  const m = Math.round((12 * sigma * sigma - 3 * wl * wl - 12 * wl - 9) / (-4 * wl - 4));
  const boxes = [0, 1, 2].map((i) => ((i < m ? wl : wl + 2) - 1) / 2);
  const tmp = new Float32Array(n);
  for (const c of ch) {
    for (const r of boxes) {
      boxPass(c, tmp, w, h, r, true);
      boxPass(tmp, c, w, h, r, false);
    }
  }
  for (let i = 0; i < n; i++) {
    const a = ch[3][i];
    out[i * 4 + 3] = a;
    const k = a > 0 ? 255 / a : 0;
    out[i * 4] = ch[0][i] * k;
    out[i * 4 + 1] = ch[1][i] * k;
    out[i * 4 + 2] = ch[2][i] * k;
  }
}

function boxPass(src: Float32Array, dst: Float32Array, w: number, h: number, r: number, horizontal: boolean): void {
  const len = horizontal ? w : h;
  const lines = horizontal ? h : w;
  const step = horizontal ? 1 : w;
  const k = 1 / (2 * r + 1);
  for (let l = 0; l < lines; l++) {
    const base = horizontal ? l * w : l;
    const at = (i: number) => src[base + Math.min(len - 1, Math.max(0, i)) * step];
    let acc = 0;
    for (let i = -r; i <= r; i++) acc += at(i);
    for (let i = 0; i < len; i++) {
      dst[base + i * step] = acc * k;
      acc += at(i + r + 1) - at(i - r);
    }
  }
}

/** Applique un filtre : `src` et `out` sont des pixels RGBA de taille w × h. */
export function applyFilter(
  kind: FilterKind,
  src: Uint8ClampedArray,
  out: Uint8ClampedArray,
  w: number,
  h: number,
  p: Record<string, number>,
): void {
  const n = w * h * 4;
  switch (kind) {
    case 'brightnessContrast': {
      const b = p.brightness * 2.55;
      const c = p.contrast * 2.55;
      const f = (259 * (c + 255)) / (255 * (259 - c));
      for (let i = 0; i < n; i += 4) {
        for (let k = 0; k < 3; k++) out[i + k] = clamp(f * (src[i + k] + b - 128) + 128);
        out[i + 3] = src[i + 3];
      }
      break;
    }
    case 'hueSaturation': {
      const dh = p.hue / 360;
      const ds = p.saturation / 100;
      const dl = p.lightness / 100;
      for (let i = 0; i < n; i += 4) {
        let [hh, s, l] = rgbToHsl(src[i], src[i + 1], src[i + 2]);
        hh = (hh + dh + 1) % 1;
        s = ds >= 0 ? s + (1 - s) * ds * s : s * (1 + ds);
        l = dl >= 0 ? l + (1 - l) * dl : l * (1 + dl);
        const [r, g, bb] = hslToRgb(hh, Math.min(1, Math.max(0, s)), Math.min(1, Math.max(0, l)));
        out[i] = r;
        out[i + 1] = g;
        out[i + 2] = bb;
        out[i + 3] = src[i + 3];
      }
      break;
    }
    case 'blur':
      gaussianBlur(src, out, w, h, p.radius);
      break;
    case 'invert':
      for (let i = 0; i < n; i += 4) {
        out[i] = 255 - src[i];
        out[i + 1] = 255 - src[i + 1];
        out[i + 2] = 255 - src[i + 2];
        out[i + 3] = src[i + 3];
      }
      break;
    case 'grayscale':
      for (let i = 0; i < n; i += 4) {
        const y = 0.299 * src[i] + 0.587 * src[i + 1] + 0.114 * src[i + 2];
        out[i] = out[i + 1] = out[i + 2] = y;
        out[i + 3] = src[i + 3];
      }
      break;
    case 'sepia': {
      const a = p.amount / 100;
      for (let i = 0; i < n; i += 4) {
        const r = src[i], g = src[i + 1], b = src[i + 2];
        out[i] = clamp(r + a * (0.393 * r + 0.769 * g + 0.189 * b - r));
        out[i + 1] = clamp(g + a * (0.349 * r + 0.686 * g + 0.168 * b - g));
        out[i + 2] = clamp(b + a * (0.272 * r + 0.534 * g + 0.131 * b - b));
        out[i + 3] = src[i + 3];
      }
      break;
    }
    case 'posterize': {
      const lv = Math.max(2, Math.round(p.levels)) - 1;
      for (let i = 0; i < n; i += 4) {
        for (let k = 0; k < 3; k++) out[i + k] = (Math.round((src[i + k] / 255) * lv) / lv) * 255;
        out[i + 3] = src[i + 3];
      }
      break;
    }
    case 'pixelate': {
      const s = Math.max(1, Math.round(p.size));
      for (let by = 0; by < h; by += s) {
        for (let bx = 0; bx < w; bx += s) {
          let r = 0, g = 0, b = 0, a = 0, cnt = 0;
          const ey = Math.min(h, by + s);
          const ex = Math.min(w, bx + s);
          for (let y = by; y < ey; y++) {
            for (let x = bx; x < ex; x++) {
              const i = (y * w + x) * 4;
              const al = src[i + 3];
              r += src[i] * al; g += src[i + 1] * al; b += src[i + 2] * al; a += al; cnt++;
            }
          }
          const k = a > 0 ? 1 / a : 0;
          for (let y = by; y < ey; y++) {
            for (let x = bx; x < ex; x++) {
              const i = (y * w + x) * 4;
              out[i] = r * k; out[i + 1] = g * k; out[i + 2] = b * k; out[i + 3] = a / cnt;
            }
          }
        }
      }
      break;
    }
    case 'noise': {
      const rand = rng(42);
      const amt = p.amount * 2.55;
      for (let i = 0; i < n; i += 4) {
        const d = (rand() - 0.5) * 2 * amt;
        out[i] = clamp(src[i] + d);
        out[i + 1] = clamp(src[i + 1] + d);
        out[i + 2] = clamp(src[i + 2] + d);
        out[i + 3] = src[i + 3];
      }
      break;
    }
    case 'sharpen': {
      gaussianBlur(src, out, w, h, 1.5);
      const a = p.amount / 100;
      for (let i = 0; i < n; i += 4) {
        for (let k = 0; k < 3; k++) out[i + k] = clamp(src[i + k] + a * (src[i + k] - out[i + k]));
        out[i + 3] = src[i + 3];
      }
      break;
    }
  }
}
