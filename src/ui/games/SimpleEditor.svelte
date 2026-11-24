<script lang="ts">
  import { onMount } from 'svelte';
  import type { Editor, ToolId } from '../../engine/editor';
  import { getPreset } from '../../engine/brush/presets';
  import { t } from '../../lib/i18n/t.svelte';
  import Icon from '../common/Icon.svelte';
  import type { IconName } from '../common/icons';

  /** Éditeur simplifié et rapide pour les jeux : crayon, gomme, remplissage, 3 tailles, palette. */
  let { editor }: { editor: Editor } = $props();
  let tick = $state(0);
  let canvas: HTMLCanvasElement;
  onMount(() => {
    editor.setBrush({ ...getPreset('marker-fine')!.settings, size: 6 }, 'brush');
    editor.setBrush({ ...getPreset('eraser-hard')!.settings, size: 24 }, 'eraser');
    editor.configure('fill', { tolerance: 48, expand: 2 });
    const detach = editor.attach(canvas);
    const unsub = editor.subscribe(() => tick++);
    requestAnimationFrame(() => editor.fit());
    return () => (unsub(), detach());
  });
  const s = $derived((void tick, { tool: editor.tool, color: editor.color, size: editor.brush.size, canUndo: editor.history.canUndo, canRedo: editor.history.canRedo }));
  const colors = ['#1f2430', '#ffffff', '#8a8f99', '#e8463a', '#f59f2f', '#f7d046', '#7cc35c', '#2a8a4a', '#2bb3a3', '#3d7be0', '#1d3f8f', '#8a5cd6', '#e86fa8', '#8b5a3c', '#f2c6a0', '#ffe3ec'];
  const tools: [ToolId, IconName][] = [['brush', 'brush'], ['eraser', 'eraser'], ['fill', 'fill']];
  const sizes = [3, 8, 20];
  function size(px: number) {
    if (editor.tool === 'eraser') editor.setBrush({ size: px * 2 }, 'eraser');
    else editor.setBrush({ size: px }, 'brush');
  }
</script>

<div class="se">
  <div class="wrap"><canvas class="canvas-surface" bind:this={canvas}></canvas></div>
  <div class="tools" role="toolbar">
    {#each tools as [id, icon] (id)}
      <button class="ib" aria-pressed={s.tool === id} onclick={() => editor.setTool(id)} aria-label={t(`tools.${id}`)} title={t(`tools.${id}`)}><Icon name={icon} /></button>
    {/each}
    <span class="sep"></span>
    {#each sizes as px (px)}
      <button class="ib" aria-pressed={s.tool !== 'eraser' && Math.abs(s.size - px) < 0.5} onclick={() => size(px)} aria-label="{px} px">
        <span class="dot" style:width="{px + 4}px" style:height="{px + 4}px"></span>
      </button>
    {/each}
    <span class="sep"></span>
    <button class="ib" disabled={!s.canUndo} onclick={() => editor.undo()} aria-label={t('draw.undo')}><Icon name="undo" /></button>
    <button class="ib" disabled={!s.canRedo} onclick={() => editor.redo()} aria-label={t('draw.redo')}><Icon name="redo" /></button>
    <button class="ib" onclick={() => editor.clearLayer()} aria-label={t('games.clear')} title={t('games.clear')}><Icon name="trash" /></button>
  </div>
  <div class="palette">
    {#each colors as c (c)}
      <button class="sw" class:on={s.color === c} style:background={c} aria-label={c} onclick={() => (editor.setColor(c), s.tool === 'eraser' && editor.setTool('brush'))}></button>
    {/each}
    <label class="sw custom" title={t('brush.color')}><input type="color" value={s.color} oninput={(e) => editor.setColor(e.currentTarget.value)} /></label>
  </div>
</div>

<style>
  .se { display: flex; flex-direction: column; gap: 8px; height: 100%; min-height: 0; }
  .wrap { position: relative; flex: 1; min-height: 200px; border-radius: 14px; overflow: hidden; background: #d9dbe0; }
  canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
  .tools, .palette { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; align-items: center; }
  .ib { width: 44px; height: 44px; border-radius: 12px; border: 2px solid var(--line); background: var(--surface); color: var(--ink); display: grid; place-items: center; cursor: pointer; }
  .ib[aria-pressed='true'] { border-color: var(--accent); color: var(--accent); }
  .ib:disabled { opacity: 0.4; }
  .dot { border-radius: 50%; background: currentColor; }
  .sep { width: 1px; height: 30px; background: var(--line); }
  .sw { width: 30px; height: 30px; border-radius: 50%; border: 2px solid var(--line); cursor: pointer; padding: 0; }
  .sw.on { box-shadow: 0 0 0 3px var(--accent); }
  .custom { position: relative; overflow: hidden; background: conic-gradient(red, yellow, lime, cyan, blue, magenta, red); }
  .custom input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
</style>
