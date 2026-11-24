<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import type { BouilleData } from '../../bouille/model';
  import type { Expression, View } from '../../bouille/render';
  import type { Bouille3D } from '../../bouille/three3d';

  /** Bouille en 3D : glisser pour la faire tourner. */
  let { bouille, view = 'bust', expr = 'neutral', yaw = $bindable(0), children }: { bouille: BouilleData; view?: View; expr?: Expression; yaw?: number; children?: Snippet } = $props();
  let canvas = $state<HTMLCanvasElement>();
  let box = $state<HTMLElement>();
  let engine = $state.raw<Bouille3D | null>(null);
  let failed = $state(false);

  onMount(() => {
    let ro: ResizeObserver | null = null;
    let alive = true;
    import('../../bouille/three3d')
      .then(({ Bouille3D, webglAvailable }) => {
        if (!alive) return;
        if (!webglAvailable()) return (failed = true);
        const e = new Bouille3D(canvas!);
        engine = e;
        const fit = () => e.resize(box!.clientWidth, box!.clientHeight);
        ro = new ResizeObserver(fit);
        ro.observe(box!);
        fit();
      })
      .catch(() => (failed = true));
    return () => {
      alive = false;
      ro?.disconnect();
      engine?.dispose();
    };
  });

  // Mise à jour (regroupée) quand la Bouille, la vue ou l'expression changent
  let timer = 0;
  $effect(() => {
    const e = engine;
    const data = $state.snapshot(bouille) as BouilleData;
    const v = view;
    const x = expr;
    if (!e) return;
    clearTimeout(timer);
    timer = window.setTimeout(() => e.set(data, { view: v, expr: x }), 40);
  });
  $effect(() => {
    if (engine) engine.yaw = yaw;
  });

  let drag: { x: number; yaw: number } | null = null;
  function down(ev: PointerEvent) {
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    drag = { x: ev.clientX, yaw };
  }
  function move(ev: PointerEvent) {
    if (drag) yaw = Math.max(-Math.PI, Math.min(Math.PI, drag.yaw + (ev.clientX - drag.x) / 90));
  }
</script>

<div class="b3d" bind:this={box} role="img" onpointerdown={down} onpointermove={move} onpointerup={() => (drag = null)} onpointercancel={() => (drag = null)}>
  {#if failed}{@render children?.()}{/if}
  <canvas bind:this={canvas} class:hidden={failed}></canvas>
</div>

<style>
  .b3d { position: relative; width: 100%; height: 100%; touch-action: none; cursor: grab; }
  canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  .hidden { display: none; }
</style>
