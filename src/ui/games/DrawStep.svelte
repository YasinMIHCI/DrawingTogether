<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { Editor } from '../../engine/editor';
  import type { Game, Task } from '../../games/game';
  import { CORPSE_H, CORPSE_STRIP, GAME_H, GAME_W, getMode } from '../../games/modes';
  import { canvasToBase64, drawScribble, entryImage } from '../../games/media';
  import { ideaFor } from '../../games/ideas';
  import { settings } from '../../lib/settings.svelte';
  import { screen } from '../../lib/screen.svelte';
  import { t } from '../../lib/i18n/t.svelte';
  import type { Key } from '../../lib/i18n/i18n.svelte';
  import EditorView from '../EditorView.svelte';
  import type { FileActions } from '../common/types';
  import SimpleEditor from './SimpleEditor.svelte';
  import Timer from './Timer.svelte';
  import EntryView from './EntryView.svelte';

  let { game, task, total }: { game: Game; task: Task; total: number } = $props();
  // L'écran est recréé à chaque tour : la tâche est lue une fois.
  const tk = untrack(() => task);
  const st = untrack(() => game.state!);
  const mode = getMode(st.config.mode);
  const corpse = mode.id === 'corpse';
  const editor = new Editor({ width: GAME_W, height: corpse ? CORPSE_H : GAME_H, historyBytes: (screen.info.coarse ? 48 : 128) * 2 ** 20 });
  const drawing = editor.doc.layers[0];
  let full = $state(untrack(() => st.config.editor === 'full'));
  let ready = $state(false);

  const prev = untrack(() => tk.history[tk.history.length - 1]);
  const lastText = untrack(() => [...task.history].reverse().find((e) => e.kind === 'text'));

  // Consigne affichée au-dessus de la toile
  const title: Key = (() => {
    switch (mode.id) {
      case 'flipbook': return tk.round === 0 ? 'games.draw.flipFirst' : 'games.draw.flipNext';
      case 'corpse': return tk.round === 0 ? 'games.draw.corpseFirst' : tk.round === st.rounds - 1 ? 'games.draw.corpseLast' : 'games.draw.corpseNext';
      case 'scribble': return tk.round === 0 ? 'games.draw.scribble' : 'games.draw.prompt';
      case 'atelier': return 'games.draw.atelier';
      case 'relay': return 'games.draw.relay';
      default: return 'games.draw.prompt';
    }
  })();
  const promptText = mode.id === 'atelier' ? ideaFor(settings.locale, st.seed + tk.chain)
    : mode.id === 'relay' ? (tk.history[0]?.kind === 'text' ? tk.history[0].data : '')
    : mode.id === 'flipbook' || mode.id === 'corpse' || (mode.id === 'scribble' && tk.round === 0) ? ''
    : (lastText?.data ?? '');

  onMount(async () => {
    // Calque guide (non envoyé) : image précédente en transparence (flip-book) ou bande du bas (cadavre exquis)
    const img = prev ? await entryImage(prev) : null;
    if (img && (mode.id === 'flipbook' || corpse)) {
      const guide = editor.doc.createLayer();
      guide.locked = true;
      guide.name = '·';
      if (corpse) {
        guide.opacity = 0.75;
        guide.surface.ctx.drawImage(img, 0, CORPSE_H - CORPSE_STRIP, GAME_W, CORPSE_STRIP, 0, 0, GAME_W, CORPSE_STRIP);
        guide.surface.ctx.fillStyle = 'rgba(43,179,163,0.12)';
        guide.surface.ctx.fillRect(0, 0, GAME_W, CORPSE_STRIP);
      } else {
        guide.opacity = 0.3;
        guide.surface.ctx.drawImage(img, 0, 0);
      }
      editor.doc.insert(guide, 0);
      editor.doc.activeId = drawing.id;
    }
    // Contenu de départ dans le dessin lui-même
    if (mode.id === 'scribble' && tk.round === 0) drawScribble(drawing.surface.ctx, st.seed + tk.chain * 7919);
    if (mode.id === 'relay' && img) drawing.surface.ctx.drawImage(img, 0, 0);
    editor.notify();
    ready = true;
  });

  let sent = false;
  async function send() {
    if (sent) return;
    sent = true;
    editor.finishTransform(true);
    game.submit('image', await canvasToBase64(drawing.surface.canvas));
  }

  const files: FileActions = {
    disabled: ['newDoc', 'open', 'save'],
    newDoc() {}, open() {}, save() {},
    async importImage() {},
    async exportImage() {},
  };
</script>

<section class="draw-step" class:full>
  <header>
    <div class="consigne">
      <span class="round">{t('games.round', { r: String(task.round + 1), n: String(st.rounds) })}</span>
      <strong>{t(title)}</strong>
      {#if promptText}<span class="prompt">« {promptText} »</span>{/if}
    </div>
    <Timer deadline={game.deadline} {total} onend={send} />
    <button class="btn" onclick={() => (full = !full)}>{full ? t('games.simpleEditor') : t('games.fullEditor')}</button>
    <button class="btn primary" onclick={send}>{t('games.done')}</button>
  </header>
  {#if mode.id === 'classic' && prev?.kind === 'empty'}<div class="hint"><EntryView entry={prev} /></div>{/if}
  <div class="area">
    {#if ready}
      {#if full}
        <div class="full-wrap"><EditorView {editor} {files} /></div>
      {:else}
        <SimpleEditor {editor} />
      {/if}
    {/if}
  </div>
</section>

<style>
  .draw-step { position: fixed; inset: 0; display: flex; flex-direction: column; gap: 8px; padding: 8px; background: var(--bg); }
  header { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .consigne { flex: 1; min-width: 200px; display: grid; gap: 2px; }
  .round { font-size: 0.8rem; color: var(--ink-soft); font-weight: 700; }
  .prompt { font-size: 1.15rem; font-weight: 700; color: var(--accent); word-break: break-word; }
  header :global(.timer) { width: 180px; }
  .btn { font: inherit; min-height: 42px; padding: 0 16px; border-radius: 12px; border: 2px solid var(--line); background: var(--surface); color: var(--ink); cursor: pointer; }
  .btn.primary { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); font-weight: 700; }
  .area { flex: 1; min-height: 0; position: relative; }
  .full-wrap { position: absolute; inset: 0; border-radius: 12px; overflow: hidden; }
  .hint { max-width: 400px; }
</style>
