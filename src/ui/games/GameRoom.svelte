<script lang="ts">
  import { onDestroy, onMount, untrack } from 'svelte';
  import type { Room } from '../../net/room';
  import { Game } from '../../games/game';
  import { stepTime } from '../../games/modes';
  import { t } from '../../lib/i18n/t.svelte';
  import RoomLobby from '../room/RoomLobby.svelte';
  import ModePicker from './ModePicker.svelte';
  import WriteStep from './WriteStep.svelte';
  import DrawStep from './DrawStep.svelte';
  import Waiting from './Waiting.svelte';
  import Album from './Album.svelte';
  import { play } from '../../lib/sound';

  let { room, onleave }: { room: Room; onleave: () => void } = $props();
  const game = untrack(() => new Game(room));
  let tick = $state(0);
  onMount(() => {
    const a = game.subscribe(() => tick++);
    const b = room.subscribe(() => tick++);
    return () => (a(), b());
  });
  onDestroy(() => game.dispose());

  // Sons : début de tour (si on a quelque chose à faire), fin de partie
  let lastStep = '';
  $effect(() => {
    const step = `${s.id}-${s.phase}-${s.round}`;
    if (step === lastStep) return;
    lastStep = step;
    if (s.phase === 'play' && s.task && !s.submitted) play('start');
    else if (s.phase === 'album') play('end');
  });

  const s = $derived.by(() => {
    void tick;
    const st = game.state;
    const task = game.task();
    return {
      phase: st?.phase ?? 'lobby', task, submitted: game.hasSubmitted(), spectator: !!st && st.phase !== 'lobby' && game.myIndex < 0,
      host: room.isHost, players: room.peers.length, round: st?.round ?? 0, id: st?.id ?? '',
      total: task ? stepTime(st!.config, task.kind) * 1000 : 0,
    };
  });
</script>

{#if s.phase === 'lobby'}
  <RoomLobby {room} {onleave} canvasInfo={false} primaryLabel={t('games.start')} onopen={s.host ? () => game.start() : undefined}>
    {#snippet extra()}<ModePicker {game} {tick} players={s.players} />{/snippet}
  </RoomLobby>
{:else if s.phase === 'album'}
  <Album {game} {tick} />
{:else if s.spectator}
  <p class="card">{t('games.spectator')}</p>
  <Waiting {game} {tick} total={0} />
{:else if s.task && !s.submitted}
  {#key `${s.id}-${s.round}`}
    {#if s.task.kind === 'write'}
      <WriteStep {game} task={s.task} total={s.total} />
    {:else}
      <DrawStep {game} task={s.task} total={s.total} />
    {/if}
  {/key}
{:else}
  <Waiting {game} {tick} total={s.total} />
{/if}

<style>
  .card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 14px; text-align: center; }
</style>
