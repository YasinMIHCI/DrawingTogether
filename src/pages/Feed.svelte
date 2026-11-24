<script lang="ts">
  import { feed, friendState, type Post } from '../social/api';
  import { auth } from '../social/auth.svelte';
  import { t } from '../lib/i18n/t.svelte';
  import RequireAccount from '../ui/social/RequireAccount.svelte';
  import PostCard from '../ui/social/PostCard.svelte';
  import ShareDialog from '../ui/social/ShareDialog.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import { themeName, themeOf, weekKey } from '../social/challenges';
  import { settings } from '../lib/settings.svelte';
  const theme = themeOf(weekKey());

  const PAGE = 20;
  let posts = $state<Post[] | null>(null);
  let more = $state(false);
  let error = $state<string | null>(null);
  let sharing = $state(false);

  // Le fil : mes publications et celles de mes amis (les salons ont leurs propres pages)
  let owners: string[] = [];
  async function refresh() {
    try {
      owners = [auth.userId!, ...(await friendState()).friends.map((f) => f.id)];
      const list = await feed({ limit: PAGE, owners });
      posts = list;
      more = list.length === PAGE;
    } catch {
      error = t('acc.err.setupMissing');
    }
  }
  async function loadMore() {
    const list = await feed({ limit: PAGE, owners, before: posts?.at(-1)?.created_at });
    posts = [...(posts ?? []), ...list];
    more = list.length === PAGE;
  }
  $effect(() => {
    if (auth.userId) refresh();
  });
</script>

<main class="soc">
  <h1 class="band">{t('feed.title')}</h1>
  <a class="challenge" href="#/c/defis">🏆 {t('ch.feedBanner', { theme: `${theme.icon} ${themeName(theme, settings.locale)}` })} <span>→ {t('ch.participate')}</span></a>
  <RequireAccount>
    {#if error}<p class="error">{error}</p>{/if}
    {#if posts && !posts.length}<EmptyState text={t('feed.empty')} />{/if}
    <div class="list">
      {#each posts ?? [] as p (p.id)}
        <PostCard post={p} ondelete={refresh} />
      {/each}
    </div>
    {#if more}<button class="btn" style="justify-self: center" onclick={loadMore}>{t('feed.more')}</button>{/if}
  </RequireAccount>
</main>

{#if auth.userId}
  <button class="publish" onclick={() => (sharing = true)}>
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M4 5h16v10H10l-4 4v-4H4z" fill="var(--green-bright)" /></svg>
    {t('feed.publish')}
  </button>
{/if}

{#if sharing}<ShareDialog onclose={() => (sharing = false)} ondone={refresh} />{/if}

<style>
  .challenge { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; padding: 10px 14px; border-radius: 14px; background: #fff4cc; color: #6b4a00; font-weight: 700; text-decoration: none; border: 1px solid #f2d27a; }
  .challenge span { font-weight: 800; }
  .list { display: grid; grid-template-columns: minmax(0, 1fr); gap: 18px; padding-bottom: 80px; }
  .publish {
    position: fixed; right: 0; bottom: max(16px, env(safe-area-inset-bottom)); z-index: 30;
    display: inline-flex; align-items: center; gap: 10px; font: inherit; font-weight: 800; font-size: 1.1rem;
    padding: 16px 28px 16px 22px; border: 1px solid var(--line); border-right: 0; border-radius: 30px 0 0 30px;
    background: var(--surface); color: var(--ink); box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18); cursor: pointer;
  }
  .publish:hover { background: var(--surface-2); }
</style>
