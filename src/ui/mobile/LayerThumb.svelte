<script lang="ts">
  import { CHECKER } from './sliders';

  /** Vignette d'un calque (ou du fond si `source` est null). */
  let { source, docW, docH, tick, background = null, width = 96 }: {
    source: HTMLCanvasElement | null; docW: number; docH: number; tick: number; background?: string | null; width?: number;
  } = $props();
  let canvas: HTMLCanvasElement;
  // La vignette tient dans un carré width × width
  const w = $derived(docW >= docH ? width : Math.max(24, Math.round((width * docW) / docH)));
  const height = $derived(docW >= docH ? Math.max(24, Math.round((width * docH) / docW)) : width);

  $effect(() => {
    void tick;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!source && background) {
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (source) {
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    }
  });
</script>

<canvas bind:this={canvas} style:width="{w}px" style:height="{height}px" style:background={CHECKER}></canvas>

<style>
  canvas { display: block; border-radius: 8px; margin: 0 auto; }
</style>
