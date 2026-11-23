<script lang="ts">
  import type { Editor } from '../../engine/editor';
  import { BLEND_MODES, type BlendMode, type Layer } from '../../engine/layers';
  import { t } from '../../lib/i18n/t.svelte';
  import type { Key } from '../../lib/i18n/i18n.svelte';

  let { editor, tick }: { editor: Editor; tick: number } = $props();

  const s = $derived.by(() => {
    void tick;
    const doc = editor.doc;
    return {
      layers: [...doc.layers].reverse(),
      active: doc.active,
      activeIndex: doc.indexOf(doc.activeId),
      count: doc.layers.length,
      background: doc.background,
    };
  });
  const layerName = (l: Layer) => l.name ?? t('layers.default', { n: String(l.number) });
  const pct = (v: number) => Math.round(v * 100);
</script>

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

<style>
  .icons button { padding: 0; }
  .layers { list-style: none; margin: 6px 0; padding: 0; display: grid; gap: 4px; }
  .layers li { display: flex; gap: 4px; align-items: center; border-radius: 10px; padding: 2px; }
  .layers li.active { background: var(--surface-2); outline: 2px solid var(--teal); }
  .layers .name { flex: 1; justify-items: start; text-align: left; border: 0; background: none; display: grid; }
  .layers small { color: var(--ink-soft); font-size: 0.75rem; }
  .eye { padding: 0; }
</style>
