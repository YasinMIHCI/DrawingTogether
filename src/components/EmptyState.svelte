<script lang="ts">
  import type { Snippet } from 'svelte';
  import { parseBouille, randomBouille, seeded } from '../bouille/model';
  import { renderBouille, type Expression } from '../bouille/render';
  import { settings } from '../lib/settings.svelte';

  /** Message « rien pour l'instant », illustré par une Bouille (la sienne, sinon un passant). */
  let { text, expr = 'surprised', seed = 7, children }: { text: string; expr?: Expression; seed?: number; children?: Snippet } = $props();
  const b = $derived(parseBouille(settings.bouille) ?? randomBouille(seeded(seed)));
</script>

<div class="empty panel">
  <span class="who" aria-hidden="true">{@html renderBouille(b, { view: 'full', expr, turn: 0.3 })}</span>
  <div class="bubble">
    <p>{text}</p>
    {#if children}{@render children()}{/if}
  </div>
</div>

<style>
  .empty { display: flex; align-items: center; gap: 18px; padding: 18px 22px; }
  .who { width: 90px; height: 120px; flex: none; }
  .who :global(svg) { width: 100%; height: 100%; }
  .bubble { position: relative; flex: 1; background: var(--surface-2); border-radius: 16px; padding: 12px 16px; display: grid; gap: 10px; justify-items: start; }
  .bubble::before { content: ''; position: absolute; left: -16px; top: 50%; margin-top: -9px; border: 9px solid transparent; border-right: 9px solid var(--surface-2); border-left: 0; }
  p { margin: 0; color: var(--ink-soft); font-weight: 600; }
</style>
