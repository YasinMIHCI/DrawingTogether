<script lang="ts">
  import type { Editor } from '../../engine/editor';
  import { hexToRgb, hsvToHex, isHexColor, normalizeHex, rgbToHex, rgbToHsv } from '../../engine/color';
  import { activePalette, addPalette, colorPrefs, removePalette } from '../../lib/colorPrefs.svelte';
  import { t } from '../../lib/i18n/t.svelte';
  import Icon from '../common/Icon.svelte';
  import ColorWheel from '../mobile/ColorWheel.svelte';
  import DSlider from './DSlider.svelte';
  import { swapColors } from '../brushActions';

  /** Sélecteur de couleur bureau : roue + carré, code hex, curseurs TSV/RVB, palettes. */
  let { editor, tick, wheel = 200 }: { editor: Editor; tick: number; wheel?: number } = $props();

  const color = $derived((void tick, editor.color));
  let hsv = $state<[number, number, number]>([0, 0, 0]);
  let lastHex = '';
  $effect(() => {
    if (color !== lastHex) {
      const [h, s, v] = rgbToHsv(...hexToRgb(color));
      hsv = [s === 0 || v === 0 ? hsv[0] : h, s, v];
      lastHex = color;
    }
  });
  function setHsv(h: number, s: number, v: number) {
    hsv = [h, s, v];
    lastHex = hsvToHex(h, s, v);
    editor.setColor(lastHex);
  }
  let model = $state<'hsv' | 'rgb'>('hsv');
  const rgb = $derived(hexToRgb(color));
  const palette = $derived(activePalette());
  const setRgb = (k: 0 | 1 | 2, v: number) => {
    const c = [...rgb] as [number, number, number];
    c[k] = Math.round(v);
    editor.setColor(rgbToHex(...c));
  };
  const paletteName = (i: number) => colorPrefs.palettes[i].name || t('m.paletteDefault');
</script>

<div class="cp">
  <div class="top">
    <div class="pair">
      <button class="bg" style:background={colorPrefs.secondary} onclick={() => swapColors(editor)} title={t('m.secondary')} aria-label={t('m.secondary')}></button>
      <span class="fg" style:background={color}></span>
    </div>
    <input class="hex" type="text" value={color} maxlength="7" aria-label={t('m.editHex')}
      onchange={(e) => isHexColor(e.currentTarget.value) && editor.setColor(normalizeHex(e.currentTarget.value))} />
    <select bind:value={model} aria-label={t('m.colorSliders')}>
      <option value="hsv">{t('m.hsv')}</option><option value="rgb">{t('m.rgb')}</option>
    </select>
  </div>
  <ColorWheel h={hsv[0]} s={hsv[1]} v={hsv[2]} size={wheel} onchange={setHsv} />
  <div class="sliders">
    {#if model === 'hsv'}
      <DSlider label="T" value={hsv[0]} min={0} max={360} width={130} onchange={(v) => setHsv(v, hsv[1], hsv[2])} />
      <DSlider label="S" value={hsv[1] * 100} min={0} max={100} width={130} onchange={(v) => setHsv(hsv[0], v / 100, hsv[2])} />
      <DSlider label="V" value={hsv[2] * 100} min={0} max={100} width={130} onchange={(v) => setHsv(hsv[0], hsv[1], v / 100)} />
    {:else}
      <DSlider label="R" value={rgb[0]} min={0} max={255} width={130} onchange={(v) => setRgb(0, v)} />
      <DSlider label="V" value={rgb[1]} min={0} max={255} width={130} onchange={(v) => setRgb(1, v)} />
      <DSlider label="B" value={rgb[2]} min={0} max={255} width={130} onchange={(v) => setRgb(2, v)} />
    {/if}
  </div>
  <div class="pal-head">
    <select value={colorPrefs.active} onchange={(e) => (colorPrefs.active = +e.currentTarget.value)} aria-label={t('m.colorSets')}>
      {#each colorPrefs.palettes as _, i (i)}<option value={i}>{paletteName(i)}</option>{/each}
    </select>
    <button class="d-ibtn" onclick={() => addPalette(t('m.newPalette'))} title={t('m.newPalette')} aria-label={t('m.newPalette')}><Icon name="plus" size={16} /></button>
    <button class="d-ibtn" onclick={() => { const n = prompt(t('m.renamePalette'), paletteName(colorPrefs.active)); if (n) palette.name = n; }} title={t('m.renamePalette')} aria-label={t('m.renamePalette')}><Icon name="edit" size={16} /></button>
    <button class="d-ibtn" disabled={colorPrefs.palettes.length <= 1} onclick={() => removePalette(colorPrefs.active)} title={t('m.deletePalette')} aria-label={t('m.deletePalette')}><Icon name="trash" size={16} /></button>
  </div>
  <div class="swatches">
    {#each palette.colors as c, i (c + i)}
      <button class="sw" style:background={c} title={c} aria-label={c} onclick={() => editor.setColor(c)}
        oncontextmenu={(e) => { e.preventDefault(); palette.colors.splice(i, 1); }}></button>
    {/each}
    <button class="sw add" onclick={() => !palette.colors.includes(color) && palette.colors.push(color)} title={t('m.addColor')} aria-label={t('m.addColor')}><Icon name="plus" size={14} /></button>
  </div>
</div>

<style>
  .cp { display: grid; gap: 8px; padding: 8px; }
  .top { display: flex; align-items: center; gap: 8px; }
  .pair { position: relative; width: 50px; height: 34px; flex: none; }
  .fg, .bg { position: absolute; width: 30px; height: 30px; border-radius: 4px; border: 1px solid var(--d-line); }
  .fg { left: 0; top: 0; pointer-events: none; box-shadow: 0 0 0 2px var(--d-panel); }
  .bg { left: 18px; top: 4px; }
  .hex { width: 84px; font-variant-numeric: tabular-nums; }
  .sliders { display: grid; gap: 2px; }
  .pal-head { display: flex; align-items: center; gap: 2px; }
  .pal-head select { flex: 1; min-width: 0; }
  .swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(20px, 1fr)); gap: 2px; }
  .sw { aspect-ratio: 1; border-radius: 2px; border: 1px solid rgba(0, 0, 0, 0.15); }
  .sw.add { display: grid; place-items: center; color: var(--d-soft); border: 1px dashed var(--d-line); }
</style>
