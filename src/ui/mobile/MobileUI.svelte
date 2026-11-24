<script lang="ts">
  import { onMount } from 'svelte';
  import './mobile.css';
  import type { Editor } from '../../engine/editor';
  import { brushPrefs, brushSettings } from '../../lib/brushPrefs.svelte';
  import { screen } from '../../lib/screen.svelte';
  import { t } from '../../lib/i18n/t.svelte';
  import { href } from '../../lib/router.svelte';
  import type { FileActions } from '../common/types';
  import Icon from '../common/Icon.svelte';
  import type { IconName } from '../common/icons';
  import ToolsPanel, { type ToolChoice } from './ToolsPanel.svelte';
  import BrushPanel from './BrushPanel.svelte';
  import ColorPanel from './ColorPanel.svelte';
  import LayersPanel from './LayersPanel.svelte';
  import LayerMenu from './LayerMenu.svelte';
  import OptionStrip from './OptionStrip.svelte';
  import MenuPanel from './MenuPanel.svelte';
  import FilePanel from './FilePanel.svelte';
  import FilterPanel from './FilterPanel.svelte';
  import TextPanel from './TextPanel.svelte';

  let { editor, files, status }: { editor: Editor; files: FileActions; status: string } = $props();

  // L'éditeur n'est pas réactif : on relit son état à chaque notification.
  let tick = $state(0);
  onMount(() => {
    editor.setBrush(brushSettings(brushPrefs.selected.brush), 'brush');
    editor.setBrush(brushSettings(brushPrefs.selected.eraser), 'eraser');
    return editor.subscribe(() => tick++);
  });

  type Panel = 'tools' | 'brushes' | 'color' | 'layerMenu' | 'menu' | 'file' | 'filter' | 'effect';
  let panel = $state<Panel | null>(null);
  let layersOpen = $state(false);

  const s = $derived.by(() => {
    void tick;
    return {
      tool: editor.tool,
      color: editor.color,
      canUndo: editor.history.canUndo,
      canRedo: editor.history.canRedo,
      textRequest: editor.textRequest !== null,
      filtering: editor.filterSession !== null,
      notice: editor.notice,
    };
  });

  // Tablette : panneaux plus larges, roue de couleur plus grande
  const tablet = $derived(Math.min(screen.info.width, screen.info.height) >= 600);
  const wheelSize = $derived(Math.min(tablet ? 320 : 280, screen.info.width - 72));

  $effect(() => {
    if (!s.notice) return;
    const id = setTimeout(() => {
      editor.notice = null;
      editor.notify();
    }, 2500);
    return () => clearTimeout(id);
  });

  const toggle = (p: Panel) => (panel = panel === p ? null : p);
  function pickTool(c: ToolChoice) {
    if (c === 'filters' || c === 'effects') {
      panel = c === 'filters' ? 'filter' : 'effect';
      return;
    }
    editor.setTool(c);
    panel = null;
  }
  const brushOrEraser = () => editor.setTool(s.tool === 'eraser' ? 'brush' : 'eraser');

  const bar: { id: Panel | 'swap' | 'layers'; icon: IconName; label: Parameters<typeof t>[0] }[] = [
    { id: 'swap', icon: 'swap', label: 'm.toggleEraser' },
    { id: 'tools', icon: 'tools', label: 'm.tools' },
    { id: 'brushes', icon: 'brushes', label: 'm.brushes' },
    { id: 'color', icon: 'plus', label: 'm.color' },
    { id: 'layers', icon: 'layers', label: 'm.layers' },
  ];
  const isActive = (id: string) => (id === 'layers' ? layersOpen : panel === id);
  function barTap(id: Panel | 'swap' | 'layers') {
    if (id === 'swap') brushOrEraser();
    else if (id === 'layers') {
      layersOpen = !layersOpen;
      if (panel === 'layerMenu' && !layersOpen) panel = null;
    } else toggle(id);
  }
  // Le panneau des filtres reste ouvert tant qu'un filtre est en cours
  const shownPanel = $derived<Panel | 'text' | null>(s.textRequest ? 'text' : s.filtering && panel !== 'effect' ? 'filter' : panel);
  const modal = $derived(shownPanel !== null && shownPanel !== 'filter' && shownPanel !== 'effect' && shownPanel !== 'text');
</script>

<div class="m root" class:tablet class:layers-open={layersOpen}>
  <div class="top">
    <a class="m-icon-btn back" href={href('home')} aria-label={t('nav.back')}><Icon name="back" size={30} /></a>
    {#if status}<span class="status">{status}</span>{/if}
    <div class="right">
      <div class="pill">
        <button class="m-icon-btn" onclick={() => editor.undo()} disabled={!s.canUndo} aria-label={t('m.undo')}><Icon name="undo" /></button>
        <button class="m-icon-btn" onclick={() => editor.redo()} disabled={!s.canRedo} aria-label={t('m.redo')}><Icon name="redo" /></button>
      </div>
      <button class="m-icon-btn round" class:on={panel === 'file'} onclick={() => toggle('file')} aria-label={t('m.file')}><Icon name="image" /></button>
      <button class="m-icon-btn round" class:on={panel === 'menu'} onclick={() => toggle('menu')} aria-label={t('m.menu')}><Icon name="more" /></button>
    </div>
  </div>

  {#if s.notice}
    <div class="notice" role="status">{t(`notice.${s.notice}`)}</div>
  {/if}

  {#if layersOpen}
    <LayersPanel {editor} {tick} width={tablet ? 140 : 84} onmenu={() => toggle('layerMenu')} />
  {/if}

  {#if modal}
    <button class="backdrop" aria-label={t('m.close')} onclick={() => (panel = null)}></button>
  {/if}

  <div class="dock">
    {#if !shownPanel}
      <div class="strip-wrap"><OptionStrip {editor} {tick} /></div>
    {/if}
    <div class="card">
      {#if shownPanel}
        <div class="handle"></div>
        <div class="panel">
          {#if shownPanel === 'text'}
            <TextPanel {editor} />
          {:else if shownPanel === 'tools'}
            <ToolsPanel tool={s.tool} onpick={pickTool} />
          {:else if shownPanel === 'brushes'}
            <BrushPanel {editor} {tick} which={s.tool === 'eraser' ? 'eraser' : 'brush'} />
          {:else if shownPanel === 'color'}
            <ColorPanel {editor} {tick} {wheelSize} />
          {:else if shownPanel === 'layerMenu'}
            <LayerMenu {editor} {tick} />
          {:else if shownPanel === 'menu'}
            <MenuPanel {editor} {tick} onclose={() => (panel = null)} />
          {:else if shownPanel === 'file'}
            <FilePanel {files} onclose={() => (panel = null)} />
          {:else if shownPanel === 'filter' || shownPanel === 'effect'}
            <FilterPanel {editor} {tick} group={shownPanel} ondone={() => (panel = null)} />
          {/if}
        </div>
      {/if}
      <nav class="bar">
        {#each bar as b (b.id)}
          <button class="m-icon-btn" class:active={isActive(b.id)} onclick={() => barTap(b.id)} aria-label={t(b.label)} aria-pressed={isActive(b.id)}>
            {#if b.id === 'color'}
              <span class="swatch" style:background={s.color}></span>
            {:else if b.id === 'swap'}
              <Icon name={s.tool === 'eraser' ? 'eraser' : 'swap'} size={28} />
            {:else}
              <Icon name={b.icon} size={28} />
            {/if}
          </button>
        {/each}
        <span class="indicator" style:left="{(Math.max(0, bar.findIndex((b) => isActive(b.id))) * 100) / bar.length}%"
          style:opacity={bar.some((b) => isActive(b.id)) ? 1 : 0}></span>
      </nav>
    </div>
  </div>
</div>

<style>
  .root { position: absolute; inset: 0; pointer-events: none; }
  .root > :global(*) { pointer-events: auto; }
  .top { position: absolute; top: 0; left: 0; right: 0; display: flex; align-items: center; padding: max(6px, env(safe-area-inset-top)) 8px 6px; pointer-events: none; }
  .top > * { pointer-events: auto; }
  .back { color: var(--m-soft); }
  .status { font-size: 0.85rem; color: var(--m-soft); background: var(--m-float); padding: 4px 10px; border-radius: 12px; }
  .right { margin-left: auto; display: flex; gap: 8px; align-items: center; }
  .pill { display: flex; gap: 4px; background: var(--m-float); border-radius: 26px; padding: 0 6px; box-shadow: var(--m-shadow); }
  .round { background: var(--m-float); box-shadow: var(--m-shadow); }
  .round.on { color: var(--m-accent); }
  .notice { position: absolute; top: 70px; left: 50%; transform: translateX(-50%); background: rgba(30, 30, 34, 0.9); color: #fff; padding: 8px 14px; border-radius: 12px; z-index: 6; pointer-events: none; }
  .backdrop { position: absolute; inset: 0; background: transparent; z-index: 3; }
  .dock {
    position: absolute; left: 0; right: 0; bottom: 0; z-index: 5; display: grid; gap: 8px;
    padding: 0 10px max(8px, env(safe-area-inset-bottom)); pointer-events: none;
  }
  .dock > * { pointer-events: auto; }
  .tablet .dock { max-width: 600px; margin: 0 auto; }
  /* Tablette : le panneau des calques reste à droite, les panneaux du bas se décalent */
  .tablet.layers-open .dock { right: 180px; }
  .tablet.layers-open { --strip-h: 16px; }
  .card { background: var(--m-panel); border-radius: 26px; box-shadow: var(--m-shadow); overflow: hidden; }
  .handle { width: 40px; height: 5px; border-radius: 3px; background: var(--m-line); margin: 8px auto 0; }
  .panel { max-height: 74vh; overflow: hidden; }
  .bar { position: relative; display: grid; grid-template-columns: repeat(5, 1fr); justify-items: center; height: var(--m-dock); align-items: center; border-top: 1px solid transparent; }
  .card:has(.panel) .bar { border-top-color: var(--m-line); }
  .bar .active { color: var(--m-accent); }
  .indicator { position: absolute; top: -1px; width: 20%; height: 3px; display: flex; justify-content: center; transition: left 0.15s; }
  .indicator::after { content: ''; width: 44px; height: 3px; border-radius: 2px; background: var(--m-accent); margin: 0 auto; }
  .swatch { width: 34px; height: 34px; border-radius: 50%; border: 2px solid var(--m-card); box-shadow: 0 0 0 1px var(--m-line); }
  .strip-wrap { max-width: 640px; width: 100%; margin: 0 auto; }
</style>
