<script lang="ts">
  import { feed, friendState, openDirect, profileByUsername, relationTo, requestFriend, acceptFriend, type Post, type PublicProfile, type Relation } from '../social/api';
  import { auth } from '../social/auth.svelte';
  import { router, href } from '../lib/router.svelte';
  import { t } from '../lib/i18n/t.svelte';
  import Avatar from '../components/Avatar.svelte';
  import RequireAccount from '../ui/social/RequireAccount.svelte';
  import PostCard from '../ui/social/PostCard.svelte';

  let profile = $state<PublicProfile | null | undefined>(undefined);
  let relation = $state<Relation>('none');
  let posts = $state<Post[]>([]);

  async function load() {
    profile = await profileByUsername(router.param).catch(() => null);
    if (!profile) return;
    relation = profile.id === auth.userId ? 'self' : relationTo(await friendState(), profile.id);
    posts = relation === 'self' || relation === 'friend' ? await feed({ owner: profile.id }) : [];
  }
  $effect(() => {
    void router.param;
    if (auth.userId) load();
  });
  async function message() {
    location.hash = `#/messages/${await openDirect(profile!.id)}`;
  }
</script>

<main class="soc">
  <RequireAccount>
    {#if profile === null}<p class="muted">{t('prof.notFound')}</p>
    {:else if profile}
      <section class="card head">
        <Avatar id={0} url={profile.avatar_url} size={96} />
        <div>
          <h1>{profile.display_name || profile.username}</h1>
          <p class="muted">@{profile.username}</p>
          {#if profile.bio}<p class="bio">{profile.bio}</p>{/if}
          <div class="row">
            {#if relation === 'self'}<a class="btn" href={href('account')}>{t('nav.account')}</a>
            {:else if relation === 'friend'}<button class="btn primary" onclick={message}>{t('fr.message')}</button>
            {:else if relation === 'outgoing'}<span class="muted">{t('fr.sent')}</span>
            {:else if relation === 'incoming'}<button class="btn primary" onclick={async () => { await acceptFriend(profile!.id); load(); }}>{t('fr.accept')}</button>
            {:else}<button class="btn primary" onclick={async () => { await requestFriend(profile!.id); load(); }}>{t('fr.add')}</button>{/if}
          </div>
        </div>
      </section>
      <h2>{t('prof.posts')}</h2>
      {#if relation !== 'self' && relation !== 'friend'}<p class="muted">{t('prof.private')}</p>{/if}
      {#each posts as p (p.id)}<PostCard post={p} ondelete={load} />{/each}
    {/if}
  </RequireAccount>
</main>

<style>
  .head { grid-template-columns: auto 1fr; align-items: center; gap: 16px; }
  .bio { margin: 6px 0; white-space: pre-wrap; }
</style>
