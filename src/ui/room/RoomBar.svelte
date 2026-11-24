<script lang="ts">
  import { onMount, tick as nextTick } from 'svelte';
  import type { Editor } from '../../engine/editor';
  import type { SharedSession } from '../../net/sharedSession';
  import { peerColor } from '../../net/sharedSession';
  import { t } from '../../lib/i18n/t.svelte';
  import PlayerAvatar from '../../components/PlayerAvatar.svelte';
  import MiniMap from './MiniMap.svelte';
  import { play } from '../../lib/sound';

  /** Barre de la salle, posée sur la toile : joueurs, code, discussion, vue d'ensemble, retour à la salle. */
  let { session, editor, onlobby }: { session: SharedSession; editor: Editor; onlobby: () => void } = $props();

  let tick = $state(0);
  onMount(() => {
    const a = session.subscribe(() => tick++);
    const b = session.room.subscribe(() => tick++);
    return () => (a(), b());
  });
  const s = $derived.by(() => {
    void tick;
    return {
      peers: session.room.peers, hostId: session.room.state.hostId, chat: session.chat, unread: session.unread,
      synced: session.synced, reconnecting: session.room.status === 'reconnecting',
    };
  });
  // Son quand un autre joueur écrit
  let seen = 0;
  $effect(() => {
    const n = s.chat.length;
    if (n > seen && s.chat[n - 1]?.from !== session.me) play('message');
    seen = n;
  });
  let chatOpen = $state(false);
  let mapOpen = $state(false);
  let text = $state('');
  let list = $state<HTMLElement>();

  async function openChat() {
    chatOpen = !chatOpen;
    session.unread = 0;
    tick++;
    await nextTick();
    list?.scrollTo(0, list.scrollHeight);
  }
  $effect(() => {
    void s.chat.length;
    if (chatOpen) {
      session.unread = 0;
      nextTick().then(() => list?.scrollTo(0, list.scrollHeight));
    }
  });
</script>

<div class="rb">
  <div class="pill">
    <button class="code" onclick={onlobby} title={t('room.lobby')}>{session.room.code}</button>
    <div class="peers" aria-label={t('room.players')}>
      {#each s.peers as p (p.id)}
        <span class="peer" style:--c={peerColor(p.avatar)} title={p.nickname}>
          <PlayerAvatar avatar={p.avatar} url={p.avatarUrl} bouille={p.bouille} size={26} />
          {#if p.id === s.hostId}<span class="crown">👑</span>{/if}
        </span>
      {/each}
    </div>
    <button class="ib" aria-pressed={chatOpen} onclick={openChat} aria-label={t('room.chat')} title={t('room.chat')}>
      💬{#if s.unread && !chatOpen}<span class="badge">{s.unread}</span>{/if}
    </button>
    <button class="ib" aria-pressed={mapOpen} onclick={() => (mapOpen = !mapOpen)} aria-label={t('room.minimap')} title={t('room.minimap')}>🗺</button>
  </div>
  {#if !s.synced}<p class="note">{t('room.syncing')}</p>{/if}
  {#if s.reconnecting}<p class="note warn">{t('shared.reconnecting')}</p>{/if}
  {#if mapOpen}<div class="map"><MiniMap {editor} {session} {tick} /></div>{/if}
  {#if chatOpen}
    <div class="chat">
      <ul bind:this={list}>
        {#each s.chat as m, i (i)}
          <li><b style:color={peerColor(s.peers.find((p) => p.id === m.from)?.avatar ?? 0)}>{m.name}</b> {m.text}</li>
        {/each}
      </ul>
      <form onsubmit={(e) => { e.preventDefault(); session.sendChat(text); text = ''; }}>
        <input type="text" bind:value={text} maxlength="300" placeholder={t('room.chatPlaceholder')} aria-label={t('room.chat')} />
        <button disabled={!text.trim()}>{t('room.send')}</button>
      </form>
    </div>
  {/if}
</div>

<style>
  .rb { display: grid; justify-items: center; gap: 6px; font: 14px/1.3 system-ui, sans-serif; pointer-events: none; }
  .rb > * { pointer-events: auto; }
  .pill { display: flex; align-items: center; gap: 6px; padding: 4px 6px; border-radius: 22px; background: rgba(255, 255, 255, 0.94); color: #1f2430; box-shadow: 0 2px 12px rgba(0, 0, 0, 0.18); max-width: calc(100vw - 24px); }
  .code { font: inherit; font-weight: 800; letter-spacing: 0.12em; padding: 4px 10px; border-radius: 16px; border: 0; background: #f0efe9; color: inherit; cursor: pointer; }
  .peers { display: flex; overflow-x: auto; }
  .peer { position: relative; margin-left: -4px; border-radius: 50%; box-shadow: 0 0 0 2px #fff, 0 0 0 4px var(--c); display: grid; }
  .peer:first-child { margin-left: 2px; }
  .crown { position: absolute; top: -9px; right: -6px; font-size: 11px; }
  .ib { position: relative; font-size: 17px; width: 34px; height: 34px; border-radius: 50%; border: 0; background: none; cursor: pointer; }
  .ib[aria-pressed='true'] { background: #e7f0ff; }
  .badge { position: absolute; top: -2px; right: -2px; min-width: 16px; height: 16px; border-radius: 8px; background: #ff3b30; color: #fff; font-size: 10px; display: grid; place-items: center; padding: 0 3px; }
  .note { margin: 0; padding: 4px 10px; border-radius: 12px; background: rgba(255, 255, 255, 0.94); color: #444; font-size: 12px; }
  .warn { background: #ffc94a; color: #1f2430; }
  .chat { width: min(340px, calc(100vw - 24px)); background: rgba(255, 255, 255, 0.97); color: #1f2430; border-radius: 14px; box-shadow: 0 4px 18px rgba(0, 0, 0, 0.2); overflow: hidden; }
  ul { list-style: none; margin: 0; padding: 8px 10px; max-height: 220px; overflow-y: auto; display: grid; gap: 4px; word-break: break-word; }
  form { display: flex; gap: 6px; padding: 6px; border-top: 1px solid #eee; }
  input { flex: 1; min-width: 0; font: inherit; padding: 6px 10px; border-radius: 14px; border: 1px solid #ddd; }
  form button { font: inherit; border: 0; border-radius: 14px; padding: 0 12px; background: #ff6b4a; color: #fff; cursor: pointer; }
  form button:disabled { opacity: 0.4; }
</style>
