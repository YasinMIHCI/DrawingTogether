<script lang="ts">
  import { onMount } from 'svelte';
  import { Editor } from '../../engine/editor';
  import { renderComposite } from '../../engine/renderer';
  import { createSurface } from '../../engine/canvas';
  import { t } from '../../lib/i18n/t.svelte';
  import SimpleEditor from '../games/SimpleEditor.svelte';

  /** Recadrer une image importée, ou dessiner son avatar. Produit un PNG 256 × 256. */
  let { mode, file = null, onsave, oncancel }: {
    mode: 'crop' | 'draw'; file?: File | null; onsave: (png: Blob) => void; oncancel: () => void;
  } = $props();

  const OUT = 256;
  const VIEW = 280;
  let canvas = $state<HTMLCanvasElement>();
  let img: ImageBitmap | null = null;
  let zoom = $state(1);
  let ox = $state(0);
  let oy = $state(0);
  let busy = $state(false);
  const editor = new Editor({ width: 512, height: 512, historyBytes: 32 * 2 ** 20 });

  onMount(async () => {
    if (mode === 'crop' && file) {
      img = await createImageBitmap(file);
      draw();
    }
  });

  // Échelle de base : l'image couvre tout le cercle
  const base = () => (img ? VIEW / Math.min(img.width, img.height) : 1);

  function draw() {
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d')!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = canvas.height = VIEW * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, VIEW, VIEW);
    const k = base() * zoom;
    ctx.drawImage(img, VIEW / 2 - (img.width * k) / 2 + ox, VIEW / 2 - (img.height * k) / 2 + oy, img.width * k, img.height * k);
  }
  $effect(() => {
    void zoom;
    void ox;
    void oy;
    draw();
  });

  let dragFrom: { x: number; y: number; ox: number; oy: number } | null = null;
  function down(e: PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragFrom = { x: e.clientX, y: e.clientY, ox, oy };
  }
  function move(e: PointerEvent) {
    if (!dragFrom) return;
    ox = dragFrom.ox + e.clientX - dragFrom.x;
    oy = dragFrom.oy + e.clientY - dragFrom.y;
  }

  async function save() {
    busy = true;
    const out = createSurface(OUT, OUT);
    out.ctx.fillStyle = '#ffffff';
    out.ctx.fillRect(0, 0, OUT, OUT);
    if (mode === 'crop' && img) {
      const k = (base() * zoom * OUT) / VIEW;
      const s = OUT / VIEW;
      out.ctx.drawImage(img, OUT / 2 - (img.width * k) / 2 + ox * s, OUT / 2 - (img.height * k) / 2 + oy * s, img.width * k, img.height * k);
    } else {
      out.ctx.scale(OUT / 512, OUT / 512);
      renderComposite(out.ctx, editor.doc, true);
    }
    out.canvas.toBlob((b) => {
      busy = false;
      if (b) onsave(b);
    }, 'image/png');
  }
</script>

<div class="backdrop" role="presentation">
  <div class="dialog" role="dialog" aria-label={t('acc.avatar')}>
    {#if mode === 'crop'}
      <p class="hint">{t('acc.crop')}</p>
      <div class="crop">
        <canvas bind:this={canvas} style:width="{VIEW}px" style:height="{VIEW}px" onpointerdown={down} onpointermove={move} onpointerup={() => (dragFrom = null)}></canvas>
        <div class="ring" aria-hidden="true"></div>
      </div>
      <label class="zoom">{t('acc.zoom')} <input type="range" min="1" max="4" step="0.01" bind:value={zoom} /></label>
    {:else}
      <div class="draw"><SimpleEditor {editor} /></div>
    {/if}
    <div class="actions">
      <button class="btn" onclick={oncancel}>{t('acc.cancel')}</button>
      <button class="btn primary" onclick={save} disabled={busy}>{t('acc.useImage')}</button>
    </div>
  </div>
</div>

<style>
  .backdrop { position: fixed; inset: 0; z-index: 60; background: rgba(0, 0, 0, 0.45); display: grid; place-items: center; padding: 12px; }
  .dialog { background: var(--surface); color: var(--ink); border-radius: 16px; padding: 14px; display: grid; gap: 10px; width: min(560px, 100%); max-height: 100%; overflow: auto; }
  .hint { margin: 0; color: var(--ink-soft); font-size: 0.9rem; }
  .crop { position: relative; width: 280px; height: 280px; margin: 0 auto; touch-action: none; }
  .crop canvas { border-radius: 12px; cursor: grab; display: block; }
  .ring { position: absolute; inset: 0; border-radius: 50%; box-shadow: 0 0 0 999px rgba(0, 0, 0, 0.35); pointer-events: none; }
  .crop { overflow: hidden; border-radius: 12px; }
  .zoom { display: flex; gap: 10px; align-items: center; justify-content: center; }
  .draw { height: min(70vh, 560px); }
  .actions { display: flex; justify-content: flex-end; gap: 8px; }
  .btn { font: inherit; min-height: 42px; padding: 0 16px; border-radius: 12px; border: 2px solid var(--line); background: var(--surface); color: var(--ink); cursor: pointer; }
  .btn.primary { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); font-weight: 700; }
</style>
