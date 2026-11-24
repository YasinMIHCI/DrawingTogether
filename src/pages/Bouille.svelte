<script lang="ts">
  import { onMount } from 'svelte';
  import {
    ADJUST, CLOTH, COLORS, COUNT, PANTS, RANGE, defaultBouille, parseBouille, randomBouille, stringifyBouille,
    type BouilleData, type Category, type Part,
  } from '../bouille/model';
  import { bouillePng, renderBouille, type View } from '../bouille/render';
  import { appChrome } from '../lib/appChrome.svelte';
  import { settings } from '../lib/settings.svelte';
  import { href } from '../lib/router.svelte';
  import { t } from '../lib/i18n/t.svelte';
  import type { Key } from '../lib/i18n/i18n.svelte';
  import { auth, saveBouille } from '../social/auth.svelte';
  import { router } from '../lib/router.svelte';
  import FacePaint from '../ui/bouille/FacePaint.svelte';
  import Bouille3DView from '../ui/bouille/Bouille3DView.svelte';
  import { bouilleStill } from '../bouille/stills';
  import { PAINT_SHEETS, type PaintSheet } from '../bouille/model';
  import type { Bouille3D, Brush } from '../bouille/three3d';
  import { EXPRESSIONS, type Expression } from '../bouille/render';

  /** Créateur de Bouille : aperçu à gauche, parties et réglages à droite. */
  const CATS: Category[] = ['face', 'hair', 'brows', 'eyes', 'nose', 'mouth', 'beard', 'must', 'glasses', 'mark', 'body'];
  const OPTIONAL = new Set<Category>(['beard', 'must', 'glasses', 'mark']);

  // #/bouille/new : juste après l'inscription, on part d'une Bouille au hasard
  const welcome = router.param === 'new';
  let b = $state<BouilleData>((!welcome && parseBouille(settings.bouille)) || (welcome ? randomBouille() : defaultBouille()));
  let saved = settings.bouille ?? stringifyBouille(defaultBouille());
  let past = $state<string[]>([]);
  let future = $state<string[]>([]);
  let cat = $state<Category>('face');
  let view = $state<View>('bust');
  let turn = $state(0);
  // 3D par défaut (choix mémorisé), 2D si l'appareil ne la gère pas
  let mode3d = $state(readMode());
  let yaw = $state(0);
  function readMode(): boolean {
    try {
      return localStorage.getItem('dt.bouille3d') !== '0';
    } catch {
      return true;
    }
  }
  $effect(() => {
    try {
      localStorage.setItem('dt.bouille3d', mode3d ? '1' : '0');
    } catch {
      /* rien */
    }
  });
  let busy = $state(false);
  let painting = $state(false);
  // Peinture : choix de la zone et de la méthode (feuille 2D ou directement sur le modèle 3D)
  let choosing = $state(false);
  let sheet = $state<PaintSheet>('face');
  let guide = $state<string | null>(null);
  let engine = $state.raw<Bouille3D | null>(null);
  let painting3d = $state(false);
  const PALETTE = ['#1f1a17', '#ffffff', '#8a5a3a', '#e8463a', '#f59f2f', '#f7d046', '#9bd33f', '#2a8a4a', '#3d7be0', '#5cb8e6', '#8a5cd6', '#ef8fb7', '#f2c6a0', '#9aa0a6'];
  let color3d = $state(PALETTE[0]);
  let size3d = $state(3);
  let eraser3d = $state(false);
  let mirror3d = $state(false);
  let undo3d: Record<PaintSheet, ImageData>[] = [];
  const SHEETS: PaintSheet[] = ['face', 'head', 'body', 'back'];
  const ALL_SHEETS = Object.keys(PAINT_SHEETS) as PaintSheet[];
  const brush3d = $derived<Brush | null>(painting3d ? { color: eraser3d ? null : color3d, size: size3d, mirror: mirror3d } : null);
  const FLAT: Record<string, PaintSheet> = { face: 'flatFace', head: 'flatHead', body: 'flatBody', back: 'flatBack' };
  function openSheet(k: PaintSheet, method: '2d' | '3d' | 'skin') {
    choosing = false;
    if (method === '2d') {
      // Calque plat façon « feuille » : le dessin peut dépasser de la Bouille
      const f = FLAT[k];
      sheet = f;
      guide = engine ? engine.guide(f as 'flatFace') : null;
      painting = true;
      return;
    }
    if (method === '3d') {
      mode3d = true;
      if (k === 'head' || k === 'back') yaw = Math.PI;
      else yaw = 0;
      view = k === 'body' || k === 'back' ? 'full' : 'bust';
      undo3d = [];
      painting3d = true;
      return;
    }
    sheet = k;
    guide = (k === 'body' || k === 'back') && engine ? engine.guide(k) : null;
    painting = true;
  }
  const hasPaint = (k: PaintSheet) => !!(b as unknown as Record<string, string>)[PAINT_SHEETS[k].key] || !!(b as unknown as Record<string, string>)[PAINT_SHEETS[FLAT[k]].key];
  function snapshot3d() {
    if (!engine) return;
    const snap = {} as Record<PaintSheet, ImageData>;
    for (const k of SHEETS) {
      const c = engine.sheets.canvases[k];
      snap[k] = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
    }
    undo3d = [...undo3d.slice(-30), snap];
  }
  function undoStroke() {
    const snap = undo3d.pop();
    if (!snap || !engine) return;
    for (const k of SHEETS) engine.sheets.canvases[k].getContext('2d')!.putImageData(snap[k], 0, 0);
    engine.refreshPaint();
    undo3d = [...undo3d];
  }
  function finish3d(save: boolean) {
    const e = engine;
    painting3d = false;
    if (!e) return;
    if (!save) {
      // On recharge les peintures d'origine
      for (const k of SHEETS) e.sheets.remember(k, '\u0000');
      e.set($state.snapshot(b) as BouilleData, { view, expr });
      return;
    }
    edit(() => {
      for (const k of SHEETS) {
        const v = e.sheets.export(k);
        const key = PAINT_SHEETS[k].key;
        if (v) (b as unknown as Record<string, string>)[key] = v;
        else delete (b as unknown as Record<string, string>)[key];
        e.sheets.remember(k, v);
      }
    });
  }
  let expr = $state<Expression>('neutral');
  let error = $state<string | null>(null);

  onMount(() => {
    appChrome.fullscreen = true;
    return () => (appChrome.fullscreen = false);
  });

  function remember() {
    past = [...past.slice(-80), stringifyBouille(b)];
    future = [];
  }
  function edit(fn: () => void) {
    remember();
    fn();
  }
  function undo() {
    if (!past.length) return;
    future = [...future, stringifyBouille(b)];
    b = parseBouille(past.at(-1))!;
    past = past.slice(0, -1);
  }
  function redo() {
    if (!future.length) return;
    past = [...past, stringifyBouille(b)];
    b = parseBouille(future.at(-1))!;
    future = future.slice(0, -1);
  }

  const partOf = (c: Category) => b[c as Exclude<Category, 'body'>] as Part;
  const preview = $derived(renderBouille(b, { view, turn, expr }));

  /** Vignette d'un modèle de la partie (réglages remis à zéro pour bien la voir). */
  function thumb(c: Category, s: number): string {
    const copy = parseBouille(stringifyBouille(b))!;
    const p = copy[c as Exclude<Category, 'body'>] as Part;
    Object.assign(p, { s, z: 0, y: 0, x: 0, r: 0 });
    if (c === 'hair') copy.hair.f = b.hair.f;
    return renderBouille(copy, { only: c });
  }
  const icon = (c: Category) =>
    c === 'body' ? renderBouille(b, { view: 'full' }) : OPTIONAL.has(c) && partOf(c).s === 0 ? thumb(c, 1) : renderBouille(b, { only: c });
  const thumbs = $derived(cat === 'body' ? [] : Array.from({ length: COUNT[cat] }, (_, s) => (OPTIONAL.has(cat) && s === 0 ? '' : thumb(cat, s))));

  // Glisser l'aperçu pour tourner la tête
  let drag: { x: number; turn: number } | null = null;
  function down(e: PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag = { x: e.clientX, turn };
  }
  function move(e: PointerEvent) {
    if (drag) turn = Math.max(-1, Math.min(1, drag.turn + (e.clientX - drag.x) / 160));
  }

  const leave = () => (location.hash = href(auth.userId ? 'account' : 'home'));

  async function done() {
    busy = true;
    error = null;
    settings.bouille = stringifyBouille(b);
    if (auth.userId) {
      try {
        // Image de l'avatar : rendu 3D si la 3D est utilisée, sinon le dessin 2D
        const still = mode3d ? await bouilleStill($state.snapshot(b) as BouilleData, { view: 'head', w: 256, h: 256, background: '#f4efe2' }) : null;
        const png = still ? await (await fetch(still)).blob() : await bouillePng(b, 256, '#f4efe2');
        settings.bouille = await saveBouille(settings.bouille, png);
      } catch {
        error = t('bou.saveError');
        busy = false;
        return;
      }
    }
    busy = false;
    saved = stringifyBouille(b);
    leave();
  }
  function quit() {
    if (stringifyBouille(b) !== saved && !confirm(t('bou.quitConfirm'))) return;
    leave();
  }

  const adjKey = (k: 'z' | 'y' | 'x' | 'r') => `bou.${k}` as Key;
  const range = (k: 'z' | 'y' | 'x' | 'r') => RANGE[k];
</script>

<div class="maker" class:paint3d={painting3d}>
  <header class="bar">
    <button class="tool" onclick={undo} disabled={!past.length} title={t('bou.undo')} aria-label={t('bou.undo')}>
      <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </button>
    <button class="tool" onclick={redo} disabled={!future.length} title={t('bou.redo')} aria-label={t('bou.redo')}>
      <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="m15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </button>
    <button class="tool wide" onclick={() => edit(() => (b = randomBouille()))}>🎲 <span class="lbl">{t('bou.random')}</span></button>
    <div class="seg" role="group" aria-label="2D / 3D">
      <button aria-pressed={!mode3d} onclick={() => (mode3d = false)}>2D</button>
      <button aria-pressed={mode3d} onclick={() => (mode3d = true)}>3D</button>
    </div>
    <div class="seg" role="group">
      <button aria-pressed={view === 'bust'} onclick={() => (view = 'bust')}>{t('bou.bust')}</button>
      <button aria-pressed={view === 'full'} onclick={() => (view = 'full')}>{t('bou.full')}</button>
    </div>
    <span class="grow"></span>
    <div class="finish">
      <button class="pill done" onclick={done} disabled={busy}>＋ {t('bou.done')}</button>
      <button class="pill quit" onclick={quit}>－ {t('bou.quit')}</button>
    </div>
  </header>

  <section class="stage">
    {#if mode3d}
      <div class="preview" aria-label={t('bou.title')}>
        <Bouille3DView bouille={b} {view} {expr} bind:yaw bind:engine brush={brush3d} onstroke={snapshot3d}>{@html preview}</Bouille3DView>
        {#if brush3d}
          <div class="p3d" role="toolbar" aria-label={t('paint.title')}>
            <div class="p3d-row">
              {#each PALETTE as c (c)}
                <button class="sw3" class:on={!eraser3d && color3d === c} style:--c={c} aria-label={c} onclick={() => ((color3d = c), (eraser3d = false))}></button>
              {/each}
              <label class="sw3 custom" title={t('paint.custom')}><input type="color" bind:value={color3d} oninput={() => (eraser3d = false)} aria-label={t('paint.custom')} /></label>
            </div>
            <div class="p3d-row">
              {#each [1, 3, 6, 10] as s (s)}
                <button class="b3" class:on={size3d === s} aria-label="{t('paint.size')} {s}" onclick={() => (size3d = s)}><span style:width="{3 + s * 1.6}px" style:height="{3 + s * 1.6}px"></span></button>
              {/each}
              <button class="b3" class:on={eraser3d} onclick={() => (eraser3d = !eraser3d)} title={t('paint.eraser')} aria-label={t('paint.eraser')}>🧽</button>
              <button class="b3" class:on={mirror3d} onclick={() => (mirror3d = !mirror3d)} title={t('paint.mirror')} aria-label={t('paint.mirror')}>⇋</button>
              <button class="b3" onclick={() => (yaw -= Math.PI / 4)} title={t('paint.turnLeft')} aria-label={t('paint.turnLeft')}>⟲</button>
              <button class="b3" onclick={() => (yaw += Math.PI / 4)} title={t('paint.turnRight')} aria-label={t('paint.turnRight')}>⟳</button>
              <button class="b3" onclick={undoStroke} title={t('bou.undo')} aria-label={t('bou.undo')}>↶</button>
              <span class="grow"></span>
              <button class="b3 txt" onclick={() => finish3d(false)}>{t('bou.quit')}</button>
              <button class="b3 txt ok" onclick={() => finish3d(true)}>{t('bou.done')}</button>
            </div>
          </div>
        {/if}
      </div>
      <button class="reset" onclick={() => (yaw = 0)} disabled={yaw === 0}>⟲ {t('bou.resetView')}</button>
    {:else}
      <div class="preview" role="img" aria-label={t('bou.title')} onpointerdown={down} onpointermove={move} onpointerup={() => (drag = null)} onpointercancel={() => (drag = null)}>
        {@html preview}
      </div>
      <button class="reset" onclick={() => (turn = 0)} disabled={turn === 0}>⟲ {t('bou.resetView')}</button>
    {/if}
    <div class="exprs" role="group" aria-label={t('bou.expr')}>
      {#each EXPRESSIONS as e (e)}
        <button class:on={expr === e} aria-pressed={expr === e} title={t(`bou.expr.${e}` as Key)} aria-label={t(`bou.expr.${e}` as Key)} onclick={() => (expr = e)}>
          {@html renderBouille(b, { view: 'head', expr: e, viewBox: '34 62 132 116' })}
        </button>
      {/each}
    </div>
    <p class="hint">{t('bou.hint')}</p>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    {#if welcome}<p class="welcome">{t('bou.welcome')}</p>{/if}
  </section>

  <section class="panel-side">
    <div class="tabs" role="tablist">
      {#each CATS as c (c)}
        <button role="tab" aria-selected={cat === c} onclick={() => (cat = c)} title={t(`bou.cat.${c}` as Key)}>
          <span class="ti">{@html icon(c)}</span>
          <span>{t(`bou.cat.${c}` as Key)}</span>
        </button>
        {#if c === 'face'}
          <!-- Peinture du visage : onglet à part pour qu'on la trouve -->
          <button class="paint-tab" onclick={() => (choosing = true)} title={t('paint.title')}>
            <span class="ti">🖌</span>
            <span>{t('bou.cat.paint')}</span>
          </button>
        {/if}
      {/each}
    </div>

    <div class="options">
      {#if cat !== 'body'}
        <div class="grid">
          {#each thumbs as svg, s (s)}
            <button class="opt" class:on={partOf(cat).s === s} aria-pressed={partOf(cat).s === s} aria-label="{t(`bou.cat.${cat}` as Key)} {s + 1}"
              onclick={() => edit(() => (partOf(cat).s = s))}>
              {#if svg}{@html svg}{:else}<span class="none">{t('bou.none')}</span>{/if}
            </button>
          {/each}
        </div>
        {#if cat === 'face'}
          <div class="paint-row">
            <button class="act primary" onclick={() => (choosing = true)}>🖌 {b.paint ? t('paint.edit') : t('paint.add')}</button>
            {#if b.paint}<button class="act" onclick={() => edit(() => (b.paint = undefined))}>{t('paint.remove')}</button>{/if}
          </div>
        {/if}
        {#if cat === 'hair'}
          <label class="check"><input type="checkbox" checked={b.hair.f} onchange={() => edit(() => (b.hair.f = !b.hair.f))} /> {t('bou.flip')}</label>
        {/if}
        {#if COLORS[cat]}
          <h3>{cat === 'face' ? t('bou.skin') : t('bou.color')}</h3>
          <div class="swatches">
            {#each COLORS[cat]! as col, i (col)}
              <button class="sw" class:on={partOf(cat).c === i} style:--c={col} aria-label="{t('bou.color')} {i + 1}" aria-pressed={partOf(cat).c === i}
                onclick={() => edit(() => (partOf(cat).c = i))}></button>
            {/each}
          </div>
        {:else if cat === 'beard' || cat === 'must'}
          <p class="note">{t('bou.hairColor')}</p>
        {/if}
        {#each ADJUST[cat] as k (k)}
          <div class="adj">
            <span>{t(adjKey(k))}</span>
            <button class="step" aria-label="{t(adjKey(k))} −" disabled={partOf(cat)[k] <= -range(k)} onclick={() => edit(() => partOf(cat)[k]--)}>−</button>
            <input type="range" min={-range(k)} max={range(k)} step="1" value={partOf(cat)[k]} aria-label={t(adjKey(k))}
              onpointerdown={remember} oninput={(e) => (partOf(cat)[k] = +e.currentTarget.value)} />
            <button class="step" aria-label="{t(adjKey(k))} +" disabled={partOf(cat)[k] >= range(k)} onclick={() => edit(() => partOf(cat)[k]++)}>+</button>
          </div>
        {/each}
      {:else}
        <h3>{t('bou.shirt')}</h3>
        <div class="swatches">
          {#each CLOTH as col, i (col)}
            <button class="sw" class:on={b.body.c === i} style:--c={col} aria-label="{t('bou.shirt')} {i + 1}" aria-pressed={b.body.c === i} onclick={() => edit(() => (b.body.c = i))}></button>
          {/each}
        </div>
        <h3>{t('bou.pants')}</h3>
        <div class="swatches">
          {#each PANTS as col, i (col)}
            <button class="sw" class:on={b.body.p === i} style:--c={col} aria-label="{t('bou.pants')} {i + 1}" aria-pressed={b.body.p === i} onclick={() => edit(() => (b.body.p = i))}></button>
          {/each}
        </div>
        {#each [['h', 'bou.height'], ['w', 'bou.build']] as const as [k, label] (k)}
          <div class="adj">
            <span>{t(label)}</span>
            <button class="step" aria-label="{t(label)} −" disabled={b.body[k] <= -4} onclick={() => edit(() => { b.body[k]--; view = 'full'; })}>−</button>
            <input type="range" min="-4" max="4" step="1" value={b.body[k]} aria-label={t(label)}
              onpointerdown={() => { remember(); view = 'full'; }} oninput={(e) => (b.body[k] = +e.currentTarget.value)} />
            <button class="step" aria-label="{t(label)} +" disabled={b.body[k] >= 4} onclick={() => edit(() => { b.body[k]++; view = 'full'; })}>+</button>
          </div>
        {/each}
      {/if}
    </div>
  </section>
</div>

<style>
  .maker {
    --orange: #f28c1d;
    --amber: #f5b425;
    --cream: #f7edd5;
    --cream-line: #ecdcb6;
    --ink-b: #2c2a33;
    position: fixed; inset: 0; display: grid; grid-template-columns: minmax(280px, 42%) 1fr; grid-template-rows: auto 1fr;
    color: var(--ink-b);
    background:
      url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cg fill='none' stroke='%23e9d6a8' stroke-width='6' stroke-linecap='round'%3E%3Cpath d='M20 40q20-25 40 0t40 0'/%3E%3Ccircle cx='120' cy='110' r='14'/%3E%3Cpath d='M30 120l14 14m0-14l-14 14'/%3E%3C/g%3E%3C/svg%3E") 0 0 / 160px 160px,
      var(--cream);
  }
  .bar {
    grid-column: 1 / -1; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    padding: 8px 12px; padding-top: max(8px, env(safe-area-inset-top));
    background: linear-gradient(var(--amber), #efa714); box-shadow: 0 2px 0 rgba(0, 0, 0, 0.08);
  }
  .tool {
    display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-width: 52px; height: 52px; padding: 0 10px;
    border: 0; border-radius: 16px; background: #fff; color: var(--ink-b); font: inherit; font-weight: 800;
    box-shadow: 0 4px 0 rgba(0, 0, 0, 0.12); cursor: pointer;
  }
  .tool:disabled { opacity: 0.45; cursor: default; }
  .tool.wide { padding: 0 16px; }
  .seg { display: inline-flex; background: rgba(255, 255, 255, 0.45); border-radius: 16px; padding: 4px; gap: 4px; }
  .seg button { border: 0; border-radius: 12px; padding: 10px 14px; font: inherit; font-weight: 800; background: none; color: var(--ink-b); cursor: pointer; }
  .seg [aria-pressed='true'] { background: #fff; box-shadow: 0 2px 0 rgba(0, 0, 0, 0.12); color: #a14f00; }
  .grow { flex: 1; }
  .finish { display: grid; gap: 6px; }
  .pill { border: 0; border-radius: 14px; padding: 6px 22px; font: inherit; font-weight: 800; cursor: pointer; box-shadow: 0 3px 0 rgba(0, 0, 0, 0.12); min-width: 150px; }
  .done { background: #f7c96b; color: #fff; background: linear-gradient(#f6a83a, var(--orange)); }
  .quit { background: #f9d37a; color: var(--ink-b); }
  .pill:disabled { opacity: 0.6; }

  .stage { position: relative; display: grid; grid-template-rows: 1fr auto auto; padding: 14px; min-height: 0; }
  .preview {
    min-height: 0; border-radius: 22px; touch-action: none; cursor: grab;
    background: repeating-conic-gradient(#e9e2d2 0 25%, #f3eee3 0 50%) 0 0 / 24px 24px;
    border: 6px solid #f2dfae; display: grid; place-items: center; overflow: hidden;
  }
  .preview :global(svg) { width: 100%; height: 100%; max-height: 100%; }
  .exprs { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
  .exprs button { width: 48px; height: 44px; padding: 2px; border: 0; border-radius: 12px; background: #fff; cursor: pointer; box-shadow: 0 3px 0 rgba(0, 0, 0, 0.1); }
  .exprs button.on { background: var(--orange); }
  .exprs :global(svg) { width: 100%; height: 100%; background: #fff; border-radius: 9px; }
  /* Peinture 3D : seulement la Bouille et la barre d'outils, en plein écran */
  .paint3d .bar, .paint3d .panel-side, .paint3d .exprs, .paint3d .reset, .paint3d .hint { display: none !important; }
  .paint3d { grid-template-columns: 1fr !important; grid-template-rows: 1fr !important; }
  .paint3d .stage { padding: 0 !important; grid-template-rows: 1fr !important; }
  .paint3d .preview { border: 0; border-radius: 0; }
  .paint3d .p3d { left: 6px; right: 6px; bottom: max(6px, env(safe-area-inset-bottom)); padding: 6px; }
  .paint3d .p3d-row:first-child { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; }
  .paint3d .sw3 { flex: none; }
  .p3d { position: absolute; left: 10px; right: 10px; bottom: 10px; display: grid; gap: 6px; padding: 8px; border-radius: 16px; background: rgba(255, 255, 255, 0.92); box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15); }
  .preview { position: relative; }
  .p3d-row { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
  .sw3 { position: relative; width: 28px; height: 28px; border-radius: 50%; border: 2px solid #fff; background: var(--c); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3); cursor: pointer; padding: 0; }
  .sw3.on { outline: 3px solid var(--orange); }
  .sw3.custom { background: conic-gradient(red, yellow, lime, cyan, blue, magenta, red); }
  .sw3.custom input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
  .b3 { min-width: 36px; height: 36px; border: 0; border-radius: 10px; background: #f3ead5; font: inherit; font-weight: 800; cursor: pointer; display: grid; place-items: center; color: var(--ink-b); }
  .b3 span { display: block; background: var(--ink-b); border-radius: 2px; }
  .b3.on { background: var(--orange); color: #fff; }
  .b3.on span { background: #fff; }
  .b3.txt { padding: 0 12px; }
  .b3.ok { background: linear-gradient(#f6a83a, var(--orange)); color: #fff; }
  .p3d .grow { flex: 1; }
  .chooser-bg { --orange: #f28c1d; --ink-b: #2c2a33; position: fixed; inset: 0; z-index: 70; background: rgba(0, 0, 0, 0.4); display: grid; place-items: center; padding: 12px; }
  .chooser { background: #f7edd5; color: var(--ink-b); border-radius: 22px; padding: 16px; width: min(560px, 100%); max-height: 100%; overflow: auto; display: grid; gap: 10px; }
  .chooser .act.primary { background: linear-gradient(#f6a83a, var(--orange)); color: #fff; }
  .chooser h2 { margin: 0; }
  .zone-row { display: grid; grid-template-columns: 1fr auto auto; gap: 8px; align-items: center; background: #fff; padding: 8px 10px; border-radius: 14px; }
  .zone-row .link { grid-column: 2 / -1; justify-self: end; border: 0; background: none; font: inherit; font-size: 0.8rem; color: #8a6a2a; text-decoration: underline; cursor: pointer; padding: 0; }
  @media (max-width: 480px) { .zone-row { grid-template-columns: 1fr 1fr; } .zone-row b { grid-column: 1 / -1; } }
  .paint-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .act { border: 0; border-radius: 14px; padding: 10px 16px; font: inherit; font-weight: 800; background: #fff; color: var(--ink-b); box-shadow: 0 3px 0 rgba(0, 0, 0, 0.1); cursor: pointer; }
  .act.primary { background: linear-gradient(#f6a83a, var(--orange)); color: #fff; }
  .reset { justify-self: start; margin-top: 10px; border: 0; background: rgba(255, 255, 255, 0.7); border-radius: 12px; padding: 8px 12px; font: inherit; font-weight: 700; color: var(--ink-b); cursor: pointer; }
  .reset:disabled { opacity: 0.5; cursor: default; }
  .hint { margin: 6px 2px 0; font-size: 0.85rem; color: #7a6a4a; }
  .welcome { position: absolute; top: 24px; left: 24px; right: 24px; margin: 0; padding: 10px 14px; border-radius: 16px; background: #fff; font-weight: 800; box-shadow: 0 3px 0 rgba(0, 0, 0, 0.1); text-align: center; }
  .error { margin: 6px 0 0; padding: 8px 12px; border-radius: 10px; background: #ffe1dc; color: #8a1f0e; }

  .panel-side { display: grid; grid-template-rows: auto 1fr; min-height: 0; padding: 14px 14px 0 0; gap: 10px; }
  .tabs { display: flex; gap: 6px; overflow-x: auto; padding: 2px 2px 6px; scrollbar-width: thin; }
  .tabs button {
    flex: none; width: 74px; display: grid; justify-items: center; gap: 2px; padding: 6px 4px; border: 0; border-radius: 16px;
    background: #fff; color: var(--ink-b); font: inherit; font-size: 0.72rem; font-weight: 800; cursor: pointer; box-shadow: 0 3px 0 rgba(0, 0, 0, 0.1);
  }
  .tabs [aria-selected='true'] { background: var(--orange); color: #2c2a33; }
  .paint-tab .ti { font-size: 1.6rem; background: linear-gradient(#fff, #fde7c4); }
  .ti { width: 46px; height: 40px; display: grid; place-items: center; background: #fff; border-radius: 10px; }
  .ti :global(svg) { width: 100%; height: 100%; }
  .options { overflow-y: auto; padding: 4px 4px 24px; display: grid; gap: 10px; align-content: start; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(78px, 1fr)); gap: 10px; }
  .opt {
    aspect-ratio: 1; border: 0; border-radius: 18px; background: #fff; padding: 6px; cursor: pointer;
    box-shadow: 0 4px 0 rgba(0, 0, 0, 0.1); display: grid; place-items: center;
  }
  .opt :global(svg) { width: 100%; height: 100%; }
  .opt.on { background: var(--orange); box-shadow: 0 4px 0 #c96d0e; }
  .opt.on :global(svg) { background: #fff; border-radius: 12px; }
  .none { font-weight: 800; color: #9a8a6a; }
  h3 { margin: 6px 0 0; font-size: 0.95rem; }
  .swatches { display: flex; flex-wrap: wrap; gap: 8px; }
  .sw { width: 40px; height: 40px; border-radius: 50% 50% 46% 54% / 55% 48% 52% 45%; border: 3px solid #fff; background: var(--c); cursor: pointer; box-shadow: 0 2px 0 rgba(0, 0, 0, 0.15); }
  .sw.on { outline: 4px solid var(--orange); outline-offset: 1px; }
  .check { display: flex; gap: 8px; align-items: center; font-weight: 700; }
  .note { margin: 0; color: #7a6a4a; font-size: 0.9rem; }
  .adj { display: grid; grid-template-columns: 90px 40px 1fr 40px; gap: 8px; align-items: center; font-weight: 700; }
  .adj input { accent-color: var(--orange); width: 100%; }
  .step { width: 40px; height: 40px; border: 0; border-radius: 12px; background: #fff; font: inherit; font-size: 1.3rem; font-weight: 800; color: var(--ink-b); cursor: pointer; box-shadow: 0 3px 0 rgba(0, 0, 0, 0.1); }
  .step:disabled { opacity: 0.4; }

  @media (max-width: 760px) {
    .maker { grid-template-columns: 1fr; grid-template-rows: auto 34vh 1fr; }
    .stage { padding: 8px 10px 0; grid-template-rows: 1fr auto; }
    .hint { display: none; }
    .exprs { position: absolute; top: 14px; right: 16px; flex-direction: column; gap: 4px; margin: 0; }
    .exprs button { width: 36px; height: 32px; }
    .reset { position: absolute; left: 18px; bottom: 8px; margin: 0; padding: 4px 8px; font-size: 0.8rem; }
    .panel-side { padding: 8px 10px 0; }
    .tool { height: 44px; min-width: 44px; }
    .pill { min-width: 110px; padding: 4px 12px; }
    .finish { grid-template-columns: 1fr 1fr; }
    .bar .grow { display: none; }
    .bar { gap: 6px; padding: 6px 8px; }
    .lbl { display: none; }
    .tool.wide { padding: 0 12px; }
    .seg button { padding: 8px 8px; font-size: 0.85rem; }
    .finish { width: 100%; }
    .grid { grid-template-columns: repeat(auto-fill, minmax(64px, 1fr)); gap: 8px; }
  }
</style>

{#if painting}
  <FacePaint bouille={b} {sheet} {guide} oncancel={() => (painting = false)}
    onsave={(p) => { edit(() => { const k = PAINT_SHEETS[sheet].key; if (p) (b as unknown as Record<string, string>)[k] = p; else delete (b as unknown as Record<string, string>)[k]; }); painting = false; }} />
{/if}

{#if choosing}
  <div class="chooser-bg" role="presentation" onclick={(e) => e.target === e.currentTarget && (choosing = false)}>
    <div class="chooser" role="dialog" aria-label={t('paint.title')}>
      <h2>🖌 {t('bou.cat.paint')}</h2>
      <p class="note">{t('paint.choose')}</p>
      {#each SHEETS as k (k)}
        <div class="zone-row">
          <b>{t(`paint.sheet.${k}` as Key)}{hasPaint(k) ? ' ✓' : ''}</b>
          <button class="act" onclick={() => openSheet(k, '2d')}>📄 {t('paint.sheet2d')}</button>
          <button class="act primary" onclick={() => openSheet(k, '3d')}>🧊 {t('paint.on3d')}</button>
          <button class="link" onclick={() => openSheet(k, 'skin')}>{t('paint.skin2d')}</button>
        </div>
      {/each}
      <button class="act" onclick={() => (choosing = false)}>{t('acc.cancel')}</button>
    </div>
  </div>
{/if}
