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

<div class="dialog" role="dialog" aria-label={t('newdoc.title')}>
  <h2>{t('newdoc.title')}</h2>
  <div class="grid2">
    {#each presets as p (p.id)}
      <button aria-pressed={width === p.w && height === p.h} onclick={() => ((width = p.w), (height = p.h))}>
        {t(p.id)}<small>{p.w} × {p.h}</small>
      </button>
    {/each}
  </div>
  <div class="grid2">
    <label class="field"><span>{t('newdoc.width')}</span><input type="number" min="16" max={MAX_SIDE} bind:value={width} /></label>
    <label class="field"><span>{t('newdoc.height')}</span><input type="number" min="16" max={MAX_SIDE} bind:value={height} /></label>
  </div>
  <div class="row">
    <span>{t('layers.background')}</span>
    <button aria-pressed={!transparent} onclick={() => (transparent = false)}>{t('layers.bgWhite')}</button>
    <button aria-pressed={transparent} onclick={() => (transparent = true)}>{t('layers.bgTransparent')}</button>
  </div>
  {#if !valid}<p class="note">{t('newdoc.tooBig')}</p>{:else if large}<p class="note">{t('newdoc.memory')}</p>{/if}
  <p class="note">{t('newdoc.warn')}</p>
  <div class="actions">
    <button onclick={oncancel}>{t('newdoc.cancel')}</button>
    <button class="primary" disabled={!valid} onclick={() => oncreate(Math.round(width), Math.round(height), transparent ? null : '#ffffff')}>{t('newdoc.create')}</button>
  </div>
</div>

<style>
  button small { display: block; font-size: 0.72rem; color: var(--ink-soft); }
  .grid2 button { padding: 4px 6px; min-height: 48px; }
</style>
