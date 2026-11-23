export interface TextOptions {
  font: string;
  /** Taille en pixels du document. */
  size: number;
  bold: boolean;
  italic: boolean;
}

export const TEXT_FONTS = ['sans-serif', 'serif', 'monospace', 'cursive', 'Georgia', 'Impact', 'Comic Sans MS', 'Courier New'];

export function cssFont(o: TextOptions): string {
  const family = /\s/.test(o.font) ? `"${o.font}"` : o.font;
  return `${o.italic ? 'italic ' : ''}${o.bold ? 'bold ' : ''}${o.size}px ${family}`;
}

/** Mesure un texte multiligne. */
export function measureText(ctx: CanvasRenderingContext2D, text: string, o: TextOptions): { w: number; h: number } {
  ctx.font = cssFont(o);
  const lines = text.split('\n');
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width));
  return { w, h: lines.length * o.size * 1.25 };
}

export function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, o: TextOptions, color: string): void {
  ctx.font = cssFont(o);
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  text.split('\n').forEach((line, i) => ctx.fillText(line, x, y + i * o.size * 1.25));
}
