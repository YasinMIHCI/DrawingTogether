<script lang="ts">
  import { onMount } from 'svelte';
  import { createPost, myConversations, sendMessage, type ConversationSummary } from '../../social/api';
  import { drawingImage, listDrawings, loadThumb, type DrawingInfo } from '../../lib/gallery';
  import { t } from '../../lib/i18n/t.svelte';

  /** Partager un dessin de la galerie : fil des amis, et/ou dans des discussions. */
  let { drawingId = null, conversation = null, onclose, ondone }: {
    drawingId?: string | null; conversation?: string | null; onclose: () => void; ondone?: (postId: string) => void;
  } = $props();

  let chosen = $state<string | null>(null);
  let drawings = $state<DrawingInfo[] | null>(null);
  let thumbs = $state<Record<string, string>>({});
  let convs = $state<ConversationSummary[]>([]);
  let targets = $state<string[]>([]);
  let title = $state('');
  let busy = $state(false);
  let error = $state<string | null>(null);

  onMount(() => {
    chosen = drawingId;
    if (conversation) targets = [conversation];
    if (drawingId) loadThumb(drawingId).then((b) => b && (thumbs[drawingId] = URL.createObjectURL(b)));
    else {
      listDrawings().then(async (l) => {
        drawings = l;
        for (const d of l) {
          const b = await loadThumb(d.id);
          if (b) thumbs[d.id] = URL.createObjectURL(b);
        }
      });
    }
    if (!conversation) myConversations().then((c) => (convs = c)).catch(() => {});
    return () => Object.values(thumbs).forEach((u) => URL.revokeObjectURL(u));
  });

  const convName = (c: ConversationSummary) => (c.kind === 'direct' ? c.other?.display_name || c.other?.username || '?' : c.name);

  async function publish() {
    if (!chosen) return;
    busy = true;
    error = null;
    try {
      const img = await drawingImage(chosen);
      if (!img) throw new Error('image');
      const id = await createPost(img.png, img.width, img.height, title);
      for (const c of targets) await sendMessage(c, '', id);
      ondone?.(id);
      onclose();
    } catch {
      error = t('acc.err.network');
    }
    busy = false;
  }
</script>

<div class="backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && onclose()}>
  <div class="dialog soc" role="dialog" aria-label={t('feed.share')}>
    <h2>{t('feed.share')}</h2>
    {#if !chosen}
      <p class="muted">{t('feed.pick')}</p>
      {#if drawings && !drawings.length}<p class="muted">{t('feed.noDrawings')}</p>{/if}
      <ul class="pick">
        {#each drawings ?? [] as d (d.id)}
          <li><button onclick={() => (chosen = d.id)} aria-label={d.name || t('gallery.untitled')}>{#if thumbs[d.id]}<img src={thumbs[d.id]} alt="" />{/if}</button></li>
        {/each}
      </ul>
    {:else}
      {#if thumbs[chosen]}<img class="preview" src={thumbs[chosen]} alt="" />{/if}
      <input type="text" bind:value={title} maxlength="80" placeholder={t('feed.title.placeholder')} aria-label={t('feed.title.placeholder')} />
      {#if !conversation}
        <fieldset>
          <legend class="muted">{t('feed.where')}</legend>
          <label><input type="checkbox" checked disabled /> {t('feed.toFriends')}</label>
          {#each convs as c (c.id)}
            <label><input type="checkbox" value={c.id} bind:group={targets} /> {convName(c)}</label>
          {/each}
        </fieldset>
      {/if}
      {#if error}<p class="error">{error}</p>{/if}
    {/if}
    <div class="row end">
      <button class="btn" onclick={onclose}>{t('acc.cancel')}</button>
      {#if chosen}<button class="btn primary" onclick={publish} disabled={busy}>{t('feed.publish')}</button>{/if}
    </div>
  </div>
</div>

<style>
  .backdrop { position: fixed; inset: 0; z-index: 60; background: rgba(0, 0, 0, 0.45); display: grid; place-items: center; padding: 12px; }
  .dialog { background: var(--surface); border-radius: 16px; padding: 16px; width: min(520px, 100%); max-height: 100%; overflow: auto; }
  .pick { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; }
  .pick button { width: 100%; aspect-ratio: 4 / 3; border: 2px solid var(--line); border-radius: 10px; background: #fff; padding: 0; overflow: hidden; cursor: pointer; }
  .pick img { width: 100%; height: 100%; object-fit: contain; }
  .preview { max-width: 100%; max-height: 220px; justify-self: center; border-radius: 10px; background: #fff; }
  fieldset { border: 0; padding: 0; margin: 0; display: grid; gap: 6px; }
  .end { justify-content: flex-end; }
</style>
