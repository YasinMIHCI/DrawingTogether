<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import './desktop.css';
  import type { Editor } from '../../engine/editor';
  import { brushPrefs, brushSettings } from '../../lib/brushPrefs.svelte';
  import { desktopPrefs } from '../../lib/desktopPrefs.svelte';
  import { isDark } from '../../lib/theme.svelte';
  import { t } from '../../lib/i18n/t.svelte';
  import type { FileActions } from '../common/types';
  import Icon from '../common/Icon.svelte';
  import { bindShortcuts, createCommands } from './commands';
  import { KRITA_MENUS } from './menus';
  import { viewport, type Insets } from './viewport';
  import MenuBar from './MenuBar.svelte';
  import ToolOptionsBar from './ToolOptionsBar.svelte';
  import Toolbox from './Toolbox.svelte';
  import Docker from './Docker.svelte';
  import ColorPicker from './ColorPicker.svelte';
  import BrushDocker from './BrushDocker.svelte';
  import LayersDocker from './LayersDocker.svelte';
  import Navigator from './Navigator.svelte';
  import StatusBar from './StatusBar.svelte';
  import Dialogs from './Dialogs.svelte';

  let { editor, files, status, setViewport }: {
    editor: Editor; files: FileActions; status: string; setViewport: (r: Insets | null) => void;
  } = $props();

  let tick = $state(0);
  let shortcuts = $state(false);
  const commands = untrack(() =>
    createCommands(editor, files, {
      togglePanels: () => (desktopPrefs.hidden = !desktopPrefs.hidden),
      showShortcuts: () => (shortcuts = true),
    }),
  );

  onMount(() => {
    editor.setBrush(brushSettings(brushPrefs.selected.brush), 'brush');
    editor.setBrush(brushSettings(brushPrefs.selected.eraser), 'eraser');
    const unsub = editor.subscribe(() => tick++);
    const unbind = bindShortcuts(commands);
    return () => {
      unsub();
      unbind();
    };
  });

  const notice = $derived((void tick, editor.notice));
  $effect(() => {
    if (!notice) return;
    const id = setTimeout(() => ((editor.notice = null), editor.notify()), 2500);
    return () => clearTimeout(id);
  });

  // Largeur du panneau de droite, réglable en glissant le séparateur
  function resizeDock(e: PointerEvent) {
    const startX = e.clientX;
    const startW = desktopPrefs.dockWidth;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => (desktopPrefs.dockWidth = Math.max(220, Math.min(560, startW - (ev.clientX - startX))));
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  }
  const hidden = $derived(desktopPrefs.hidden);
</script>

<div class="d krita" class:dark={isDark()} class:hidden style:--dock="{desktopPrefs.dockWidth}px">
  {#if !hidden}
    <div class="menu"><MenuBar menus={KRITA_MENUS} {commands} {tick} /></div>
    <div class="options"><ToolOptionsBar {editor} {tick} /></div>
    <div class="tools"><Toolbox {editor} {tick} {commands} oncolor={() => (desktopPrefs.collapsed.color = false)} /></div>
  {/if}
  <div class="view" use:viewport={setViewport}>
    {#if notice}<div class="notice" role="status">{t(`notice.${notice}`)}</div>{/if}
    {#if hidden}
      <button class="d-ibtn show" onclick={() => (desktopPrefs.hidden = false)} title="{t('cmd.togglePanels')} (Tab)" aria-label={t('cmd.togglePanels')}><Icon name="sidebar" size={18} /></button>
    {/if}
  </div>
  {#if !hidden}
    <aside class="dock">
      <div class="splitter" role="separator" aria-orientation="vertical" aria-label={t('d.resize')} onpointerdown={resizeDock}></div>
      <div class="dockers">
        <Docker id="color"><ColorPicker {editor} {tick} wheel={Math.min(180, desktopPrefs.dockWidth - 60)} /></Docker>
        <Docker id="brushes"><BrushDocker {editor} {tick} /></Docker>
        <Docker id="layers" grow><LayersDocker {editor} {tick} /></Docker>
        <Docker id="navigator"><Navigator {editor} {tick} /></Docker>
      </div>
    </aside>
  {/if}
  <div class="status"><StatusBar {editor} {tick} {status} /></div>
  <Dialogs {editor} {tick} {commands} bind:shortcuts />
</div>

<style>
  .krita {
    position: absolute; inset: 0; display: grid;
    grid-template-columns: auto 1fr var(--dock);
    grid-template-rows: auto auto 1fr auto;
    grid-template-areas: 'menu menu menu' 'options options options' 'tools view dock' 'status status status';
    pointer-events: none;
  }
  .krita > :global(:not(.view)) { pointer-events: auto; }
  .krita.hidden { grid-template-columns: 0 1fr 0; }
  .menu { grid-area: menu; }
  .options { grid-area: options; }
  .tools { grid-area: tools; display: flex; min-height: 0; }
  .view { grid-area: view; position: relative; min-width: 0; min-height: 0; }
  .dock { grid-area: dock; display: flex; min-height: 0; background: var(--d-panel); border-left: 1px solid var(--d-line); }
  .splitter { width: 5px; cursor: ew-resize; flex: none; }
  .splitter:hover { background: var(--d-accent-soft); }
  .dockers { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow-y: auto; }
  .status { grid-area: status; }
  .notice { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); background: rgba(20, 20, 24, 0.9); color: #fff; padding: 6px 12px; border-radius: 6px; pointer-events: none; }
  .show { position: absolute; top: 8px; left: 8px; pointer-events: auto; background: var(--d-panel); box-shadow: var(--d-shadow); }
</style>
