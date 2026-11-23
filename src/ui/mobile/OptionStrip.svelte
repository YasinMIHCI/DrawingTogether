<script lang="ts">
  import type { Editor, SelectOptions } from '../../engine/editor';
  import type { SelectMode } from '../../engine/selection';
  import type { ShapeKind } from '../../engine/tools/shapes';
  import type { LiquifyMode } from '../../engine/tools/liquify';
  import { TEXT_FONTS } from '../../engine/tools/text';
  import { brushPrefs, brushSettings, setBrushOverride } from '../../lib/brushPrefs.svelte';
  import { t } from '../../lib/i18n/t.svelte';
  import Icon from './Icon.svelte';
  import MSlider from './MSlider.svelte';
  import { CHECKER, formatSize, posToSize, sizeToPos } from './sliders';

  /** Réglages rapides de l'outil actif, au-dessus de la barre du bas. */
  let { editor, tick }: { editor: Editor; tick: number } = $props();

  const s = $derived.by(() => {
    void tick;
    return {
      tool: editor.tool,
      color: editor.color,
      fill: { ...editor.fill },
      shape: { ...editor.shape },
      text: { ...editor.text },
      sel: { ...editor.selectOpts },
      liq: { ...editor.liquifyOpts },
      hasSelection: editor.selection.active,
      hasClipboard: editor.hasClipboard,
      transforming: editor.transform.active,
      proportional: editor.transform.proportional,
    };
  });
  const which = $derived<'brush' | 'eraser'>(s.tool === 'eraser' ? 'eraser' : 'brush');
  const id = $derived(brushPrefs.selected[which]);
  const b = $derived((void tick, brushSettings(id)));
  function tweak(patch: { size?: number; opacity?: number }) {
    setBrushOverride(id, patch);
    editor.setBrush(brushSettings(id), which);
  }
  const shapes: ShapeKind[] = ['line', 'rect', 'ellipse', 'polygon'];
  const selKinds: SelectOptions['kind'][] = ['rect', 'ellipse', 'lasso', 'wand'];
  const selModes: SelectMode[] = ['replace', 'add', 'subtract', 'intersect'];
  const liqModes: LiquifyMode[] = ['push', 'twirlRight', 'twirlLeft', 'pinch', 'expand'];
</script>

<div class="strip">
  {#if s.tool === 'brush' || s.tool === 'eraser'}
    <MSlider label={t('m.brushSize')} value={b.size} min={1} max={300} toPos={sizeToPos} fromPos={posToSize} format={formatSize} onchange={(v) => tweak({ size: v })} />
    <MSlider label={t('m.brushOpacity')} value={b.opacity * 100} min={1} max={100} onchange={(v) => tweak({ opacity: v / 100 })}
      track="linear-gradient(to right, transparent, {s.tool === 'eraser' ? '#888' : s.color}), {CHECKER}" />
  {:else if s.tool === 'fill'}
    <p class="lbl">{t('fill.tolerance')}</p>
    <MSlider label={t('fill.tolerance')} value={s.fill.tolerance} min={0} max={255} onchange={(v) => editor.configure('fill', { tolerance: Math.round(v) })} />
    <div class="m-seg">
      <button aria-pressed={s.fill.source === 'layer'} onclick={() => editor.configure('fill', { source: 'layer' })}>{t('fill.sourceLayer')}</button>
      <button aria-pressed={s.fill.source === 'canvas'} onclick={() => editor.configure('fill', { source: 'canvas' })}>{t('fill.sourceCanvas')}</button>
      <button aria-pressed={s.fill.expand > 0} onclick={() => editor.configure('fill', { expand: s.fill.expand > 0 ? 0 : 1 })}>{t('fill.expand')}</button>
    </div>
  {:else if s.tool === 'eyedropper'}
    <p class="m-hint">{t('m.eyedropperHint')}</p>
  {:else if s.tool === 'shape'}
    <div class="m-seg">
      {#each shapes as k (k)}
        <button aria-pressed={s.shape.kind === k} onclick={() => editor.configure('shape', { kind: k })}>{t(`shape.${k}`)}</button>
      {/each}
      <button aria-pressed={s.shape.fill} onclick={() => editor.configure('shape', { fill: !s.shape.fill })}>{t('shape.fill')}</button>
    </div>
    <MSlider label={t('shape.width')} value={s.shape.width} min={1} max={100} onchange={(v) => editor.configure('shape', { width: Math.round(v) })} />
    {#if s.shape.kind === 'polygon'}
      <div class="m-row"><p class="m-hint grow">{t('shape.polygonHint')}</p>
        <button class="m-pill-btn primary" onclick={() => editor.finishPolygon(true)}>{t('shape.polygonDone')}</button></div>
    {/if}
  {:else if s.tool === 'text'}
    <p class="m-hint">{t('text.hint')}</p>
    <div class="m-row">
      <select value={s.text.font} onchange={(e) => editor.configure('text', { font: e.currentTarget.value })} aria-label={t('text.font')}>
        {#each TEXT_FONTS as f (f)}<option value={f}>{f}</option>{/each}
      </select>
      <div class="m-seg">
        <button aria-pressed={s.text.bold} onclick={() => editor.configure('text', { bold: !s.text.bold })}><b>B</b></button>
        <button aria-pressed={s.text.italic} onclick={() => editor.configure('text', { italic: !s.text.italic })}><i>I</i></button>
      </div>
    </div>
    <MSlider label={t('text.size')} value={s.text.size} min={8} max={400} onchange={(v) => editor.configure('text', { size: Math.round(v) })} />
  {:else if s.tool === 'select'}
    <div class="m-seg">
      {#each selKinds as k (k)}
        <button aria-pressed={s.sel.kind === k} onclick={() => editor.configure('selectOpts', { kind: k })}>{t(`select.${k}`)}</button>
      {/each}
      <select value={s.sel.mode} onchange={(e) => editor.configure('selectOpts', { mode: e.currentTarget.value as SelectMode })} aria-label={t('select.mode')}>
        {#each selModes as m (m)}<option value={m}>{t(`select.${m}`)}</option>{/each}
      </select>
    </div>
    {#if s.sel.kind === 'wand'}
      <MSlider label={t('fill.tolerance')} value={s.sel.tolerance} min={0} max={255} onchange={(v) => editor.configure('selectOpts', { tolerance: Math.round(v) })} />
    {/if}
    <div class="m-seg scroll">
      <button onclick={() => editor.selectAll()}>{t('select.all')}</button>
      <button onclick={() => editor.deselect()} disabled={!s.hasSelection}>{t('select.none')}</button>
      <button onclick={() => editor.invertSelection()}>{t('select.invert')}</button>
      <button onclick={() => editor.copy()}>{t('select.copy')}</button>
      <button onclick={() => editor.cut()}>{t('select.cut')}</button>
      <button onclick={() => editor.paste()} disabled={!s.hasClipboard}>{t('select.paste')}</button>
      <button onclick={() => editor.deleteSelection()}>{t('select.delete')}</button>
    </div>
  {:else if s.tool === 'transform'}
    <div class="m-row icons">
      <button class="m-icon-btn" onclick={() => (editor.transform.flip(true), editor.notify())} disabled={!s.transforming} aria-label={t('transform.flipH')}><Icon name="flipH" /></button>
      <button class="m-icon-btn" onclick={() => (editor.transform.flip(false), editor.notify())} disabled={!s.transforming} aria-label={t('transform.flipV')}><Icon name="flipV" /></button>
      <button class="m-icon-btn" onclick={() => (editor.transform.rotate90(-1), editor.notify())} disabled={!s.transforming} aria-label={t('transform.rotateLeft')}><Icon name="rotateLeft" /></button>
      <button class="m-icon-btn" onclick={() => (editor.transform.rotate90(1), editor.notify())} disabled={!s.transforming} aria-label={t('transform.rotateRight')}><Icon name="rotateRight" /></button>
      <span class="grow"></span>
      <button class="m-pill-btn" onclick={() => editor.finishTransform(false)} disabled={!s.transforming}>{t('transform.cancel')}</button>
      <button class="m-pill-btn primary" onclick={() => editor.finishTransform(true)} disabled={!s.transforming}><Icon name="check" size={18} />{t('transform.apply')}</button>
    </div>
    <label class="check"><input type="checkbox" checked={s.proportional}
      onchange={(e) => ((editor.transform.proportional = e.currentTarget.checked), editor.notify())} /> {t('transform.proportional')}</label>
  {:else if s.tool === 'liquify'}
    <div class="m-seg">
      {#each liqModes as m (m)}
        <button aria-pressed={s.liq.mode === m} onclick={() => editor.configure('liquifyOpts', { mode: m })}>{t(`liquify.${m}`)}</button>
      {/each}
    </div>
    <MSlider label={t('liquify.size')} value={s.liq.size} min={10} max={400} onchange={(v) => editor.configure('liquifyOpts', { size: Math.round(v) })} />
    <MSlider label={t('liquify.strength')} value={s.liq.strength * 100} min={5} max={100} onchange={(v) => editor.configure('liquifyOpts', { strength: v / 100 })} />
  {/if}
</div>

<style>
  .strip { display: grid; gap: 4px; padding: 8px 14px; border-radius: 18px; background: var(--m-float); box-shadow: var(--m-shadow); backdrop-filter: blur(6px); }
  .lbl { margin: 0; font-size: 0.85rem; color: var(--m-soft); }
  .grow { flex: 1; }
  .scroll { flex-wrap: nowrap; overflow-x: auto; padding-bottom: 2px; }
  .scroll button { flex: none; }
  .icons { gap: 2px; flex-wrap: wrap; }
  .check { display: flex; gap: 8px; align-items: center; font-size: 0.9rem; }
</style>
