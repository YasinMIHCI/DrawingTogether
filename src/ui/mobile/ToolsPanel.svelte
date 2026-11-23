<script lang="ts">
  import type { ToolId } from '../../engine/editor';
  import { t } from '../../lib/i18n/t.svelte';
  import type { Key } from '../../lib/i18n/i18n.svelte';
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';

  export type ToolChoice = ToolId | 'filters' | 'effects';
  let { tool, onpick }: { tool: ToolId; onpick: (c: ToolChoice) => void } = $props();

  const items: { id: ToolChoice; icon: IconName; label: Key }[] = [
    { id: 'transform', icon: 'move', label: 'tools.transform' },
    { id: 'select', icon: 'select', label: 'tools.select' },
    { id: 'liquify', icon: 'liquify', label: 'tools.liquify' },
    { id: 'shape', icon: 'shape', label: 'tools.shape' },
    { id: 'filters', icon: 'filters', label: 'tools.filters' },
    { id: 'brush', icon: 'brush', label: 'tools.brush' },
    { id: 'eraser', icon: 'eraser', label: 'tools.eraser' },
    { id: 'fill', icon: 'fill', label: 'tools.fill' },
    { id: 'eyedropper', icon: 'eyedropper', label: 'tools.eyedropper' },
    { id: 'effects', icon: 'effect', label: 'tools.effects' },
    { id: 'text', icon: 'text', label: 'tools.text' },
  ];
</script>

<div class="grid">
  {#each items as it (it.id)}
    <button class:active={it.id === tool} onclick={() => onpick(it.id)}>
      <Icon name={it.icon} size={30} />
      <span>{t(it.label)}</span>
    </button>
  {/each}
</div>

<style>
  .grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px 2px; padding: 12px 6px 4px; }
  button { display: grid; justify-items: center; gap: 6px; padding: 8px 2px; border-radius: 12px; color: var(--m-ink); }
  button span { font-size: 0.78rem; line-height: 1.2; text-align: center; color: var(--m-text); }
  button.active { color: var(--m-accent); }
  button.active span { color: var(--m-accent); }
  button:active { background: rgba(127, 127, 127, 0.12); }
</style>
