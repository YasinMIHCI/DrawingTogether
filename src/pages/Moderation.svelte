<script lang="ts">
  import { deletePost, dismissReports, isModerator, reportedPosts, setHidden, type ReportedPost } from '../social/api';
  import { auth } from '../social/auth.svelte';
  import { t } from '../lib/i18n/t.svelte';
  import RequireAccount from '../ui/social/RequireAccount.svelte';
  import PostCard from '../ui/social/PostCard.svelte';
  import EmptyState from '../components/EmptyState.svelte';

  /** Modération : publications signalées → masquer / rétablir, supprimer, ignorer. */
  let allowed = $state<boolean | null>(null);
  let list = $state<ReportedPost[] | null>(null);
  async function load() {
    allowed = await isModerator();
    if (allowed) list = await reportedPosts();
  }
  $effect(() => {
    if (auth.userId) load();
  });
  async function act(f: () => Promise<void>) {
    await f().catch(() => alert(t('acc.err.network')));
    load();
  }
</script>

<main class="soc">
  <h1 class="band">{t('mod.title')}</h1>
  <RequireAccount>
    {#if allowed === false}<p class="muted">{t('mod.forbidden')}</p>{/if}
    {#if list && !list.length}<EmptyState text={t('mod.empty')} expr="happy" />{/if}
    {#each list ?? [] as r (r.post.id)}
      <section class="panel report">
        <p class="reasons">
          🚩 {t('mod.reasons', { spam: String(r.reasons.spam), offensive: String(r.reasons.offensive), other: String(r.reasons.other) })}
          {#if r.post.hidden}<span class="hidden">{t('mod.hidden')}</span>{/if}
        </p>
        <PostCard post={r.post} compact />
        <div class="row">
          <button class="btn" onclick={() => act(() => setHidden(r.post.id, !r.post.hidden))}>{r.post.hidden ? t('mod.unhide') : t('mod.hide')}</button>
          <button class="btn" onclick={() => act(() => dismissReports(r.post.id))}>{t('mod.dismiss')}</button>
          <button class="btn danger" onclick={() => confirm(t('feed.deleteConfirm')) && act(() => deletePost(r.post))}>{t('feed.delete')}</button>
        </div>
      </section>
    {/each}
  </RequireAccount>
</main>

<style>
  .report { padding: 12px 14px; display: grid; gap: 10px; }
  .reasons { margin: 0; font-weight: 700; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .hidden { font-size: 0.8rem; background: #ffe1dc; color: #8a1f0e; padding: 2px 8px; border-radius: 8px; }
</style>
