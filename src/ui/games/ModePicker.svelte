<script lang="ts">
  import type { Game } from '../../games/game';
  import { getMode, MODES, roundsFor, stepTime } from '../../games/modes';
  import { t } from '../../lib/i18n/t.svelte';
  import ModeIcon from './ModeIcon.svelte';

  /** Choix du mode (onglet Modes) et réglages (onglet Personnalisations). Seul l'hôte peut modifier. */
  let { game, tick, players }: { game: Game; tick: number; players: number } = $props();
  let tab = $state<'presets' | 'custom'>('presets');
  const cfg = $derived((void tick, game.config));
  const host = $derived((void tick, game.room.isHost));
  const mode = $derived(getMode(cfg.mode));
  const times = [0, 15, 30, 45, 60, 90, 120, 180, 300];
  const fmt = (n: number) => (n === 0 ? t('games.unlimited') : t('games.seconds', { n: String(n) }));
</script>

<section class="card picker">
  <div class="tabs" role="tablist">
    <button role="tab" aria-selected={tab === 'presets'} onclick={() => (tab = 'presets')}>{t('games.presets')}</button>
    <button role="tab" aria-selected={tab === 'custom'} onclick={() => (tab = 'custom')}>{t('games.custom')}</button>
  </div>

  {#if tab === 'presets'}
    <div class="modes">
      {#each MODES as m (m.id)}
        <button class="mode" aria-pressed={cfg.mode === m.id} disabled={!host && cfg.mode !== m.id} onclick={() => game.setConfig({ mode: m.id })}>
          <ModeIcon mode={m.icon} size={56} />
          <span class="txt"><strong>{t(m.name)}</strong><span>{t(m.desc)}</span></span>
        </button>
      {/each}
    </div>
  {:else}
    <div class="custom">
      <label>
        <span>{t('games.rounds')}</span>
        <select value={cfg.rounds} disabled={!host} onchange={(e) => game.setConfig({ rounds: +e.currentTarget.value })}>
          <option value={0}>{t('games.auto')} ({roundsFor({ ...cfg, rounds: 0 }, players)})</option>
          {#each Array.from({ length: 12 }, (_, i) => i + 1) as n (n)}<option value={n}>{n}</option>{/each}
        </select>
      </label>
      {#each [['writeTime', 'games.writeTime', 'write'], ['drawTime', 'games.drawTime', 'draw']] as const as [k, label, kind] (k)}
        <label>
          <span>{t(label)}</span>
          <select value={cfg[k] === null ? 'mode' : String(cfg[k])} disabled={!host}
            onchange={(e) => game.setConfig({ [k]: e.currentTarget.value === 'mode' ? null : +e.currentTarget.value })}>
            <option value="mode">{t('games.modeTime')} ({fmt(stepTime({ ...cfg, [k]: null }, kind))})</option>
            {#each times as n (n)}<option value={String(n)}>{fmt(n)}</option>{/each}
          </select>
        </label>
      {/each}
      <label>
        <span>{t('games.editor')}</span>
        <select value={cfg.editor} disabled={!host} onchange={(e) => game.setConfig({ editor: e.currentTarget.value as 'simple' | 'full' })}>
          <option value="simple">{t('games.editor.simple')}</option>
          <option value="full">{t('games.editor.full')}</option>
        </select>
      </label>
    </div>
  {/if}
  {#if !host}<p class="muted">{t('games.waitHost')} — <strong>{t(mode.name)}</strong></p>{/if}
  {#if players < 2}<p class="muted">{t('games.solo')}</p>{/if}
</section>

<style>
  .card { background: var(--surface); border: 2px solid var(--line); border-radius: var(--radius); padding: 16px; box-shadow: var(--shadow); display: grid; gap: 12px; }
  .tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .tabs button { font: inherit; font-weight: 700; padding: 10px; border-radius: 12px; border: 2px solid var(--line); background: var(--surface-2); color: var(--ink-soft); cursor: pointer; }
  .tabs [aria-selected='true'] { background: var(--teal); border-color: var(--teal); color: #fff; }
  .modes { display: grid; gap: 8px; max-height: 420px; overflow-y: auto; padding-right: 4px; }
  .mode { display: flex; gap: 14px; align-items: center; text-align: left; font: inherit; color: inherit; padding: 10px 12px; border-radius: 14px; border: 2px solid var(--line); background: var(--surface-2); cursor: pointer; }
  .mode[aria-pressed='true'] { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent) inset; background: var(--surface); }
  .mode:disabled { opacity: 0.45; cursor: default; }
  .mode :global(svg) { flex: none; }
  .txt { display: grid; gap: 2px; }
  .txt span { color: var(--ink-soft); font-size: 0.9rem; }
  .custom { display: grid; gap: 10px; }
  .custom label { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; }
  select { font: inherit; color: var(--ink); background: var(--surface-2); border: 2px solid var(--line); border-radius: 10px; padding: 6px 8px; }
  .muted { margin: 0; color: var(--ink-soft); font-size: 0.9rem; }
</style>
