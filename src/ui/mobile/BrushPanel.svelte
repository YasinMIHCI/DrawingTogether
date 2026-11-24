<script lang="ts">
  import { untrack } from 'svelte';
  import type { Editor } from '../../engine/editor';
  import { BRUSH_CATEGORIES, BRUSH_PRESETS, getPreset } from '../../engine/brush/presets';
  import type { AngleMode, BrushMode, BrushSettings, TipKind } from '../../engine/brush/settings';
  import { TIP_VARIANTS } from '../../engine/brush/tips';
  import {
    brushPrefs, brushSettings, createCustomBrush, deleteCustomBrush, isCustomBrush,
    renameCustomBrush, resetBrush, setBrushOverride,
  } from '../../lib/brushPrefs.svelte';
  import { t } from '../../lib/i18n/t.svelte';
  import type { Key } from '../../lib/i18n/i18n.svelte';
  import { BRUSH_SLIDERS } from '../brushParams';
  import BrushPreview from '../common/BrushPreview.svelte';
  import Icon from '../common/Icon.svelte';
  import type { IconName } from '../common/icons';
  import MSlider from './MSlider.svelte';
  import { formatSize, posToSize, sizeToPos } from './sliders';

  let { editor, tick, which }: { editor: Editor; tick: number; which: 'brush' | 'eraser' } = $props();

  type Cat = (typeof BRUSH_CATEGORIES)[number] | 'custom';
  const catIcons: Record<Cat, IconName> = {
    pen: 'nib', sketch: 'pencil', paint: 'brush', spray: 'spray', blend: 'drops', decoration: 'effect', eraser: 'eraser', custom: 'star',
  };
  const color = $derived((void tick, editor.color));
  const selectedId = $derived(brushPrefs.selected[which]);
  const current = $derived(brushSettings(selectedId));
  const initialCat = (id: string): Cat => (isCustomBrush(id) ? 'custom' : (getPreset(id)?.category ?? 'pen'));
  let category = $state<Cat>(untrack(() => initialCat(brushPrefs.selected[which])));
  let settingsOpen = $state(false);
  let menuOpen = $state(false);
  const cats: Cat[] = [...BRUSH_CATEGORIES, 'custom'];
  const list = $derived(
    category === 'custom'
      ? Object.entries(brushPrefs.custom).map(([id, c]) => ({ id, name: c.name }))
      : BRUSH_PRESETS.filter((p) => p.category === category).map((p) => ({ id: p.id, name: t(`brushes.${p.id}` as Key) })),
  );
  const nameOf = (id: string) => (isCustomBrush(id) ? brushPrefs.custom[id].name : t(`brushes.${id}` as Key));

  const apply = (id: string) => editor.setBrush(brushSettings(id), which);
  function select(id: string) {
    if (selectedId === id) {
      settingsOpen = true;
      return;
    }
    brushPrefs.selected[which] = id;
    apply(id);
  }
  function tweak(patch: Partial<BrushSettings>) {
    setBrushOverride(selectedId, patch);
    apply(selectedId);
  }
  function duplicate() {
    const id = createCustomBrush(selectedId, `${nameOf(selectedId)} ${t('brush.copySuffix')}`);
    category = 'custom';
    menuOpen = false;
    brushPrefs.selected[which] = id;
    apply(id);
  }
  function remove() {
    deleteCustomBrush(selectedId);
    menuOpen = false;
    settingsOpen = false;
    apply(brushPrefs.selected[which]);
  }
  function reset() {
    resetBrush(selectedId);
    apply(selectedId);
    menuOpen = false;
  }
  const pct = (v: number) => Math.round(v * 100);
  const tips = Object.keys(TIP_VARIANTS) as TipKind[];
  const modes: BrushMode[] = ['paint', 'erase', 'smudge', 'blur'];
  const angleModes: AngleMode[] = ['fixed', 'direction', 'random'];
</script>

{#if settingsOpen}
  <div class="settings">
    <header>
      <button class="m-icon-btn" onclick={() => (settingsOpen = false)} aria-label={t('nav.back')}><Icon name="back" /></button>
      {#if isCustomBrush(selectedId)}
        <input type="text" value={nameOf(selectedId)} aria-label={t('brush.name')} oninput={(e) => renameCustomBrush(selectedId, e.currentTarget.value)} />
      {:else}
        <span class="m-title">{nameOf(selectedId)}</span>
      {/if}
    </header>
    <div class="preview"><BrushPreview settings={current} {color} /></div>
    <div class="body">
      <p class="lbl">{t('m.brushSize')}</p>
      <MSlider label={t('m.brushSize')} value={current.size} min={1} max={300} toPos={sizeToPos} fromPos={posToSize} format={formatSize} onchange={(v) => tweak({ size: v })} />
      <p class="lbl">{t('m.brushOpacity')}</p>
      <MSlider label={t('m.brushOpacity')} value={current.opacity * 100} min={1} max={100} onchange={(v) => tweak({ opacity: v / 100 })} />
      <button class="m-pill-btn wide" onclick={reset}>{t('brush.reset')}</button>
      <details>
        <summary>{t('brush.advanced')}</summary>
        <div class="selects">
          <label>{t('brush.tip')}
            <select value={current.tip} onchange={(e) => tweak({ tip: e.currentTarget.value as TipKind })}>
              {#each tips as k (k)}<option value={k}>{t(`tip.${k}`)}</option>{/each}
            </select></label>
          <label>{t('brush.mode')}
            <select value={current.mode} onchange={(e) => tweak({ mode: e.currentTarget.value as BrushMode })}>
              {#each modes as m (m)}<option value={m}>{t(`mode.${m}`)}</option>{/each}
            </select></label>
          <label>{t('brush.angleMode')}
            <select value={current.angleMode} onchange={(e) => tweak({ angleMode: e.currentTarget.value as AngleMode })}>
              {#each angleModes as m (m)}<option value={m}>{t(`angleMode.${m}`)}</option>{/each}
            </select></label>
        </div>
        {#each BRUSH_SLIDERS.filter((sl) => !sl.when || sl.when(current)) as sl (sl.key)}
          {@const v = current[sl.key] as number}
          <p class="lbl">{t(sl.label)}</p>
          <MSlider label={t(sl.label)} value={sl.pct ? v * 100 : v} min={sl.pct ? sl.min * 100 : sl.min} max={sl.pct ? sl.max * 100 : sl.max}
            format={(x) => (sl.step < 1 && !sl.pct ? x.toFixed(1) : String(Math.round(x)))}
            onchange={(x) => tweak({ [sl.key]: sl.pct ? x / 100 : sl.step >= 1 ? Math.round(x) : x } as Partial<BrushSettings>)} />
        {/each}
        <label class="check"><input type="checkbox" checked={current.pressureSize} onchange={(e) => tweak({ pressureSize: e.currentTarget.checked })} /> {t('brush.pressureSize')}</label>
        <label class="check"><input type="checkbox" checked={current.pressureOpacity} onchange={(e) => tweak({ pressureOpacity: e.currentTarget.checked })} /> {t('brush.pressureOpacity')}</label>
      </details>
    </div>
  </div>
{:else}
  <div class="lib">
    <div class="top">
      <button class="m-icon-btn" onclick={duplicate} aria-label={t('brush.newCustom')} title={t('brush.newCustom')}><Icon name="plus" size={28} /></button>
      <button class="m-icon-btn" onclick={() => (menuOpen = !menuOpen)} aria-label={t('m.brushMenu')} aria-expanded={menuOpen}><Icon name="more" /></button>
      {#if menuOpen}
        <div class="menu">
          <button onclick={duplicate}>{t('brush.newCustom')}</button>
          <button onclick={reset}>{t('brush.reset')}</button>
          {#if isCustomBrush(selectedId)}<button onclick={remove}>{t('brush.delete')}</button>{/if}
        </div>
      {/if}
    </div>
    <nav class="cats">
      {#each cats as c (c)}
        <button class:active={category === c} onclick={() => (category = c)}>
          <Icon name={catIcons[c]} size={28} />
          <span>{c === 'custom' ? t('brush.custom') : t(`brushCat.${c}`)}</span>
        </button>
      {/each}
    </nav>
    <div class="list">
      {#each list as b (b.id)}
        <div class="card" class:selected={selectedId === b.id}>
          <button class="pick" onclick={() => select(b.id)}>
            <span>{b.name}</span>
            <BrushPreview settings={brushSettings(b.id)} {color} />
          </button>
          {#if selectedId === b.id}
            <button class="go" onclick={() => (settingsOpen = true)} aria-label={t('m.settings')}><Icon name="chevronRight" size={20} /></button>
          {/if}
        </div>
      {:else}
        <p class="m-hint">{t('brush.noCustom')}</p>
      {/each}
    </div>
  </div>
{/if}

<style>
  .lib { display: grid; grid-template-columns: 96px 1fr; grid-template-rows: auto 1fr; height: min(62vh, 560px); }
  .top { grid-column: 1 / 3; display: flex; justify-content: flex-end; gap: 4px; padding: 4px 8px 0; position: relative; }
  .menu { position: absolute; right: 12px; top: 52px; z-index: 2; background: var(--m-card); border-radius: 12px; box-shadow: var(--m-shadow); display: grid; min-width: 220px; overflow: hidden; }
  .menu button { padding: 14px 16px; text-align: left; border-bottom: 1px solid var(--m-line); }
  .cats { overflow-y: auto; display: grid; align-content: start; gap: 6px; padding: 4px 0 8px; }
  .cats button { display: grid; justify-items: center; gap: 4px; padding: 8px 2px; color: var(--m-ink); }
  .cats span { font-size: 0.75rem; text-align: center; line-height: 1.15; color: var(--m-text); }
  .cats .active, .cats .active span { color: var(--m-accent); }
  .list { overflow-y: auto; padding: 4px 12px 12px 4px; display: grid; align-content: start; gap: 10px; }
  .card { position: relative; background: #fff; border-radius: 14px; border: 2px solid transparent; }
  .card.selected { border-color: var(--m-accent); }
  .pick { width: 100%; display: grid; justify-items: start; gap: 2px; padding: 10px 14px 6px; color: #2c2d31; font-size: 0.95rem; }
  .go { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 32px; height: 32px; border-radius: 50%; background: #a9abb1; color: #fff; display: grid; place-items: center; }
  .settings { height: min(62vh, 560px); display: grid; grid-template-rows: auto auto 1fr; }
  .settings header { display: flex; align-items: center; gap: 8px; padding: 4px 8px; }
  .settings header input { flex: 1; }
  .preview { background: #fff; padding: 4px 12px; }
  .body { overflow-y: auto; padding: 8px 18px 16px; }
  .lbl { margin: 10px 0 0; font-size: 0.95rem; }
  .wide { width: 100%; margin-top: 16px; }
  details { margin-top: 14px; }
  summary { color: var(--m-soft); padding: 8px 0; cursor: pointer; }
  .selects { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .selects label { display: grid; gap: 4px; font-size: 0.85rem; color: var(--m-soft); }
  .check { display: flex; gap: 10px; align-items: center; margin-top: 12px; }
</style>
