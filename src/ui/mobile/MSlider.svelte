<script lang="ts">
  /**
   * Curseur avec pastille de valeur (touchez la pastille pour saisir un nombre).
   * `toPos` / `fromPos` : conversion valeur ↔ position 0..1 (ex. échelle logarithmique pour la taille).
   */
  let {
    value,
    min,
    max,
    onchange,
    label,
    toPos = (v: number) => (v - min) / (max - min),
    fromPos = (p: number) => min + p * (max - min),
    format = (v: number) => String(Math.round(v)),
    track = '',
    showPill = true,
  }: {
    value: number;
    min: number;
    max: number;
    onchange: (v: number) => void;
    label: string;
    toPos?: (v: number) => number;
    fromPos?: (p: number) => number;
    format?: (v: number) => string;
    track?: string;
    showPill?: boolean;
  } = $props();

  let editing = $state(false);
  let draft = $state('');
  const pos = $derived(Math.max(0, Math.min(1, toPos(value))));

  function commit() {
    editing = false;
    const v = parseFloat(draft.replace(',', '.'));
    if (Number.isFinite(v)) onchange(Math.max(min, Math.min(max, v)));
  }
</script>

<div class="m-slider">
  <input
    type="range"
    min="0"
    max="1000"
    step="1"
    value={Math.round(pos * 1000)}
    aria-label={label}
    style:--track={track || 'linear-gradient(var(--m-line), var(--m-line))'}
    style:--fill={track ? 'transparent' : 'var(--m-ink)'}
    style:--pos="{pos * 100}%"
    oninput={(e) => onchange(fromPos(+e.currentTarget.value / 1000))}
  />
  {#if showPill}
    {#if editing}
      <!-- svelte-ignore a11y_autofocus -->
      <input class="m-value" type="text" inputmode="decimal" bind:value={draft} autofocus
        onblur={commit} onkeydown={(e) => e.key === 'Enter' && commit()} aria-label={label} />
    {:else}
      <button class="m-value" onclick={() => ((draft = format(value)), (editing = true))} aria-label={label}>{format(value)}</button>
    {/if}
  {/if}
</div>

<style>
  .m-slider { display: flex; align-items: center; gap: 12px; min-height: 44px; }
  input[type='range'] {
    flex: 1; min-width: 0; height: 28px; margin: 0; background: transparent; -webkit-appearance: none; appearance: none;
  }
  input[type='range']::-webkit-slider-runnable-track {
    height: 10px; border-radius: 5px;
    background: linear-gradient(to right, var(--fill) var(--pos), transparent var(--pos)), var(--track);
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.08);
  }
  input[type='range']::-moz-range-track {
    height: 10px; border-radius: 5px;
    background: linear-gradient(to right, var(--fill) var(--pos), transparent var(--pos)), var(--track);
  }
  input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none; width: 30px; height: 30px; margin-top: -10px; border-radius: 50%;
    background: #fff; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
  }
  input[type='range']::-moz-range-thumb { width: 30px; height: 30px; border: 0; border-radius: 50%; background: #fff; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35); }
</style>
