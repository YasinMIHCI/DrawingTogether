<script lang="ts">
  import { onMount, tick } from 'svelte';
  import {
    addGroupMembers, conversationInfo, createGroup, feed, friendState, listMessages, markRead, myConversations, profilesByIds,
    removeMember, renameGroup, sendMessage, type ConversationSummary, type Member, type Message, type Post, type PublicProfile,
  } from '../social/api';
  import { auth } from '../social/auth.svelte';
  import { onNewMessage, refreshCounts, viewing } from '../social/store.svelte';
  import { router, href } from '../lib/router.svelte';
  import { settings } from '../lib/settings.svelte';
  import { t } from '../lib/i18n/t.svelte';
  import Avatar from '../components/Avatar.svelte';
  import RequireAccount from '../ui/social/RequireAccount.svelte';
  import PostCard from '../ui/social/PostCard.svelte';
  import ShareDialog from '../ui/social/ShareDialog.svelte';

  let convs = $state<ConversationSummary[]>([]);
  let error = $state<string | null>(null);
  const current = $derived(router.param || null);

  // Discussion ouverte
  let info = $state<{ kind: 'direct' | 'group'; name: string; members: Member[] } | null>(null);
  let messages = $state<Message[]>([]);
  let hasOlder = $state(false);
  let posts = $state<Record<string, Post>>({});
  let people = $state<Record<string, PublicProfile>>({});
  let draft = $state('');
  let showInfo = $state(false);
  let sharing = $state(false);
  let scroller = $state<HTMLElement>();

  // Nouveau groupe / ajout de membres
  let picking = $state<'new' | 'add' | null>(null);
  let friends = $state<PublicProfile[]>([]);
  let picked = $state<string[]>([]);
  let groupName = $state('');

  async function refreshList() {
    try {
      convs = await myConversations();
      error = null;
    } catch {
      error = t('acc.err.setupMissing');
    }
  }

  async function loadPosts(list: Message[]) {
    const ids = [...new Set(list.map((m) => m.post_id).filter((x): x is string => !!x && !posts[x]))];
    if (!ids.length) return;
    for (const p of await feed({ ids, limit: ids.length }).catch(() => [])) posts[p.id] = p;
  }

  async function open(id: string) {
    viewing.conversation = id;
    showInfo = false;
    info = null;
    messages = [];
    try {
      info = await conversationInfo(id);
    } catch {
      error = t('acc.err.network');
      return;
    }
    for (const m of info.members) people[m.id] = m;
    const list = await listMessages(id);
    messages = list;
    hasOlder = list.length === 50;
    await loadPosts(list);
    await markRead(id);
    refreshCounts();
    refreshList();
    await tick();
    scroller?.scrollTo(0, scroller.scrollHeight);
  }

  async function older() {
    const list = await listMessages(current!, messages[0]?.created_at);
    hasOlder = list.length === 50;
    messages = [...list, ...messages];
    loadPosts(list);
  }

  $effect(() => {
    const id = current;
    if (!auth.userId) return;
    if (id) open(id);
    else {
      viewing.conversation = null;
      info = null;
      refreshList();
    }
  });

  onMount(() => {
    const off = onNewMessage(async (m) => {
      if (m.conversation_id === current) {
        if (!messages.some((x) => x.id === m.id)) {
          const stick = !scroller || scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 80;
          if (!people[m.sender_id]) Object.assign(people, Object.fromEntries(await profilesByIds([m.sender_id])));
          messages = [...messages, m];
          await loadPosts([m]);
          markRead(m.conversation_id);
          await tick();
          if (stick) scroller?.scrollTo(0, scroller.scrollHeight);
        }
      }
      refreshList();
    });
    return () => {
      off();
      viewing.conversation = null;
    };
  });

  async function send(e: SubmitEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !current) return;
    draft = '';
    try {
      const m = await sendMessage(current, body);
      if (!messages.some((x) => x.id === m.id)) messages = [...messages, m];
      await tick();
      scroller?.scrollTo(0, scroller.scrollHeight);
    } catch {
      draft = body;
      error = t('msg.notFriends');
    }
  }

  async function startPicking(kind: 'new' | 'add') {
    picking = kind;
    picked = [];
    groupName = '';
    const s = await friendState();
    friends = kind === 'add' ? s.friends.filter((f) => !info?.members.some((m) => m.id === f.id)) : s.friends;
  }
  async function confirmPick() {
    if (!picked.length) return;
    if (picking === 'new') {
      const id = await createGroup(groupName.trim() || t('msg.newGroup'), picked);
      picking = null;
      location.hash = `#/messages/${id}`;
    } else if (current) {
      await addGroupMembers(current, picked);
      picking = null;
      info = await conversationInfo(current);
    }
  }

  const title = (c: ConversationSummary) => (c.kind === 'direct' ? c.other?.display_name || c.other?.username || '?' : c.name);
  const preview = (c: ConversationSummary) => (c.last_post && !c.last_body ? t('msg.drawing') : c.last_body ?? '');
  const time = (d: string) => new Date(d).toLocaleTimeString(settings.locale, { hour: '2-digit', minute: '2-digit' });
  const day = (d: string) => new Date(d).toLocaleDateString(settings.locale, { dateStyle: 'medium' });
  const curConv = $derived(convs.find((c) => c.id === current));
  const headerName = $derived(info?.kind === 'group' ? info.name : curConv ? title(curConv) : (info?.members.find((m) => m.id !== auth.userId)?.display_name ?? ''));
  const isOwner = $derived(info?.members.some((m) => m.id === auth.userId && m.role === 'owner') ?? false);
</script>

<main class="soc wide" class:thread-open={!!current}>
  <RequireAccount>
    {#if error}<p class="error">{error}</p>{/if}
    <div class="layout">
      <aside class="card list">
        <div class="row" style="justify-content: space-between">
          <h1>{t('msg.title')}</h1>
          <button class="btn small" onclick={() => startPicking('new')}>＋ {t('msg.newGroup')}</button>
        </div>
        {#if !convs.length}<p class="muted">{t('msg.empty')}</p>{/if}
        <ul class="people">
          {#each convs as c (c.id)}
            <li>
              <a class="person conv" class:active={c.id === current} href="#/messages/{c.id}">
                {#if c.kind === 'direct'}<Avatar id={0} url={c.other?.avatar_url ?? null} size={42} />
                {:else}<span class="group-ico" aria-hidden="true">👥</span>{/if}
                <span class="who"><b>{title(c)}</b><span>{preview(c)}</span></span>
                {#if c.unread && c.id !== current}<span class="badge">{c.unread}</span>{/if}
              </a>
            </li>
          {/each}
        </ul>
      </aside>

      {#if current}
        <section class="card thread">
          <header class="row">
            <a class="btn small back" href={href('messages')}>← {t('msg.back')}</a>
            <h2 class="grow">{headerName}</h2>
            {#if info?.kind === 'group'}<button class="btn small" aria-expanded={showInfo} onclick={() => (showInfo = !showInfo)}>{t('msg.info')}</button>{/if}
          </header>

          {#if showInfo && info}
            <div class="info">
              {#if isOwner}
                <form class="row" onsubmit={async (e) => { e.preventDefault(); const n = (e.currentTarget.elements[0] as HTMLInputElement).value; await renameGroup(current, n); info = await conversationInfo(current); refreshList(); }}>
                  <input type="text" value={info.name} maxlength="60" aria-label={t('msg.groupName')} style="flex: 1" />
                  <button class="btn small">{t('msg.rename')}</button>
                </form>
              {/if}
              <h3>{t('msg.members')} ({info.members.length})</h3>
              <ul class="people">
                {#each info.members as m (m.id)}
                  <li class="person">
                    <Avatar id={0} url={m.avatar_url} size={32} />
                    <a class="who" href="#/u/{m.username}"><b>{m.display_name || m.username}{m.role === 'owner' ? ` · ${t('msg.owner')}` : ''}</b></a>
                    {#if isOwner && m.id !== auth.userId}<button class="btn small danger" onclick={async () => { await removeMember(current, m.id); info = await conversationInfo(current); }}>{t('msg.removeMember')}</button>{/if}
                  </li>
                {/each}
              </ul>
              <div class="row">
                <button class="btn small" onclick={() => startPicking('add')}>＋ {t('msg.addMembers')}</button>
                <button class="btn small danger" onclick={async () => { if (confirm(t('msg.leaveConfirm'))) { await removeMember(current, auth.userId!); location.hash = href('messages'); } }}>{t('msg.leave')}</button>
              </div>
            </div>
          {/if}

          <div class="scroll" bind:this={scroller}>
            {#if hasOlder}<button class="btn small older" onclick={older}>{t('msg.older')}</button>{/if}
            {#each messages as m, i (m.id)}
              {@const mine = m.sender_id === auth.userId}
              {#if i === 0 || day(messages[i - 1].created_at) !== day(m.created_at)}<p class="day">{day(m.created_at)}</p>{/if}
              <div class="msg" class:mine>
                {#if !mine && (i === 0 || messages[i - 1].sender_id !== m.sender_id)}
                  <span class="from">{people[m.sender_id]?.display_name || people[m.sender_id]?.username || ''}</span>
                {/if}
                {#if m.post_id}
                  {#if posts[m.post_id]}<div class="shared"><PostCard post={posts[m.post_id]} /></div>{:else}<p class="bubble">{t('msg.drawing')}</p>{/if}
                {/if}
                {#if m.body}<p class="bubble">{m.body}<time>{time(m.created_at)}</time></p>{/if}
              </div>
            {/each}
          </div>

          <form class="compose" onsubmit={send}>
            <button type="button" class="btn small" title={t('msg.shareDrawing')} aria-label={t('msg.shareDrawing')} onclick={() => (sharing = true)}>🖼</button>
            <input type="text" bind:value={draft} maxlength="2000" placeholder={t('msg.placeholder')} aria-label={t('msg.placeholder')} />
            <button class="btn primary" disabled={!draft.trim()}>{t('msg.send')}</button>
          </form>
        </section>
      {/if}
    </div>
  </RequireAccount>
</main>

{#if picking}
  <div class="backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && (picking = null)}>
    <div class="dialog soc" role="dialog" aria-label={picking === 'new' ? t('msg.newGroup') : t('msg.addMembers')}>
      <h2>{picking === 'new' ? t('msg.newGroup') : t('msg.addMembers')}</h2>
      {#if picking === 'new'}<input type="text" bind:value={groupName} maxlength="60" placeholder={t('msg.groupName')} aria-label={t('msg.groupName')} />{/if}
      <p class="muted">{t('msg.chooseFriends')}</p>
      {#if !friends.length}<p class="muted">{t('fr.none')}</p>{/if}
      <ul class="people">
        {#each friends as f (f.id)}
          <li><label class="person"><input type="checkbox" value={f.id} bind:group={picked} /><Avatar id={0} url={f.avatar_url} size={32} /><span class="who"><b>{f.display_name || f.username}</b></span></label></li>
        {/each}
      </ul>
      <div class="row" style="justify-content: flex-end">
        <button class="btn" onclick={() => (picking = null)}>{t('acc.cancel')}</button>
        <button class="btn primary" disabled={!picked.length} onclick={confirmPick}>{picking === 'new' ? t('msg.create') : t('fr.add')}</button>
      </div>
    </div>
  </div>
{/if}

{#if sharing && current}<ShareDialog conversation={current} onclose={() => (sharing = false)} />{/if}

<style>
  .wide { max-width: 1100px; }
  .layout { display: grid; grid-template-columns: 320px 1fr; gap: 14px; height: calc(100dvh - 60px); min-height: 420px; }
  .list { overflow: auto; align-content: start; }
  .conv { text-decoration: none; }
  .conv.active { background: var(--surface-2); outline: 2px solid var(--accent); }
  .group-ico { width: 42px; height: 42px; border-radius: 50%; background: var(--surface-2); display: grid; place-items: center; font-size: 1.3rem; flex: none; }
  .thread { grid-template-rows: auto auto 1fr auto; min-height: 0; padding: 10px; }
  .grow { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .back { display: none; }
  .info { border-bottom: 2px solid var(--line); padding-bottom: 10px; display: grid; gap: 8px; max-height: 40vh; overflow: auto; }
  .info h3 { font-size: 0.95rem; }
  .scroll { overflow: auto; min-height: 0; display: flex; flex-direction: column; gap: 4px; padding: 4px; }
  .older { align-self: center; }
  .day { align-self: center; margin: 8px 0 2px; font-size: 0.78rem; color: var(--ink-soft); }
  .msg { display: flex; flex-direction: column; align-items: flex-start; max-width: 80%; }
  .msg.mine { align-self: flex-end; align-items: flex-end; }
  .from { font-size: 0.78rem; color: var(--ink-soft); margin: 4px 8px 0; }
  .bubble { margin: 0; padding: 8px 12px; border-radius: 16px; background: var(--surface-2); white-space: pre-wrap; word-break: break-word; }
  .mine .bubble { background: var(--accent); color: var(--accent-ink); }
  .bubble time { margin-left: 8px; font-size: 0.7rem; opacity: 0.7; }
  .shared { width: min(340px, 70vw); }
  .compose { display: flex; gap: 6px; }
  .compose input { flex: 1; }
  .backdrop { position: fixed; inset: 0; z-index: 60; background: rgba(0, 0, 0, 0.45); display: grid; place-items: center; padding: 12px; }
  .dialog { background: var(--surface); border-radius: 16px; padding: 16px; width: min(440px, 100%); max-height: 100%; overflow: auto; }
  label.person { cursor: pointer; }
  @media (max-width: 760px) {
    .layout { grid-template-columns: 1fr; height: calc(100dvh - 40px); }
    .thread-open .list { display: none; }
    .back { display: inline-flex; }
  }
</style>
