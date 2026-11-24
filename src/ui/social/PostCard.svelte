<script lang="ts">
  import { addComment, deleteComment, deletePost, listComments, setLike, type Comment, type Post } from '../../social/api';
  import { auth } from '../../social/auth.svelte';
  import { settings } from '../../lib/settings.svelte';
  import { t } from '../../lib/i18n/t.svelte';
  import Avatar from '../../components/Avatar.svelte';
  import PostImage from './PostImage.svelte';

  let { post, ondelete }: { post: Post; ondelete?: () => void } = $props();
  let likes = $state(0);
  let liked = $state(false);
  let count = $state(0);
  $effect.pre(() => {
    likes = post.likes;
    liked = post.liked;
    count = post.comments;
  });
  let comments = $state<Comment[] | null>(null);
  let draft = $state('');
  const when = (d: string) => new Date(d).toLocaleString(settings.locale, { dateStyle: 'medium', timeStyle: 'short' });

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

<article class="card post">
  <header class="person">
    <a class="who-row" href="#/u/{post.owner?.username}">
      <Avatar id={0} url={post.owner?.avatar_url ?? null} size={36} />
      <span class="who"><b>{post.owner?.display_name || post.owner?.username}</b><span>{when(post.created_at)}</span></span>
    </a>
    {#if post.owner_id === auth.userId}
      <button class="btn small danger" onclick={async () => { if (confirm(t('feed.deleteConfirm'))) { await deletePost(post); ondelete?.(); } }}>{t('feed.delete')}</button>
    {/if}
  </header>
  {#if post.title}<h3>{post.title}</h3>{/if}
  <PostImage path={post.image_path} width={post.width} height={post.height} alt={post.title} />
  <div class="row">
    <button class="btn small" aria-pressed={liked} onclick={toggleLike}>{liked ? '♥' : '♡'} {likes}</button>
    <button class="btn small" aria-expanded={!!comments} onclick={() => (comments ? (comments = null) : loadComments())}>💬 {count}</button>
  </div>
  {#if comments}
    <ul class="comments">
      {#each comments as c (c.id)}
        <li>
          <Avatar id={0} url={c.author?.avatar_url ?? null} size={26} />
          <p><b>{c.author?.display_name || c.author?.username}</b> {c.body}</p>
          {#if c.user_id === auth.userId || post.owner_id === auth.userId}
            <button class="x" aria-label={t('feed.delete')} onclick={async () => { await deleteComment(c.id); loadComments(); }}>×</button>
          {/if}
        </li>
      {/each}
    </ul>
    <form class="row" onsubmit={send}>
      <input type="text" bind:value={draft} maxlength="500" placeholder={t('feed.comment')} aria-label={t('feed.comment')} style="flex: 1" />
      <button class="btn small primary">{t('msg.send')}</button>
    </form>
  {/if}
</article>

<style>
  .post header { justify-content: space-between; padding: 0; }
  .post header:hover { background: none; }
  .who-row { display: flex; align-items: center; gap: 10px; text-decoration: none; min-width: 0; }
  .comments { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  .comments li { display: flex; gap: 8px; align-items: flex-start; }
  .comments p { margin: 0; flex: 1; word-break: break-word; }
  .x { border: 0; background: none; color: var(--ink-soft); cursor: pointer; font-size: 1.1rem; }
</style>
