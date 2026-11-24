<script lang="ts">
  import { parseBouille, type BouilleData } from '../bouille/model';
  import { renderBouille, type Expression, type View } from '../bouille/render';
  import { bouilleStill, stills3d } from '../bouille/stills';

  /** Bouille affichée en image 3D (rendu mis en cache) ; le dessin 2D s'affiche en attendant ou sans 3D. */
  let { bouille, view = 'head', expr = 'neutral', yaw = 0, w = 120, h = 120 }: {
    bouille: BouilleData | string | unknown; view?: View; expr?: Expression; yaw?: number; w?: number; h?: number;
  } = $props();
  const b = $derived(typeof bouille === 'object' && bouille && 'face' in (bouille as object) ? (bouille as BouilleData) : parseBouille(bouille));
  let img = $state<string | null>(null);
  $effect(() => {
    const data = b;
    // On garde l'image précédente pendant le rendu de la nouvelle (pas de clignotement)
    if (!data || !stills3d()) return;
    let alive = true;
    bouilleStill($state.snapshot(data) as BouilleData, { view, expr, yaw, w: w * 2, h: h * 2 }).then((u) => alive && (img = u));
    return () => (alive = false);
  });
  const svg = $derived(b ? renderBouille(b, { view, expr, turn: Math.max(-1, Math.min(1, yaw)) }) : '');
</script>

{#if img}<img src={img} alt="" draggable="false" />{:else}{@html svg}{/if}

<style>
  img { width: 100%; height: 100%; object-fit: contain; display: block; }
</style>
