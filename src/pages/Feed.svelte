<script lang="ts">
  import { feed, type Post } from '../social/api';
  import { auth } from '../social/auth.svelte';
  import { t } from '../lib/i18n/t.svelte';
  import RequireAccount from '../ui/social/RequireAccount.svelte';
  import PostCard from '../ui/social/PostCard.svelte';
  import ShareDialog from '../ui/social/ShareDialog.svelte';

  let posts = $state<Post[] | null>(null);
  let error = $state<string | null>(null);
  let sharing = $state(false);

  async function refresh() {
    try {
      posts = await feed();
    } catch {
      error = t('acc.err.setupMissing');
    }
  }
  $effect(() => {
    if (auth.userId) refresh();
  });
</script>

<main class="soc">
  <h1 class="band">{t('feed.title')}</h1>
  <p class="muted">{t('feed.intro')}</p>
  <RequireAccount>
    {#if error}<p class="error">{error}</p>{/if}
    {#if posts && !posts.length}<p class="muted">{t('feed.empty')}</p>{/if}
    {#each posts ?? [] as p (p.id)}
      <PostCard post={p} ondelete={refresh} />
    {/each}
  </RequireAccount>
</main>

{#if auth.userId}<button class="publish" onclick={() => (sharing = true)}>✎ {t('feed.publish')}</button>{/if}

<style>
  .publish { position: fixed; right: 16px; bottom: max(16px, env(safe-area-inset-bottom)); z-index: 30; font: inherit; font-weight: 800; font-size: 1.05rem; padding: 14px 26px; border: 0; border-radius: 30px 30px 30px 30px; background: var(--surface); color: var(--ink); box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2); cursor: pointer; }
  .publish::first-letter { color: var(--green-bright); }
</style>

{#if sharing}<ShareDialog onclose={() => (sharing = false)} ondone={refresh} />{/if}
