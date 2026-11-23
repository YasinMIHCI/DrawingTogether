<script lang="ts">
  import type { Editor } from '../../engine/editor';
  import { t } from '../../lib/i18n/t.svelte';
  import Icon from './Icon.svelte';
  import LayerThumb from './LayerThumb.svelte';

  let { editor, tick, width = 96, onmenu }: { editor: Editor; tick: number; width?: number; onmenu: () => void } = $props();

  const s = $derived.by(() => {
    void tick;
    const doc = editor.doc;
    return { layers: [...doc.layers].reverse(), activeId: doc.activeId, count: doc.layers.length, background: doc.background, w: doc.width, h: doc.height };
  });

  // Glisser-déposer après un appui long
  let drag = $state<{ id: number; startY: number; y: number; target: number } | null>(null);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let list: HTMLElement;
  let suppressClick = false;

  function down(e: PointerEvent, id: number) {
    const y = e.clientY;
    const el = e.currentTarget as HTMLElement;
    const pid = e.pointerId;
    clearTimeout(timer);
    timer = setTimeout(() => {
      el.setPointerCapture?.(pid);
      drag = { id, startY: y, y, target: s.layers.findIndex((l) => l.id === id) };
      navigator.vibrate?.(15);
    }, 350);
  }
  function move(e: PointerEvent) {
    if (!drag) {
      return;
    }
    drag.y = e.clientY;
    const items = [...list.querySelectorAll<HTMLElement>('[data-layer]')];
    let target = items.length; // « insérer avant l'élément n° target » (n = tout en bas)
    for (let i = 0; i < items.length; i++) {
      const r = items[i].getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) {
        target = i;
        break;
      }
    }
    drag.target = target;
  }
  function up() {
    clearTimeout(timer);
    if (!drag) return;
    const d = drag;
    drag = null;
    suppressClick = true;
    // position visuelle finale (haut = 0), puis index du document (bas = 0)
    const from = s.layers.findIndex((l) => l.id === d.id);
    const final = d.target > from ? d.target - 1 : d.target;
    editor.moveLayerTo(d.id, s.count - 1 - final);
  }
  function tap(id: number) {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    if (id === s.activeId) onmenu();
    else editor.setActiveLayer(id);
  }
</script>

<aside class="layers" style:--w="{width}px">
  <button class="tile add" onclick={() => editor.addLayer()} aria-label={t('layers.add')}><Icon name="plus" size={30} /></button>
  <button class="tile more" onclick={onmenu} aria-label={t('m.layerMenu')}><Icon name="more" /></button>
  <div class="list" bind:this={list} onpointermove={move} onpointerup={up} onpointercancel={up} role="list">
    {#each s.layers as l, i (l.id)}
      <div class="item" data-layer role="listitem"
        class:active={l.id === s.activeId}
        class:dragging={drag?.id === l.id}
        class:drop-before={drag && drag.target === i && drag.id !== l.id}>
        <button class="thumb" onpointerdown={(e) => down(e, l.id)} onpointerleave={() => !drag && clearTimeout(timer)}
          onclick={() => tap(l.id)} aria-label={l.name ?? t('layers.default', { n: String(l.number) })}>
          <LayerThumb source={l.surface.canvas} docW={s.w} docH={s.h} {tick} {width} />
        </button>
        <button class="eye" onclick={() => editor.setLayerProps(l.id, { visible: !l.visible })} aria-label={t('layers.visible')} aria-pressed={l.visible}>
          <Icon name={l.visible ? 'eye' : 'eyeOff'} size={16} />
        </button>
        {#if l.locked}<span class="lock"><Icon name="lock" size={14} /></span>{/if}
        {#if l.opacity < 1}<span class="op">{Math.round(l.opacity * 100)}</span>{/if}
      </div>
    {/each}
  </div>
  <button class="bg" onclick={() => editor.setBackground(s.background ? null : '#ffffff')} aria-label={t('m.background')} title={t('m.background')}>
    <LayerThumb source={null} background={s.background} docW={s.w} docH={s.h} {tick} width={width} />
  </button>
</aside>

<style>
  .layers {
    position: absolute; right: 8px; top: 64px; bottom: calc(var(--m-dock) + var(--strip-h, 130px) + env(safe-area-inset-bottom));
    width: calc(var(--w) + 20px); padding: 10px; display: flex; flex-direction: column; gap: 8px;
    background: var(--m-panel); border-radius: 16px; box-shadow: var(--m-shadow); z-index: 4;
  }
  .tile { height: 56px; border-radius: 12px; background: var(--m-card); border: 1px solid var(--m-line); display: grid; place-items: center; color: var(--m-ink); flex: none; }
  .tile.more { height: 36px; }
  .list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; min-height: 0; touch-action: pan-y; }
  .item { position: relative; border-radius: 10px; border: 3px solid transparent; flex: none; }
  .item.active { border-color: var(--m-accent); }
  .item.dragging { opacity: 0.5; }
  .item.drop-before::before { content: ''; position: absolute; left: 0; right: 0; top: -7px; height: 3px; background: var(--m-accent); border-radius: 2px; }
  .thumb { display: block; width: 100%; }
  .eye { position: absolute; left: 3px; bottom: 3px; width: 24px; height: 24px; border-radius: 50%; background: rgba(255, 255, 255, 0.9); color: #444; display: grid; place-items: center; }
  .lock { position: absolute; right: 4px; bottom: 4px; color: #444; background: rgba(255, 255, 255, 0.9); border-radius: 6px; padding: 1px; display: grid; }
  .op { position: absolute; right: 4px; top: 4px; font-size: 0.7rem; background: rgba(255, 255, 255, 0.9); color: #333; border-radius: 6px; padding: 0 4px; }
  .bg { flex: none; border-radius: 10px; overflow: hidden; border: 1px solid var(--m-line); }
</style>
