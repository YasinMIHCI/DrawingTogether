<script lang="ts">
  import type { Editor } from '../../engine/editor';
  import { FILTERS, type FilterKind } from '../../engine/tools/filters';
  import { t } from '../../lib/i18n/t.svelte';
  import type { Key } from '../../lib/i18n/i18n.svelte';
  import MSlider from './MSlider.svelte';

  /** Liste des filtres (ou effets), puis réglages du filtre choisi avec aperçu en direct. */
  let { editor, tick, group, ondone }: { editor: Editor; tick: number; group: 'filter' | 'effect'; ondone: () => void } = $props();
  const session = $derived((void tick, editor.filterSession));
  const kinds = $derived((Object.keys(FILTERS) as FilterKind[]).filter((k) => FILTERS[k].group === group));
</script>

<div class="fp">
  {#if session}
    <p class="m-title">{t(`filter.${session.kind}`)}</p>
    <p class="m-hint">{t('filter.scope')}</p>
    {#each FILTERS[session.kind].params as p (p.id)}
      <p class="lbl">{t(`filterParam.${p.id}` as Key)}</p>
      <MSlider label={t(`filterParam.${p.id}` as Key)} value={session.params[p.id]} min={p.min} max={p.max}
        format={(v) => (p.step < 1 ? v.toFixed(1) : String(Math.round(v)))}
        onchange={(v) => editor.setFilterParams({ [p.id]: p.step < 1 ? Math.round(v / p.step) * p.step : Math.round(v) })} />
    {/each}
    <div class="m-row end">
      <button class="m-pill-btn" onclick={() => (editor.cancelFilter(), ondone())}>{t('filter.cancel')}</button>
      <button class="m-pill-btn primary" onclick={() => (editor.applyFilter(), ondone())}>{t('filter.apply')}</button>
    </div>
  {:else}
    <p class="m-hint">{t('m.filtersHint')}</p>
    <div class="list">
      {#each kinds as k (k)}
        <button class="m-pill-btn" onclick={() => editor.beginFilter(k)}>{t(`filter.${k}`)}</button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .fp { padding: 12px 16px; display: grid; gap: 6px; }
  .lbl { margin: 4px 0 0; }
  .list { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
  .end { justify-content: flex-end; margin-top: 8px; }
</style>
