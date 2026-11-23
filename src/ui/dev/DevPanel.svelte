<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { Editor } from '../../engine/editor';
  import { BLEND_MODES, type BlendMode, type Layer } from '../../engine/layers';
  import { t } from '../../lib/i18n/t.svelte';
  import type { Key } from '../../lib/i18n/i18n.svelte';
  import { href } from '../../lib/router.svelte';

  let { editor }: { editor: Editor } = $props();

  // L'éditeur n'est pas réactif : on relit son état à chaque notification.
  let tick = $state(0);
  onMount(() => editor.subscribe(() => tick++));

  let open = $state(true);
  const brush = $state(untrack(() => ({ ...editor.brush })));
  $effect(() => editor.setBrush($state.snapshot(brush)));

  const s = $derived.by(() => {
    void tick;
    const doc = editor.doc;
    return {
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

  const layerName = (l: Layer) => l.name ?? t('layers.default', { n: String(l.number) });
  const pct = (v: number) => Math.round(v * 100);
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

{#if open}
  <aside class="panel">
    <p class="note">{t('draw.panelNote')}</p>

    <h3>{t('draw.view')}</h3>
    <div class="row">
      <button onclick={() => editor.fit()}>{t('draw.fit')}</button>
      <button onclick={() => editor.setZoom(1)}>{t('draw.zoom100')}</button>
      <button onclick={() => editor.setRotation(0)}>{t('draw.resetRotation')}</button>
    </div>

    <h3>{t('brush.title')}</h3>
    <label class="field"><span>{t('brush.color')}</span><input type="color" bind:value={brush.color} /></label>
    <label class="field"><span>{t('brush.size')} <b>{brush.size.toFixed(1)}</b></span>
      <input type="range" min="1" max="300" step="0.5" bind:value={brush.size} /></label>
    <label class="field"><span>{t('brush.opacity')} <b>{pct(brush.opacity)}</b></span>
      <input type="range" min="0.01" max="1" step="0.01" bind:value={brush.opacity} /></label>
    <label class="field"><span>{t('brush.flow')} <b>{pct(brush.flow)}</b></span>
      <input type="range" min="0.01" max="1" step="0.01" bind:value={brush.flow} /></label>
    <label class="field"><span>{t('brush.hardness')} <b>{pct(brush.hardness)}</b></span>
      <input type="range" min="0" max="1" step="0.01" bind:value={brush.hardness} /></label>
    <label class="field"><span>{t('brush.spacing')} <b>{pct(brush.spacing)}</b></span>
      <input type="range" min="0.02" max="1" step="0.01" bind:value={brush.spacing} /></label>
    <label class="field"><span>{t('brush.smoothing')} <b>{pct(brush.smoothing)}</b></span>
      <input type="range" min="0" max="0.95" step="0.01" bind:value={brush.smoothing} /></label>
    <label class="check"><input type="checkbox" bind:checked={brush.pressureSize} /> {t('brush.pressureSize')}</label>
    <label class="check"><input type="checkbox" bind:checked={brush.pressureOpacity} /> {t('brush.pressureOpacity')}</label>
    <label class="check"><input type="checkbox" bind:checked={brush.eraser} /> {t('brush.eraser')}</label>

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
  .btn, .panel button, select { min-height: 40px; min-width: 40px; padding: 0 10px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); text-decoration: none; display: inline-grid; place-items: center; cursor: pointer; font-size: 1rem; }
  .btn:disabled, .panel button:disabled { opacity: 0.4; cursor: default; }
  .btn.wide { margin-left: auto; }
  .status { padding: 6px 10px; border-radius: 10px; background: var(--surface); border: 1px solid var(--line); font-variant-numeric: tabular-nums; font-size: 0.9rem; }
  .notice { position: absolute; top: 64px; left: 50%; transform: translateX(-50%); background: var(--ink); color: var(--bg); padding: 8px 14px; border-radius: 10px; pointer-events: none; }
  .panel { position: absolute; top: 60px; right: 8px; bottom: 8px; width: min(320px, calc(100vw - 16px)); overflow-y: auto; background: var(--surface); border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px; box-shadow: var(--shadow); overscroll-behavior: contain; }
  @media (max-width: 600px) { .panel { top: auto; height: 55vh; } }
  .note { margin: 0 0 6px; font-size: 0.8rem; color: var(--ink-soft); }
  h3 { margin: 14px 0 6px; font-size: 0.95rem; }
  .row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 6px 0; }
  .icons button { padding: 0; }
  .field { display: grid; gap: 2px; margin: 6px 0; font-size: 0.9rem; }
  .field span { display: flex; justify-content: space-between; color: var(--ink-soft); }
  .field input[type='range'] { width: 100%; }
  .field input[type='color'] { width: 100%; height: 36px; border: 0; padding: 0; background: none; }
  .check { display: flex; gap: 8px; align-items: center; margin: 4px 0; font-size: 0.9rem; }
  .layers { list-style: none; margin: 6px 0; padding: 0; display: grid; gap: 4px; }
  .layers li { display: flex; gap: 4px; align-items: center; border-radius: 10px; padding: 2px; }
  .layers li.active { background: var(--surface-2); outline: 2px solid var(--teal); }
  .layers .name { flex: 1; justify-items: start; text-align: left; border: 0 !important; background: none !important; display: grid !important; }
  .layers small { color: var(--ink-soft); font-size: 0.75rem; }
  .eye { padding: 0 !important; }
  [aria-pressed='true'] { border-color: var(--teal) !important; }
</style>
