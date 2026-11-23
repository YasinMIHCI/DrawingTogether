import { createSurface } from '../canvas';
import { rng } from '../random';

const SIZE = 256;
let grain: HTMLCanvasElement | null = null;

/**
 * Texture de papier répétable (blanc + alpha) : bruit lissé sur deux octaves.
 * Utilisée en « destination-out » pour creuser le trait comme sur un papier à grain.
 */
export function grainCanvas(): HTMLCanvasElement {
  if (grain) return grain;
  const rand = rng(1234);
  const layer = (cell: number) => {
    const n = SIZE / cell;
    const v = Array.from({ length: n * n }, () => rand());
    const at = (x: number, y: number) => v[((y + n) % n) * n + ((x + n) % n)];
    return (x: number, y: number) => {
      const gx = x / cell;
      const gy = y / cell;
      const x0 = Math.floor(gx);
      const y0 = Math.floor(gy);
      const fx = gx - x0;
      const fy = gy - y0;
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
      const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
      return a + (b - a) * sy;
    };
  };
  const coarse = layer(8);
  const fine = layer(2);
  const s = createSurface(SIZE, SIZE);
  const img = s.ctx.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const v = coarse(x, y) * 0.45 + fine(x, y) * 0.35 + rand() * 0.2;
      // Contraste : les creux du papier ne prennent pas le pigment
      const a = Math.max(0, Math.min(1, (v - 0.35) * 2.2));
      const i = (y * SIZE + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = a * 255;
    }
  }
  s.ctx.putImageData(img, 0, 0);
  grain = s.canvas;
  return grain;
}
