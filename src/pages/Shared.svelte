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
  import RoomLobby from '../ui/room/RoomLobby.svelte';

  type View = 'home' | 'busy' | 'room';
  let view = $state<View>('home');
  let room = $state.raw<Room | null>(null);
  let error = $state<string | null>(null);
  let code = $state(normalizeCode(router.param));
  let joinPassword = $state('');
  let needPassword = $state(false);
  let createPassword = $state('');
  let size = $state<'large' | 'medium' | 'hd' | 'square'>('large');
  let transparent = $state(false);
  const sizes = { large: [4000, 3000], medium: [3000, 2000], hd: [1920, 1080], square: [2048, 2048] } as const;

  const hasNickname = $derived(settings.nickname.trim().length > 0);

  function me(id = newPlayerId(), joinedAt = Date.now()): PeerInfo {
    return { id, nickname: settings.nickname.trim().slice(0, 20), avatar: settings.avatar, joinedAt };
  }

  function enter(r: Room) {
    room = r;
    view = 'room';
    error = null;
    remember();
    history.replaceState(null, '', `#/shared/${r.code}`);
    r.subscribe(() => {
      if (r.status === 'kicked') {
        error = t('shared.kicked');
        exit();
      } else remember();
    });
  }

  function remember() {
    if (!room) return;
    saveRoomSession({ code: room.code, id: room.me.id, joinedAt: room.me.joinedAt, wasHost: room.isHost, settings: room.state.settings });
  }

  function exit() {
    room?.leave();
    room = null;
    saveRoomSession(null);
    view = 'home';
    history.replaceState(null, '', '#/shared');
  }

  const errorText = (reason: RejectReason) => t(`shared.err.${reason}` as Key);

  async function create() {
    if (!hasNickname) return (error = t('shared.needNickname'));
    view = 'busy';
    error = null;
    const [width, height] = sizes[size];
    const s: RoomSettings = { width, height, background: transparent ? null : '#ffffff', locked: false, passwordHash: null };
    try {
      const r = await Room.create(supabaseTransport, generateCode(), me(), s);
      if (createPassword) await r.setPassword(createPassword);
      createPassword = '';
      enter(r);
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
    error = null;
    try {
      enter(await Room.join(supabaseTransport, c, me(id, joinedAt), joinPassword || null));
      joinPassword = '';
      needPassword = false;
    } catch (e) {
      view = 'home';
      const reason = e instanceof JoinError ? e.reason : 'network';
      if (reason === 'password') needPassword = true;
      error = errorText(reason);
    }
  }

  onMount(async () => {
    // Retour dans la salle après un rechargement de la page
    const saved = loadRoomSession();
    if (saved && hasNickname && (!code || code === saved.code)) {
      code = saved.code;
      view = 'busy';
      try {
        enter(await Room.join(supabaseTransport, saved.code, me(saved.id, saved.joinedAt), null));
        return;
      } catch (e) {
        // L'hôte était seul : la salle a disparu avec lui, on la recrée avec le même code.
        if (e instanceof JoinError && e.reason === 'notFound' && saved.wasHost) {
          try {
            enter(await Room.create(supabaseTransport, saved.code, me(saved.id, saved.joinedAt), saved.settings));
            return;
          } catch {
            /* on retombe sur l'accueil */
          }
        }
        saveRoomSession(null);
        view = 'home';
        error = errorText(e instanceof JoinError ? e.reason : 'network');
      }
    } else if (isValidCode(code) && hasNickname) {
      join();
    }
  });

  onDestroy(() => room?.leave());
</script>

<main>
  <h1>{t('shared.title')}</h1>

  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#if view === 'busy'}
    <p class="busy" role="status">{t('shared.connecting')}</p>
  {:else if view === 'room' && room}
    <RoomLobby {room} onleave={exit} />
  {:else}
    <p class="intro">{t('shared.intro')}</p>
    {#if !hasNickname}<ProfileCard />{/if}
    <div class="cols">
      <form class="card" onsubmit={(e) => { e.preventDefault(); join(); }}>
        <h2>{t('shared.join')}</h2>
        <label class="field"><span>{t('shared.code')}</span>
          <input class="code" type="text" value={code} maxlength="7" autocapitalize="characters" autocomplete="off" spellcheck="false"
            placeholder={t('shared.codePlaceholder')} oninput={(e) => (code = normalizeCode(e.currentTarget.value))} /></label>
        {#if needPassword}
          <label class="field"><span>{t('shared.password')}</span>
            <input type="password" bind:value={joinPassword} autocomplete="off" /></label>
        {/if}
        <button class="btn primary" disabled={!isValidCode(code) || !hasNickname}>{t('shared.join')}</button>
      </form>

      <form class="card" onsubmit={(e) => { e.preventDefault(); create(); }}>
        <h2>{t('shared.create')}</h2>
        <fieldset>
          <legend>{t('shared.size')}</legend>
          {#each Object.entries(sizes) as [id, [w, h]] (id)}
            <label class="radio"><input type="radio" name="size" value={id} bind:group={size} />
              {t(`shared.size.${id}` as Key)} <span class="muted">{w} × {h}</span></label>
          {/each}
        </fieldset>
        <div class="row">
          <span>{t('layers.background')}</span>
          <label class="radio"><input type="radio" name="bg" checked={!transparent} onchange={() => (transparent = false)} /> {t('layers.bgWhite')}</label>
          <label class="radio"><input type="radio" name="bg" checked={transparent} onchange={() => (transparent = true)} /> {t('layers.bgTransparent')}</label>
        </div>
        <label class="field"><span>{t('shared.passwordOptional')}</span>
          <input type="password" bind:value={createPassword} autocomplete="new-password" /></label>
        <button class="btn primary" disabled={!hasNickname}>{t('shared.create')}</button>
      </form>
    </div>
  {/if}
</main>

<style>
  main { max-width: 860px; margin: 0 auto; padding: 8px 16px 40px; display: grid; gap: 14px; }
  h1 { margin: 0; }
  .intro { margin: 0; color: var(--ink-soft); }
  .error { margin: 0; padding: 10px 14px; border-radius: 12px; background: #ffe1dc; color: #8a1f0e; }
  .busy { padding: 40px 0; text-align: center; font-size: 1.1rem; color: var(--ink-soft); }
  .cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; align-items: start; }
  @media (max-width: 700px) { .cols { grid-template-columns: minmax(0, 1fr); } }
  .card { background: var(--surface); border: 2px solid var(--line); border-radius: var(--radius); padding: 16px; box-shadow: var(--shadow); display: grid; gap: 12px; }
  h2 { margin: 0; font-size: 1.1rem; }
  .field { display: grid; gap: 4px; }
  .field span, legend { font-size: 0.9rem; color: var(--ink-soft); font-weight: 600; }
  input[type='text'], input[type='password'] { font: inherit; color: var(--ink); padding: 10px 12px; border: 2px solid var(--line); border-radius: 12px; background: var(--surface-2); min-width: 0; }
  .code { font-size: 1.4rem; letter-spacing: 0.2em; text-transform: uppercase; font-weight: 700; }
  fieldset { border: 0; padding: 0; margin: 0; display: grid; gap: 6px; }
  .radio { display: flex; gap: 8px; align-items: center; }
  .row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  .muted { color: var(--ink-soft); font-size: 0.85rem; }
  .btn { font: inherit; min-height: 44px; border-radius: 12px; border: 2px solid var(--line); cursor: pointer; }
  .btn.primary { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); font-weight: 700; }
  .btn:disabled { opacity: 0.45; cursor: default; }
</style>
