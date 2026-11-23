<script lang="ts">
  import { onMount } from 'svelte';
  import type { Editor, ToolId } from '../../engine/editor';
  import { BLEND_MODES, type BlendMode, type Layer } from '../../engine/layers';
  import { BRUSH_CATEGORIES, BRUSH_PRESETS, getPreset, type BrushCategory } from '../../engine/brush/presets';
  import type { BrushSettings } from '../../engine/brush/settings';
  import type { ShapeKind } from '../../engine/tools/shapes';
  import { TEXT_FONTS } from '../../engine/tools/text';
  import { brushPrefs, brushSettings, resetBrush, setBrushOverride } from '../../lib/brushPrefs.svelte';
  import { t } from '../../lib/i18n/t.svelte';
  import type { Key } from '../../lib/i18n/i18n.svelte';
  import { href } from '../../lib/router.svelte';
  import BrushPreview from './BrushPreview.svelte';

  let { editor }: { editor: Editor } = $props();

  // L'éditeur n'est pas réactif : on relit son état à chaque notification.
  let tick = $state(0);
  onMount(() => {
    editor.setBrush(brushSettings(brushPrefs.selected.brush), 'brush');
    editor.setBrush(brushSettings(brushPrefs.selected.eraser), 'eraser');
    return editor.subscribe(() => tick++);
  });

  let open = $state(true);
  let textValue = $state('');

  const s = $derived.by(() => {
    void tick;
    const doc = editor.doc;
    return {
      tool: editor.tool,
      color: editor.color,
      fill: { ...editor.fill },
      shape: { ...editor.shape },
      text: { ...editor.text },
      textRequest: editor.textRequest,
      layers: [...doc.layers].reverse(),
      active: doc.active,
      activeIndex: doc.indexOf(doc.activeId),
      count: doc.layers.length,
      canUndo: editor.history.canUndo,
      canRedo: editor.history.canRedo,
      zoom: Math.round(editor.view.zoom * 100),
      rotation: Math.round((editor.view.rotation * 180) / Math.PI),
      background: doc.background,
      notice: editor.notice,
    };
  });

  // Pinceau ou gomme selon l'outil
  const which = $derived<'brush' | 'eraser'>(s.tool === 'eraser' ? 'eraser' : 'brush');
  const selectedId = $derived(brushPrefs.selected[which]);
  const current = $derived(brushSettings(selectedId));
  let category = $state<BrushCategory>(getPreset(brushPrefs.selected.brush)?.category ?? 'pen');
  const shownCategory = $derived<BrushCategory>(which === 'eraser' ? 'eraser' : category);
  const presets = $derived(BRUSH_PRESETS.filter((p) => p.category === shownCategory));

  function selectBrush(id: string) {
    brushPrefs.selected[which] = id;
    editor.setBrush(brushSettings(id), which);
  }
  function tweak(patch: Partial<BrushSettings>) {
    setBrushOverride(selectedId, patch);
    editor.setBrush(brushSettings(selectedId), which);
  }
  function reset() {
    resetBrush(selectedId);
    editor.setBrush(brushSettings(selectedId), which);
  }

  const tools: ToolId[] = ['brush', 'eraser', 'fill', 'eyedropper', 'shape', 'text'];
  const toolIcons: Record<ToolId, string> = { brush: '🖌', eraser: '⌫', fill: '🪣', eyedropper: '💧', shape: '▭', text: 'T' };
  const shapes: ShapeKind[] = ['line', 'rect', 'ellipse', 'polygon'];

  const layerName = (l: Layer) => l.name ?? t('layers.default', { n: String(l.number) });
  const pct = (v: number) => Math.round(v * 100);

  function submitText() {
    editor.commitText(textValue);
    textValue = '';
  }
</script>

<div class="bar">
  <a class="btn" href={href('home')} aria-label={t('nav.back')}>←</a>
  <button class="btn" onclick={() => editor.undo()} disabled={!s.canUndo} title={t('draw.undo')} aria-label={t('draw.undo')}>↶</button>
  <button class="btn" onclick={() => editor.redo()} disabled={!s.canRedo} title={t('draw.redo')} aria-label={t('draw.redo')}>↷</button>
  <span class="status">{s.zoom}% · {s.rotation}°</span>
  <button class="btn wide" onclick={() => (open = !open)} aria-expanded={open}>{t('draw.panel')}</button>
</div>

{#if s.notice}
  <div class="notice" role="status">{t(`notice.${s.notice}`)}</div>
{/if}

{#if s.textRequest}
  <form class="text-dialog" onsubmit={(e) => { e.preventDefault(); submitText(); }}>
    <!-- svelte-ignore a11y_autofocus -->
    <textarea bind:value={textValue} placeholder={t('text.placeholder')} rows="3" autofocus></textarea>
    <div class="row">
      <button type="button" onclick={() => editor.cancelText()}>{t('text.cancel')}</button>
      <button type="submit" class="primary">{t('text.ok')}</button>
    </div>
  </form>
{/if}

{#if open}
  <aside class="panel">
    <p class="note">{t('draw.panelNote')}</p>

    <h3>{t('tools.title')}</h3>
    <div class="tools">
      {#each tools as tool (tool)}
        <button aria-pressed={s.tool === tool} onclick={() => editor.setTool(tool)}>
          <span aria-hidden="true">{toolIcons[tool]}</span>{t(`tools.${tool}`)}
        </button>
      {/each}
    </div>
    <label class="field"><span>{t('brush.color')} <b>{s.color}</b></span>
      <input type="color" value={s.color} oninput={(e) => editor.setColor(e.currentTarget.value)} /></label>

    {#if s.tool === 'brush' || s.tool === 'eraser'}
      <h3>{t('brush.library')}</h3>
      {#if which === 'brush'}
        <div class="cats">
          {#each BRUSH_CATEGORIES.filter((c) => c !== 'eraser') as c (c)}
            <button aria-pressed={category === c} onclick={() => (category = c)}>{t(`brushCat.${c}`)}</button>
          {/each}
        </div>
      {/if}
      <div class="brushes">
        {#each presets as p (p.id)}
          <button class="brush" aria-pressed={selectedId === p.id} onclick={() => selectBrush(p.id)}>
            <span>{t(`brushes.${p.id}` as Key)}</span>
            <BrushPreview settings={brushSettings(p.id)} color={s.color} />
          </button>
        {/each}
      </div>
      <label class="field"><span>{t('brush.size')} <b>{current.size.toFixed(1)}</b></span>
        <input type="range" min="1" max="300" step="0.5" value={current.size} oninput={(e) => tweak({ size: +e.currentTarget.value })} /></label>
      <label class="field"><span>{t('brush.opacity')} <b>{pct(current.opacity)}</b></span>
        <input type="range" min="0.01" max="1" step="0.01" value={current.opacity} oninput={(e) => tweak({ opacity: +e.currentTarget.value })} /></label>
      <details>
        <summary>{t('brush.advanced')}</summary>
        <label class="field"><span>{t('brush.flow')} <b>{pct(current.flow)}</b></span>
          <input type="range" min="0.01" max="1" step="0.01" value={current.flow} oninput={(e) => tweak({ flow: +e.currentTarget.value })} /></label>
        <label class="field"><span>{t('brush.hardness')} <b>{pct(current.hardness)}</b></span>
          <input type="range" min="0" max="1" step="0.01" value={current.hardness} oninput={(e) => tweak({ hardness: +e.currentTarget.value })} /></label>
        <label class="field"><span>{t('brush.spacing')} <b>{pct(current.spacing)}</b></span>
          <input type="range" min="0.02" max="2" step="0.01" value={current.spacing} oninput={(e) => tweak({ spacing: +e.currentTarget.value })} /></label>
        <label class="field"><span>{t('brush.smoothing')} <b>{pct(current.smoothing)}</b></span>
          <input type="range" min="0" max="0.95" step="0.01" value={current.smoothing} oninput={(e) => tweak({ smoothing: +e.currentTarget.value })} /></label>
        <label class="field"><span>{t('brush.grain')} <b>{pct(current.grain)}</b></span>
          <input type="range" min="0" max="1" step="0.01" value={current.grain} oninput={(e) => tweak({ grain: +e.currentTarget.value })} /></label>
        <label class="check"><input type="checkbox" checked={current.pressureSize} onchange={(e) => tweak({ pressureSize: e.currentTarget.checked })} /> {t('brush.pressureSize')}</label>
        <label class="check"><input type="checkbox" checked={current.pressureOpacity} onchange={(e) => tweak({ pressureOpacity: e.currentTarget.checked })} /> {t('brush.pressureOpacity')}</label>
      </details>
      <button class="full" onclick={reset}>{t('brush.reset')}</button>
    {:else if s.tool === 'fill'}
      <label class="field"><span>{t('fill.tolerance')} <b>{s.fill.tolerance}</b></span>
        <input type="range" min="0" max="255" step="1" value={s.fill.tolerance} oninput={(e) => (editor.fill.tolerance = +e.currentTarget.value, tick++)} /></label>
      <label class="field"><span>{t('fill.expand')} <b>{s.fill.expand} px</b></span>
        <input type="range" min="0" max="5" step="1" value={s.fill.expand} oninput={(e) => (editor.fill.expand = +e.currentTarget.value, tick++)} /></label>
      <label class="field"><span>{t('fill.opacity')} <b>{pct(s.fill.opacity)}</b></span>
        <input type="range" min="0.01" max="1" step="0.01" value={s.fill.opacity} oninput={(e) => (editor.fill.opacity = +e.currentTarget.value, tick++)} /></label>
      <div class="row">
        <span>{t('fill.source')}</span>
        <button aria-pressed={s.fill.source === 'layer'} onclick={() => (editor.fill.source = 'layer', tick++)}>{t('fill.sourceLayer')}</button>
        <button aria-pressed={s.fill.source === 'canvas'} onclick={() => (editor.fill.source = 'canvas', tick++)}>{t('fill.sourceCanvas')}</button>
      </div>
    {:else if s.tool === 'shape'}
      <div class="row">
        {#each shapes as k (k)}
          <button aria-pressed={s.shape.kind === k} onclick={() => (editor.finishPolygon(true), editor.shape.kind = k, tick++)}>{t(`shape.${k}`)}</button>
        {/each}
      </div>
      <label class="check"><input type="checkbox" checked={s.shape.fill} onchange={(e) => (editor.shape.fill = e.currentTarget.checked, tick++)} /> {t('shape.fill')}</label>
      <label class="field"><span>{t('shape.width')} <b>{s.shape.width}</b></span>
        <input type="range" min="1" max="100" step="1" value={s.shape.width} oninput={(e) => (editor.shape.width = +e.currentTarget.value, tick++)} /></label>
      {#if s.shape.kind === 'polygon'}
        <p class="note">{t('shape.polygonHint')}</p>
        <button class="full" onclick={() => editor.finishPolygon(true)}>{t('shape.polygonDone')}</button>
      {/if}
    {:else if s.tool === 'text'}
      <p class="note">{t('text.hint')}</p>
      <label class="field"><span>{t('text.font')}</span>
        <select value={s.text.font} onchange={(e) => (editor.text.font = e.currentTarget.value, tick++)}>
          {#each TEXT_FONTS as f (f)}<option value={f} style:font-family={f}>{f}</option>{/each}
        </select></label>
      <label class="field"><span>{t('text.size')} <b>{s.text.size}</b></span>
        <input type="range" min="8" max="400" step="1" value={s.text.size} oninput={(e) => (editor.text.size = +e.currentTarget.value, tick++)} /></label>
      <label class="check"><input type="checkbox" checked={s.text.bold} onchange={(e) => (editor.text.bold = e.currentTarget.checked, tick++)} /> {t('text.bold')}</label>
      <label class="check"><input type="checkbox" checked={s.text.italic} onchange={(e) => (editor.text.italic = e.currentTarget.checked, tick++)} /> {t('text.italic')}</label>
    {/if}

    <h3>{t('draw.view')}</h3>
    <div class="row">
      <button onclick={() => editor.fit()}>{t('draw.fit')}</button>
      <button onclick={() => editor.setZoom(1)}>{t('draw.zoom100')}</button>
      <button onclick={() => editor.setRotation(0)}>{t('draw.resetRotation')}</button>
    </div>

    <h3>{t('layers.title')}</h3>
    <div class="row icons">
      <button onclick={() => editor.addLayer()} title={t('layers.add')} aria-label={t('layers.add')}>＋</button>
      <button onclick={() => editor.duplicateLayer()} title={t('layers.duplicate')} aria-label={t('layers.duplicate')}>⧉</button>
      <button onclick={() => editor.moveLayer(s.active.id, 1)} disabled={s.activeIndex >= s.count - 1} title={t('layers.up')} aria-label={t('layers.up')}>▲</button>
      <button onclick={() => editor.moveLayer(s.active.id, -1)} disabled={s.activeIndex <= 0} title={t('layers.down')} aria-label={t('layers.down')}>▼</button>
      <button onclick={() => editor.mergeDown()} disabled={s.activeIndex <= 0} title={t('layers.merge')} aria-label={t('layers.merge')}>⤓</button>
      <button onclick={() => editor.clearLayer()} title={t('layers.clear')} aria-label={t('layers.clear')}>⌫</button>
      <button onclick={() => editor.removeLayer()} disabled={s.count <= 1} title={t('layers.remove')} aria-label={t('layers.remove')}>🗑</button>
    </div>
    <ul class="layers">
      {#each s.layers as l (l.id)}
        <li class:active={l.id === s.active.id}>
          <button class="eye" aria-pressed={l.visible} title={t('layers.visible')}
            onclick={() => editor.setLayerProps(l.id, { visible: !l.visible })}>{l.visible ? '👁' : '—'}</button>
          <button class="name" onclick={() => editor.setActiveLayer(l.id)}>
            {layerName(l)} <small>{pct(l.opacity)}% · {t(`blend.${l.blend}` as Key)}</small>
          </button>
          <button class="eye" aria-pressed={l.locked} title={t('layers.lock')}
            onclick={() => editor.setLayerProps(l.id, { locked: !l.locked })}>{l.locked ? '🔒' : '🔓'}</button>
        </li>
      {/each}
    </ul>
    <label class="field"><span>{t('layers.opacity')} <b>{pct(s.active.opacity)}</b></span>
      <input type="range" min="0" max="1" step="0.01" value={s.active.opacity}
        oninput={(e) => editor.setLayerProps(s.active.id, { opacity: +e.currentTarget.value })} /></label>
    <label class="field"><span>{t('layers.blend')}</span>
      <select value={s.active.blend} onchange={(e) => editor.setLayerProps(s.active.id, { blend: e.currentTarget.value as BlendMode })}>
        {#each BLEND_MODES as m (m)}<option value={m}>{t(`blend.${m}` as Key)}</option>{/each}
      </select></label>
    <div class="row">
      <span>{t('layers.background')}</span>
      <button aria-pressed={s.background !== null} onclick={() => editor.setBackground('#ffffff')}>{t('layers.bgWhite')}</button>
      <button aria-pressed={s.background === null} onclick={() => editor.setBackground(null)}>{t('layers.bgTransparent')}</button>
    </div>
  </aside>
{/if}

<style>
  .bar { position: absolute; top: max(8px, env(safe-area-inset-top)); left: 8px; right: 8px; display: flex; gap: 6px; align-items: center; pointer-events: none; }
  .bar > * { pointer-events: auto; }
  .btn, .panel button, select, .text-dialog button { min-height: 40px; min-width: 40px; padding: 0 10px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); text-decoration: none; display: inline-grid; place-items: center; cursor: pointer; font-size: 1rem; }
  .btn:disabled, .panel button:disabled { opacity: 0.4; cursor: default; }
  .btn.wide { margin-left: auto; }
  .status { padding: 6px 10px; border-radius: 10px; background: var(--surface); border: 1px solid var(--line); font-variant-numeric: tabular-nums; font-size: 0.9rem; }
  .notice { position: absolute; top: 64px; left: 50%; transform: translateX(-50%); background: var(--ink); color: var(--bg); padding: 8px 14px; border-radius: 10px; pointer-events: none; }
  .panel { position: absolute; top: 60px; right: 8px; bottom: 8px; width: min(320px, calc(100vw - 16px)); overflow-y: auto; background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px; box-shadow: var(--shadow); overscroll-behavior: contain; }
  @media (max-width: 600px) { .panel { top: auto; height: 55vh; } }
  .note { margin: 0 0 6px; font-size: 0.8rem; color: var(--ink-soft); }
  h3 { margin: 14px 0 6px; font-size: 0.95rem; }
  .row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 6px 0; }
  .tools { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .tools button { display: flex !important; gap: 6px; justify-content: center; font-size: 0.85rem !important; }
  .cats { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; }
  .cats button { min-height: 32px !important; font-size: 0.8rem !important; padding: 0 8px !important; }
  .brushes { display: grid; gap: 4px; max-height: 300px; overflow-y: auto; margin-bottom: 8px; }
  .brush { display: grid !important; justify-items: start; padding: 4px 8px !important; background: #fff !important; color: #1f2430 !important; font-size: 0.85rem !important; }
  .icons button { padding: 0; }
  .full { width: 100%; }
  .field { display: grid; gap: 2px; margin: 6px 0; font-size: 0.9rem; }
  .field span { display: flex; justify-content: space-between; color: var(--ink-soft); }
  .field input[type='range'] { width: 100%; }
  .field input[type='color'] { width: 100%; height: 36px; border: 0; padding: 0; background: none; }
  details { margin: 6px 0; font-size: 0.9rem; }
  summary { cursor: pointer; color: var(--ink-soft); }
  .check { display: flex; gap: 8px; align-items: center; margin: 4px 0; font-size: 0.9rem; }
  .layers { list-style: none; margin: 6px 0; padding: 0; display: grid; gap: 4px; }
  .layers li { display: flex; gap: 4px; align-items: center; border-radius: 10px; padding: 2px; }
  .layers li.active { background: var(--surface-2); outline: 2px solid var(--teal); }
  .layers .name { flex: 1; justify-items: start; text-align: left; border: 0 !important; background: none !important; display: grid !important; }
  .layers small { color: var(--ink-soft); font-size: 0.75rem; }
  .eye { padding: 0 !important; }
  [aria-pressed='true'] { border-color: var(--teal) !important; box-shadow: inset 0 0 0 1px var(--teal); }
  .text-dialog { position: absolute; left: 50%; top: 30%; transform: translateX(-50%); width: min(420px, calc(100vw - 32px)); background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 12px; box-shadow: var(--shadow); z-index: 2; }
  .text-dialog textarea { width: 100%; font-size: 1rem; padding: 8px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface-2); resize: vertical; }
  .text-dialog .row { justify-content: flex-end; }
  .primary { background: var(--accent) !important; color: var(--accent-ink) !important; border-color: var(--accent) !important; }
</style>
