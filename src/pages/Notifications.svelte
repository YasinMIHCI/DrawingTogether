<script lang="ts">
  import { onMount } from 'svelte';
  import { clearNotifications, listNotifications, markNotificationsRead, type Notification } from '../social/api';
  import { auth } from '../social/auth.svelte';
  import { social, viewing } from '../social/store.svelte';
  import { settings } from '../lib/settings.svelte';
  import { relativeTime } from '../lib/time';
  import { t } from '../lib/i18n/t.svelte';
  import type { Key } from '../lib/i18n/i18n.svelte';
  import Avatar from '../components/Avatar.svelte';
  import RequireAccount from '../ui/social/RequireAccount.svelte';
  import EmptyState from '../components/EmptyState.svelte';

  let list = $state<Notification[] | null>(null);
  let error = $state<string | null>(null);

  async function load() {
    try {
      list = await listNotifications();
      error = null;
      if (list.some((n) => !n.read)) await markNotificationsRead();
      social.notifications = 0;
    } catch {
      error = t('notif.setup');
    }
  }
  $effect(() => {
    if (auth.userId) load();
  });
  onMount(() => {
    viewing.notifications = true;
    // Recharge quand une notification arrive pendant qu'on regarde la page
    let seen = social.notifications;
    const timer = setInterval(() => {
      if (social.notifications !== seen) (seen = social.notifications), load();
    }, 1500);
    return () => {
      viewing.notifications = false;
      clearInterval(timer);
    };
  });

  const link = (n: Notification) =>
    n.kind === 'like' || n.kind === 'comment' ? `#/post/${n.post_id}`
    : n.kind === 'group_add' ? `#/messages/${n.conversation_id}`
    : n.kind === 'friend_request' ? '#/friends'
    : `#/u/${n.actor?.username ?? ''}`;
  const ICON: Record<Notification['kind'], string> = { friend_request: '👋', friend_accept: '🤝', like: '😊', comment: '💬', group_add: '👥' };
</script>

<main class="soc">
  <h1 class="band">{t('notif.title')}
    {#if list?.length}<button class="clear" onclick={async () => { await clearNotifications(); list = []; }}>{t('notif.clear')}</button>{/if}
  </h1>
  <RequireAccount>
    {#if error}<p class="error">{error}</p>{/if}
    {#if list && !list.length}<EmptyState text={t('notif.empty')} expr="happy" seed={3} />{/if}
    {#if list?.length}
      <ul class="panel items">
        {#each list as n (n.id)}
          <li class:unread={!n.read}>
            <a href={link(n)}>
              <span class="avatar-frame"><Avatar id={0} url={n.actor?.avatar_url ?? null} size={44} /></span>
              <span class="txt">
                <span>{ICON[n.kind]} {t(`notif.${n.kind}` as Key, { name: n.actor?.display_name || n.actor?.username || '?' })}</span>
                <time datetime={n.created_at}>{relativeTime(n.created_at, settings.locale)}</time>
              </span>
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  </RequireAccount>
</main>

<style>
  .clear { font: inherit; font-size: 0.85rem; font-weight: 700; padding: 4px 12px; border-radius: 10px; border: 0; background: rgba(255, 255, 255, 0.25); color: #fff; cursor: pointer; }
  .items { list-style: none; margin: 0; padding: 0; overflow: hidden; }
  li + li { border-top: 1px solid var(--line); }
  li a { display: flex; gap: 12px; align-items: center; padding: 10px 14px; text-decoration: none; }
  li a:hover { background: var(--surface-2); }
  li.unread { background: var(--green-soft); }
  .txt { display: grid; gap: 2px; min-width: 0; }
  time { font-size: 0.8rem; color: var(--ink-soft); }
</style>
