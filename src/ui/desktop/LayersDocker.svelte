<script lang="ts">
  import type { Editor } from '../../engine/editor';
  import { BLEND_MODES, type BlendMode, type Layer } from '../../engine/layers';
  import { t } from '../../lib/i18n/t.svelte';
  import type { Key } from '../../lib/i18n/i18n.svelte';
  import Icon from '../common/Icon.svelte';
  import LayerThumb from '../common/LayerThumb.svelte';
  import DSlider from './DSlider.svelte';

  let { editor, tick }: { editor: Editor; tick: number } = $props();
  const s = $derived.by(() => {
    void tick;
    const doc = editor.doc;
    return {
      layers: [...doc.layers].reverse(), active: doc.active, index: doc.indexOf(doc.activeId),
      count: doc.layers.length, w: doc.width, h: doc.height, bg: doc.background,
    };
  });
  const name = (l: Layer) => l.name ?? t('layers.default', { n: String(l.number) });
  let renaming = $state<number | null>(null);
  let dragId = $state<number | null>(null);
  let dropAt = $state<number | null>(null);

  function drop() {
    if (dragId !== null && dropAt !== null) {
      const from = s.layers.findIndex((l) => l.id === dragId);
      const final = dropAt > from ? dropAt - 1 : dropAt;
      editor.moveLayerTo(dragId, s.count - 1 - final);
    }
    dragId = dropAt = null;
  }
</script>

<div class="ld">
  <div class="props">
    <select value={s.active.blend} onchange={(e) => editor.setLayerProps(s.active.id, { blend: e.currentTarget.value as BlendMode })} aria-label={t('layers.blend')}>
      {#each BLEND_MODES as m (m)}<option value={m}>{t(`blend.${m}` as Key)}</option>{/each}
    </select>
    <DSlider label={t('brush.opacity')} value={Math.round(s.active.opacity * 100)} min={0} max={100} width={70} unit="%"
      onchange={(v) => editor.setLayerProps(s.active.id, { opacity: v / 100 })} />
  </div>
  <ul class="list" aria-label={t('layers.title')} ondragover={(e) => e.preventDefault()} ondrop={drop}>
    {#each s.layers as l, i (l.id)}
      <li class:active={l.id === s.active.id} class:drop={dropAt === i}
        draggable={renaming !== l.id} ondragstart={() => (dragId = l.id)} ondragend={() => (dragId = dropAt = null)}
        ondragover={(e) => { e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); dropAt = e.clientY < r.top + r.height / 2 ? i : i + 1; }}>
        <button class="d-ibtn" onclick={() => editor.setLayerProps(l.id, { visible: !l.visible })} aria-label="{t('layers.visible')} : {name(l)}" aria-pressed={l.visible}>
          <Icon name={l.visible ? 'eye' : 'eyeOff'} size={15} />
        </button>
        <LayerThumb source={l.surface.canvas} docW={s.w} docH={s.h} {tick} width={40} />
        {#if renaming === l.id}
          <!-- svelte-ignore a11y_autofocus -->
          <input type="text" value={name(l)} autofocus aria-label={t('m.layerName')}
            onblur={(e) => { editor.setLayerProps(l.id, { name: e.currentTarget.value || null }); renaming = null; }}
            onkeydown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') renaming = null; }} />
        {:else}
          <button class="name" aria-current={l.id === s.active.id ? 'true' : undefined} title={name(l)}
            onclick={() => editor.setActiveLayer(l.id)} ondblclick={() => (renaming = l.id)}
            onkeydown={(e) => e.key === 'F2' && (renaming = l.id)}>{name(l)}</button>
        {/if}
        {#if l.opacity < 1}<span class="op">{Math.round(l.opacity * 100)}%</span>{/if}
        <button class="d-ibtn" onclick={() => editor.setLayerProps(l.id, { locked: !l.locked })} aria-label="{t('layers.lock')} : {name(l)}" aria-pressed={l.locked}>
          <Icon name={l.locked ? 'lock' : 'unlock'} size={14} />
        </button>
      </li>
    {/each}
  </ul>
  <div class="bgrow" class:drop={dropAt === s.layers.length}>
    <button class="d-tbtn" onclick={() => editor.setBackground(s.bg ? null : '#ffffff')}>
      {t('m.background')} : {s.bg ? t('layers.bgWhite') : t('layers.bgTransparent')}
    </button>
  </div>
  <div class="tools">
    <button class="d-ibtn" onclick={() => editor.addLayer()} title={t('layers.add')} aria-label={t('layers.add')}><Icon name="plus" size={16} /></button>
    <button class="d-ibtn" onclick={() => editor.duplicateLayer()} title={t('layers.duplicate')} aria-label={t('layers.duplicate')}><Icon name="duplicate" size={16} /></button>
    <button class="d-ibtn" onclick={() => editor.moveLayer(s.active.id, 1)} disabled={s.index >= s.count - 1} title={t('layers.up')} aria-label={t('layers.up')}><Icon name="arrowUp" size={16} /></button>
    <button class="d-ibtn" onclick={() => editor.moveLayer(s.active.id, -1)} disabled={s.index <= 0} title={t('layers.down')} aria-label={t('layers.down')}><Icon name="arrowDown" size={16} /></button>
    <button class="d-ibtn" onclick={() => editor.mergeDown()} disabled={s.index <= 0} title={t('layers.merge')} aria-label={t('layers.merge')}><Icon name="mergeDown" size={16} /></button>
    <button class="d-ibtn" onclick={() => editor.clearLayer()} title={t('layers.clear')} aria-label={t('layers.clear')}><Icon name="eraser" size={16} /></button>
    <button class="d-ibtn" onclick={() => editor.removeLayer()} disabled={s.count <= 1} title={t('layers.remove')} aria-label={t('layers.remove')}><Icon name="trash" size={16} /></button>
  </div>
</div>

<style>
  .ld { display: flex; flex-direction: column; height: 100%; min-height: 120px; }
  .props { display: flex; align-items: center; gap: 6px; padding: 6px; flex-wrap: wrap; }
  .props select { flex: 1; min-width: 90px; }
  .list { list-style: none; margin: 0; padding: 0 4px; flex: 1; overflow-y: auto; min-height: 60px; }
  li { display: flex; align-items: center; gap: 6px; padding: 3px 4px; border-radius: 4px; position: relative; cursor: default; }
  li:hover { background: var(--d-hover); }
  li.active { background: var(--d-accent-soft); }
  li.drop::before { content: ''; position: absolute; left: 0; right: 0; top: -1px; height: 2px; background: var(--d-accent); }
  .name { flex: 1; min-width: 0; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 4px 2px; border-radius: 4px; }
  li input { flex: 1; min-width: 0; }
  .op { color: var(--d-soft); font-size: 11px; }
  .bgrow { padding: 4px; position: relative; }
  .bgrow.drop::before { content: ''; position: absolute; left: 0; right: 0; top: -1px; height: 2px; background: var(--d-accent); }
  .bgrow .d-tbtn { width: 100%; justify-content: center; }
  .tools { display: flex; gap: 2px; padding: 4px; border-top: 1px solid var(--d-line); }
</style>
