<script lang="ts">
  import { href, router, type Route } from '../lib/router.svelte';
  import { settings } from '../lib/settings.svelte';
  import { t } from '../lib/i18n/t.svelte';
  import type { Key } from '../lib/i18n/i18n.svelte';
  import { auth } from '../social/auth.svelte';
  import { social } from '../social/store.svelte';
  import Avatar from './Avatar.svelte';
  import { parseBouille } from '../bouille/model';
  import { renderBouille } from '../bouille/render';

  const url = $derived(auth.profile?.avatar_url ?? settings.avatarUrl);
  const mine = $derived(!url && settings.bouille ? parseBouille(settings.bouille) : null);

  /** Barre de navigation à gauche (ordinateur, tablette et téléphone). */
  const items: { route: Route; label: Key; icon: string; badge?: () => number; also?: Route[] }[] = [
    { route: 'home', label: 'nav.home', icon: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z', also: ['draw', 'shared', 'games'] },
    { route: 'feed', label: 'nav.feed', icon: 'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM8.5 10.5a1 1 0 1 0 0-.01M15.5 10.5a1 1 0 1 0 0-.01M8 14.5c2 2 6 2 8 0' },
    { route: 'friends', label: 'nav.friends', icon: 'M8.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2 20c0-3.5 3-5.5 6.5-5.5S15 16.5 15 20M16 4.5a3.2 3.2 0 0 1 0 6.3M17.5 14.6c2.6.5 4.5 2.4 4.5 5.4', badge: () => social.requests, also: ['u'] },
    { route: 'messages', label: 'nav.messages', icon: 'M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3.5 6.5 12 13l8.5-6.5', badge: () => social.unread },
    { route: 'gallery', label: 'nav.gallery', icon: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z' },
    { route: 'settings', label: 'nav.settings', icon: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 13a7.5 7.5 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.5 7.5 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.4z', also: ['pen-test'] },
  ];
  const active = (i: (typeof items)[number]) => router.route === i.route || !!i.also?.includes(router.route);

  function back() {
    if (history.length > 1) history.back();
    else location.hash = href('home');
  }
</script>

<nav class="side" aria-label={t('nav.menu')}>
  <a class="item me" class:on={router.route === 'account'} href={href('account')} aria-current={router.route === 'account' ? 'page' : undefined}>
    <span class="avatar-frame">{#if mine}<span class="bq">{@html renderBouille(mine, { view: 'head' })}</span>{:else}<Avatar id={settings.avatar} {url} size={40} />{/if}</span>
    <span class="label">{auth.profile ? t('nav.profile') : t('nav.signin')}</span>
  </a>
  <div class="list">
    {#each items as i (i.route)}
      {@const n = i.badge?.() ?? 0}
      <a class="item" class:on={active(i)} href={href(i.route)} aria-current={active(i) ? 'page' : undefined}>
        <span class="ico">
          <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path d={i.icon} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
          {#if n}<span class="dot">{n > 99 ? '99+' : n}</span>{/if}
        </span>
        <span class="label">{t(i.label)}</span>
      </a>
    {/each}
  </div>
  <button class="item back" onclick={back} disabled={router.route === 'home'}>
    <span class="ico"><svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg></span>
    <span class="label">{t('nav.back')}</span>
  </button>
</nav>

<style>
  .side {
    position: fixed; left: 0; top: 0; bottom: 0; width: var(--side-w);
    display: flex; flex-direction: column;
    background: var(--surface); border-radius: 0 26px 26px 0;
    box-shadow: 2px 0 0 var(--line), 4px 0 18px rgba(0, 0, 0, 0.08);
    padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom);
    overflow: hidden auto; scrollbar-width: none;
  }
  .list { flex: 1; display: flex; flex-direction: column; }
  .item {
    position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
    min-height: 84px; padding: 8px 4px; text-decoration: none; color: var(--ink-soft);
    border: 0; border-bottom: 1px solid var(--line); background: none; font: inherit; cursor: pointer; text-align: center;
  }
  .item:hover { background: var(--surface-2); }
  .item.on { color: var(--accent); background: var(--green-soft); }
  .item.on::before { content: ''; position: absolute; left: 0; top: 14px; bottom: 14px; width: 4px; border-radius: 0 4px 4px 0; background: var(--green-bright); }
  .bq { display: block; width: 40px; height: 40px; background: #f4efe2; border-radius: 11px; }
  .bq :global(svg) { width: 100%; height: 100%; }
  .ico { position: relative; display: grid; place-items: center; }
  .label { font-size: 0.74rem; font-weight: 700; line-height: 1.15; }
  .me { min-height: 96px; }
  .dot { position: absolute; top: -6px; right: -12px; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 10px; background: #e0352b; color: #fff; font-size: 0.72rem; font-weight: 800; display: grid; place-items: center; box-shadow: 0 0 0 2px var(--surface); }
  .back { border-bottom: 0; background: #4a4f55; color: #fff; min-height: 76px; }
  .back:hover { background: #3c4146; }
  .back:disabled { opacity: 1; color: #9aa0a6; cursor: default; }

  /* Grand écran : libellés à côté des icônes */
  @media (min-width: 1100px) {
    .item { flex-direction: row; justify-content: flex-start; gap: 12px; min-height: 60px; padding: 8px 18px; }
    .label { font-size: 0.95rem; }
    .me { min-height: 76px; }
    .back { min-height: 60px; }
  }
  /* Téléphone : barre plus étroite */
  @media (max-width: 640px) {
    .item { min-height: 64px; padding: 6px 2px; }
    .label { font-size: 0.62rem; }
    .me { min-height: 72px; }
    .ico svg { width: 26px; height: 26px; }
  }
</style>
