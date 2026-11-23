import { createSurface, type Surface } from '../canvas';

const cache = new Map<string, Surface>();

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  const n = m ? parseInt(m[1], 16) : 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Image d'un tampon rond (couleur + dureté), à une résolution adaptée au diamètre. */
export function getStamp(color: string, hardness: number, diameter: number): Surface {
  let res = 8;
  while (res < diameter && res < 512) res *= 2;
  const h = Math.round(hardness * 100) / 100;
  const key = `${color}|${h}|${res}`;
  let stamp = cache.get(key);
  if (stamp) return stamp;
  if (cache.size > 48) cache.clear();

  stamp = createSurface(res, res);
  const { ctx } = stamp;
  const r = res / 2;
  const [cr, cg, cb] = hexToRgb(color);
  if (h >= 0.99) {
    ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
  } else {
    const g = ctx.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, `rgba(${cr},${cg},${cb},1)`);
    g.addColorStop(h, `rgba(${cr},${cg},${cb},1)`);
    g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    ctx.fillStyle = g;
  }
  ctx.beginPath();
  ctx.arc(r, r, r, 0, Math.PI * 2);
  ctx.fill();
  cache.set(key, stamp);
  return stamp;
}
