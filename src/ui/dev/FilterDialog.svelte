<script lang="ts">
  import type { Editor } from '../../engine/editor';
  import { FILTERS } from '../../engine/tools/filters';
  import { t } from '../../lib/i18n/t.svelte';
  import type { Key } from '../../lib/i18n/i18n.svelte';

  let { editor, tick }: { editor: Editor; tick: number } = $props();
  const session = $derived((void tick, editor.filterSession));
</script>

{#if session}
  <div class="dialog" role="dialog" aria-label={t(`filter.${session.kind}`)}>
    <h2>{t(`filter.${session.kind}`)}</h2>
    <p class="note">{t('filter.scope')}</p>
    {#each FILTERS[session.kind].params as p (p.id)}
      <label class="field"><span>{t(`filterParam.${p.id}` as Key)} <b>{session.params[p.id]}</b></span>
        <input type="range" min={p.min} max={p.max} step={p.step} value={session.params[p.id]}
          oninput={(e) => editor.setFilterParams({ [p.id]: +e.currentTarget.value })} /></label>
    {/each}
    <div class="actions">
      <button onclick={() => editor.cancelFilter()}>{t('filter.cancel')}</button>
      <button class="primary" onclick={() => editor.applyFilter()}>{t('filter.apply')}</button>
    </div>
  </div>
{/if}
