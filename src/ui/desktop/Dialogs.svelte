<script lang="ts">
  import type { Editor } from '../../engine/editor';
  import { FILTERS } from '../../engine/tools/filters';
  import { t } from '../../lib/i18n/t.svelte';
  import type { Key } from '../../lib/i18n/i18n.svelte';
  import { formatKeys, type Command } from './commands';
  import DSlider from './DSlider.svelte';

  /** Fenêtres de l'interface bureau : filtre en cours, saisie de texte, aide des raccourcis. */
  let { editor, tick, commands, shortcuts = $bindable(false) }: {
    editor: Editor; tick: number; commands: Record<string, Command>; shortcuts?: boolean;
  } = $props();
  const filter = $derived((void tick, editor.filterSession));
  const textAt = $derived((void tick, editor.textRequest));
  let text = $state('');
  const withKeys = $derived(Object.values(commands).filter((c) => c.keys));
</script>

{#if filter}
  <!-- Pas de fond sombre : on voit l'aperçu sur la toile -->
  <div class="d-dialog floating" role="dialog" aria-label={t(`filter.${filter.kind}`)}>
    <header>{t(`filter.${filter.kind}`)}</header>
    <div class="body">
      <p class="d-note">{t('filter.scope')}</p>
      {#each FILTERS[filter.kind].params as p (p.id)}
        <DSlider label={t(`filterParam.${p.id}` as Key)} value={filter.params[p.id]} min={p.min} max={p.max} step={p.step} width={180}
          onchange={(v) => editor.setFilterParams({ [p.id]: v })} />
      {/each}
    </div>
    <footer>
      <button class="d-tbtn" onclick={() => editor.cancelFilter()}>{t('filter.cancel')}</button>
      <button class="d-tbtn primary" onclick={() => editor.applyFilter()}>{t('filter.apply')}</button>
    </footer>
  </div>
{/if}

{#if textAt}
  <div class="d-backdrop">
    <form class="d-dialog" onsubmit={(e) => { e.preventDefault(); editor.commitText(text); text = ''; }}>
      <header>{t('tools.text')}</header>
      <div class="body">
        <!-- svelte-ignore a11y_autofocus -->
        <textarea bind:value={text} rows="4" placeholder={t('text.placeholder')} autofocus
          onkeydown={(e) => e.key === 'Enter' && (e.ctrlKey || e.metaKey) && e.currentTarget.form?.requestSubmit()}></textarea>
      </div>
      <footer>
        <button type="button" class="d-tbtn" onclick={() => editor.cancelText()}>{t('text.cancel')}</button>
        <button type="submit" class="d-tbtn primary">{t('text.ok')}</button>
      </footer>
    </form>
  </div>
{/if}

{#if shortcuts}
  <div class="d-backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && (shortcuts = false)}>
    <div class="d-dialog" role="dialog" aria-label={t('cmd.shortcuts')}>
      <header>{t('cmd.shortcuts')}</header>
      <div class="body">
        <dl class="keys">
          {#each withKeys as c (c.id)}
            <dt>{t(c.label)}</dt><dd>{c.keys!.map((k) => formatKeys(k)).join('  ·  ')}</dd>
          {/each}
        </dl>
        <p class="d-note">{t('d.shortcutsHint')}</p>
      </div>
      <footer><button class="d-tbtn primary" onclick={() => (shortcuts = false)}>{t('d.close')}</button></footer>
    </div>
  </div>
{/if}

<style>
  .floating { position: fixed; right: 330px; top: 80px; z-index: 35; min-width: 300px; }
  .d-dialog { min-width: 420px; }
  textarea { width: 100%; padding: 6px; resize: vertical; }
  .keys { display: grid; grid-template-columns: 1fr auto; margin: 0; }
  .keys dt, .keys dd { margin: 0; padding: 3px 6px; border-bottom: 1px solid var(--d-line); }
  .keys dd { text-align: right; color: var(--d-soft); white-space: nowrap; font-variant-numeric: tabular-nums; }
</style>
