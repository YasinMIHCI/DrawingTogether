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
  import { daysLeft, recentWeeks, themeName, themeOf, weekKey } from '../social/challenges';

  /** Un salon : ses publications (visibles par tous les comptes) et le bouton Publier. */
  const PAGE = 20;
  let c = $state<Community | null | undefined>(undefined);
  let posts = $state<Post[] | null>(null);
  let more = $state(false);
  let sharing = $state(false);
  // Salon « Défis » : semaine affichée (null = toutes les publications)
  const weeks = recentWeeks(6);
  const isChallenge = $derived(router.param === 'defis');
  let week = $state<string | null>(weekKey());
  const filter = () => (isChallenge && week ? { challenge: week } : {});

  async function load() {
    const list = await listCommunities();
    c = list?.find((x) => x.id === router.param) ?? null;
    if (!c) return;
    let l: Post[];
    try {
      l = await feed({ community: c.id, limit: PAGE, ...filter() });
    } catch {
      // Défis pas encore installés côté serveur (social-5.sql) : toutes les publications du salon
      week = null;
      l = await feed({ community: c.id, limit: PAGE });
    }
    posts = l;
    more = l.length === PAGE;
  }
  async function loadMore() {
    const l = await feed({ community: c!.id, limit: PAGE, before: posts?.at(-1)?.created_at, ...filter() });
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
      {#if isChallenge}
        {@const th = themeOf(weeks[0])}
        <section class="challenge panel">
          <span class="big" aria-hidden="true">{th.icon}</span>
          <div class="ctxt">
            <span class="kicker">🏆 {t('ch.thisWeek')}</span>
            <b>{themeName(th, settings.locale)}</b>
            <span class="muted">{t('ch.left', { n: String(daysLeft()) })}</span>
          </div>
          <button class="btn primary" onclick={() => (sharing = true)}>{t('ch.participate')}</button>
        </section>
        <div class="weeks" role="tablist" aria-label={t('ch.past')}>
          {#each weeks as w, i (w)}
            {@const wt = themeOf(w)}
            <button role="tab" aria-selected={week === w} onclick={() => { week = w; load(); }}>{wt.icon} {i === 0 ? t('ch.thisWeek') : themeName(wt, settings.locale)}</button>
          {/each}
          <button role="tab" aria-selected={week === null} onclick={() => { week = null; load(); }}>{t('ch.all')}</button>
        </div>
      {/if}
      {#if posts && !posts.length}<EmptyState text={isChallenge && week ? t('ch.empty') : t('com.empty')} expr="happy" seed={13} />{/if}
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
{#if sharing && c}<ShareDialog community={c.id} challenge={isChallenge ? weeks[0] : null} onclose={() => (sharing = false)} ondone={() => { week = isChallenge ? weeks[0] : null; load(); }} />{/if}

<style>
  .head { display: flex; gap: 16px; align-items: center; padding: 14px 16px; flex-wrap: wrap; }
  .txt { flex: 1; min-width: 180px; display: grid; gap: 2px; }
  h1 { font-size: 1.4rem; }
  .note { margin: 0; font-size: 0.8rem; color: var(--ink-soft); }
  .fav { font: inherit; font-weight: 800; padding: 8px 14px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface); color: var(--ink-soft); cursor: pointer; }
  .fav.on { background: #fff4cc; color: #9a6a00; border-color: #f2c94c; }
  .challenge { display: flex; align-items: center; gap: 14px; padding: 14px 16px; flex-wrap: wrap; background: linear-gradient(120deg, #fff4cc, var(--surface) 70%); }
  .big { font-size: 2.6rem; }
  .ctxt { flex: 1; min-width: 160px; display: grid; }
  .ctxt b { font-size: 1.3rem; }
  .kicker { font-size: 0.8rem; font-weight: 800; color: #6b4a00; }
  .challenge { color: #3a2d00; }
  .challenge .muted { color: #6b5a2a; }
  .weeks { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; }
  .weeks button { flex: none; font: inherit; font-size: 0.85rem; font-weight: 700; padding: 6px 12px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); cursor: pointer; }
  .weeks [aria-selected='true'] { background: var(--green-soft); color: var(--accent-text); border-color: var(--green-bright); }
  .list { display: grid; grid-template-columns: minmax(0, 1fr); gap: 18px; padding-bottom: 80px; }
  .publish {
    position: fixed; right: 0; bottom: max(16px, env(safe-area-inset-bottom)); z-index: 30;
    display: inline-flex; align-items: center; gap: 10px; font: inherit; font-weight: 800; font-size: 1.1rem;
    padding: 16px 28px 16px 22px; border: 1px solid var(--line); border-right: 0; border-radius: 30px 0 0 30px;
    background: var(--surface); color: var(--ink); box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18); cursor: pointer;
  }
</style>
