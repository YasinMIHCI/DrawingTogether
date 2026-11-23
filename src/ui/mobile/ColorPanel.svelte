<script lang="ts">
  import type { Editor } from '../../engine/editor';
  import { hexToRgb, hsvToHex, isHexColor, normalizeHex, rgbToHex, rgbToHsv } from '../../engine/color';
  import { activePalette, addPalette, colorPrefs, removePalette } from '../../lib/colorPrefs.svelte';
  import { t } from '../../lib/i18n/t.svelte';
  import Icon from './Icon.svelte';
  import MSlider from './MSlider.svelte';
  import ColorWheel from './ColorWheel.svelte';
  import { CHECKER } from './sliders';

  let { editor, tick, wheelSize = 260 }: { editor: Editor; tick: number; wheelSize?: number } = $props();

  const color = $derived((void tick, editor.color));
  // On garde la teinte en mémoire : elle se perd quand la couleur devient grise ou noire.
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
  const setHex = (hex: string) => editor.setColor(hex);

  let tab = $state<'sets' | 'sliders'>('sets');
  let model = $state<'hsv' | 'rgb'>('hsv');
  let editingHex = $state(false);
  let hexDraft = $state('');
  let paletteMenu = $state(false);
  const rgb = $derived(hexToRgb(color));
  const palette = $derived(activePalette());
  const paletteName = (i: number) => colorPrefs.palettes[i].name || t('m.paletteDefault');

  function swap() {
    const s = colorPrefs.secondary;
    colorPrefs.secondary = color;
    setHex(s);
  }
  function commitHex() {
    editingHex = false;
    if (isHexColor(hexDraft)) setHex(normalizeHex(hexDraft));
  }
  function addColor() {
    if (!palette.colors.includes(color)) palette.colors.push(color);
  }
  let pressTimer: ReturnType<typeof setTimeout> | undefined;
  let longPressed = false;
  function swatchDown(i: number) {
    longPressed = false;
    pressTimer = setTimeout(() => {
      longPressed = true;
      if (confirm(t('m.removeColor'))) palette.colors.splice(i, 1);
    }, 600);
  }
  function swatchUp(c: string) {
    clearTimeout(pressTimer);
    if (!longPressed) setHex(c);
  }
  const rgbTrack = (k: 0 | 1 | 2) => {
    const lo = [...rgb] as [number, number, number];
    const hi = [...rgb] as [number, number, number];
    lo[k] = 0;
    hi[k] = 255;
    return `linear-gradient(to right, ${rgbToHex(...lo)}, ${rgbToHex(...hi)})`;
  };
  const setRgb = (k: 0 | 1 | 2, val: number) => {
    const c = [...rgb] as [number, number, number];
    c[k] = Math.round(val);
    setHex(rgbToHex(...c));
  };
</script>

<div class="color">
  <div class="head">
    <div class="pair">
      <button class="sec" style:background={colorPrefs.secondary} onclick={swap} aria-label={t('m.secondary')} title={t('m.secondary')}></button>
      <span class="main" style:background={color} title={t('m.primary')}></span>
    </div>
    {#if editingHex}
      <!-- svelte-ignore a11y_autofocus -->
      <input class="hex-input" type="text" bind:value={hexDraft} autofocus maxlength="7" onblur={commitHex}
        onkeydown={(e) => e.key === 'Enter' && commitHex()} aria-label={t('m.editHex')} />
    {:else}
      <button class="hex" onclick={() => ((hexDraft = color), (editingHex = true))} aria-label={t('m.editHex')}>
        {color.toUpperCase()} <Icon name="edit" size={18} />
      </button>
    {/if}
    <button class="transparent" style:background={CHECKER} onclick={() => editor.setTool('eraser')} aria-label={t('m.transparent')} title={t('m.transparent')}></button>
  </div>

  <ColorWheel h={hsv[0]} s={hsv[1]} v={hsv[2]} size={wheelSize} onchange={setHsv} />

  <div class="tabs" role="tablist">
    <button role="tab" aria-selected={tab === 'sets'} onclick={() => (tab = 'sets')}>{t('m.colorSets')}</button>
    <button role="tab" aria-selected={tab === 'sliders'} onclick={() => (tab = 'sliders')}>{t('m.colorSliders')}</button>
  </div>

  {#if tab === 'sets'}
    <div class="sets">
      <div class="set-head">
        <button class="m-icon-btn" onclick={() => (paletteMenu = !paletteMenu)} aria-expanded={paletteMenu} aria-label={t('m.colorSets')}><Icon name="menu" /></button>
        {#if paletteMenu}
          <div class="pmenu">
            {#each colorPrefs.palettes as _, i (i)}
              <button class:active={i === colorPrefs.active} onclick={() => ((colorPrefs.active = i), (paletteMenu = false))}>{paletteName(i)}</button>
            {/each}
            <button onclick={() => { addPalette(t('m.newPalette')); paletteMenu = false; }}>＋ {t('m.newPalette')}</button>
            <button onclick={() => { const n = prompt(t('m.renamePalette'), paletteName(colorPrefs.active)); if (n) palette.name = n; paletteMenu = false; }}>{t('m.renamePalette')}</button>
            {#if colorPrefs.palettes.length > 1}
              <button onclick={() => { removePalette(colorPrefs.active); paletteMenu = false; }}>{t('m.deletePalette')}</button>
            {/if}
          </div>
        {/if}
        <span>{paletteName(colorPrefs.active)}</span>
      </div>
      <div class="swatches">
        {#each palette.colors as c, i (c + i)}
          <button class="sw" style:background={c} aria-label={c} onpointerdown={() => swatchDown(i)}
            onpointerup={() => swatchUp(c)} onpointerleave={() => clearTimeout(pressTimer)}></button>
        {/each}
        <button class="sw add" onclick={addColor} aria-label={t('m.addColor')}><Icon name="plus" /></button>
      </div>
      <p class="m-hint">{t('m.paletteHint')}</p>
    </div>
  {:else}
    <div class="sliders">
      <div class="m-seg model">
        <button aria-pressed={model === 'hsv'} onclick={() => (model = 'hsv')}>{t('m.hsv')}</button>
        <button aria-pressed={model === 'rgb'} onclick={() => (model = 'rgb')}>{t('m.rgb')}</button>
      </div>
      {#if model === 'hsv'}
        <p class="lbl">{t('m.hue')}</p>
        <MSlider label={t('m.hue')} value={hsv[0]} min={0} max={360} onchange={(x) => setHsv(x, hsv[1], hsv[2])}
          track="linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" />
        <p class="lbl">{t('m.sat')}</p>
        <MSlider label={t('m.sat')} value={hsv[1] * 100} min={0} max={100} onchange={(x) => setHsv(hsv[0], x / 100, hsv[2])}
          track="linear-gradient(to right, {hsvToHex(hsv[0], 0, hsv[2])}, {hsvToHex(hsv[0], 1, hsv[2])})" />
        <p class="lbl">{t('m.val')}</p>
        <MSlider label={t('m.val')} value={hsv[2] * 100} min={0} max={100} onchange={(x) => setHsv(hsv[0], hsv[1], x / 100)}
          track="linear-gradient(to right, #000, {hsvToHex(hsv[0], hsv[1], 1)})" />
      {:else}
        {#each [0, 1, 2] as const as k (k)}
          {@const label = t(k === 0 ? 'm.red' : k === 1 ? 'm.green' : 'm.blue')}
          <p class="lbl">{label}</p>
          <MSlider {label} value={rgb[k]} min={0} max={255} onchange={(x) => setRgb(k, x)} track={rgbTrack(k)} />
        {/each}
      {/if}
    </div>
  {/if}
</div>

<style>
  .color { padding: 10px 16px 12px; display: grid; gap: 10px; max-height: min(72vh, 680px); overflow-y: auto; }
  .head { display: flex; align-items: center; gap: 12px; }
  .pair { position: relative; width: 92px; height: 56px; flex: none; }
  .main, .sec { position: absolute; width: 52px; height: 52px; border-radius: 50%; }
  .main { left: 0; top: 2px; border: 3px solid var(--m-accent); box-shadow: 0 0 0 2px var(--m-panel) inset; pointer-events: none; }
  .sec { left: 36px; top: 2px; border: 1px solid var(--m-line); }
  .hex { display: inline-flex; gap: 6px; align-items: center; font-size: 1.05rem; color: var(--m-text); font-variant-numeric: tabular-nums; }
  .hex-input { width: 110px; }
  .transparent { margin-left: auto; width: 48px; height: 48px; border-radius: 50%; border: 1px solid var(--m-line); }
  .tabs { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1px solid var(--m-line); }
  .tabs button { padding: 10px 0; color: var(--m-soft); border-bottom: 3px solid transparent; }
  .tabs [aria-selected='true'] { color: var(--m-accent); border-bottom-color: var(--m-accent); }
  .sets { background: rgba(127, 127, 127, 0.08); border-radius: 12px; padding-bottom: 6px; }
  .set-head { display: flex; align-items: center; gap: 6px; background: var(--m-card); border-radius: 12px 12px 0 0; position: relative; }
  .pmenu { position: absolute; left: 8px; top: 50px; z-index: 2; background: var(--m-card); box-shadow: var(--m-shadow); border-radius: 12px; display: grid; min-width: 230px; overflow: hidden; }
  .pmenu button { padding: 12px 14px; text-align: left; border-bottom: 1px solid var(--m-line); }
  .pmenu .active { color: var(--m-accent); }
  .swatches { display: grid; grid-template-columns: repeat(auto-fill, minmax(44px, 1fr)); }
  .sw { aspect-ratio: 1; border-radius: 0; }
  .sw.add { display: grid; place-items: center; color: var(--m-soft); border: 2px solid var(--m-line); }
  .sets .m-hint { padding: 0 10px; }
  .model { display: grid; grid-template-columns: 1fr 1fr; }
  .lbl { margin: 6px 0 0; }
</style>
