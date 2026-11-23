<script lang="ts">
  import type { Editor, SelectOptions } from '../../engine/editor';
  import type { SelectMode } from '../../engine/selection';
  import type { ShapeKind } from '../../engine/tools/shapes';
  import type { LiquifyMode } from '../../engine/tools/liquify';
  import { TEXT_FONTS } from '../../engine/tools/text';
  import { t } from '../../lib/i18n/t.svelte';
  import BrushSection from './BrushSection.svelte';

  let { editor, tick }: { editor: Editor; tick: number } = $props();

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
  const pct = (v: number) => Math.round(v * 100);
  const shapes: ShapeKind[] = ['line', 'rect', 'ellipse', 'polygon'];
  const selKinds: SelectOptions['kind'][] = ['rect', 'ellipse', 'lasso', 'wand'];
  const selModes: SelectMode[] = ['replace', 'add', 'subtract', 'intersect'];
  const liqModes: LiquifyMode[] = ['push', 'twirlRight', 'twirlLeft', 'pinch', 'expand'];
</script>

{#if s.tool === 'brush' || s.tool === 'eraser'}
  <BrushSection {editor} {tick} which={s.tool} />
{:else if s.tool === 'fill'}
  <label class="field"><span>{t('fill.tolerance')} <b>{s.fill.tolerance}</b></span>
    <input type="range" min="0" max="255" step="1" value={s.fill.tolerance} oninput={(e) => editor.configure('fill', { tolerance: +e.currentTarget.value })} /></label>
  <label class="field"><span>{t('fill.expand')} <b>{s.fill.expand} px</b></span>
    <input type="range" min="0" max="5" step="1" value={s.fill.expand} oninput={(e) => editor.configure('fill', { expand: +e.currentTarget.value })} /></label>
  <label class="field"><span>{t('fill.opacity')} <b>{pct(s.fill.opacity)}</b></span>
    <input type="range" min="0.01" max="1" step="0.01" value={s.fill.opacity} oninput={(e) => editor.configure('fill', { opacity: +e.currentTarget.value })} /></label>
  <div class="row">
    <span>{t('fill.source')}</span>
    <button aria-pressed={s.fill.source === 'layer'} onclick={() => editor.configure('fill', { source: 'layer' })}>{t('fill.sourceLayer')}</button>
    <button aria-pressed={s.fill.source === 'canvas'} onclick={() => editor.configure('fill', { source: 'canvas' })}>{t('fill.sourceCanvas')}</button>
  </div>
{:else if s.tool === 'shape'}
  <div class="row">
    {#each shapes as k (k)}
      <button aria-pressed={s.shape.kind === k} onclick={() => editor.configure('shape', { kind: k })}>{t(`shape.${k}`)}</button>
    {/each}
  </div>
  <label class="check"><input type="checkbox" checked={s.shape.fill} onchange={(e) => editor.configure('shape', { fill: e.currentTarget.checked })} /> {t('shape.fill')}</label>
  <label class="field"><span>{t('shape.width')} <b>{s.shape.width}</b></span>
    <input type="range" min="1" max="100" step="1" value={s.shape.width} oninput={(e) => editor.configure('shape', { width: +e.currentTarget.value })} /></label>
  {#if s.shape.kind === 'polygon'}
    <p class="note">{t('shape.polygonHint')}</p>
    <button class="full" onclick={() => editor.finishPolygon(true)}>{t('shape.polygonDone')}</button>
  {/if}
{:else if s.tool === 'text'}
  <p class="note">{t('text.hint')}</p>
  <label class="field"><span>{t('text.font')}</span>
    <select value={s.text.font} onchange={(e) => editor.configure('text', { font: e.currentTarget.value })}>
      {#each TEXT_FONTS as f (f)}<option value={f} style:font-family={f}>{f}</option>{/each}
    </select></label>
  <label class="field"><span>{t('text.size')} <b>{s.text.size}</b></span>
    <input type="range" min="8" max="400" step="1" value={s.text.size} oninput={(e) => editor.configure('text', { size: +e.currentTarget.value })} /></label>
  <label class="check"><input type="checkbox" checked={s.text.bold} onchange={(e) => editor.configure('text', { bold: e.currentTarget.checked })} /> {t('text.bold')}</label>
  <label class="check"><input type="checkbox" checked={s.text.italic} onchange={(e) => editor.configure('text', { italic: e.currentTarget.checked })} /> {t('text.italic')}</label>
{:else if s.tool === 'select'}
  <div class="grid2">
    {#each selKinds as k (k)}
      <button aria-pressed={s.sel.kind === k} onclick={() => editor.configure('selectOpts', { kind: k })}>{t(`select.${k}`)}</button>
    {/each}
  </div>
  <label class="field"><span>{t('select.mode')}</span>
    <select value={s.sel.mode} onchange={(e) => editor.configure('selectOpts', { mode: e.currentTarget.value as SelectMode })}>
      {#each selModes as m (m)}<option value={m}>{t(`select.${m}`)}</option>{/each}
    </select></label>
  {#if s.sel.kind === 'wand'}
    <label class="field"><span>{t('fill.tolerance')} <b>{s.sel.tolerance}</b></span>
      <input type="range" min="0" max="255" step="1" value={s.sel.tolerance} oninput={(e) => editor.configure('selectOpts', { tolerance: +e.currentTarget.value })} /></label>
    <div class="row">
      <button aria-pressed={s.sel.source === 'layer'} onclick={() => editor.configure('selectOpts', { source: 'layer' })}>{t('fill.sourceLayer')}</button>
      <button aria-pressed={s.sel.source === 'canvas'} onclick={() => editor.configure('selectOpts', { source: 'canvas' })}>{t('fill.sourceCanvas')}</button>
    </div>
  {/if}
  <p class="note">{t('select.hint')}</p>
  <div class="grid3">
    <button onclick={() => editor.selectAll()}>{t('select.all')}</button>
    <button onclick={() => editor.deselect()} disabled={!s.hasSelection}>{t('select.none')}</button>
    <button onclick={() => editor.invertSelection()}>{t('select.invert')}</button>
    <button onclick={() => editor.copy()}>{t('select.copy')}</button>
    <button onclick={() => editor.cut()}>{t('select.cut')}</button>
    <button onclick={() => editor.paste()} disabled={!s.hasClipboard}>{t('select.paste')}</button>
  </div>
  <button class="full" style="margin-top:6px" onclick={() => editor.deleteSelection()}>{t('select.delete')}</button>
{:else if s.tool === 'transform'}
  <p class="note">{t('transform.hint')}</p>
  <div class="grid2">
    <button onclick={() => (editor.transform.flip(true), editor.notify())} disabled={!s.transforming}>{t('transform.flipH')}</button>
    <button onclick={() => (editor.transform.flip(false), editor.notify())} disabled={!s.transforming}>{t('transform.flipV')}</button>
    <button onclick={() => (editor.transform.rotate90(-1), editor.notify())} disabled={!s.transforming}>{t('transform.rotateLeft')}</button>
    <button onclick={() => (editor.transform.rotate90(1), editor.notify())} disabled={!s.transforming}>{t('transform.rotateRight')}</button>
  </div>
  <label class="check"><input type="checkbox" checked={s.proportional}
    onchange={(e) => ((editor.transform.proportional = e.currentTarget.checked), editor.notify())} /> {t('transform.proportional')}</label>
  <div class="grid2">
    <button onclick={() => editor.finishTransform(false)} disabled={!s.transforming}>{t('transform.cancel')}</button>
    <button class="primary" onclick={() => editor.finishTransform(true)} disabled={!s.transforming}>{t('transform.apply')}</button>
  </div>
{:else if s.tool === 'liquify'}
  <div class="grid3">
    {#each liqModes as m (m)}
      <button aria-pressed={s.liq.mode === m} onclick={() => editor.configure('liquifyOpts', { mode: m })}>{t(`liquify.${m}`)}</button>
    {/each}
  </div>
  <label class="field"><span>{t('liquify.size')} <b>{s.liq.size}</b></span>
    <input type="range" min="10" max="400" step="1" value={s.liq.size} oninput={(e) => editor.configure('liquifyOpts', { size: +e.currentTarget.value })} /></label>
  <label class="field"><span>{t('liquify.strength')} <b>{pct(s.liq.strength)}</b></span>
    <input type="range" min="0.05" max="1" step="0.01" value={s.liq.strength} oninput={(e) => editor.configure('liquifyOpts', { strength: +e.currentTarget.value })} /></label>
{/if}
