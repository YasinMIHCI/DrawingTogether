<script lang="ts">
  import { renderBrushPreview } from '../../engine/brush/preview';
  import type { BrushSettings } from '../../engine/brush/settings';

  let { settings, color }: { settings: BrushSettings; color: string } = $props();
  let canvas: HTMLCanvasElement;

  $effect(() => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(220 * dpr);
    canvas.height = Math.round(48 * dpr);
    renderBrushPreview(canvas, settings, color);
  });
</script>

<canvas bind:this={canvas} aria-hidden="true"></canvas>

<style>
  canvas { display: block; width: 100%; height: 48px; }
</style>
