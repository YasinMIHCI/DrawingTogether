<script lang="ts">
  import type { Snippet } from 'svelte';
  import { desktopPrefs, type DockerId } from '../../lib/desktopPrefs.svelte';
  import { t } from '../../lib/i18n/t.svelte';
  import Icon from '../common/Icon.svelte';

  /** Panneau ancré : titre cliquable pour replier, poignée en bas pour la hauteur. */
  let { id, children, actions, grow = false }: { id: DockerId; children: Snippet; actions?: Snippet; grow?: boolean } = $props();
  const collapsed = $derived(desktopPrefs.collapsed[id]);
  const height = $derived(desktopPrefs.heights[id]);
  let body = $state<HTMLElement>();

  function startResize(e: PointerEvent) {
    const startY = e.clientY;
    const startH = body?.getBoundingClientRect().height ?? 100;
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => (desktopPrefs.heights[id] = Math.max(60, Math.round(startH + ev.clientY - startY)));
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
  }
</script>

<section class="docker" class:collapsed class:fixed={height > 0} class:grow={grow && height === 0}>
  <header>
    <button class="title" onclick={() => (desktopPrefs.collapsed[id] = !collapsed)} aria-expanded={!collapsed}>
      <Icon name={collapsed ? 'chevronRight' : 'chevronDown'} size={14} />
      {t(`d.docker.${id}`)}
    </button>
    {#if actions && !collapsed}<div class="actions">{@render actions()}</div>{/if}
  </header>
  {#if !collapsed}
    <div class="body" bind:this={body} style:height={height > 0 ? `${height}px` : null}>{@render children()}</div>
    <div class="grip" role="separator" aria-orientation="horizontal" aria-label={t('d.resize')}
      onpointerdown={startResize} ondblclick={() => (desktopPrefs.heights[id] = 0)}></div>
  {/if}
</section>

<style>
  .docker { display: flex; flex-direction: column; border-bottom: 1px solid var(--d-line); min-height: 0; }
  .docker { flex: none; }
  /* Le panneau « grow » (calques) prend la place restante ; les autres gardent leur taille */
  .docker.grow:not(.collapsed) { flex: 1 1 auto; min-height: 160px; }
  header { display: flex; align-items: center; height: 26px; background: var(--d-panel-2); padding: 0 4px; flex: none; }
  .title { display: flex; align-items: center; gap: 4px; flex: 1; height: 100%; text-align: left; font-weight: 600; }
  .actions { display: flex; gap: 2px; }
  .body { overflow: auto; min-height: 0; }
  .grow .body { flex: 1 1 auto; }
  .grip { height: 5px; cursor: ns-resize; flex: none; }
  .grip:hover { background: var(--d-accent-soft); }
</style>
