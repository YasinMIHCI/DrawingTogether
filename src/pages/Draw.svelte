<script lang="ts">
  import { onMount } from 'svelte';
  import { Editor } from '../engine/editor';
  import { screen } from '../lib/screen.svelte';
  import DevPanel from '../ui/dev/DevPanel.svelte';

  // Taille par défaut selon l'orientation de l'écran (choix de la taille : T1.9).
  const portrait = screen.info.height > screen.info.width;
  const touch = screen.info.coarse;
  const editor = new Editor({
    width: portrait ? 1080 : 1920,
    height: portrait ? 1920 : 1080,
    historyBytes: (touch ? 96 : 384) * 2 ** 20,
  });

  let canvas: HTMLCanvasElement;
  onMount(() => editor.attach(canvas));
</script>

<div class="draw">
  <canvas class="canvas-surface" bind:this={canvas}></canvas>
  <DevPanel {editor} />
</div>

<style>
  .draw { position: fixed; inset: 0; overflow: hidden; --workspace: #9a9ea8; }
  @media (prefers-color-scheme: dark) { .draw { --workspace: #2a2d35; } }
  canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
</style>
