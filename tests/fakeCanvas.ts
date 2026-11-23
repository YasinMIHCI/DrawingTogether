import { setSurfaceFactory } from '../src/engine/canvas';

/** Canvas factice pour les tests (jsdom n'a pas de Canvas 2D). */
export function useFakeCanvas(): void {
  setSurfaceFactory((width, height) => {
    const canvas = { width, height } as HTMLCanvasElement;
    const noop = () => {};
    const ctx = new Proxy(
      {
        canvas,
        getImageData: (_x: number, _y: number, w: number, h: number) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
        createRadialGradient: () => ({ addColorStop: noop }),
      } as Record<string, unknown>,
      { get: (t, k: string) => (k in t ? t[k] : noop), set: (t, k: string, v) => ((t[k] = v), true) },
    ) as unknown as CanvasRenderingContext2D;
    return { canvas, ctx };
  });
}
