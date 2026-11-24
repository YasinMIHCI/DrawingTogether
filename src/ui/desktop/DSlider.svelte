<script lang="ts">
  /** Curseur compact avec champ numérique. */
  let { label, value, min, max, step = 1, unit = '', width = 110, onchange }: {
    label: string; value: number; min: number; max: number; step?: number; unit?: string; width?: number; onchange: (v: number) => void;
  } = $props();
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const shown = $derived(step < 1 ? Math.round(value * 10) / 10 : Math.round(value));
</script>

<label class="ds">
  <span class="d-label">{label}</span>
  <input type="range" {min} {max} {step} {value} style:width="{width}px" oninput={(e) => onchange(+e.currentTarget.value)} />
  <input type="number" {min} {max} {step} value={shown} aria-label={label}
    onchange={(e) => { const v = parseFloat(e.currentTarget.value); if (Number.isFinite(v)) onchange(clamp(v)); }} />
  {#if unit}<span class="d-label">{unit}</span>{/if}
</label>

<style>
  .ds { display: inline-flex; align-items: center; gap: 6px; }
  input[type='number'] { width: 58px; }
</style>
