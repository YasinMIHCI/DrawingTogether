<script lang="ts">
  import { addComment, deleteComment, deletePost, isModerator, listComments, listCommunities, reportPost, setHidden, setLike, type Comment, type Community, type Post, type ReportReason } from '../../social/api';
  import { auth } from '../../social/auth.svelte';
  import { settings } from '../../lib/settings.svelte';
  import { relativeTime } from '../../lib/time';
  import { t } from '../../lib/i18n/t.svelte';
  import Avatar from '../../components/Avatar.svelte';
  import PostImage from './PostImage.svelte';
  import { parseBouille } from '../../bouille/model';
  import { renderBouille } from '../../bouille/render';

  // Ma Bouille sur le bouton « Ouais ! » : contente quand j'ai aimé
  const myB = $derived(parseBouille(settings.bouille));

  /** Publication façon « bulle » : avatar à gauche, étiquette du pseudo, contenu, barre « Ouais ! ». */
  let { post, ondelete, compact = false }: { post: Post; ondelete?: () => void; compact?: boolean } = $props();
  let likes = $state(0);
  let liked = $state(false);
  let count = $state(0);
  $effect.pre(() => {
    likes = post.likes;
    liked = post.liked;
    count = post.comments;
  });
  let comments = $state<Comment[] | null>(null);
  let community = $state<Community | null>(null);
  let mod = $state(false);
  let reporting = $state(false);
  let reported = $state(false);
  let hidden = $state(false);
  $effect.pre(() => {
    hidden = !!post.hidden;
  });
  $effect(() => {
    const id = post.community_id;
    if (id) listCommunities().then((l) => (community = l?.find((c) => c.id === id) ?? null));
    isModerator().then((m) => (mod = m));
  });
  async function report(reason: ReportReason) {
    reporting = false;
    await reportPost(post.id, reason).then(() => (reported = true)).catch(() => alert(t('acc.err.network')));
  }
  async function toggleHidden() {
    hidden = !hidden;
    await setHidden(post.id, hidden).catch(() => (hidden = !hidden));
  }
  let draft = $state('');
  const name = $derived(post.owner?.display_name || post.owner?.username || '?');
  const mine = $derived(post.owner_id === auth.userId);

  async function toggleLike() {
    liked = !liked;
    likes += liked ? 1 : -1;
    try {
      await setLike(post.id, liked);
    } catch {
      liked = !liked;
      likes += liked ? 1 : -1;
    }
  }
  async function loadComments() {
    comments = await listComments(post.id);
    count = comments.length;
  }
  async function send(e: SubmitEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    await addComment(post.id, draft);
    draft = '';
    loadComments();
  }
</script>

<article class="post" class:compact>
  {#if !compact}
    <a class="who avatar-frame" href="#/u/{post.owner?.username}" aria-label={name}>
      <Avatar id={0} url={post.owner?.avatar_url ?? null} size={56} />
    </a>
  {/if}
  <div class="main">
    <div class="meta">
      <a class="tag" href="#/u/{post.owner?.username}">{name}</a>
      <time datetime={post.created_at}>{relativeTime(post.created_at, settings.locale)}</time>
    </div>
    <div class="bubble">
      {#if community || hidden}
        <p class="tags">
          {#if community}<a class="com" href="#/c/{community.id}">{community.icon} {settings.locale === 'fr' ? community.name_fr : community.name_en}</a>{/if}
          {#if hidden}<span class="hid">{t('mod.hidden')}</span>{/if}
        </p>
      {/if}
      {#if post.title}<p class="topic">✎ {post.title}</p>{/if}
      {#if post.body}<p class="body">{post.body}</p>{/if}
      {#if post.image_path}<PostImage path={post.image_path} width={post.width} height={post.height} alt={post.title} />{/if}
      <div class="actions">
        <button class="yeah" class:on={liked} aria-pressed={liked} onclick={toggleLike} disabled={mine} title={mine ? '' : t('feed.like')}>
          {#if myB}<span class="me">{@html renderBouille(myB, { view: 'head', expr: liked ? 'happy' : 'neutral', viewBox: '30 50 140 130' })}</span>
          {:else}<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="currentColor" fill-opacity=".18" stroke="currentColor" stroke-width="2"/><path d="M8.5 13.5q3.5 4 7 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="9" cy="10" r="1.3" fill="currentColor"/><circle cx="15" cy="10" r="1.3" fill="currentColor"/></svg>{/if}
          {t('feed.like')}
        </button>
        <span class="grow"></span>
        <span class="count" title={t('feed.like')}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8.5 13.5q3.5 4 7 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>{likes}
        </span>
        <button class="count" aria-expanded={!!comments} title={t('feed.comments')} onclick={() => (comments ? (comments = null) : loadComments())}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 5h16v10H10l-4 4v-4H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>{count}
        </button>
        {#if !mine}
          <span class="rep-wrap">
            <button class="count" class:done={reported} title={reported ? t('rep.done') : t('rep.title')} aria-label={t('rep.title')} aria-expanded={reporting} disabled={reported} onclick={() => (reporting = !reporting)}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5" fill={reported ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
            </button>
            {#if reporting}
              <span class="rep-menu" role="menu">
                {#each ['spam', 'offensive', 'other'] as const as r (r)}<button role="menuitem" onclick={() => report(r)}>{t(`rep.${r}`)}</button>{/each}
              </span>
            {/if}
          </span>
        {/if}
        {#if mod && !mine}
          <button class="count" title={hidden ? t('mod.unhide') : t('mod.hide')} onclick={toggleHidden}>{hidden ? '👁' : '🙈'}</button>
        {/if}
        {#if mine || mod}
          <button class="count del" title={t('feed.delete')} aria-label={t('feed.delete')} onclick={async () => { if (confirm(t('feed.deleteConfirm'))) { await deletePost(post); ondelete?.(); } }}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
          </button>
        {/if}
      </div>
      {#if comments}
        <ul class="comments">
          {#each comments as c (c.id)}
            <li>
              <span class="avatar-frame small"><Avatar id={0} url={c.author?.avatar_url ?? null} size={28} /></span>
              <p><a href="#/u/{c.author?.username}"><b>{c.author?.display_name || c.author?.username}</b></a> {c.body}
                <time>{relativeTime(c.created_at, settings.locale)}</time></p>
              {#if c.user_id === auth.userId || mine}
                <button class="x" aria-label={t('feed.delete')} onclick={async () => { await deleteComment(c.id); loadComments(); }}>×</button>
              {/if}
            </li>
          {/each}
        </ul>
        <form class="reply" onsubmit={send}>
          <input type="text" bind:value={draft} maxlength="500" placeholder={t('feed.comment')} aria-label={t('feed.comment')} />
          <button class="send">{t('msg.send')}</button>
        </form>
      {/if}
    </div>
  </div>
</article>

<style>
  .post { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 14px; align-items: start; min-width: 0; }
  .post.compact { grid-template-columns: 1fr; }
  .who { margin-top: 30px; text-decoration: none; }
  .main { min-width: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 4px; }
  .meta { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 0 4px; }
  .tag { background: #5d6268; color: #fff; font-weight: 800; font-size: 0.82rem; padding: 2px 10px; border-radius: 9px; text-decoration: none; max-width: 70%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  time { color: var(--ink-soft); font-size: 0.8rem; white-space: nowrap; }
  .bubble { position: relative; background: var(--surface); border: 1px solid var(--line); border-radius: 16px; box-shadow: var(--shadow); padding: 12px 14px 8px; display: grid; gap: 8px; }
  .post:not(.compact) .bubble::before {
    content: ''; position: absolute; left: -9px; top: 18px; width: 16px; height: 16px; background: var(--surface);
    border-left: 1px solid var(--line); border-bottom: 1px solid var(--line); transform: rotate(45deg); border-radius: 0 0 0 4px;
  }
  .tags { margin: 0; display: flex; gap: 6px; flex-wrap: wrap; }
  .com { font-size: 0.8rem; font-weight: 800; color: var(--blue-text); background: color-mix(in srgb, var(--blue) 14%, transparent); padding: 2px 10px; border-radius: 9px; text-decoration: none; }
  .hid { font-size: 0.8rem; font-weight: 700; background: #ffe1dc; color: #8a1f0e; padding: 2px 8px; border-radius: 8px; }
  .rep-wrap { position: relative; }
  .count.done { color: var(--danger); }
  .rep-menu { position: absolute; right: 0; bottom: calc(100% + 4px); z-index: 5; display: grid; min-width: 170px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--shadow); overflow: hidden; }
  .rep-menu button { font: inherit; text-align: left; padding: 8px 12px; border: 0; background: none; color: var(--ink); cursor: pointer; }
  .rep-menu button:hover { background: var(--surface-2); }
  .topic { margin: 0; color: var(--accent-text); font-weight: 800; font-size: 0.85rem; }
  .body { margin: 0; font-size: 1.05rem; white-space: pre-wrap; word-break: break-word; }
  .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; border-top: 1px solid var(--line); margin: 0 -14px; padding: 6px 10px 0; }
  .grow { flex: 1; }
  .yeah { display: inline-flex; align-items: center; gap: 6px; font: inherit; font-weight: 800; font-size: 0.88rem; padding: 5px 12px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface-2); color: var(--ink-soft); cursor: pointer; }
  .me { width: 24px; height: 22px; display: block; }
  .me :global(svg) { width: 100%; height: 100%; }
  .yeah.on { background: var(--green-soft); color: var(--accent-text); border-color: var(--green-bright); }
  .yeah:disabled { opacity: 0.5; cursor: default; }
  .count { display: inline-flex; align-items: center; gap: 4px; font: inherit; font-size: 0.88rem; font-weight: 700; color: var(--ink-soft); background: none; border: 0; padding: 4px 6px; border-radius: 8px; }
  button.count { cursor: pointer; }
  button.count:hover { background: var(--surface-2); }
  .del:hover { color: var(--danger); }
  .comments { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
  .comments li { display: flex; gap: 8px; align-items: flex-start; }
  .comments p { margin: 0; flex: 1; word-break: break-word; }
  .comments a { text-decoration: none; }
  .comments time { margin-left: 6px; font-size: 0.75rem; }
  .avatar-frame.small { padding: 2px; border-radius: 10px; }
  .x { border: 0; background: none; color: var(--ink-soft); cursor: pointer; font-size: 1.1rem; }
  .reply { display: flex; gap: 6px; padding-bottom: 6px; }
  .reply input { flex: 1; min-width: 0; font: inherit; color: var(--ink); padding: 8px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-2); }
  .send { font: inherit; font-weight: 800; padding: 0 14px; border-radius: 10px; border: 0; background: var(--accent); color: var(--accent-ink); cursor: pointer; }
  @media (max-width: 640px) {
    .post { gap: 8px; }
    .who :global(svg), .who :global(img) { width: 40px !important; height: 40px !important; }
  }
</style>
