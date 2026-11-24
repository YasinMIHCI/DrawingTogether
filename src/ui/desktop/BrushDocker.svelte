<script lang="ts">
  import { untrack } from 'svelte';
  import type { Editor } from '../../engine/editor';
  import { BRUSH_CATEGORIES, BRUSH_PRESETS, getPreset } from '../../engine/brush/presets';
  import type { AngleMode, BrushMode, BrushSettings, TipKind } from '../../engine/brush/settings';
  import { TIP_VARIANTS } from '../../engine/brush/tips';
  import {
    brushPrefs, brushSettings, createCustomBrush, deleteCustomBrush, isCustomBrush, renameCustomBrush, resetBrush,
  } from '../../lib/brushPrefs.svelte';
  import { t } from '../../lib/i18n/t.svelte';
  import type { Key } from '../../lib/i18n/i18n.svelte';
  import Icon from '../common/Icon.svelte';
  import BrushPreview from '../common/BrushPreview.svelte';
  import { BRUSH_SLIDERS } from '../brushParams';
  import { selectBrush, tweakActiveBrush } from '../brushActions';
  import DSlider from './DSlider.svelte';

  let { editor, tick }: { editor: Editor; tick: number } = $props();
  type Cat = (typeof BRUSH_CATEGORIES)[number] | 'custom';
  const which = $derived<'brush' | 'eraser'>((void tick, editor.tool === 'eraser' ? 'eraser' : 'brush'));
  const color = $derived((void tick, editor.color));
  const selectedId = $derived(brushPrefs.selected[which]);
  const current = $derived((void tick, brushSettings(selectedId)));
  let category = $state<Cat>(untrack(() => (isCustomBrush(brushPrefs.selected.brush) ? 'custom' : (getPreset(brushPrefs.selected.brush)?.category ?? 'pen'))));
  const list = $derived(
    category === 'custom'
      ? Object.entries(brushPrefs.custom).map(([id, c]) => ({ id, name: c.name }))
      : BRUSH_PRESETS.filter((p) => p.category === category).map((p) => ({ id: p.id, name: t(`brushes.${p.id}` as Key) })),
  );
  const nameOf = (id: string) => (isCustomBrush(id) ? brushPrefs.custom[id].name : t(`brushes.${id}` as Key));
  const tweak = (p: Partial<BrushSettings>) => tweakActiveBrush(editor, p);
  function duplicate() {
    const id = createCustomBrush(selectedId, `${nameOf(selectedId)} ${t('brush.copySuffix')}`);
    category = 'custom';
    selectBrush(editor, which, id);
  }
  const pct = (v: number) => Math.round(v * 100);
  const tips = Object.keys(TIP_VARIANTS) as TipKind[];
  const modes: BrushMode[] = ['paint', 'erase', 'smudge', 'blur'];
  const angleModes: AngleMode[] = ['fixed', 'direction', 'random'];
</script>

<div class="bd">
  <div class="row">
    <select bind:value={category} aria-label={t('d.category')}>
      {#each BRUSH_CATEGORIES as c (c)}<option value={c}>{t(`brushCat.${c}`)}</option>{/each}
      <option value="custom">{t('brush.custom')}</option>
    </select>
    <button class="d-ibtn" onclick={duplicate} title={t('brush.newCustom')} aria-label={t('brush.newCustom')}><Icon name="plus" size={16} /></button>
    <button class="d-ibtn" onclick={() => { resetBrush(selectedId); selectBrush(editor, which, selectedId); }} title={t('brush.reset')} aria-label={t('brush.reset')}><Icon name="rotateLeft" size={16} /></button>
    {#if isCustomBrush(selectedId)}
      <button class="d-ibtn" onclick={() => { deleteCustomBrush(selectedId); selectBrush(editor, which, brushPrefs.selected[which]); }} title={t('brush.delete')} aria-label={t('brush.delete')}><Icon name="trash" size={16} /></button>
    {/if}
  </div>
  <div class="grid">
    {#each list as b (b.id)}
      <button class="tile" aria-pressed={selectedId === b.id} onclick={() => selectBrush(editor, which, b.id)} title={b.name}>
        <span>{b.name}</span>
        <BrushPreview settings={brushSettings(b.id)} {color} height={30} />
      </button>
    {:else}
      <p class="d-label">{t('brush.noCustom')}</p>
    {/each}
  </div>
  <details>
    <summary>{t('brush.advanced')} — {nameOf(selectedId)}</summary>
    {#if isCustomBrush(selectedId)}
      <label class="row"><span class="d-label">{t('brush.name')}</span>
        <input type="text" value={nameOf(selectedId)} oninput={(e) => renameCustomBrush(selectedId, e.currentTarget.value)} /></label>
    {/if}
    <div class="row">
      <select value={current.tip} onchange={(e) => tweak({ tip: e.currentTarget.value as TipKind })} aria-label={t('brush.tip')}>
        {#each tips as k (k)}<option value={k}>{t('brush.tip')} : {t(`tip.${k}`)}</option>{/each}
      </select>
      <select value={current.mode} onchange={(e) => tweak({ mode: e.currentTarget.value as BrushMode })} aria-label={t('brush.mode')}>
        {#each modes as m (m)}<option value={m}>{t(`mode.${m}`)}</option>{/each}
      </select>
    </div>
    <select value={current.angleMode} onchange={(e) => tweak({ angleMode: e.currentTarget.value as AngleMode })} aria-label={t('brush.angleMode')}>
      {#each angleModes as m (m)}<option value={m}>{t('brush.angleMode')} : {t(`angleMode.${m}`)}</option>{/each}
    </select>
    {#each BRUSH_SLIDERS.filter((sl) => !sl.when || sl.when(current)) as sl (sl.key)}
      {@const v = current[sl.key] as number}
      <DSlider label={t(sl.label)} value={sl.pct ? pct(v) : v} min={sl.pct ? sl.min * 100 : sl.min} max={sl.pct ? sl.max * 100 : sl.max}
        step={sl.pct ? 1 : sl.step} width={90}
        onchange={(x) => tweak({ [sl.key]: sl.pct ? x / 100 : x } as Partial<BrushSettings>)} />
    {/each}
    <label class="row"><input type="checkbox" checked={current.pressureOpacity} onchange={(e) => tweak({ pressureOpacity: e.currentTarget.checked })} /> {t('brush.pressureOpacity')}</label>
  </details>
</div>

<style>
  .bd { padding: 6px; display: grid; gap: 6px; }
  .row { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
  .row select { flex: 1; min-width: 0; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 4px; }
  .tile { display: grid; justify-items: start; padding: 3px 6px; border-radius: 4px; background: #fff; color: #222; border: 1px solid var(--d-line); font-size: 12px; overflow: hidden; }
  .tile span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .tile[aria-pressed='true'] { border-color: var(--d-accent); box-shadow: 0 0 0 1px var(--d-accent); }
  details { display: grid; gap: 4px; }
  summary { cursor: pointer; color: var(--d-soft); padding: 2px 0; }
  details[open] { display: grid; gap: 4px; }
</style>
