import { Layer } from '../layers';
import { StrokeRenderer } from './stroke';
import type { BrushSettings } from './settings';

/**
 * Aperçu d'un pinceau : une vague en S avec une pression qui monte puis redescend.
 * Pour étaler / flouter, on dessine d'abord des bandes de couleur à mélanger.
 */
export function renderBrushPreview(target: HTMLCanvasElement, settings: BrushSettings, color: string): void {
  const w = target.width;
  const h = target.height;
  const out = target.getContext('2d');
  if (!out || !w || !h) return;
  const layer = new Layer(w, h, 0);
  const direct = settings.mode === 'smudge' || settings.mode === 'blur';
  if (direct || settings.mode === 'erase') {
    const bands = ['#e85d4a', '#f5c542', '#3aa3d9', '#7bc96f'];
    bands.forEach((c, i) => {
      layer.surface.ctx.fillStyle = c;
      layer.surface.ctx.fillRect((i * w) / bands.length, h * 0.18, w / bands.length + 1, h * 0.64);
    });
  }
  const s: BrushSettings = { ...settings, smoothing: 0, size: Math.max(2, Math.min(settings.size * (h / 90), h * 0.42)) };
  const stroke = new StrokeRenderer(w, h);
  const N = 80;
  const at = (i: number) => {
    const t = i / N;
    return {
      x: w * (0.08 + 0.84 * t),
      y: h / 2 - Math.sin(t * Math.PI * 2) * h * 0.2,
      pressure: Math.pow(Math.sin(Math.PI * t), 0.7) * 0.9 + 0.1,
    };
  };
  stroke.begin(layer, s, color, at(0), false);
  for (let i = 1; i <= N; i++) stroke.add([at(i)]);
  stroke.end();
  out.clearRect(0, 0, w, h);
  out.drawImage(layer.surface.canvas, 0, 0);
}
