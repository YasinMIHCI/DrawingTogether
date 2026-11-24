<script lang="ts">
  import {
    acceptFriend, feed, friendState, likedPosts, openDirect, profileByUsername, profileStats, relationTo, requestFriend,
    type Post, type ProfileStats, type PublicProfile, type Relation,
  } from '../social/api';
  import { auth } from '../social/auth.svelte';
  import { router, href } from '../lib/router.svelte';
  import { t } from '../lib/i18n/t.svelte';
  import Avatar from '../components/Avatar.svelte';
  import RequireAccount from '../ui/social/RequireAccount.svelte';
  import PostCard from '../ui/social/PostCard.svelte';

  /** Page profil : en-tête (avatar, nom, bio, compteurs) et onglets Publications / Ouais !. */
  let profile = $state<PublicProfile | null | undefined>(undefined);
  let relation = $state<Relation>('none');
  let stats = $state<ProfileStats | null>(null);
  let tab = $state<'posts' | 'likes'>('posts');
  let posts = $state<Post[] | null>(null);
  let likes = $state<Post[] | null>(null);

  const visible = $derived(relation === 'self' || relation === 'friend');

  async function load() {
    profile = await profileByUsername(router.param).catch(() => null);
    if (!profile) return;
    relation = profile.id === auth.userId ? 'self' : relationTo(await friendState(), profile.id);
    stats = await profileStats(profile.id);
    posts = likes = null;
    await showTab(tab);
  }
  async function showTab(which: 'posts' | 'likes') {
    tab = which;
    if (!profile || !visible) return;
    if (which === 'posts' && !posts) posts = await feed({ owner: profile.id });
    if (which === 'likes' && !likes) likes = await likedPosts(profile.id);
  }
  $effect(() => {
    void router.param;
    if (auth.userId) load();
  });
  async function message() {
    location.hash = `#/messages/${await openDirect(profile!.id)}`;
  }
  const list = $derived(tab === 'posts' ? posts : likes);
</script>

<main class="soc">
  <RequireAccount>
    {#if profile === null}<p class="muted">{t('prof.notFound')}</p>
    {:else if profile}
      <section class="head panel">
        <div class="top">
          <span class="avatar-frame big"><Avatar id={0} url={profile.avatar_url} size={96} /></span>
          <div class="id">
            <h1>{profile.display_name || profile.username}</h1>
            <p class="muted">@{profile.username}</p>
            {#if profile.bio}<p class="bio">{profile.bio}</p>{/if}
          </div>
        </div>
        <div class="row actions">
          {#if relation === 'self'}
            <a class="btn" href="#/bouille">{t('prof.editBouille')}</a>
            <a class="btn" href={href('account')}>{t('prof.editProfile')}</a>
          {:else if relation === 'friend'}<button class="btn primary" onclick={message}>{t('fr.message')}</button>
          {:else if relation === 'outgoing'}<span class="muted">{t('fr.sent')}</span>
          {:else if relation === 'incoming'}<button class="btn primary" onclick={async () => { await acceptFriend(profile!.id); load(); }}>{t('fr.accept')}</button>
          {:else}<button class="btn primary" onclick={async () => { await requestFriend(profile!.id); load(); }}>{t('fr.add')}</button>{/if}
        </div>
        {#if stats}
          <dl class="stats">
            <div><dt>{t('prof.friends')}</dt><dd>{stats.friends}</dd></div>
            <div><dt>{t('prof.postsCount')}</dt><dd>{stats.posts}</dd></div>
            <div><dt>{t('prof.likes')}</dt><dd>{stats.likes_given}</dd></div>
          </dl>
        {/if}
      </section>

      {#if !visible}
        <p class="muted">{t('prof.private')}</p>
      {:else}
        <div class="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'posts'} onclick={() => showTab('posts')}>
            {t('prof.posts')} {#if stats}<span class="n">{stats.posts}</span>{/if}
          </button>
          <button role="tab" aria-selected={tab === 'likes'} onclick={() => showTab('likes')}>
            {t('prof.likes')} {#if stats}<span class="n">{stats.likes_given}</span>{/if}
          </button>
        </div>
        {#if list && !list.length}<p class="muted">{tab === 'posts' ? t('prof.postsEmpty') : t('prof.likesEmpty')}</p>{/if}
        <div class="list">
          {#each list ?? [] as p (p.id)}<PostCard post={p} ondelete={load} />{/each}
        </div>
      {/if}
    {/if}
  </RequireAccount>
</main>

<style>
  .head { padding: 16px; display: grid; gap: 12px; }
  .top { display: flex; gap: 16px; align-items: center; }
  .big { padding: 4px; border-radius: 18px; }
  .id { min-width: 0; }
  h1 { font-size: 1.4rem; overflow-wrap: anywhere; }
  .bio { margin: 6px 0 0; white-space: pre-wrap; }
  .actions a { text-decoration: none; }
  .stats { display: grid; grid-template-columns: repeat(3, 1fr); margin: 0 -16px -16px; border-top: 1px solid var(--line); }
  .stats div { padding: 10px 16px; }
  .stats div + div { border-left: 1px solid var(--line); }
  dt { font-size: 0.8rem; color: var(--ink-soft); }
  dd { margin: 0; font-weight: 800; font-size: 1.15rem; }
  .tabs { display: grid; grid-template-columns: 1fr 1fr; border-radius: 12px; overflow: hidden; border: 1px solid var(--line); box-shadow: var(--shadow); }
  .tabs button { display: flex; align-items: center; justify-content: space-between; gap: 8px; font: inherit; font-weight: 800; padding: 10px 14px; border: 0; background: var(--surface); color: var(--ink); cursor: pointer; }
  .tabs [aria-selected='true'] { background: linear-gradient(var(--green-bright), var(--accent)); color: #fff; }
  .n { min-width: 34px; padding: 1px 8px; border-radius: 8px; background: rgba(0, 0, 0, 0.18); color: #fff; font-size: 0.8rem; text-align: center; }
  .tabs [aria-selected='false'] .n { background: #8f959b; }
  .list { display: grid; grid-template-columns: minmax(0, 1fr); gap: 18px; }
</style>
