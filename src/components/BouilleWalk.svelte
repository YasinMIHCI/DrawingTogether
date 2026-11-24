<script lang="ts">
  import type { BouilleData } from '../bouille/model';
  import type { Expression } from '../bouille/render';
  import { GESTURES, type GestureName } from '../bouille/poses';
  import { bouilleGesture, bouilleWalk, GESTURE_ABOVE, stills3d, WALK_FRAMES, WALK_YAWS } from '../bouille/stills';
  import BouilleImg from './BouilleImg.svelte';

  /**
   * Bouille en pied sur la place : planche 3D de marche (jouée image par image en CSS) seulement pendant le déplacement,
   * image fixe à l'arrêt, et un geste joué une fois (`gesture`, puis `ondone`). Sans 3D : petits sautillements du dessin.
   */
  let { bouille, expr = 'neutral', dir = 1, moving = false, gesture = null, ondone, w = 96, h = 126 }: {
    bouille: BouilleData; expr?: Expression; dir?: 1 | -1; moving?: boolean;
    /** Geste en cours (`id` change à chaque clic) */
    gesture?: { name: GestureName; id: number } | null;
    ondone?: () => void;
    w?: number; h?: number;
  } = $props();

  const yaw = $derived(dir * 0.6);
  let walkSheet = $state<string | null>(null);
  $effect(() => {
    const data = bouille;
    if (!stills3d()) return;
    let alive = true;
    bouilleWalk($state.snapshot(data) as BouilleData, { w: w * 2, h: h * 2 }).then((u) => alive && (walkSheet = u));
    return () => (alive = false);
  });

  // Geste : planche rendue au premier clic (puis en cache) ; en attendant, ou sans 3D, un saut du dessin
  let gestureSheet = $state<{ id: number; url: string | null } | null>(null);
  $effect(() => {
    const g = gesture;
    if (!g) return;
    let alive = true;
    const done = (url: string | null) => alive && (gestureSheet = { id: g.id, url });
    if (!stills3d()) done(null);
    else bouilleGesture($state.snapshot(bouille) as BouilleData, g.name, { yaw, w: w * 2, h: h * 2 }).then(done);
    return () => (alive = false);
  });
  const g = $derived(gesture ? GESTURES[gesture.name] : null);
  const ready = $derived(gesture && gestureSheet?.id === gesture.id ? gestureSheet : null);
  const sheetGesture = $derived(gesture && g && ready?.url ? ready.url : null);
  const walking = $derived(moving && !!walkSheet && !gesture);
  const row = $derived(Math.max(0, WALK_YAWS.indexOf(yaw)));
</script>

<!-- L'image fixe reste toujours montée (pas de retour au dessin 2D le temps d'un nouveau rendu) ; les planches se posent par-dessus -->
<div class="still" class:hidden={sheetGesture || walking} class:hop={moving && !walkSheet && !gesture} class:pop={gesture && ready && !ready.url}
  onanimationend={(e) => e.animationName.endsWith('pop') && ondone?.()}>
  <BouilleImg {bouille} view="full" {expr} {yaw} {w} {h} />
</div>
{#if sheetGesture && gesture && g}
  <div class="gesture" aria-hidden="true" style:top="{-GESTURE_ABOVE * 100}%" style:height="{(1 + GESTURE_ABOVE) * 100}%">
    {#key gesture.id}
      <img class="strip once" src={sheetGesture} alt="" draggable="false" style:width="{g.frames * 100}%" style:--n={g.frames}
        style:animation-duration="{g.dur}s" onanimationend={() => ondone?.()} />
    {/key}
  </div>
{:else if walking}
  <div class="walk" aria-hidden="true">
    <div class="row" style:top="{-row * 100}%" style:height="{WALK_YAWS.length * 100}%">
      <img class="strip loop" src={walkSheet} alt="" draggable="false" style:width="{WALK_FRAMES * 100}%" style:--n={WALK_FRAMES} />
    </div>
  </div>
{/if}

<style>
  .walk { position: absolute; inset: 0; overflow: hidden; }
  .gesture { position: absolute; left: 0; width: 100%; overflow: hidden; }
  .row { position: absolute; left: 0; width: 100%; }
  .strip { display: block; height: 100%; max-width: none; }
  .loop { animation: cycle 0.72s steps(var(--n)) infinite; }
  .once { animation-name: cycle; animation-timing-function: steps(var(--n)); animation-iteration-count: 1; }
  @keyframes cycle { to { transform: translateX(-100%); } }
  .still { width: 100%; height: 100%; }
  .hidden { visibility: hidden; }
  .still :global(svg) { width: 100%; height: 100%; }
  .hop { animation: walk 0.42s ease-in-out infinite; }
  @keyframes walk { 50% { transform: translateY(-4px) rotate(2deg); } }
  .pop { animation: pop 0.9s ease-out; }
  @keyframes pop { 30% { transform: translateY(-14px) rotate(-6deg); } 60% { transform: translateY(0) rotate(4deg); } }
</style>
