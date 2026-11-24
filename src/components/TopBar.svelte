<script lang="ts">
  import { href } from '../lib/router.svelte';
  import { settings } from '../lib/settings.svelte';
  import { LOCALES } from '../lib/i18n/i18n.svelte';
  import { t } from '../lib/i18n/t.svelte';
  import { auth } from '../social/auth.svelte';
  import { social } from '../social/store.svelte';
  import Avatar from './Avatar.svelte';
</script>

<header>
  <a class="brand" href={href('home')}>
    <img src="./favicon.svg" alt="" width="32" height="32" />
    <span>{t('app.name')}</span>
  </a>
  <nav>
    {#if auth.userId}
      <a class="icon" href={href('feed')} aria-label={t('nav.feed')} title={t('nav.feed')}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M4 4h16v16H4zM4 15l5-5 4 4 2-2 5 5"/></svg>
      </a>
      <a class="icon" href={href('friends')} aria-label={t('nav.friends')} title={t('nav.friends')}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-4 3-6 7-6s7 2 7 6M16 3.5a4 4 0 0 1 0 7.5M18 15c2.5.6 4 2.6 4 6"/></svg>
        {#if social.requests}<span class="dot">{social.requests}</span>{/if}
      </a>
      <a class="icon" href={href('messages')} aria-label={t('nav.messages')} title={t('nav.messages')}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" d="M4 5h16v11H9l-5 4z"/></svg>
        {#if social.unread}<span class="dot">{social.unread > 99 ? '99+' : social.unread}</span>{/if}
      </a>
    {/if}
    <a class="account" href={href('account')} aria-label={auth.userId ? t('nav.account') : t('nav.signin')} title={auth.userId ? t('nav.account') : t('nav.signin')}>
      {#if auth.profile}<Avatar id={settings.avatar} url={auth.profile.avatar_url} size={36} />{:else}<span class="signin">{t('nav.signin')}</span>{/if}
    </a>
    <select aria-label={t('settings.language')} bind:value={settings.locale}>
      {#each LOCALES as l (l.id)}<option value={l.id}>{l.id.toUpperCase()}</option>{/each}
    </select>
    <a class="icon" href={href('settings')} aria-label={t('nav.settings')} title={t('nav.settings')}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M19.4 13a7.5 7.5 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.3 7.3 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.3 7.3 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.5 7.5 0 0 0 0 2l-2 1.6 2 3.4 2.4-1c.5.4 1.1.7 1.7 1l.4 2.5h4l.4-2.5c.6-.3 1.2-.6 1.7-1l2.4 1 2-3.4zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" transform="translate(-1 0)"/></svg>
    </a>
  </nav>
</header>

<style>
  header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; padding-top: max(12px, env(safe-area-inset-top)); }
  .brand { display: flex; align-items: center; gap: 10px; text-decoration: none; font-weight: 800; font-size: 1.15rem; }
  nav { display: flex; align-items: center; gap: 8px; }
  select { padding: 6px 8px; border: 2px solid var(--line); border-radius: 10px; background: var(--surface); }
  .icon { position: relative; }
  .dot { position: absolute; top: -6px; right: -6px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: var(--accent); color: var(--accent-ink); font-size: 0.7rem; font-weight: 700; display: grid; place-items: center; }
  .account { display: grid; place-items: center; text-decoration: none; border-radius: 50%; }
  .signin { font-weight: 700; font-size: 0.9rem; padding: 8px 12px; border: 2px solid var(--line); border-radius: 12px; background: var(--surface); white-space: nowrap; }
  @media (max-width: 480px) { .brand span { display: none; } nav { gap: 6px; } }
  .icon { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 12px; border: 2px solid var(--line); background: var(--surface); }
</style>
