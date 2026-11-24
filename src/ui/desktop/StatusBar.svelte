<script lang="ts">
  import { onMount } from 'svelte';
  import type { Editor } from '../../engine/editor';
  import { t } from '../../lib/i18n/t.svelte';
  import Icon from '../common/Icon.svelte';

  let { editor, tick, status = '' }: { editor: Editor; tick: number; status?: string } = $props();
  let pos = $state<{ x: number; y: number } | null>(null);
  onMount(() => {
    let raf = 0;
    return editor.subscribeHover(() => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const p = editor.pointerDoc;
        pos = p && p.x >= 0 && p.y >= 0 && p.x < editor.doc.width && p.y < editor.doc.height ? { x: Math.floor(p.x), y: Math.floor(p.y) } : null;
      });
    });
  });
  const s = $derived.by(() => {
    void tick;
    const b = editor.selection.bounds;
    return {
      w: editor.doc.width, h: editor.doc.height, zoom: editor.view.zoom,
      rot: Math.round((editor.view.rotation * 180) / Math.PI), sel: b ? `${b.w} × ${b.h}` : '',
    };
  });
  // Zoom sur une échelle logarithmique (2 % → 6400 %)
  const toPos = (z: number) => Math.log(z / 0.02) / Math.log(64 / 0.02);
  const fromPos = (p: number) => 0.02 * Math.pow(64 / 0.02, p);
</script>

<footer class="status">
  <span title={t('d.status.pos')}>{pos ? `${pos.x}, ${pos.y} px` : '—'}</span>
  {#if s.sel}<span title={t('d.status.selection')}>⬚ {s.sel}</span>{/if}
  <span title={t('d.status.size')}>{s.w} × {s.h} px</span>
  {#if status}<span class="saved">{status}</span>{/if}
  <span class="grow"></span>
  {#if s.rot}<button onclick={() => editor.setRotation(0)} title={t('draw.resetRotation')}>{s.rot}°</button>{/if}
  <button class="d-ibtn" onclick={() => editor.fit()} title={t('draw.fit')} aria-label={t('draw.fit')}><Icon name="fit" size={15} /></button>
  <button class="d-ibtn" onclick={() => editor.setZoom(s.zoom / 1.25)} aria-label={t('cmd.zoomOut')}><Icon name="zoomOut" size={15} /></button>
  <input type="range" min="0" max="1000" value={Math.round(toPos(s.zoom) * 1000)} aria-label={t('cmd.zoomWheel')}
    oninput={(e) => editor.setZoom(fromPos(+e.currentTarget.value / 1000))} />
  <button class="d-ibtn" onclick={() => editor.setZoom(s.zoom * 1.25)} aria-label={t('cmd.zoomIn')}><Icon name="zoomIn" size={15} /></button>
  <button class="zoom" onclick={() => editor.setZoom(1)} title={t('draw.zoom100')}>{Math.round(s.zoom * 100)} %</button>
</footer>

<style>
  .status { display: flex; align-items: center; gap: 14px; height: 26px; padding: 0 8px; background: var(--d-panel-2); border-top: 1px solid var(--d-line); color: var(--d-soft); font-size: 12px; font-variant-numeric: tabular-nums; }
  .status .d-ibtn { width: 22px; height: 22px; }
  .grow { flex: 1; }
  .saved { color: var(--d-accent); }
  input[type='range'] { width: 120px; }
  .zoom { min-width: 52px; text-align: right; }
</style>
