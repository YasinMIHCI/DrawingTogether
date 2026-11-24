<script lang="ts">
  import type { Game } from '../../games/game';
  import { t } from '../../lib/i18n/t.svelte';
  import Avatar from '../../components/Avatar.svelte';
  import { chainFor } from '../../games/modes';
  import Timer from './Timer.svelte';

  /** Après avoir rendu sa contribution : qui a fini, chrono, et bouton de l'hôte pour passer à la suite. */
  let { game, tick, total }: { game: Game; tick: number; total: number } = $props();
  const s = $derived.by(() => {
    void tick;
    const st = game.state!;
    const n = st.players.length;
    return {
      players: st.players.map((p, i) => ({ ...p, done: !!game.entry(chainFor(i, st.round, n), st.round), here: game.room.peers.some((q) => q.id === p.id) })),
      count: game.submittedCount(), n, host: game.room.isHost,
    };
  });
</script>

<section class="wait">
  <h2>{t('games.waiting', { k: String(s.count), n: String(s.n) })}</h2>
  <Timer deadline={game.deadline} {total} />
  <ul>
    {#each s.players as p (p.id)}
      <li class:done={p.done} class:away={!p.here}><Avatar id={p.avatar} size={44} /><span>{p.nickname}</span>{#if p.done}<b>✓</b>{/if}</li>
    {/each}
  </ul>
  {#if s.host}<button class="btn" onclick={() => game.finishRound()}>{t('games.skip')}</button>{/if}
</section>

<style>
  .wait { display: grid; gap: 16px; justify-items: center; max-width: 560px; margin: 40px auto; text-align: center; }
  h2 { margin: 0; }
  .wait :global(.timer) { width: 260px; }
  ul { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; }
  li { display: grid; justify-items: center; gap: 4px; opacity: 0.5; position: relative; }
  li.done { opacity: 1; }
  li.away { filter: grayscale(1); }
  b { position: absolute; top: -4px; right: -4px; background: var(--teal); color: #fff; border-radius: 50%; width: 20px; height: 20px; display: grid; place-items: center; font-size: 12px; }
  .btn { font: inherit; min-height: 42px; padding: 0 18px; border-radius: 12px; border: 2px solid var(--line); background: var(--surface); color: var(--ink); cursor: pointer; }
</style>
