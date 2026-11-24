<script lang="ts">
  import { feed, type Post } from '../social/api';
  import { auth } from '../social/auth.svelte';
  import { t } from '../lib/i18n/t.svelte';
  import RequireAccount from '../ui/social/RequireAccount.svelte';
  import PostCard from '../ui/social/PostCard.svelte';
  import ShareDialog from '../ui/social/ShareDialog.svelte';

  const PAGE = 20;
  let posts = $state<Post[] | null>(null);
  let more = $state(false);
  let error = $state<string | null>(null);
  let sharing = $state(false);

  async function refresh() {
    try {
      const list = await feed({ limit: PAGE });
      posts = list;
      more = list.length === PAGE;
    } catch {
      error = t('acc.err.setupMissing');
    }
  }
  async function loadMore() {
    const list = await feed({ limit: PAGE, before: posts?.at(-1)?.created_at });
    posts = [...(posts ?? []), ...list];
    more = list.length === PAGE;
  }
  $effect(() => {
    if (auth.userId) refresh();
  });
</script>

<main class="soc">
  <h1 class="band">{t('feed.title')}</h1>
  <RequireAccount>
    {#if error}<p class="error">{error}</p>{/if}
    {#if posts && !posts.length}<p class="muted">{t('feed.empty')}</p>{/if}
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
  .list { display: grid; gap: 18px; padding-bottom: 80px; }
  .publish {
    position: fixed; right: 0; bottom: max(16px, env(safe-area-inset-bottom)); z-index: 30;
    display: inline-flex; align-items: center; gap: 10px; font: inherit; font-weight: 800; font-size: 1.1rem;
    padding: 16px 28px 16px 22px; border: 1px solid var(--line); border-right: 0; border-radius: 30px 0 0 30px;
    background: var(--surface); color: var(--ink); box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18); cursor: pointer;
  }
  .publish:hover { background: var(--surface-2); }
</style>
