<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import type { BouilleData } from '../../bouille/model';
  import type { Expression, View } from '../../bouille/render';
  import type { Bouille3D, Brush } from '../../bouille/three3d';

  /** Bouille en 3D : glisser pour la faire tourner ; en mode peinture, glisser peint sur le modèle. */
  let {
    bouille, view = 'bust', expr = 'neutral', yaw = $bindable(0), engine = $bindable(null), brush = null, onstroke, children,
  }: {
    bouille: BouilleData; view?: View; expr?: Expression; yaw?: number; engine?: Bouille3D | null;
    /** Pinceau actif : la vue passe en mode peinture */
    brush?: Brush | null;
    /** Avant chaque trait (pour pouvoir l'annuler) */
    onstroke?: () => void;
    children?: Snippet;
  } = $props();
  let canvas = $state<HTMLCanvasElement>();
  let box = $state<HTMLElement>();
  let failed = $state(false);

  onMount(() => {
    let ro: ResizeObserver | null = null;
    let alive = true;
    let mine: Bouille3D | null = null;
    import('../../bouille/three3d')
      .then(({ Bouille3D, webglAvailable }) => {
        if (!alive) return;
        if (!webglAvailable()) return (failed = true);
        mine = new Bouille3D(canvas!);
        engine = mine;
        const fit = () => mine!.resize(box!.clientWidth, box!.clientHeight);
        ro = new ResizeObserver(fit);
        ro.observe(box!);
        fit();
      })
      .catch(() => (failed = true));
    return () => {
      alive = false;
      ro?.disconnect();
      mine?.dispose();
      engine = null;
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
  $effect(() => {
    if (engine) engine.idle = !brush;
  });

  let drag: { x: number; yaw: number } | null = null;
  let painting = false;
  function down(ev: PointerEvent) {
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    if (brush && engine) {
      onstroke?.();
      painting = true;
      engine.paint(ev.clientX, ev.clientY, brush, true);
      return;
    }
    drag = { x: ev.clientX, yaw };
  }
  function move(ev: PointerEvent) {
    if (painting && brush && engine) {
      engine.paint(ev.clientX, ev.clientY, brush, false);
      return;
    }
    if (drag) yaw = Math.max(-Math.PI, Math.min(Math.PI, drag.yaw + (ev.clientX - drag.x) / 90));
  }
  function up() {
    drag = null;
    if (painting) engine?.endStroke();
    painting = false;
  }
</script>

<div class="b3d" class:paint={!!brush} bind:this={box} role="img" onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}>
  {#if failed}{@render children?.()}{/if}
  <canvas bind:this={canvas} class:hidden={failed}></canvas>
</div>

<style>
  .b3d { position: relative; width: 100%; height: 100%; touch-action: none; cursor: grab; }
  .b3d.paint { cursor: crosshair; }
  canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
  .hidden { display: none; }
</style>
