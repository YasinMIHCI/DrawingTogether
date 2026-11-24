<script lang="ts">
  import { renderBrushPreview } from '../../engine/brush/preview';
  import type { BrushSettings } from '../../engine/brush/settings';

  let { settings, color, height = 48 }: { settings: BrushSettings; color: string; height?: number } = $props();
  let canvas: HTMLCanvasElement;

  $effect(() => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(220 * dpr);
    canvas.height = Math.round(height * dpr);
    renderBrushPreview(canvas, settings, color);
  });
</script>

<canvas bind:this={canvas} aria-hidden="true" style:height="{height}px"></canvas>

<style>
  canvas { display: block; width: 100%; }
</style>
