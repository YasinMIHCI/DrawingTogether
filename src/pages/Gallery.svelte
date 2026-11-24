<script lang="ts">
  import { onMount } from 'svelte';
  import { projectFromFile, PROJECT_EXTENSION } from '../engine/project';
  import {
    addProject, deleteDrawing, duplicateDrawing, listDrawings, loadThumb, newDrawingId, renameDrawing, type DrawingInfo,
  } from '../lib/gallery';
  import { pickFile } from '../lib/download';
  import { href } from '../lib/router.svelte';
  import { settings } from '../lib/settings.svelte';
  import { t } from '../lib/i18n/t.svelte';
  import { auth } from '../social/auth.svelte';
  import ShareDialog from '../ui/social/ShareDialog.svelte';
  import EmptyState from '../components/EmptyState.svelte';

  let sharing = $state<string | null>(null);
  let shared = $state(false);

  let list = $state<DrawingInfo[] | null>(null);
  let thumbs = $state<Record<string, string>>({});
  let renaming = $state<string | null>(null);

  async function refresh() {
    list = await listDrawings();
    for (const d of list) {
      if (thumbs[d.id]) URL.revokeObjectURL(thumbs[d.id]);
      const b = await loadThumb(d.id);
      if (b) thumbs[d.id] = URL.createObjectURL(b);
    }
  }
  onMount(() => {
    refresh();
    return () => Object.values(thumbs).forEach((u) => URL.revokeObjectURL(u));
  });

  const name = (d: DrawingInfo) => d.name || t('gallery.untitled');
  const date = (ms: number) => new Date(ms).toLocaleString(settings.locale, { dateStyle: 'medium', timeStyle: 'short' });

  async function importProject() {
    const f = await pickFile(`${PROJECT_EXTENSION},application/json`);
    if (!f) return;
    try {
      const id = await addProject(await projectFromFile(f), f.name.replace(/\.[^.]+$/, ''));
      location.hash = `${href('draw')}/${id}`;
    } catch {
      alert(t('file.openError'));
    }
  }
</script>

<main>
  <h1 class="band">{t('gallery.title')}</h1>
  <header>
    <div>
      <p class="muted">{t('gallery.intro')}</p>
    </div>
    <div class="actions">
      <a class="btn primary" href="{href('draw')}/{newDrawingId()}">＋ {t('gallery.new')}</a>
      <button class="btn" onclick={importProject}>{t('gallery.importProject')}</button>
    </div>
  </header>

  {#if list && !list.length}
    <EmptyState text={t('gallery.empty')} expr="happy">
      <a class="btn primary" href="{href('draw')}/{newDrawingId()}">＋ {t('gallery.new')}</a>
    </EmptyState>
  {:else if list}
    <ul class="grid">
      {#each list as d (d.id)}
        <li class="card">
          <a class="thumb" href="{href('draw')}/{d.id}" aria-label="{t('gallery.open')} {name(d)}">
            {#if thumbs[d.id]}<img src={thumbs[d.id]} alt="" />{/if}
          </a>
          {#if renaming === d.id}
            <form onsubmit={async (e) => { e.preventDefault(); await renameDrawing(d.id, (e.currentTarget.elements[0] as HTMLInputElement).value); renaming = null; refresh(); }}>
              <!-- svelte-ignore a11y_autofocus -->
              <input type="text" value={d.name} maxlength="60" autofocus aria-label={t('gallery.rename')} onblur={(e) => e.currentTarget.form?.requestSubmit()} />
            </form>
          {:else}
            <strong class="name">{name(d)}</strong>
          {/if}
          <span class="muted small">{d.width} × {d.height} · {t('gallery.edited', { date: date(d.updatedAt) })}</span>
          <div class="row">
            <button class="mini" onclick={() => (renaming = d.id)}>{t('gallery.rename')}</button>
            {#if auth.userId}<button class="mini" onclick={() => (sharing = d.id)}>{t('gallery.share')}</button>{/if}
            <button class="mini" onclick={async () => { await duplicateDrawing(d.id, t('gallery.copy')); refresh(); }}>{t('gallery.duplicate')}</button>
            <button class="mini danger" onclick={async () => { if (confirm(t('gallery.deleteConfirm', { name: name(d) }))) { await deleteDrawing(d.id); refresh(); } }}>{t('gallery.delete')}</button>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
  {#if shared}<p class="toast" role="status">{t('feed.shared')}</p>{/if}
</main>

{#if sharing}
  <ShareDialog drawingId={sharing} onclose={() => (sharing = null)} ondone={() => { shared = true; setTimeout(() => (shared = false), 2500); }} />
{/if}

<style>
  main { max-width: 1040px; margin: 0 auto; padding: 8px 16px 40px; display: grid; gap: 16px; }
  header { display: flex; flex-wrap: wrap; gap: 12px; align-items: end; justify-content: space-between; }
  h1 { margin: 0; }
  .muted { color: var(--ink-soft); margin: 0; }
  .small { font-size: 0.82rem; }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .btn { font: inherit; display: inline-flex; align-items: center; min-height: 44px; padding: 0 16px; border-radius: 12px; border: 2px solid var(--line); background: var(--surface); color: var(--ink); text-decoration: none; cursor: pointer; }
  .btn.primary { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); font-weight: 700; }
  .grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
  .card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 10px; display: grid; gap: 6px; box-shadow: var(--shadow); }
  .thumb { display: grid; place-items: center; aspect-ratio: 4 / 3; background: repeating-conic-gradient(#e7e2d8 0% 25%, #f6f2ea 0% 50%) 0 0 / 16px 16px; border-radius: 10px; overflow: hidden; }
  .thumb img { max-width: 100%; max-height: 100%; display: block; }
  .name { word-break: break-word; }
  input { font: inherit; color: var(--ink); padding: 6px 8px; border: 2px solid var(--line); border-radius: 8px; background: var(--surface-2); width: 100%; }
  .row { display: flex; flex-wrap: wrap; gap: 4px; }
  .mini { font: inherit; font-size: 0.8rem; padding: 4px 8px; border-radius: 8px; border: 1px solid var(--line); background: var(--surface-2); color: var(--ink); cursor: pointer; }
  .toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); margin: 0; padding: 10px 16px; border-radius: 12px; background: var(--ink); color: var(--bg); }
  .danger { color: #c0392b; }
</style>
