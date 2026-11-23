/** Une surface de pixels : un canvas hors écran et son contexte 2D. */
export interface Surface {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

export type SurfaceFactory = (width: number, height: number) => Surface;

let factory: SurfaceFactory = (width, height) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');
  return { canvas, ctx };
};

export function createSurface(width: number, height: number): Surface {
  return factory(width, height);
}

/** Remplace la création de canvas (utilisé par les tests). */
export function setSurfaceFactory(f: SurfaceFactory): void {
  factory = f;
}
