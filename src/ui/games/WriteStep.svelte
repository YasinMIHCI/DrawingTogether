<script lang="ts">
  import type { Game, Task } from '../../games/game';
  import { getMode } from '../../games/modes';
  import { t } from '../../lib/i18n/t.svelte';
  import type { Key } from '../../lib/i18n/i18n.svelte';
  import EntryView from './EntryView.svelte';
  import Timer from './Timer.svelte';

  let { game, task, total }: { game: Game; task: Task; total: number } = $props();
  let text = $state('');
  const mode = $derived(getMode(game.state!.config.mode));
  const prev = $derived(task.history[task.history.length - 1]);
  const title = $derived<Key>(
    mode.id === 'story' ? (task.round === 0 ? 'games.write.story.first' : 'games.write.story.next')
      : mode.id === 'relay' ? 'games.write.relay'
      : prev ? 'games.write.describe' : 'games.write.first',
  );
  const max = $derived(mode.id === 'story' ? 300 : 140);
  let sent = false;
  function send() {
    if (sent) return;
    sent = true;
    const v = text.trim();
    game.submit(v ? 'text' : 'empty', v);
  }
</script>

<section class="step">
  <header>
    <span class="round">{t('games.round', { r: String(task.round + 1), n: String(game.state!.rounds) })}</span>
    <Timer deadline={game.deadline} {total} onend={send} />
  </header>
  <h2>{t(title)}</h2>
  {#if prev && prev.kind !== 'empty' || (prev && mode.id === 'story')}<div class="ctx"><EntryView entry={prev} /></div>{/if}
  <form onsubmit={(e) => { e.preventDefault(); send(); }}>
    <!-- svelte-ignore a11y_autofocus -->
    <textarea bind:value={text} maxlength={max} rows={mode.id === 'story' ? 4 : 2} placeholder={t('games.placeholder')} autofocus
      onkeydown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}></textarea>
    <div class="row"><span class="muted">{text.length} / {max}</span><button class="btn primary" disabled={!text.trim()}>{t('games.done')}</button></div>
  </form>
</section>

<style>
  .step { display: grid; gap: 14px; max-width: 640px; margin: 0 auto; width: 100%; }
  header { display: flex; align-items: center; gap: 14px; justify-content: space-between; }
  .round { font-weight: 700; color: var(--ink-soft); }
  header :global(.timer) { flex: 1; max-width: 320px; }
  h2 { margin: 0; font-size: 1.4rem; }
  textarea { width: 100%; font: inherit; font-size: 1.15rem; color: var(--ink); padding: 12px 14px; border: 2px solid var(--line); border-radius: 14px; background: var(--surface); resize: vertical; }
  form { display: grid; gap: 8px; }
  .row { display: flex; justify-content: space-between; align-items: center; }
  .muted { color: var(--ink-soft); font-size: 0.85rem; }
  .btn { font: inherit; min-height: 46px; padding: 0 22px; border-radius: 12px; border: 2px solid var(--line); cursor: pointer; }
  .btn.primary { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); font-weight: 700; }
  .btn:disabled { opacity: 0.45; cursor: default; }
</style>
