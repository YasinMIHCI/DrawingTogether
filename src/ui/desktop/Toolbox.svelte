<script lang="ts">
  import type { Editor } from '../../engine/editor';
  import { colorPrefs } from '../../lib/colorPrefs.svelte';
  import { t } from '../../lib/i18n/t.svelte';
  import Icon from '../common/Icon.svelte';
  import { swapColors } from '../brushActions';
  import { formatKeys, type Command } from './commands';

  let { editor, tick, commands, oncolor }: { editor: Editor; tick: number; commands: Record<string, Command>; oncolor?: () => void } = $props();
  const tools = ['brush', 'eraser', 'fill', 'eyedropper', 'shape', 'text', 'select', 'transform', 'liquify'];
  const color = $derived((void tick, editor.color));
  const current = $derived((void tick, editor.tool));
</script>

<div class="toolbox" role="toolbar" aria-orientation="vertical">
  {#each tools as id (id)}
    {@const c = commands[`tool.${id}`]}
    <button class="d-ibtn tool" aria-pressed={current === id} onclick={c.run}
      title="{t(c.label)} ({formatKeys(c.keys![0])})" aria-label={t(c.label)}>
      <Icon name={c.icon!} size={20} />
    </button>
  {/each}
  <div class="colors">
    <button class="bg" style:background={colorPrefs.secondary} onclick={() => swapColors(editor)} title="{t('d.bg')} · {t('cmd.swapColors')} (X)" aria-label={t('d.bg')}></button>
    <button class="fg" style:background={color} onclick={oncolor} title={t('d.fg')} aria-label={t('d.fg')}></button>
  </div>
</div>

<style>
  .toolbox { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 4px; background: var(--d-panel); border-right: 1px solid var(--d-line); width: 42px; overflow-y: auto; }
  .tool { width: 34px; height: 34px; }
  .colors { position: relative; width: 34px; height: 38px; margin-top: 10px; flex: none; }
  .fg, .bg { position: absolute; width: 22px; height: 22px; border-radius: 3px; border: 1px solid var(--d-line); box-shadow: 0 0 0 1px var(--d-panel); }
  .fg { left: 0; top: 0; }
  .bg { right: 0; bottom: 0; }
</style>
