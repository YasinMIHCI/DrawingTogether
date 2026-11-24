<script lang="ts">
  import { onMount } from 'svelte';
  import { MAX_PLAYERS, type Room } from '../../net/room';
  import { t } from '../../lib/i18n/t.svelte';
  import Avatar from '../../components/Avatar.svelte';
  import QrCode from './QrCode.svelte';
  import type { SharedSession } from '../../net/sharedSession';

  let { room, session, onleave, onopen, ondeletesave }: {
    room: Room; session?: SharedSession; onleave: () => void; onopen?: () => void; ondeletesave?: () => void;
  } = $props();

  let tick = $state(0);
  onMount(() => {
    const a = room.subscribe(() => tick++);
    const b = session?.subscribe(() => tick++);
    return () => (a(), b?.());
  });
  const saveStatus = $derived((void tick, session?.saveStatus ?? 'off'));
  // Agrandir la toile (hôte)
  let grow = $state({ top: 0, right: 0, bottom: 0, left: 0 });
  const newW = $derived((void tick, room.state.settings.width) + grow.left + grow.right);
  const newH = $derived((void tick, room.state.settings.height) + grow.top + grow.bottom);
  const growValid = $derived(newW <= 8192 && newH <= 8192 && newW * newH <= 4096 * 4096 && newW >= 16 && newH >= 16 && (grow.top || grow.right || grow.bottom || grow.left) !== 0);
  function applyGrow() {
    session?.resize(newW, newH, grow.left, grow.top);
    grow = { top: 0, right: 0, bottom: 0, left: 0 };
  }
  const s = $derived.by(() => {
    void tick;
    return { peers: room.peers, state: room.state, isHost: room.isHost, status: room.status };
  });
  const link = $derived(`${location.origin}${location.pathname}#/shared/${room.code}`);
  let copied = $state(false);
  let showQr = $state(false);
  let password = $state('');

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      prompt(t('shared.copyLink'), link);
    }
  }
  function share() {
    navigator.share?.({ title: 'DrawingTogether', text: t('shared.inviteText'), url: link }).catch(() => {});
  }
  const slots = $derived(Array.from({ length: MAX_PLAYERS }, (_, i) => s.peers[i] ?? null));
</script>

<section class="lobby">
  {#if s.status === 'reconnecting'}<p class="banner" role="status">{t('shared.reconnecting')}</p>{/if}

  <header class="card invite">
    <div>
      <p class="label">{t('shared.room')}</p>
      <p class="code">{room.code}</p>
      <p class="muted">{t('shared.canvasInfo', { w: String(s.state.settings.width), h: String(s.state.settings.height) })}</p>
    </div>
    <div class="actions">
      <button class="btn primary" onclick={copy}>{copied ? t('shared.copied') : t('shared.copyLink')}</button>
      {#if 'share' in navigator}<button class="btn" onclick={share}>{t('shared.share')}</button>{/if}
      <button class="btn" aria-pressed={showQr} onclick={() => (showQr = !showQr)}>{t('shared.qr')}</button>
    </div>
    {#if showQr}<div class="qr"><QrCode text={link} /></div>{/if}
  </header>

  <div class="card">
    <h2>{t('shared.players')} <span class="muted">{s.peers.length} / {MAX_PLAYERS}</span></h2>
    <ul class="slots">
      {#each slots as p, i (p?.id ?? `empty-${i}`)}
        <li class:empty={!p}>
          {#if p}
            <div class="av">
              <Avatar id={p.avatar} size={56} />
              {#if p.id === s.state.hostId}<span class="crown" title={t('shared.host')} aria-label={t('shared.host')}>👑</span>{/if}
            </div>
            <span class="name">{p.nickname}{#if p.id === room.me.id} <em>({t('shared.you')})</em>{/if}</span>
            {#if s.isHost && p.id !== room.me.id}
              <div class="ptools">
                <button class="mini" onclick={() => room.transferHost(p.id)}>{t('shared.makeHost')}</button>
                <button class="mini danger" onclick={() => confirm(t('shared.kickConfirm', { name: p.nickname })) && room.kick(p.id)}>{t('shared.kick')}</button>
              </div>
            {/if}
          {:else}
            <div class="av ghost"></div>
            <span class="name muted">{t('shared.empty')}</span>
          {/if}
        </li>
      {/each}
    </ul>
  </div>

  {#if s.isHost}
    <div class="card">
      <h2>{t('shared.hostTools')}</h2>
      <label class="check"><input type="checkbox" checked={s.state.settings.locked} onchange={(e) => room.setLocked(e.currentTarget.checked)} /> {t('shared.lock')}</label>
      <form class="pw" onsubmit={(e) => { e.preventDefault(); if (password) room.setPassword(password); password = ''; }}>
        <input type="password" bind:value={password} placeholder={t('shared.password')} autocomplete="new-password" />
        <button class="btn" disabled={!password}>{t('shared.setPassword')}</button>
        {#if s.state.settings.passwordHash}
          <span class="muted">🔒 {t('shared.passwordOn')}</span>
          <button type="button" class="btn" onclick={() => room.setPassword(null)}>{t('shared.removePassword')}</button>
        {/if}
      </form>
      <p class="muted small">{t('shared.security')}</p>
    </div>
    {#if session}
      <div class="card">
        <h2>{t('room.enlarge')}</h2>
        <p class="muted small top0">{t('room.enlargeHint')}</p>
        <div class="grow">
          {#each ['top', 'right', 'bottom', 'left'] as const as side (side)}
            <label>{t(`room.${side}`)}<input type="number" min="0" max="4000" step="100" bind:value={grow[side]} /></label>
          {/each}
        </div>
        <div class="row">
          <span class="muted">{t('room.newSize', { w: String(newW), h: String(newH) })}</span>
          <button class="btn" disabled={!growValid} onclick={applyGrow}>{t('room.apply')}</button>
        </div>
        {#if !growValid && (newW > 8192 || newH > 8192 || newW * newH > 4096 * 4096)}<p class="muted small">{t('newdoc.tooBig')}</p>{/if}
      </div>
    {/if}
  {/if}

  {#if session}
    <div class="card">
      <p class="save" class:bad={saveStatus === 'unavailable'}>{t(`room.save.${saveStatus}`)}</p>
      <p class="muted small top0">{t('room.saveHint')}</p>
      {#if s.isHost && ondeletesave && saveStatus !== 'off'}
        <button class="btn small-btn" onclick={() => confirm(t('room.deleteConfirm')) && ondeletesave?.()}>{t('room.deleteSave')}</button>
      {/if}
    </div>
  {/if}

  <div class="bottom">
    <button class="btn" onclick={onleave}>{t('shared.leave')}</button>
    <button class="btn primary" disabled={!onopen} onclick={onopen}>{t('shared.openCanvas')}</button>
  </div>

</section>

<style>
  .lobby { display: grid; gap: 14px; }
  .card { background: var(--surface); border: 2px solid var(--line); border-radius: var(--radius); padding: 16px; box-shadow: var(--shadow); }
  .banner { margin: 0; padding: 10px 14px; border-radius: 12px; background: var(--sun); color: #1f2430; font-weight: 600; }
  .invite { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
  .label { margin: 0; color: var(--ink-soft); font-size: 0.85rem; }
  .code { margin: 0; font-size: 2rem; font-weight: 800; letter-spacing: 0.18em; font-variant-numeric: tabular-nums; }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .qr { width: 100%; display: grid; place-items: center; }
  h2 { margin: 0 0 12px; font-size: 1.05rem; display: flex; justify-content: space-between; }
  .slots { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; }
  .slots li { display: grid; justify-items: center; gap: 4px; padding: 10px 6px; border-radius: 14px; background: var(--surface-2); text-align: center; }
  .slots li.empty { opacity: 0.55; }
  .av { position: relative; }
  .ghost { width: 56px; height: 56px; border-radius: 50%; border: 2px dashed var(--line); }
  .crown { position: absolute; right: -6px; top: -8px; font-size: 1.2rem; }
  .name { font-weight: 600; word-break: break-word; }
  em { font-weight: 400; color: var(--ink-soft); }
  .ptools { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; }
  .btn { font: inherit; color: inherit; min-height: 42px; padding: 0 16px; border-radius: 12px; border: 2px solid var(--line); background: var(--surface); cursor: pointer; }
  .btn.primary { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); font-weight: 700; }
  .btn:disabled { opacity: 0.45; cursor: default; }
  .btn[aria-pressed='true'] { border-color: var(--teal); }
  .mini { font: inherit; font-size: 0.75rem; padding: 3px 8px; border-radius: 8px; border: 1px solid var(--line); background: var(--surface); color: inherit; cursor: pointer; }
  .mini.danger { color: #d33; }
  .check { display: flex; gap: 8px; align-items: center; margin-bottom: 10px; }
  .pw { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .pw input { font: inherit; color: var(--ink); padding: 9px 12px; border: 2px solid var(--line); border-radius: 12px; background: var(--surface-2); min-width: 0; }
  .muted { color: var(--ink-soft); }
  .small { font-size: 0.85rem; margin: 10px 0 0; }
  .bottom { display: flex; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
  .grow { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin: 10px 0; }
  .grow label { display: grid; gap: 4px; font-size: 0.85rem; color: var(--ink-soft); }
  .grow input { font: inherit; color: var(--ink); padding: 8px; border: 2px solid var(--line); border-radius: 10px; background: var(--surface-2); min-width: 0; }
  @media (max-width: 480px) { .grow { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  .row { display: flex; gap: 10px; align-items: center; justify-content: space-between; flex-wrap: wrap; }
  .save { margin: 0; font-weight: 600; color: var(--teal); }
  .save.bad { color: #c0392b; }
  .top0 { margin-top: 4px; }
  .small-btn { margin-top: 10px; }
</style>
