<script lang="ts">
  import { onMount } from 'svelte';
  import {
    acceptFriend, friendState, openDirect, relationTo, removeFriend, requestFriend, searchProfiles, type FriendState, type PublicProfile,
  } from '../social/api';
  import { auth } from '../social/auth.svelte';
  import { onFriendsChange } from '../social/store.svelte';
  import { t } from '../lib/i18n/t.svelte';
  import Avatar from '../components/Avatar.svelte';
  import RequireAccount from '../ui/social/RequireAccount.svelte';

  let fs = $state<FriendState>({ friends: [], incoming: [], outgoing: [] });
  let query = $state('');
  let results = $state<PublicProfile[] | null>(null);
  let error = $state<string | null>(null);

  async function refresh() {
    if (!auth.userId) return;
    try {
      fs = await friendState();
      error = null;
    } catch {
      error = t('acc.err.setupMissing');
    }
  }
  onMount(() => onFriendsChange(refresh));
  $effect(() => {
    if (auth.userId) refresh();
  });

  let timer = 0;
  $effect(() => {
    const q = query;
    clearTimeout(timer);
    if (q.trim().length < 2) {
      results = null;
      return;
    }
    timer = window.setTimeout(async () => (results = await searchProfiles(q).catch(() => [])), 250);
  });

  async function act(f: () => Promise<unknown>) {
    try {
      await f();
    } catch {
      error = t('acc.err.network');
    }
    refresh();
  }
  async function message(p: PublicProfile) {
    const id = await openDirect(p.id);
    location.hash = `#/messages/${id}`;
  }
</script>

{#snippet who(p: PublicProfile)}
  <Avatar id={0} url={p.avatar_url} size={40} />
  <a class="who" href="#/u/{p.username}"><b>{p.display_name || p.username}</b><span>@{p.username}</span></a>
{/snippet}

<main class="soc">
  <h1>{t('fr.title')}</h1>
  <RequireAccount>
    {#if error}<p class="error">{error}</p>{/if}
    <section class="card">
      <input type="search" bind:value={query} placeholder={t('fr.search')} aria-label={t('fr.search')} autocapitalize="none" spellcheck="false" />
      {#if results}
        {#if !results.length}<p class="muted">{t('fr.noResult')}</p>{/if}
        <ul class="people">
          {#each results as p (p.id)}
            {@const rel = relationTo(fs, p.id)}
            <li class="person">
              {@render who(p)}
              {#if rel === 'friend'}<span class="muted">{t('fr.isFriend')}</span>
              {:else if rel === 'outgoing'}<span class="muted">{t('fr.sent')}</span>
              {:else if rel === 'incoming'}<button class="btn small primary" onclick={() => act(() => acceptFriend(p.id))}>{t('fr.accept')}</button>
              {:else}<button class="btn small primary" onclick={() => act(() => requestFriend(p.id))}>{t('fr.add')}</button>{/if}
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    {#if fs.incoming.length}
      <section class="card">
        <h2>{t('fr.incoming')} <span class="badge">{fs.incoming.length}</span></h2>
        <ul class="people">
          {#each fs.incoming as p (p.id)}
            <li class="person">
              {@render who(p)}
              <button class="btn small primary" onclick={() => act(() => acceptFriend(p.id))}>{t('fr.accept')}</button>
              <button class="btn small" onclick={() => act(() => removeFriend(p.id))}>{t('fr.decline')}</button>
            </li>
          {/each}
        </ul>
      </section>
    {/if}

    <section class="card">
      <h2>{t('fr.list')}</h2>
      {#if !fs.friends.length}<p class="muted">{t('fr.none')}</p>{/if}
      <ul class="people">
        {#each fs.friends as p (p.id)}
          <li class="person">
            {@render who(p)}
            <button class="btn small" onclick={() => message(p)}>{t('fr.message')}</button>
            <button class="btn small danger" onclick={() => confirm(t('fr.removeConfirm', { name: p.display_name || p.username })) && act(() => removeFriend(p.id))}>{t('fr.remove')}</button>
          </li>
        {/each}
      </ul>
    </section>

    {#if fs.outgoing.length}
      <section class="card">
        <h2>{t('fr.outgoing')}</h2>
        <ul class="people">
          {#each fs.outgoing as p (p.id)}
            <li class="person">
              {@render who(p)}
              <button class="btn small" onclick={() => act(() => removeFriend(p.id))}>{t('fr.cancel')}</button>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  </RequireAccount>
</main>
