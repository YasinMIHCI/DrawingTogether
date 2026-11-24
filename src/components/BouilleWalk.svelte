<script lang="ts">
  import type { BouilleData } from '../bouille/model';
  import type { Expression } from '../bouille/render';
  import { bouilleWalk, stills3d, WALK_FRAMES, WALK_YAWS } from '../bouille/stills';
  import BouilleImg from './BouilleImg.svelte';

  /**
   * Bouille en pied qui marche : planche 3D pré-rendue (jouée image par image en CSS) pendant le déplacement,
   * image fixe à l'arrêt. Sans 3D, on garde le petit sautillement du dessin.
   */
  let { bouille, expr = 'neutral', dir = 1, moving = false, w = 96, h = 126 }: {
    bouille: BouilleData; expr?: Expression; dir?: 1 | -1; moving?: boolean; w?: number; h?: number;
  } = $props();

  let sheet = $state<string | null>(null);
  $effect(() => {
    const data = bouille;
    if (!stills3d()) return;
    let alive = true;
    bouilleWalk($state.snapshot(data) as BouilleData, { w: w * 2, h: h * 2 }).then((u) => alive && (sheet = u));
    return () => (alive = false);
  });
  const row = $derived(Math.max(0, WALK_YAWS.indexOf(dir * 0.6)));
</script>

{#if moving && sheet}
  <div class="walk" aria-hidden="true">
    <div class="row" style:top="{-row * 100}%" style:height="{WALK_YAWS.length * 100}%">
      <img class="strip" src={sheet} alt="" draggable="false" style:width="{WALK_FRAMES * 100}%" style:--n={WALK_FRAMES} />
    </div>
  </div>
{:else}
  <div class="still" class:hop={moving}><BouilleImg {bouille} view="full" {expr} yaw={dir * 0.6} {w} {h} /></div>
{/if}

<style>
  .walk { position: relative; width: 100%; height: 100%; overflow: hidden; }
  .row { position: absolute; left: 0; width: 100%; }
  .strip { display: block; height: 100%; max-width: none; animation: cycle 0.72s steps(var(--n)) infinite; }
  @keyframes cycle { to { transform: translateX(-100%); } }
  .still { width: 100%; height: 100%; }
  .still :global(svg) { width: 100%; height: 100%; }
  .hop { animation: walk 0.42s ease-in-out infinite; }
  @keyframes walk { 50% { transform: translateY(-4px) rotate(2deg); } }
</style>
