<script lang="ts">
  import type { Snippet } from 'svelte';

  /** Bouton qui ouvre un panneau ; se ferme en cliquant ailleurs ou avec Échap. */
  let { button, children, align = 'left', label, open = $bindable(false), wide = false }: {
    button: Snippet; children: Snippet<[() => void]>; align?: 'left' | 'right'; label: string; open?: boolean; wide?: boolean;
  } = $props();
  let root: HTMLElement;
  const close = () => (open = false);

  $effect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  });
</script>

<div class="dd" bind:this={root}>
  <button class="trigger" aria-haspopup="true" aria-expanded={open} aria-label={label} title={label} onclick={() => (open = !open)}>
    {@render button()}
  </button>
  {#if open}
    <div class="d-popover" class:right={align === 'right'} class:wide role="menu">
      {@render children(close)}
    </div>
  {/if}
</div>

<style>
  .dd { position: relative; display: inline-flex; }
  .trigger { display: contents; }
  .d-popover { top: calc(100% + 4px); left: 0; }
  .d-popover.right { left: auto; right: 0; }
  .d-popover.wide { min-width: 280px; }
</style>
