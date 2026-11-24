<script lang="ts">
  import type { Entry } from '../../games/game';
  import { entryImage } from '../../games/media';
  import { t } from '../../lib/i18n/t.svelte';

  /** Affiche une contribution : texte ou dessin (sur fond blanc). */
  let { entry, max = 520 }: { entry: Entry; max?: number } = $props();
  let canvas = $state<HTMLCanvasElement>();
  $effect(() => {
    const p = entryImage(entry);
    if (!p || !canvas) return;
    p.then((img) => {
      if (!canvas) return;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, img.width, img.height);
      ctx.drawImage(img, 0, 0);
    });
  });
</script>

{#if entry.kind === 'image'}
  <canvas bind:this={canvas} style:max-width="{max}px"></canvas>
{:else if entry.kind === 'text'}
  <p class="text">{entry.data}</p>
{:else}
  <p class="text empty">{t('games.empty')}</p>
{/if}

<style>
  canvas { display: block; width: 100%; height: auto; border-radius: 12px; border: 2px solid var(--line); background: #fff; margin: 0 auto; }
  .text { margin: 0; padding: 14px 16px; border-radius: 14px; background: var(--surface); border: 2px solid var(--line); font-size: 1.15rem; font-weight: 600; word-break: break-word; }
  .empty { color: var(--ink-soft); font-weight: 400; font-style: italic; }
</style>
