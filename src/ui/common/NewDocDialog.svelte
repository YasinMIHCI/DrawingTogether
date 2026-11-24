<script lang="ts">
  import { t } from '../../lib/i18n/t.svelte';
  import type { Key } from '../../lib/i18n/i18n.svelte';

  const MAX_SIDE = 8192;
  const MAX_PIXELS = 4096 * 4096;

  let { oncreate, oncancel }: { oncreate: (w: number, h: number, bg: string | null) => void; oncancel: () => void } = $props();

  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const presets: { id: Key; w: number; h: number }[] = [
    { id: 'newdoc.screen', w: Math.round(window.innerWidth * dpr), h: Math.round(window.innerHeight * dpr) },
    { id: 'newdoc.landscape', w: 1920, h: 1080 },
    { id: 'newdoc.portrait', w: 1080, h: 1920 },
    { id: 'newdoc.square', w: 2048, h: 2048 },
    { id: 'newdoc.a4', w: 2480, h: 3508 },
  ];
  let width = $state(presets[1].w);
  let height = $state(presets[1].h);
  let transparent = $state(false);
  const valid = $derived(width >= 16 && height >= 16 && width <= MAX_SIDE && height <= MAX_SIDE && width * height <= MAX_PIXELS);
  const large = $derived(width * height > 3000 * 3000);
</script>

<div class="backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && oncancel()}>
  <div class="dialog" role="dialog" aria-label={t('newdoc.title')}>
    <h2>{t('newdoc.title')}</h2>
    <div class="presets">
      {#each presets as p (p.id)}
        <button aria-pressed={width === p.w && height === p.h} onclick={() => ((width = p.w), (height = p.h))}>
          {t(p.id)}<small>{p.w} × {p.h}</small>
        </button>
      {/each}
    </div>
    <div class="size">
      <label>{t('newdoc.width')}<input type="number" min="16" max={MAX_SIDE} bind:value={width} /></label>
      <span>×</span>
      <label>{t('newdoc.height')}<input type="number" min="16" max={MAX_SIDE} bind:value={height} /></label>
    </div>
    <div class="bg">
      <span>{t('layers.background')}</span>
      <button aria-pressed={!transparent} onclick={() => (transparent = false)}>{t('layers.bgWhite')}</button>
      <button aria-pressed={transparent} onclick={() => (transparent = true)}>{t('layers.bgTransparent')}</button>
    </div>
    {#if !valid}<p class="note warn">{t('newdoc.tooBig')}</p>{:else if large}<p class="note">{t('newdoc.memory')}</p>{/if}
    <p class="note">{t('newdoc.warn')}</p>
    <div class="actions">
      <button onclick={oncancel}>{t('newdoc.cancel')}</button>
      <button class="primary" disabled={!valid} onclick={() => oncreate(Math.round(width), Math.round(height), transparent ? null : '#ffffff')}>{t('newdoc.create')}</button>
    </div>
  </div>
</div>

<style>
  .backdrop { position: fixed; inset: 0; z-index: 50; background: rgba(0, 0, 0, 0.4); display: grid; place-items: center; padding: 16px; }
  .dialog { width: min(440px, 100%); max-height: 100%; overflow-y: auto; background: var(--surface); color: var(--ink); border-radius: 14px; padding: 16px; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3); display: grid; gap: 12px; }
  h2 { margin: 0; font-size: 1.1rem; }
  button { font: inherit; color: inherit; border: 1px solid var(--line); background: var(--surface-2); border-radius: 10px; min-height: 40px; padding: 0 12px; cursor: pointer; }
  button[aria-pressed='true'] { border-color: var(--teal); box-shadow: inset 0 0 0 1px var(--teal); }
  button:disabled { opacity: 0.4; cursor: default; }
  .primary { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
  .presets { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 6px; }
  .presets button { display: grid; padding: 6px; }
  small { color: var(--ink-soft); font-size: 0.75rem; }
  .size { display: flex; align-items: end; gap: 8px; }
  .size label { display: grid; gap: 4px; flex: 1; font-size: 0.85rem; color: var(--ink-soft); }
  input { font: inherit; color: var(--ink); background: var(--surface-2); border: 1px solid var(--line); border-radius: 10px; padding: 8px; min-width: 0; }
  .bg { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .note { margin: 0; font-size: 0.85rem; color: var(--ink-soft); }
  .warn { color: var(--accent); }
  .actions { display: flex; justify-content: flex-end; gap: 8px; }
</style>
