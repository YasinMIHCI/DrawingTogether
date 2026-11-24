<script lang="ts">
  import type { Editor } from '../../engine/editor';
  import { renderComposite } from '../../engine/renderer';
  import { t } from '../../lib/i18n/t.svelte';

  /** Vue d'ensemble du dessin ; le cadre montre la zone visible. Cliquer / glisser pour s'y déplacer. */
  let { editor, tick }: { editor: Editor; tick: number } = $props();
  let canvas: HTMLCanvasElement;
  let box = $state(240);
  const docW = $derived(editor.doc.width);
  const docH = $derived(editor.doc.height);
  const k = $derived(Math.min(box / docW, 180 / docH));
  const w = $derived(Math.round(docW * k));
  const h = $derived(Math.round(docH * k));

  let raf = 0;
  $effect(() => {
    void tick;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(draw);
  });

  function draw() {
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d')!;
    const s = (w * dpr) / docW;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    if (!editor.doc.background) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, docW, docH);
    }
    renderComposite(ctx, editor.doc, true);
    // Zone visible
    const { width, height } = editor.viewSize;
    const pts = [[0, 0], [width, 0], [width, height], [0, height]].map(([x, y]) => editor.view.toDoc({ x, y }));
    ctx.lineWidth = 2 / s;
    ctx.strokeStyle = '#ff3b30';
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.stroke();
  }

  function go(e: PointerEvent) {
    const r = canvas.getBoundingClientRect();
    editor.centerOn({ x: ((e.clientX - r.left) / r.width) * docW, y: ((e.clientY - r.top) / r.height) * docH });
  }
</script>

<div class="nav" bind:clientWidth={box}>
  <canvas bind:this={canvas} style:width="{w}px" style:height="{h}px" aria-label={t('d.docker.navigator')}
    onpointerdown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); go(e); }}
    onpointermove={(e) => e.buttons && go(e)}></canvas>
</div>

<style>
  .nav { padding: 8px; display: grid; place-items: center; }
  canvas { cursor: crosshair; box-shadow: 0 0 0 1px var(--d-line); touch-action: none; }
</style>
