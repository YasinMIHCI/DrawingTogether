<script lang="ts">
  import { onMount } from 'svelte';
  import { createPost, myConversations, sendMessage, type ConversationSummary } from '../../social/api';
  import { drawingImage, listDrawings, loadThumb, thumbnail, type DrawingInfo } from '../../lib/gallery';
  import { Editor } from '../../engine/editor';
  import { t } from '../../lib/i18n/t.svelte';
  import SimpleEditor from '../games/SimpleEditor.svelte';

  /** Publier : texte, petit dessin fait sur place, ou dessin de la galerie ; dans le fil des amis et/ou des discussions. */
  let { drawingId = null, conversation = null, onclose, ondone }: {
    drawingId?: string | null; conversation?: string | null; onclose: () => void; ondone?: (postId: string) => void;
  } = $props();

  type Mode = 'text' | 'draw' | 'gallery';
  let mode = $state<Mode>('text');
  let chosen = $state<string | null>(null);
  let drawings = $state<DrawingInfo[] | null>(null);
  let thumbs = $state<Record<string, string>>({});
  let convs = $state<ConversationSummary[]>([]);
  let targets = $state<string[]>([]);
  let title = $state('');
  let body = $state('');
  let busy = $state(false);
  let error = $state<string | null>(null);
  let editor = $state<Editor | null>(null);

  onMount(() => {
    if (drawingId) {
      mode = 'gallery';
      chosen = drawingId;
      loadThumb(drawingId).then((b) => b && (thumbs[drawingId] = URL.createObjectURL(b)));
    }
    if (conversation) targets = [conversation];
    else myConversations().then((c) => (convs = c)).catch(() => {});
    return () => Object.values(thumbs).forEach((u) => URL.revokeObjectURL(u));
  });

  async function setMode(m: Mode) {
    mode = m;
    error = null;
    if (m === 'draw' && !editor) editor = new Editor({ width: 640, height: 360, historyBytes: 32 * 2 ** 20 });
    if (m === 'gallery' && !drawings) {
      drawings = await listDrawings();
      for (const d of drawings) {
        const b = await loadThumb(d.id);
        if (b) thumbs[d.id] = URL.createObjectURL(b);
      }
    }
  }

  const convName = (c: ConversationSummary) => (c.kind === 'direct' ? c.other?.display_name || c.other?.username || '?' : c.name);
  const ready = $derived(mode === 'text' ? !!body.trim() : mode === 'draw' ? true : !!chosen);

  async function publish() {
    busy = true;
    error = null;
    try {
      let img: { png: Blob; width: number; height: number } | null = null;
      if (mode === 'gallery' && chosen) img = await drawingImage(chosen);
      if (mode === 'draw' && editor) {
        const png = await thumbnail(editor.doc, 640);
        if (png) img = { png, width: 640, height: 360 };
      }
      if (mode !== 'text' && !img) throw new Error('image');
      const id = await createPost(img?.png ?? null, img?.width ?? 0, img?.height ?? 0, title, body);
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
  <div class="dialog soc" role="dialog" aria-label={t('feed.publish')}>
    <h2 class="band">{t('feed.publish')}</h2>
    {#if !drawingId}
      <div class="modes" role="tablist">
        {#each [['text', 'feed.mode.text'], ['draw', 'feed.mode.draw'], ['gallery', 'feed.mode.gallery']] as const as [m, label] (m)}
          <button role="tab" aria-selected={mode === m} onclick={() => setMode(m)}>{t(label)}</button>
        {/each}
      </div>
    {/if}

    <input type="text" bind:value={title} maxlength="80" placeholder={t('feed.title.placeholder')} aria-label={t('feed.title.placeholder')} />

    {#if mode === 'draw' && editor}
      <div class="draw"><SimpleEditor {editor} /></div>
    {:else if mode === 'gallery'}
      {#if chosen}
        {#if thumbs[chosen]}<img class="preview" src={thumbs[chosen]} alt="" />{/if}
        {#if !drawingId}<button class="btn small" onclick={() => (chosen = null)}>{t('feed.pick')}</button>{/if}
      {:else}
        <p class="muted">{t('feed.pick')}</p>
        {#if drawings && !drawings.length}<p class="muted">{t('feed.noDrawings')}</p>{/if}
        <ul class="pick">
          {#each drawings ?? [] as d (d.id)}
            <li><button onclick={() => (chosen = d.id)} aria-label={d.name || t('gallery.untitled')}>{#if thumbs[d.id]}<img src={thumbs[d.id]} alt="" />{/if}</button></li>
          {/each}
        </ul>
      {/if}
    {/if}

    <textarea bind:value={body} maxlength="1000" rows={mode === 'text' ? 5 : 2} placeholder={mode === 'text' ? t('feed.textPlaceholder') : t('feed.caption')} aria-label={t('feed.textPlaceholder')}></textarea>

    {#if !conversation && convs.length}
      <details>
        <summary class="muted">{t('feed.where')}</summary>
        <fieldset>
          <label><input type="checkbox" checked disabled /> {t('feed.toFriends')}</label>
          {#each convs as c (c.id)}
            <label><input type="checkbox" value={c.id} bind:group={targets} /> {convName(c)}</label>
          {/each}
        </fieldset>
      </details>
    {/if}
    {#if error}<p class="error">{error}</p>{/if}
    <div class="row end">
      <button class="btn" onclick={onclose}>{t('acc.cancel')}</button>
      <button class="btn primary" onclick={publish} disabled={busy || !ready}>{t('feed.publish')}</button>
    </div>
  </div>
</div>

<style>
  .backdrop { position: fixed; inset: 0; z-index: 60; background: rgba(0, 0, 0, 0.45); display: grid; place-items: center; padding: 12px; }
  .dialog { background: var(--bg); border-radius: 20px; padding: 14px; width: min(720px, 100%); max-height: 100%; overflow: auto; }
  .modes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .modes button { font: inherit; font-weight: 800; padding: 10px 6px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface); color: var(--ink-soft); cursor: pointer; }
  .modes [aria-selected='true'] { background: var(--green-soft); color: var(--accent); border-color: var(--green-bright); }
  .draw { height: min(56vh, 460px); }
  .pick { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; }
  .pick button { width: 100%; aspect-ratio: 4 / 3; border: 2px solid var(--line); border-radius: 10px; background: #fff; padding: 0; overflow: hidden; cursor: pointer; }
  .pick img { width: 100%; height: 100%; object-fit: contain; }
  .preview { max-width: 100%; max-height: 220px; justify-self: center; border-radius: 10px; background: #fff; }
  textarea { resize: vertical; }
  fieldset { border: 0; padding: 6px 0 0; margin: 0; display: grid; gap: 6px; }
  summary { cursor: pointer; }
  .end { justify-content: flex-end; }
</style>
