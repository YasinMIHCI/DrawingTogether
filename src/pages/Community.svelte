<script lang="ts">
  import { feed, listCommunities, setFavorite, type Community, type Post } from '../social/api';
  import { auth } from '../social/auth.svelte';
  import { router } from '../lib/router.svelte';
  import { settings } from '../lib/settings.svelte';
  import { t } from '../lib/i18n/t.svelte';
  import RequireAccount from '../ui/social/RequireAccount.svelte';
  import CommunityIcon from '../ui/social/CommunityIcon.svelte';
  import PostCard from '../ui/social/PostCard.svelte';
  import ShareDialog from '../ui/social/ShareDialog.svelte';
  import EmptyState from '../components/EmptyState.svelte';

  /** Un salon : ses publications (visibles par tous les comptes) et le bouton Publier. */
  const PAGE = 20;
  let c = $state<Community | null | undefined>(undefined);
  let posts = $state<Post[] | null>(null);
  let more = $state(false);
  let sharing = $state(false);

  async function load() {
    const list = await listCommunities();
    c = list?.find((x) => x.id === router.param) ?? null;
    if (!c) return;
    const l = await feed({ community: c.id, limit: PAGE });
    posts = l;
    more = l.length === PAGE;
  }
  async function loadMore() {
    const l = await feed({ community: c!.id, limit: PAGE, before: posts?.at(-1)?.created_at });
    posts = [...(posts ?? []), ...l];
    more = l.length === PAGE;
  }
  $effect(() => {
    void router.param;
    if (auth.userId) load();
  });
  async function toggleFav() {
    if (!c) return;
    const on = !c.favorite;
    c.favorite = on;
    await setFavorite(c.id, on).catch(() => c && (c.favorite = !on));
  }
  const name = $derived(c ? (settings.locale === 'fr' ? c.name_fr : c.name_en) : '');
  const desc = $derived(c ? (settings.locale === 'fr' ? c.desc_fr : c.desc_en) : '');
</script>

<main class="soc">
  <RequireAccount>
    {#if c === null}<p class="muted">{t('com.notFound')}</p>
    {:else if c}
      <header class="head panel">
        <CommunityIcon icon={c.icon} color={c.color} size={80} />
        <div class="txt">
          <h1>{name}</h1>
          <p class="muted">{desc}</p>
          <p class="note">{t('com.public')}</p>
        </div>
        <button class="fav" class:on={c.favorite} aria-pressed={c.favorite} onclick={toggleFav}>★ {c.favorite ? t('com.unfavorite') : t('com.favorite')}</button>
      </header>
      {#if posts && !posts.length}<EmptyState text={t('com.empty')} expr="happy" seed={13} />{/if}
      <div class="list">
        {#each posts ?? [] as p (p.id)}<PostCard post={p} ondelete={load} />{/each}
      </div>
      {#if more}<button class="btn" style="justify-self: center" onclick={loadMore}>{t('feed.more')}</button>{/if}
    {/if}
  </RequireAccount>
</main>

{#if auth.userId && c}
  <button class="publish" onclick={() => (sharing = true)}>
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M4 5h16v10H10l-4 4v-4H4z" fill="var(--green-bright)" /></svg>
    {t('feed.publish')}
  </button>
{/if}
{#if sharing && c}<ShareDialog community={c.id} onclose={() => (sharing = false)} ondone={load} />{/if}

<style>
  .head { display: flex; gap: 16px; align-items: center; padding: 14px 16px; flex-wrap: wrap; }
  .txt { flex: 1; min-width: 180px; display: grid; gap: 2px; }
  h1 { font-size: 1.4rem; }
  .note { margin: 0; font-size: 0.8rem; color: var(--ink-soft); }
  .fav { font: inherit; font-weight: 800; padding: 8px 14px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface); color: var(--ink-soft); cursor: pointer; }
  .fav.on { background: #fff4cc; color: #9a6a00; border-color: #f2c94c; }
  .list { display: grid; gap: 18px; padding-bottom: 80px; }
  .publish {
    position: fixed; right: 0; bottom: max(16px, env(safe-area-inset-bottom)); z-index: 30;
    display: inline-flex; align-items: center; gap: 10px; font: inherit; font-weight: 800; font-size: 1.1rem;
    padding: 16px 28px 16px 22px; border: 1px solid var(--line); border-right: 0; border-radius: 30px 0 0 30px;
    background: var(--surface); color: var(--ink); box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18); cursor: pointer;
  }
</style>
