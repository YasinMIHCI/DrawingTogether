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
  <div class="row" style="justify-content: space-between">
    <div><h1>{t('feed.title')}</h1><p class="muted">{t('feed.intro')}</p></div>
    {#if auth.userId}<button class="btn primary" onclick={() => (sharing = true)}>＋ {t('feed.share')}</button>{/if}
  </div>
  <RequireAccount>
    {#if error}<p class="error">{error}</p>{/if}
    {#if posts && !posts.length}<p class="muted">{t('feed.empty')}</p>{/if}
    {#each posts ?? [] as p (p.id)}
      <PostCard post={p} ondelete={refresh} />
    {/each}
  </RequireAccount>
</main>

{#if sharing}<ShareDialog onclose={() => (sharing = false)} ondone={refresh} />{/if}
