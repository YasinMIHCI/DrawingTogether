<script lang="ts">
  import { feed, type Post } from '../social/api';
  import { auth } from '../social/auth.svelte';
  import { router } from '../lib/router.svelte';
  import { t } from '../lib/i18n/t.svelte';
  import RequireAccount from '../ui/social/RequireAccount.svelte';
  import PostCard from '../ui/social/PostCard.svelte';

  /** Une seule publication (lien depuis une notification). */
  let post = $state<Post | null | undefined>(undefined);
  $effect(() => {
    const id = router.param;
    if (auth.userId && id) feed({ ids: [id], limit: 1 }).then((l) => (post = l[0] ?? null)).catch(() => (post = null));
  });
</script>

<main class="soc">
  <RequireAccount>
    {#if post === null}<p class="muted">{t('post.notFound')}</p>
    {:else if post}<PostCard {post} ondelete={() => history.back()} />{/if}
  </RequireAccount>
</main>
