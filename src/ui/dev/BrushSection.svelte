<script lang="ts">
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
  import BrushPreview from './BrushPreview.svelte';
  import { BRUSH_SLIDERS } from '../brushParams';

  let { editor, tick, which }: { editor: Editor; tick: number; which: 'brush' | 'eraser' } = $props();

  type Cat = (typeof BRUSH_CATEGORIES)[number] | 'custom';
  const color = $derived((void tick, editor.color));
  const selectedId = $derived(brushPrefs.selected[which]);
  const current = $derived(brushSettings(selectedId));
  let category = $state<Cat>(
    isCustomBrush(brushPrefs.selected.brush) ? 'custom' : (getPreset(brushPrefs.selected.brush)?.category ?? 'pen'),
  );
  const cats = $derived<Cat[]>(which === 'eraser' ? ['eraser', 'custom'] : [...BRUSH_CATEGORIES.filter((c) => c !== 'eraser'), 'custom']);
  const shown = $derived<Cat>(cats.includes(category) ? category : cats[0]);
  const list = $derived(
    shown === 'custom'
      ? Object.entries(brushPrefs.custom).map(([id, c]) => ({ id, name: c.name }))
      : BRUSH_PRESETS.filter((p) => p.category === shown).map((p) => ({ id: p.id, name: t(`brushes.${p.id}` as Key) })),
  );

  const apply = (id: string) => editor.setBrush(brushSettings(id), which);
  function select(id: string) {
    brushPrefs.selected[which] = id;
    apply(id);
  }
  function tweak(patch: Partial<BrushSettings>) {
    setBrushOverride(selectedId, patch);
    apply(selectedId);
  }
  function reset() {
    resetBrush(selectedId);
    apply(selectedId);
  }
  function duplicate() {
    const name = isCustomBrush(selectedId)
      ? brushPrefs.custom[selectedId].name
      : t(`brushes.${selectedId}` as Key);
    const id = createCustomBrush(selectedId, `${name} ${t('brush.copySuffix')}`);
    category = 'custom';
    select(id);
  }
  function remove() {
    deleteCustomBrush(selectedId);
    apply(brushPrefs.selected[which]);
  }

  const pct = (v: number) => Math.round(v * 100);
  const sliders = BRUSH_SLIDERS;
  const tips = Object.keys(TIP_VARIANTS) as TipKind[];
  const modes: BrushMode[] = ['paint', 'erase', 'smudge', 'blur'];
  const angleModes: AngleMode[] = ['fixed', 'direction', 'random'];
</script>

<h3>{t('brush.library')}</h3>
<div class="cats">
  {#each cats as c (c)}
    <button aria-pressed={shown === c} onclick={() => (category = c)}>{c === 'custom' ? t('brush.custom') : t(`brushCat.${c}`)}</button>
  {/each}
</div>
<div class="brushes">
  {#each list as b (b.id)}
    <button class="brush" aria-pressed={selectedId === b.id} onclick={() => select(b.id)}>
      <span>{b.name}</span>
      <BrushPreview settings={brushSettings(b.id)} {color} />
    </button>
  {:else}
    <p class="note">{t('brush.noCustom')}</p>
  {/each}
</div>

<label class="field"><span>{t('brush.size')} <b>{current.size.toFixed(1)}</b></span>
  <input type="range" min="1" max="300" step="0.5" value={current.size} oninput={(e) => tweak({ size: +e.currentTarget.value })} /></label>
<label class="field"><span>{t('brush.opacity')} <b>{pct(current.opacity)}</b></span>
  <input type="range" min="0.01" max="1" step="0.01" value={current.opacity} oninput={(e) => tweak({ opacity: +e.currentTarget.value })} /></label>

<details>
  <summary>{t('brush.advanced')}</summary>
  {#if isCustomBrush(selectedId)}
    <label class="field"><span>{t('brush.name')}</span>
      <input type="text" value={brushPrefs.custom[selectedId].name} oninput={(e) => renameCustomBrush(selectedId, e.currentTarget.value)} /></label>
  {/if}
  <div class="grid2">
    <label class="field"><span>{t('brush.tip')}</span>
      <select value={current.tip} onchange={(e) => tweak({ tip: e.currentTarget.value as TipKind })}>
        {#each tips as k (k)}<option value={k}>{t(`tip.${k}`)}</option>{/each}
      </select></label>
    <label class="field"><span>{t('brush.mode')}</span>
      <select value={current.mode} onchange={(e) => tweak({ mode: e.currentTarget.value as BrushMode })}>
        {#each modes as m (m)}<option value={m}>{t(`mode.${m}`)}</option>{/each}
      </select></label>
  </div>
  <label class="field"><span>{t('brush.angleMode')}</span>
    <select value={current.angleMode} onchange={(e) => tweak({ angleMode: e.currentTarget.value as AngleMode })}>
      {#each angleModes as m (m)}<option value={m}>{t(`angleMode.${m}`)}</option>{/each}
    </select></label>
  {#each sliders.filter((sl) => !sl.when || sl.when(current)) as sl (sl.key)}
    {@const v = current[sl.key] as number}
    <label class="field"><span>{t(sl.label)} <b>{sl.pct ? pct(v) : v}</b></span>
      <input type="range" min={sl.min} max={sl.max} step={sl.step} value={v}
        oninput={(e) => tweak({ [sl.key]: +e.currentTarget.value } as Partial<BrushSettings>)} /></label>
  {/each}
  <label class="check"><input type="checkbox" checked={current.pressureSize} onchange={(e) => tweak({ pressureSize: e.currentTarget.checked })} /> {t('brush.pressureSize')}</label>
  <label class="check"><input type="checkbox" checked={current.pressureOpacity} onchange={(e) => tweak({ pressureOpacity: e.currentTarget.checked })} /> {t('brush.pressureOpacity')}</label>
</details>
<button class="full" onclick={reset}>{t('brush.reset')}</button>
<div class="row">
  <button class="full" onclick={duplicate}>{t('brush.newCustom')}</button>
  {#if isCustomBrush(selectedId)}
    <button class="full" onclick={remove}>{t('brush.delete')}</button>
  {/if}
</div>

<style>
  .cats { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; }
  .cats button { min-height: 32px; font-size: 0.8rem; padding: 0 8px; }
  .brushes { display: grid; gap: 4px; max-height: 300px; overflow-y: auto; margin-bottom: 8px; }
  .brush { display: grid; justify-items: start; padding: 4px 8px; background: #fff; color: #1f2430; font-size: 0.85rem; }
</style>
