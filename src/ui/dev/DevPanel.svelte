<script lang="ts">
  import { onMount } from 'svelte';
  import './dev.css';
  import type { Editor, ToolId } from '../../engine/editor';
  import { FILTERS, type FilterKind } from '../../engine/tools/filters';
  import { brushPrefs, brushSettings } from '../../lib/brushPrefs.svelte';
  import { t } from '../../lib/i18n/t.svelte';
  import { href } from '../../lib/router.svelte';
  import ToolOptions from './ToolOptions.svelte';
  import LayersSection from './LayersSection.svelte';
  import FilterDialog from './FilterDialog.svelte';
  import type { FileActions } from './types';

  let { editor, files, status }: { editor: Editor; files: FileActions; status: string } = $props();

  // L'éditeur n'est pas réactif : on relit son état à chaque notification.
  let tick = $state(0);
  onMount(() => {
    editor.setBrush(brushSettings(brushPrefs.selected.brush), 'brush');
    editor.setBrush(brushSettings(brushPrefs.selected.eraser), 'eraser');
    return editor.subscribe(() => tick++);
  });

  let open = $state(true);
  let textValue = $state('');

  const s = $derived.by(() => {
    void tick;
    return {
      tool: editor.tool,
      color: editor.color,
      textRequest: editor.textRequest,
      canUndo: editor.history.canUndo,
      canRedo: editor.history.canRedo,
      zoom: Math.round(editor.view.zoom * 100),
      rotation: Math.round((editor.view.rotation * 180) / Math.PI),
      notice: editor.notice,
    };
  });

  // Les messages disparaissent seuls
  $effect(() => {
    if (!s.notice) return;
    const id = setTimeout(() => {
      editor.notice = null;
      editor.notify();
    }, 2500);
    return () => clearTimeout(id);
  });

  const tools: ToolId[] = ['brush', 'eraser', 'fill', 'eyedropper', 'shape', 'text', 'select', 'transform', 'liquify'];
  const toolIcons: Record<ToolId, string> = {
    brush: '🖌', eraser: '⌫', fill: '🪣', eyedropper: '💧', shape: '▭', text: 'T', select: '⬚', transform: '✥', liquify: '〰',
  };
  const filterKinds = (group: 'filter' | 'effect') =>
    (Object.keys(FILTERS) as FilterKind[]).filter((k) => FILTERS[k].group === group);

  function submitText() {
    editor.commitText(textValue);
    textValue = '';
  }
</script>

<div class="dev">
  <div class="bar">
    <a class="btn" href={href('home')} aria-label={t('nav.back')}>←</a>
    <button onclick={() => editor.undo()} disabled={!s.canUndo} title={t('draw.undo')} aria-label={t('draw.undo')}>↶</button>
    <button onclick={() => editor.redo()} disabled={!s.canRedo} title={t('draw.redo')} aria-label={t('draw.redo')}>↷</button>
    <span class="status">{s.zoom}% · {s.rotation}°{status ? ` · ${status}` : ''}</span>
    <button class="wide" onclick={() => (open = !open)} aria-expanded={open}>{t('draw.panel')}</button>
  </div>

  {#if s.notice}
    <div class="notice" role="status">{t(`notice.${s.notice}`)}</div>
  {/if}

  {#if s.textRequest}
    <form class="dialog" onsubmit={(e) => { e.preventDefault(); submitText(); }}>
      <!-- svelte-ignore a11y_autofocus -->
      <textarea bind:value={textValue} placeholder={t('text.placeholder')} rows="3" autofocus></textarea>
      <div class="actions">
        <button type="button" onclick={() => editor.cancelText()}>{t('text.cancel')}</button>
        <button type="submit" class="primary">{t('text.ok')}</button>
      </div>
    </form>
  {/if}

  <FilterDialog {editor} {tick} />

  {#if open}
    <aside class="panel">
      <p class="note">{t('draw.panelNote')}</p>

      <h3>{t('tools.title')}</h3>
      <div class="grid3 tools">
        {#each tools as tool (tool)}
          <button aria-pressed={s.tool === tool} onclick={() => editor.setTool(tool)}>
            <span aria-hidden="true">{toolIcons[tool]}</span>{t(`tools.${tool}`)}
          </button>
        {/each}
      </div>
      <label class="field"><span>{t('brush.color')} <b>{s.color}</b></span>
        <input type="color" value={s.color} oninput={(e) => editor.setColor(e.currentTarget.value)} /></label>

      <ToolOptions {editor} {tick} />

      <h3>{t('filters.title')}</h3>
      <div class="grid2">
        {#each filterKinds('filter') as k (k)}<button onclick={() => editor.beginFilter(k)}>{t(`filter.${k}`)}</button>{/each}
      </div>
      <h3>{t('effects.title')}</h3>
      <div class="grid2">
        {#each filterKinds('effect') as k (k)}<button onclick={() => editor.beginFilter(k)}>{t(`filter.${k}`)}</button>{/each}
      </div>

      <h3>{t('draw.view')}</h3>
      <div class="row">
        <button onclick={() => editor.fit()}>{t('draw.fit')}</button>
        <button onclick={() => editor.setZoom(1)}>{t('draw.zoom100')}</button>
        <button onclick={() => editor.setRotation(0)}>{t('draw.resetRotation')}</button>
      </div>

      <LayersSection {editor} {tick} />

      <h3>{t('file.title')}</h3>
      <div class="grid2">
        <button onclick={files.newDoc}>{t('file.new')}</button>
        <button onclick={files.importImage}>{t('file.import')}</button>
        <button onclick={files.open}>{t('file.open')}</button>
        <button onclick={files.save}>{t('file.save')}</button>
        <button onclick={() => files.exportImage('png')}>{t('file.exportPng')}</button>
        <button onclick={() => files.exportImage('jpeg')}>{t('file.exportJpg')}</button>
      </div>
      <p class="note">{t('file.autosave')}</p>
    </aside>
  {/if}
</div>

<style>
  .bar { position: absolute; top: max(8px, env(safe-area-inset-top)); left: 8px; right: 8px; display: flex; gap: 6px; align-items: center; pointer-events: none; }
  .bar > * { pointer-events: auto; }
  .wide { margin-left: auto; }
  .status { padding: 6px 10px; border-radius: 10px; background: var(--surface); border: 1px solid var(--line); font-variant-numeric: tabular-nums; font-size: 0.9rem; }
  .notice { position: absolute; top: 64px; left: 50%; transform: translateX(-50%); background: var(--ink); color: var(--bg); padding: 8px 14px; border-radius: 10px; pointer-events: none; z-index: 4; }
  .panel { position: absolute; top: 60px; right: 8px; bottom: 8px; width: min(320px, calc(100vw - 16px)); overflow-y: auto; background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px; box-shadow: var(--shadow); overscroll-behavior: contain; }
  @media (max-width: 600px) { .panel { top: auto; height: 55vh; } }
  .tools button { display: flex; gap: 4px; justify-content: center; }
  textarea { width: 100%; font-size: 1rem; padding: 8px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface-2); color: var(--ink); resize: vertical; }
</style>
