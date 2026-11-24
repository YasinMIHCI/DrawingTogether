<script lang="ts">
  import type { Editor } from '../../engine/editor';
  import { renderComposite } from '../../engine/renderer';
  import type { SharedSession } from '../../net/sharedSession';
  import { peerColor } from '../../net/sharedSession';

  /** Vue d'ensemble de la grande toile : zone visible + curseurs des joueurs. Toucher pour s'y déplacer. */
  let { editor, session, tick }: { editor: Editor; session: SharedSession; tick: number } = $props();
  let canvas: HTMLCanvasElement;
  const box = 160;
  const k = $derived((void tick, Math.min(box / editor.doc.width, box / editor.doc.height)));
  const w = $derived(Math.round(editor.doc.width * k));
  const h = $derived(Math.round(editor.doc.height * k));
  let raf = 0;
  $effect(() => {
    void tick;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(draw);
  });
  $effect(() => editor.subscribe(() => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(draw);
  }));

  function draw() {
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d')!;
    const s = (w * dpr) / editor.doc.width;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, editor.doc.width, editor.doc.height);
    renderComposite(ctx, editor.doc, true);
    const { width, height } = editor.viewSize;
    const pts = [[0, 0], [width, 0], [width, height], [0, height]].map(([x, y]) => editor.view.toDoc({ x, y }));
    ctx.lineWidth = 2 / s;
    ctx.strokeStyle = '#ff3b30';
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.stroke();
    for (const [id, c] of session.cursors) {
      const peer = session.room.peers.find((p) => p.id === id);
      ctx.fillStyle = peerColor(peer?.avatar ?? 0);
      ctx.beginPath();
      ctx.arc(c.x, c.y, 4 / s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  function go(e: PointerEvent) {
    const r = canvas.getBoundingClientRect();
    editor.centerOn({ x: ((e.clientX - r.left) / r.width) * editor.doc.width, y: ((e.clientY - r.top) / r.height) * editor.doc.height });
  }
</script>

<canvas class="mm" bind:this={canvas} style:width="{w}px" style:height="{h}px"
  onpointerdown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); go(e); }}
  onpointermove={(e) => e.buttons && go(e)}></canvas>

<style>
  .mm { display: block; border-radius: 8px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25); touch-action: none; cursor: crosshair; }
</style>
