<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { generateCode, isValidCode, JoinError, normalizeCode, Room, type RejectReason, type RoomSettings } from '../net/room';
  import { supabaseTransport } from '../net/supabaseTransport';
  import type { PeerInfo } from '../net/transport';
  import { loadRoomSession, newPlayerId, saveRoomSession } from '../lib/roomSession';
  import { router } from '../lib/router.svelte';
  import { settings } from '../lib/settings.svelte';
  import { t } from '../lib/i18n/t.svelte';
  import type { Key } from '../lib/i18n/i18n.svelte';
  import ProfileCard from '../components/ProfileCard.svelte';
  import { network } from '../lib/online.svelte';
  import GameRoom from '../ui/games/GameRoom.svelte';

  const SETTINGS: RoomSettings = { width: 1, height: 1, background: null, locked: false, passwordHash: null };
  let view = $state<'home' | 'busy' | 'room'>('home');
  let room = $state.raw<Room | null>(null);
  let error = $state<string | null>(null);
  let code = $state(normalizeCode(router.param));
  let password = $state('');
  let needPassword = $state(false);
  const hasNickname = $derived(settings.nickname.trim().length > 0);

  const me = (id = newPlayerId(), joinedAt = Date.now()): PeerInfo => ({ id, nickname: settings.nickname.trim().slice(0, 20), avatar: settings.avatar, avatarUrl: settings.avatarUrl, joinedAt });
  const errorText = (r: RejectReason) => t(`shared.err.${r}` as Key);

  function enter(r: Room) {
    room = r;
    view = 'room';
    error = null;
    remember();
    history.replaceState(null, '', `#/games/${r.code}`);
    r.subscribe(() => {
      if (r.status === 'kicked') {
        error = t('shared.kicked');
        exit();
      } else remember();
    });
  }
  function remember() {
    if (room) saveRoomSession({ code: room.code, id: room.me.id, joinedAt: room.me.joinedAt, wasHost: room.isHost, settings: SETTINGS }, 'games');
  }
  function exit() {
    room?.leave();
    room = null;
    saveRoomSession(null, 'games');
    view = 'home';
    history.replaceState(null, '', '#/games');
  }

  async function create() {
    if (!hasNickname) return (error = t('shared.needNickname'));
    view = 'busy';
    try {
      enter(await Room.create(supabaseTransport, generateCode(), me(), SETTINGS));
    } catch {
      view = 'home';
      error = errorText('network');
    }
  }
  async function join(id?: string, joinedAt?: number) {
    if (!hasNickname) return (error = t('shared.needNickname'));
    const c = normalizeCode(code);
    if (!isValidCode(c)) return;
    view = 'busy';
    try {
      enter(await Room.join(supabaseTransport, c, me(id, joinedAt), password || null));
      password = '';
      needPassword = false;
    } catch (e) {
      view = 'home';
      const reason = e instanceof JoinError ? e.reason : 'network';
      if (reason === 'password') needPassword = true;
      error = errorText(reason);
    }
  }

  onMount(() => {
    const saved = loadRoomSession('games');
    if (saved && hasNickname && (!code || code === saved.code)) {
      code = saved.code;
      join(saved.id, saved.joinedAt);
    } else if (isValidCode(code) && hasNickname) join();
  });
  onDestroy(() => room?.leave());
</script>

<main>
  {#if !network.online}<p class="error" role="status">{t('offline.notice')}</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  {#if view === 'busy'}
    <p class="busy" role="status">{t('shared.connecting')}</p>
  {:else if view === 'room' && room}
    {#key room}<GameRoom {room} onleave={exit} />{/key}
  {:else}
    <h1>{t('games.title')}</h1>
    <p class="intro">{t('games.intro')}</p>
    {#if !hasNickname}<ProfileCard />{/if}
    <div class="cols">
      <form class="card" onsubmit={(e) => { e.preventDefault(); join(); }}>
        <h2>{t('shared.join')}</h2>
        <label class="field"><span>{t('shared.code')}</span>
          <input class="code" type="text" value={code} maxlength="7" autocomplete="off" spellcheck="false" placeholder={t('shared.codePlaceholder')}
            oninput={(e) => (code = normalizeCode(e.currentTarget.value))} /></label>
        {#if needPassword}
          <label class="field"><span>{t('shared.password')}</span><input type="password" bind:value={password} /></label>
        {/if}
        <button class="btn primary" disabled={!isValidCode(code) || !hasNickname}>{t('shared.join')}</button>
      </form>
      <div class="card">
        <h2>{t('games.create')}</h2>
        <p class="muted">{t('games.waitHost')}</p>
        <button class="btn primary" onclick={create} disabled={!hasNickname}>{t('games.create')}</button>
      </div>
    </div>
  {/if}
</main>

<style>
  main { max-width: 860px; margin: 0 auto; padding: 8px 16px 40px; display: grid; gap: 14px; }
  h1 { margin: 0; }
  .intro, .muted { margin: 0; color: var(--ink-soft); }
  .error { margin: 0; padding: 10px 14px; border-radius: 12px; background: #ffe1dc; color: #8a1f0e; }
  .busy { padding: 40px 0; text-align: center; color: var(--ink-soft); }
  .cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; align-items: start; }
  @media (max-width: 700px) { .cols { grid-template-columns: minmax(0, 1fr); } }
  .card { background: var(--surface); border: 2px solid var(--line); border-radius: var(--radius); padding: 16px; box-shadow: var(--shadow); display: grid; gap: 12px; }
  h2 { margin: 0; font-size: 1.1rem; }
  .field { display: grid; gap: 4px; }
  .field span { font-size: 0.9rem; color: var(--ink-soft); font-weight: 600; }
  input { font: inherit; color: var(--ink); padding: 10px 12px; border: 2px solid var(--line); border-radius: 12px; background: var(--surface-2); min-width: 0; }
  .code { font-size: 1.4rem; letter-spacing: 0.2em; text-transform: uppercase; font-weight: 700; }
  .btn { font: inherit; min-height: 44px; border-radius: 12px; border: 2px solid var(--line); cursor: pointer; }
  .btn.primary { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); font-weight: 700; }
  .btn:disabled { opacity: 0.45; cursor: default; }
</style>
