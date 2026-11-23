<script lang="ts">
  import type { Editor } from '../../engine/editor';
  import { BLEND_MODES, type BlendMode } from '../../engine/layers';
  import { t } from '../../lib/i18n/t.svelte';
  import type { Key } from '../../lib/i18n/i18n.svelte';
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';
  import MSlider from './MSlider.svelte';

  let { editor, tick }: { editor: Editor; tick: number } = $props();
  const s = $derived.by(() => {
    void tick;
    const doc = editor.doc;
    const l = doc.active;
    return { l, index: doc.indexOf(l.id), count: doc.layers.length, name: l.name ?? t('layers.default', { n: String(l.number) }) };
  });
  const actions = $derived<{ icon: IconName; label: Key; run: () => void; disabled?: boolean; pressed?: boolean }[]>([
    { icon: s.l.visible ? 'eye' : 'eyeOff', label: 'layers.visible', pressed: s.l.visible, run: () => editor.setLayerProps(s.l.id, { visible: !s.l.visible }) },
    { icon: s.l.locked ? 'lock' : 'unlock', label: 'layers.lock', pressed: s.l.locked, run: () => editor.setLayerProps(s.l.id, { locked: !s.l.locked }) },
    { icon: 'duplicate', label: 'layers.duplicate', run: () => editor.duplicateLayer() },
    { icon: 'mergeDown', label: 'layers.merge', disabled: s.index <= 0, run: () => editor.mergeDown() },
    { icon: 'arrowUp', label: 'layers.up', disabled: s.index >= s.count - 1, run: () => editor.moveLayer(s.l.id, 1) },
    { icon: 'arrowDown', label: 'layers.down', disabled: s.index <= 0, run: () => editor.moveLayer(s.l.id, -1) },
    { icon: 'eraser', label: 'layers.clear', run: () => editor.clearLayer() },
    { icon: 'trash', label: 'layers.remove', disabled: s.count <= 1, run: () => editor.removeLayer() },
  ]);
</script>

<div class="lm">
  <label class="name">
    <span class="m-hint">{t('m.layerName')}</span>
    <input type="text" value={s.name} onchange={(e) => editor.setLayerProps(s.l.id, { name: e.currentTarget.value || null })} />
  </label>
  <p class="lbl">{t('layers.opacity')}</p>
  <MSlider label={t('layers.opacity')} value={s.l.opacity * 100} min={0} max={100} onchange={(v) => editor.setLayerProps(s.l.id, { opacity: v / 100 })} />
  <label class="blend"><span>{t('layers.blend')}</span>
    <select value={s.l.blend} onchange={(e) => editor.setLayerProps(s.l.id, { blend: e.currentTarget.value as BlendMode })}>
      {#each BLEND_MODES as m (m)}<option value={m}>{t(`blend.${m}` as Key)}</option>{/each}
    </select>
  </label>
  <div class="actions">
    {#each actions as a (a.label)}
      <button onclick={a.run} disabled={a.disabled} aria-pressed={a.pressed}>
        <Icon name={a.icon} />
        <span>{t(a.label)}</span>
      </button>
    {/each}
  </div>
  <p class="m-hint">{t('m.layerHint')}</p>
</div>

<style>
  .lm { padding: 12px 16px; display: grid; gap: 6px; max-height: 62vh; overflow-y: auto; }
  .name { display: grid; gap: 4px; }
  .lbl { margin: 4px 0 0; }
  .blend { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .actions { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-top: 6px; }
  .actions button { display: grid; justify-items: center; gap: 4px; padding: 8px 2px; border-radius: 12px; color: var(--m-ink); }
  .actions span { font-size: 0.75rem; text-align: center; color: var(--m-text); }
  .actions [aria-pressed='true'] { color: var(--m-accent); }
</style>
