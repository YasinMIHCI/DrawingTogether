<script lang="ts">
  import type { Editor, SelectOptions } from '../../engine/editor';
  import type { SelectMode } from '../../engine/selection';
  import type { ShapeKind } from '../../engine/tools/shapes';
  import type { LiquifyMode } from '../../engine/tools/liquify';
  import { TEXT_FONTS } from '../../engine/tools/text';
  import { brushPrefs, brushSettings, isCustomBrush } from '../../lib/brushPrefs.svelte';
  import { t } from '../../lib/i18n/t.svelte';
  import type { Key } from '../../lib/i18n/i18n.svelte';
  import Icon from '../common/Icon.svelte';
  import { tweakActiveBrush } from '../brushActions';
  import DSlider from './DSlider.svelte';

  /** Options de l'outil actif, en ligne. `brushes` : afficher les réglages du pinceau (Krita). */
  let { editor, tick, brushes = true }: { editor: Editor; tick: number; brushes?: boolean } = $props();

  const s = $derived.by(() => {
    void tick;
    return {
      tool: editor.tool,
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
  const brushName = $derived(isCustomBrush(id) ? brushPrefs.custom[id].name : t(`brushes.${id}` as Key));
  const pct = (v: number) => Math.round(v * 100);
  const shapes: ShapeKind[] = ['line', 'rect', 'ellipse', 'polygon'];
  const selKinds: SelectOptions['kind'][] = ['rect', 'ellipse', 'lasso', 'wand'];
  const selModes: SelectMode[] = ['replace', 'add', 'subtract', 'intersect'];
  const liqModes: LiquifyMode[] = ['push', 'twirlRight', 'twirlLeft', 'pinch', 'expand'];
</script>

<div class="bar" role="toolbar" aria-label={t('d.toolOptions')}>
  {#if s.tool === 'brush' || s.tool === 'eraser'}
    {#if brushes}
      <span class="name" title={brushName}>{brushName}</span>
      <span class="d-sep"></span>
      <DSlider label={t('brush.size')} value={b.size} min={1} max={300} step={0.5} unit="px" onchange={(v) => tweakActiveBrush(editor, { size: v })} />
      <DSlider label={t('brush.opacity')} value={pct(b.opacity)} min={1} max={100} unit="%" onchange={(v) => tweakActiveBrush(editor, { opacity: v / 100 })} />
      <DSlider label={t('brush.flow')} value={pct(b.flow)} min={1} max={100} unit="%" width={80} onchange={(v) => tweakActiveBrush(editor, { flow: v / 100 })} />
      <DSlider label={t('brush.smoothing')} value={pct(b.smoothing)} min={0} max={95} unit="%" width={80} onchange={(v) => tweakActiveBrush(editor, { smoothing: v / 100 })} />
      <label class="chk"><input type="checkbox" checked={b.pressureSize} onchange={(e) => tweakActiveBrush(editor, { pressureSize: e.currentTarget.checked })} /> {t('brush.pressureSize')}</label>
    {/if}
  {:else if s.tool === 'fill'}
    <DSlider label={t('fill.tolerance')} value={s.fill.tolerance} min={0} max={255} onchange={(v) => editor.configure('fill', { tolerance: Math.round(v) })} />
    <DSlider label={t('fill.expand')} value={s.fill.expand} min={0} max={5} unit="px" width={70} onchange={(v) => editor.configure('fill', { expand: Math.round(v) })} />
    <DSlider label={t('fill.opacity')} value={pct(s.fill.opacity)} min={1} max={100} unit="%" onchange={(v) => editor.configure('fill', { opacity: v / 100 })} />
    <label class="row"><span class="d-label">{t('fill.source')}</span>
      <select value={s.fill.source} onchange={(e) => editor.configure('fill', { source: e.currentTarget.value as 'layer' | 'canvas' })}>
        <option value="layer">{t('fill.sourceLayer')}</option><option value="canvas">{t('fill.sourceCanvas')}</option>
      </select></label>
  {:else if s.tool === 'eyedropper'}
    <span class="d-label">{t('m.eyedropperHint')}</span>
  {:else if s.tool === 'shape'}
    {#each shapes as k (k)}
      <button class="d-tbtn" aria-pressed={s.shape.kind === k} onclick={() => editor.configure('shape', { kind: k })}>{t(`shape.${k}`)}</button>
    {/each}
    <span class="d-sep"></span>
    <label class="chk"><input type="checkbox" checked={s.shape.fill} onchange={(e) => editor.configure('shape', { fill: e.currentTarget.checked })} /> {t('shape.fill')}</label>
    <DSlider label={t('shape.width')} value={s.shape.width} min={1} max={100} unit="px" onchange={(v) => editor.configure('shape', { width: Math.round(v) })} />
    {#if s.shape.kind === 'polygon'}
      <button class="d-tbtn" onclick={() => editor.finishPolygon(true)}>{t('shape.polygonDone')}</button>
    {/if}
  {:else if s.tool === 'text'}
    <label class="row"><span class="d-label">{t('text.font')}</span>
      <select value={s.text.font} onchange={(e) => editor.configure('text', { font: e.currentTarget.value })}>
        {#each TEXT_FONTS as f (f)}<option value={f}>{f}</option>{/each}
      </select></label>
    <DSlider label={t('text.size')} value={s.text.size} min={8} max={400} unit="px" onchange={(v) => editor.configure('text', { size: Math.round(v) })} />
    <button class="d-ibtn" aria-pressed={s.text.bold} onclick={() => editor.configure('text', { bold: !s.text.bold })} aria-label={t('text.bold')}><b>B</b></button>
    <button class="d-ibtn" aria-pressed={s.text.italic} onclick={() => editor.configure('text', { italic: !s.text.italic })} aria-label={t('text.italic')}><i>I</i></button>
    <span class="d-label">{t('text.hint')}</span>
  {:else if s.tool === 'select'}
    {#each selKinds as k (k)}
      <button class="d-tbtn" aria-pressed={s.sel.kind === k} onclick={() => editor.configure('selectOpts', { kind: k })}>{t(`select.${k}`)}</button>
    {/each}
    <span class="d-sep"></span>
    <label class="row"><span class="d-label">{t('select.mode')}</span>
      <select value={s.sel.mode} onchange={(e) => editor.configure('selectOpts', { mode: e.currentTarget.value as SelectMode })}>
        {#each selModes as m (m)}<option value={m}>{t(`select.${m}`)}</option>{/each}
      </select></label>
    {#if s.sel.kind === 'wand'}
      <DSlider label={t('fill.tolerance')} value={s.sel.tolerance} min={0} max={255} width={80} onchange={(v) => editor.configure('selectOpts', { tolerance: Math.round(v) })} />
    {/if}
    <span class="d-label">{t('select.hint')}</span>
  {:else if s.tool === 'transform'}
    <button class="d-ibtn" onclick={() => (editor.transform.flip(true), editor.notify())} disabled={!s.transforming} title={t('transform.flipH')} aria-label={t('transform.flipH')}><Icon name="flipH" size={18} /></button>
    <button class="d-ibtn" onclick={() => (editor.transform.flip(false), editor.notify())} disabled={!s.transforming} title={t('transform.flipV')} aria-label={t('transform.flipV')}><Icon name="flipV" size={18} /></button>
    <button class="d-ibtn" onclick={() => (editor.transform.rotate90(-1), editor.notify())} disabled={!s.transforming} title={t('transform.rotateLeft')} aria-label={t('transform.rotateLeft')}><Icon name="rotateLeft" size={18} /></button>
    <button class="d-ibtn" onclick={() => (editor.transform.rotate90(1), editor.notify())} disabled={!s.transforming} title={t('transform.rotateRight')} aria-label={t('transform.rotateRight')}><Icon name="rotateRight" size={18} /></button>
    <label class="chk"><input type="checkbox" checked={s.proportional} onchange={(e) => ((editor.transform.proportional = e.currentTarget.checked), editor.notify())} /> {t('transform.proportional')}</label>
    <span class="d-sep"></span>
    <button class="d-tbtn" onclick={() => editor.finishTransform(false)} disabled={!s.transforming}>{t('transform.cancel')}</button>
    <button class="d-tbtn primary" onclick={() => editor.finishTransform(true)} disabled={!s.transforming}>{t('transform.apply')}</button>
  {:else if s.tool === 'liquify'}
    {#each liqModes as m (m)}
      <button class="d-tbtn" aria-pressed={s.liq.mode === m} onclick={() => editor.configure('liquifyOpts', { mode: m })}>{t(`liquify.${m}`)}</button>
    {/each}
    <span class="d-sep"></span>
    <DSlider label={t('liquify.size')} value={s.liq.size} min={10} max={400} unit="px" onchange={(v) => editor.configure('liquifyOpts', { size: Math.round(v) })} />
    <DSlider label={t('liquify.strength')} value={pct(s.liq.strength)} min={5} max={100} unit="%" onchange={(v) => editor.configure('liquifyOpts', { strength: v / 100 })} />
  {/if}
</div>

<style>
  .bar { display: flex; align-items: center; gap: 10px; min-height: 36px; padding: 3px 10px; background: var(--d-panel); border-bottom: 1px solid var(--d-line); overflow-x: auto; white-space: nowrap; }
  .bar:empty { display: none; }
  .name { font-weight: 600; max-width: 160px; overflow: hidden; text-overflow: ellipsis; }
  .chk, .row { display: inline-flex; align-items: center; gap: 6px; }
</style>
