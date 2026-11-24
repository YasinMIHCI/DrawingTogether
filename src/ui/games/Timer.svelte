<script lang="ts">
  import { onMount } from 'svelte';
  import { play } from '../../lib/sound';
  /** Barre de temps restant ; appelle `onend` une fois à zéro. */
  let { deadline, total, onend }: { deadline: number | null; total: number; onend?: () => void } = $props();
  let now = $state(Date.now());
  let fired = false;
  let lastTick = -1;
  onMount(() => {
    const id = setInterval(() => {
      now = Date.now();
      // Tic-tac pendant les 5 dernières secondes
      const sec = deadline ? Math.ceil((deadline - now) / 1000) : -1;
      if (sec > 0 && sec <= 5 && sec !== lastTick) {
        lastTick = sec;
        play('tick');
      }
      if (deadline && now >= deadline && !fired) {
        fired = true;
        onend?.();
      }
    }, 250);
    return () => clearInterval(id);
  });
  const left = $derived(deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : null);
  const ratio = $derived(deadline && total ? Math.max(0, Math.min(1, (deadline - now) / total)) : 1);
</script>

{#if left !== null}
  <div class="timer" class:low={left <= 10} role="timer" aria-live="off">
    <div class="bar"><span style:width="{ratio * 100}%"></span></div>
    <b>{left}</b>
  </div>
{/if}

<style>
  .timer { display: flex; align-items: center; gap: 8px; min-width: 120px; }
  .bar { flex: 1; height: 8px; border-radius: 4px; background: rgba(127, 127, 127, 0.25); overflow: hidden; }
  .bar span { display: block; height: 100%; background: var(--teal); transition: width 0.25s linear; }
  .low .bar span { background: var(--accent); }
  b { font-variant-numeric: tabular-nums; min-width: 2ch; text-align: right; }
  .low b { color: var(--accent); }
</style>
