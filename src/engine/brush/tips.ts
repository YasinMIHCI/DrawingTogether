import { createSurface, type Surface } from '../canvas';
import { rng } from '../random';
import type { TipKind } from './settings';

/** Pointes générées aléatoirement : plusieurs variantes pour éviter la répétition. */
export const TIP_VARIANTS: Record<TipKind, number> = {
  round: 1, wet: 1, noise: 4, bristle: 4, splatter: 4,
  star: 1, heart: 1, sparkle: 1, flower: 1, bubble: 1, leaf: 1,
};

const masks = new Map<string, Surface>();
const tinted = new Map<string, Surface>();

function resolution(diameter: number): number {
  let res = 8;
  while (res < diameter && res < 512) res *= 2;
  return res;
}

function star(ctx: CanvasRenderingContext2D, r: number, points: number, inner: number): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (i * Math.PI) / points - Math.PI / 2;
    const d = i % 2 ? r * inner : r;
    ctx.lineTo(r + Math.cos(a) * d, r + Math.sin(a) * d);
  }
  ctx.closePath();
  ctx.fill();
}

/** Masque blanc (seul l'alpha compte) de la pointe. */
function drawMask(ctx: CanvasRenderingContext2D, kind: TipKind, res: number, hardness: number, variant: number): void {
  const r = res / 2;
  const rand = rng(variant * 7919 + res);
  ctx.fillStyle = '#fff';
  switch (kind) {
    case 'round': {
      if (hardness < 0.99) {
        const g = ctx.createRadialGradient(r, r, 0, r, r, r);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(Math.max(0, hardness), 'rgba(255,255,255,1)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
      }
      ctx.beginPath();
      ctx.arc(r, r, r, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'wet': {
      // Centre plus clair, bord plus foncé : effet de bord d'aquarelle
      const g = ctx.createRadialGradient(r, r, 0, r, r, r);
      g.addColorStop(0, 'rgba(255,255,255,0.7)');
      g.addColorStop(0.75, 'rgba(255,255,255,0.8)');
      g.addColorStop(0.9, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(r, r, r, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'noise': {
      const img = ctx.createImageData(res, res);
      for (let y = 0; y < res; y++) {
        for (let x = 0; x < res; x++) {
          const d = Math.hypot(x + 0.5 - r, y + 0.5 - r) / r;
          if (d > 1) continue;
          const falloff = d < 0.6 ? 1 : 1 - (d - 0.6) / 0.4;
          const i = (y * res + x) * 4;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
          img.data[i + 3] = rand() < 0.55 * falloff + 0.15 ? 255 * (0.5 + rand() * 0.5) : 0;
        }
      }
      ctx.putImageData(img, 0, 0);
      break;
    }
    case 'bristle': {
      // Poils alignés horizontalement ; la pointe est tournée selon la direction du trait
      const n = 14;
      for (let i = 0; i < n; i++) {
        const x = r + (((i + 0.5) / n) * 2 - 1) * r * 0.92 + (rand() - 0.5) * r * 0.08;
        const y = r + (rand() - 0.5) * r * 0.35;
        const rr = r * (0.06 + rand() * 0.06);
        ctx.globalAlpha = 0.45 + rand() * 0.55;
        ctx.beginPath();
        ctx.ellipse(x, y, rr, rr * 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'splatter': {
      ctx.beginPath();
      ctx.arc(r, r, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 14; i++) {
        const a = rand() * Math.PI * 2;
        const d = r * (0.3 + rand() * 0.6);
        const rr = r * (0.04 + rand() * 0.12);
        ctx.beginPath();
        ctx.arc(r + Math.cos(a) * d, r + Math.sin(a) * d, rr, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'star':
      star(ctx, r, 5, 0.45);
      break;
    case 'sparkle':
      star(ctx, r, 4, 0.18);
      break;
    case 'heart': {
      ctx.beginPath();
      ctx.moveTo(r, res * 0.92);
      ctx.bezierCurveTo(res * -0.05, res * 0.5, res * 0.15, res * 0.02, r, res * 0.28);
      ctx.bezierCurveTo(res * 0.85, res * 0.02, res * 1.05, res * 0.5, r, res * 0.92);
      ctx.fill();
      break;
    }
    case 'flower': {
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5;
        ctx.beginPath();
        ctx.ellipse(r + Math.cos(a) * r * 0.48, r + Math.sin(a) * r * 0.48, r * 0.42, r * 0.3, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(r, r, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(r, r, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case 'bubble': {
      ctx.lineWidth = res * 0.07;
      ctx.strokeStyle = '#fff';
      ctx.beginPath();
      ctx.arc(r, r, r * 0.9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.25;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.ellipse(r * 0.65, r * 0.6, r * 0.18, r * 0.1, -0.7, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'leaf': {
      ctx.beginPath();
      ctx.moveTo(res * 0.02, r);
      ctx.quadraticCurveTo(r, res * 0.05, res * 0.98, r);
      ctx.quadraticCurveTo(r, res * 0.95, res * 0.02, r);
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineWidth = res * 0.03;
      ctx.strokeStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(res * 0.1, r);
      ctx.lineTo(res * 0.85, r);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      break;
    }
  }
}

function tipKey(kind: TipKind, hardness: number, res: number, variant: number): string {
  const h = kind === 'round' ? Math.round(hardness * 50) / 50 : 0;
  return `${kind}|${h}|${res}|${variant % TIP_VARIANTS[kind]}`;
}

/** Masque de la pointe (blanc + alpha). */
export function getTipMask(kind: TipKind, hardness: number, diameter: number, variant = 0): Surface {
  const res = resolution(diameter);
  const key = tipKey(kind, hardness, res, variant);
  let s = masks.get(key);
  if (!s) {
    if (masks.size > 64) masks.clear();
    s = createSurface(res, res);
    drawMask(s.ctx, kind, res, hardness, variant % TIP_VARIANTS[kind]);
    masks.set(key, s);
  }
  return s;
}

/** Pointe colorée. */
export function getTip(kind: TipKind, hardness: number, diameter: number, color: string, variant = 0): Surface {
  const res = resolution(diameter);
  const key = tipKey(kind, hardness, res, variant) + color;
  let s = tinted.get(key);
  if (!s) {
    if (tinted.size > 96) tinted.clear();
    const mask = getTipMask(kind, hardness, diameter, variant);
    s = createSurface(res, res);
    s.ctx.drawImage(mask.canvas, 0, 0);
    s.ctx.globalCompositeOperation = 'source-in';
    s.ctx.fillStyle = color;
    s.ctx.fillRect(0, 0, res, res);
    s.ctx.globalCompositeOperation = 'source-over';
    tinted.set(key, s);
  }
  return s;
}

/** Dessine une pointe centrée en (x, y), tournée et aplatie. */
export function drawTip(
  ctx: CanvasRenderingContext2D,
  tip: Surface,
  x: number,
  y: number,
  size: number,
  angle: number,
  roundness: number,
): void {
  if (angle === 0 && roundness >= 1) {
    ctx.drawImage(tip.canvas, x - size / 2, y - size / 2, size, size);
    return;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(1, Math.max(0.05, roundness));
  ctx.drawImage(tip.canvas, -size / 2, -size / 2, size, size);
  ctx.restore();
}
