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
  import RoomLobby from '../ui/room/RoomLobby.svelte';
  import RoomBar from '../ui/room/RoomBar.svelte';
  import EditorView from '../ui/EditorView.svelte';
  import type { Insets } from '../ui/desktop/viewport';
  import type { FileActions } from '../ui/common/types';
  import { Editor } from '../engine/editor';
  import { exportImage, projectToFile, saveProject } from '../engine/project';
  import { SharedSession } from '../net/sharedSession';
  import { supabaseCanvasStore } from '../net/canvasStore';
  import { appChrome } from '../lib/appChrome.svelte';
  import { forgetRoom, recentRooms, rememberRoom, type RecentRoom } from '../lib/recentRooms';
  import { screen, uiStyle } from '../lib/screen.svelte';
  import { downloadBlob, pickFile, timestampedName } from '../lib/download';

  type View = 'home' | 'busy' | 'lobby' | 'canvas';
  let view = $state<View>('home');
  let room = $state.raw<Room | null>(null);
  let editor = $state.raw<Editor | null>(null);
  let session = $state.raw<SharedSession | null>(null);
  let insets = $state<Insets>({ top: 0, right: 0, bottom: 0, left: 0 });
  let recent = $state<RecentRoom[]>(recentRooms());
  let saveText = $state('');
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
    return { id, nickname: settings.nickname.trim().slice(0, 20), avatar: settings.avatar, avatarUrl: settings.avatarUrl, joinedAt };
  }

  /** Entre dans la salle : crée la toile, lance la synchronisation (et charge la sauvegarde si on rouvre la salle). */
  async function enter(r: Room, fresh: boolean) {
    const st = r.state.settings;
    const ed = new Editor({ width: st.width, height: st.height, ownerId: r.me.id, historyBytes: (screen.info.coarse ? 64 : 256) * 2 ** 20 });
    ed.doc.background = st.background;
    const sess = new SharedSession(r, ed, supabaseCanvasStore);
    const saved = r.isHost && !fresh ? await supabaseCanvasStore.load(r.code).catch(() => null) : null;
    await sess.start(saved);
    if (r.isHost) {
      r.updateSettings({ width: ed.doc.width, height: ed.doc.height, background: ed.doc.background });
      sess.autosave(true);
    }
    sess.subscribe(() => (saveText = sess.saveStatus === 'saved' ? t('room.save.saved') : sess.saveStatus === 'saving' ? t('room.save.saving') : ''));
    room = r;
    editor = ed;
    session = sess;
    view = 'canvas';
    error = null;
    remember();
    rememberRoom({ code: r.code, at: Date.now(), width: st.width, height: st.height });
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
    if (session) {
      session.autosave();
      session.dispose();
    }
    session = null;
    editor = null;
    room?.leave();
    room = null;
    recent = recentRooms();
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
      await enter(r, true);
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
      await enter(await Room.join(supabaseTransport, c, me(id, joinedAt), joinPassword || null), false);
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
        await enter(await Room.join(supabaseTransport, saved.code, me(saved.id, saved.joinedAt), null), false);
        return;
      } catch (e) {
        // L'hôte était seul : la salle a disparu avec lui, on la recrée avec le même code.
        if (e instanceof JoinError && e.reason === 'notFound' && saved.wasHost) {
          try {
            await enter(await Room.create(supabaseTransport, saved.code, me(saved.id, saved.joinedAt), saved.settings), false);
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

  /** Rouvre une salle récente : on la rejoint si elle est ouverte, sinon on la recrée depuis sa sauvegarde. */
  async function reopen(r: RecentRoom) {
    if (!hasNickname) return (error = t('shared.needNickname'));
    view = 'busy';
    error = null;
    try {
      await enter(await Room.join(supabaseTransport, r.code, me(), null), false);
    } catch (e) {
      const reason = e instanceof JoinError ? e.reason : 'network';
      if (reason !== 'notFound') {
        view = 'home';
        error = errorText(reason);
        return;
      }
      try {
        const s: RoomSettings = { width: r.width, height: r.height, background: '#ffffff', locked: false, passwordHash: null };
        await enter(await Room.create(supabaseTransport, r.code, me(), s), false);
      } catch {
        view = 'home';
        error = errorText('network');
      }
    }
  }

  const files: FileActions = {
    disabled: ['newDoc', 'open'],
    newDoc() {},
    open() {},
    async save() {
      if (editor) downloadBlob(await projectToFile(await saveProject(editor.doc)), timestampedName('toile', '.dtproj'));
    },
    async importImage() {
      const f = await pickFile('image/*');
      if (f && editor) {
        const bmp = await createImageBitmap(f);
        editor.importImage(bmp, bmp.width, bmp.height);
      }
    },
    async exportImage(type) {
      if (editor) downloadBlob(await exportImage(editor.doc, type), timestampedName('toile', type === 'png' ? '.png' : '.jpg'));
    },
  };

  function onPaste(e: ClipboardEvent) {
    if (view !== 'canvas' || !editor) return;
    const target = e.target as HTMLElement | null;
    if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
    const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
    e.preventDefault();
    if (file) createImageBitmap(file).then((b) => editor?.importImage(b, b.width, b.height));
    else editor.paste();
  }

  $effect(() => {
    appChrome.fullscreen = view === 'canvas';
  });

  onDestroy(() => {
    appChrome.fullscreen = false;
    exit();
  });
</script>

<svelte:window onpaste={onPaste} />

{#if view === 'canvas' && editor && session && room}
  <div class="draw">
    {#key editor}
      <EditorView {editor} {files} status={saveText} bind:insets />
    {/key}
    <div class="roombar" style:top="{insets.top + (uiStyle() === 'mobile' ? 62 : 8)}px" style:left="{insets.left}px" style:right="{insets.right}px">
      <RoomBar {session} {editor} onlobby={() => (view = 'lobby')} />
    </div>
    {#if error}<p class="error floating" role="alert">{error}</p>{/if}
  </div>
{:else}
<main>
  <h1 class="band">{t('shared.title')}</h1>

  {#if !network.online}<p class="error" role="status">{t('offline.notice')}</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#if view === 'busy'}
    <p class="busy" role="status">{t('shared.connecting')}</p>
  {:else if view === 'lobby' && room}
    <RoomLobby {room} session={session ?? undefined} onleave={exit} onopen={() => (view = 'canvas')}
      ondeletesave={() => supabaseCanvasStore.remove(room!.code).then(() => (error = t('room.deleted'))).catch(() => {})} />
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
    {#if recent.length}
      <section class="card">
        <h2>{t('room.recent')}</h2>
        <p class="muted">{t('room.recentHint')}</p>
        <ul class="recent">
          {#each recent as r (r.code)}
            <li>
              <span class="rc">{r.code}</span>
              <span class="muted">{r.width} × {r.height} · {new Date(r.at).toLocaleDateString()}</span>
              <span class="grow"></span>
              <button class="btn small" onclick={() => reopen(r)} disabled={!hasNickname}>{t('room.reopen')}</button>
              <button class="btn small ghost" onclick={() => (forgetRoom(r.code), (recent = recentRooms()))}>{t('room.forget')}</button>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  {/if}
</main>
{/if}

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
  .btn.small { min-height: 36px; padding: 0 12px; background: var(--surface-2); }
  .btn.ghost { background: none; }
  .recent { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  .recent li { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 6px 0; border-top: 1px solid var(--line); }
  .rc { font-weight: 800; letter-spacing: 0.12em; }
  .grow { flex: 1; }
  .draw { position: fixed; inset: 0; overflow: hidden; }
  .roombar { position: absolute; display: flex; justify-content: center; pointer-events: none; z-index: 6; }
  .roombar > :global(*) { pointer-events: auto; }
  .floating { position: absolute; left: 50%; bottom: 120px; transform: translateX(-50%); z-index: 7; }
</style>
