<script lang="ts">
  import { onMount } from 'svelte';
  import { PAINT_BOX, PAINT_SHEETS, parseBouille, type BouilleData, type PaintSheet } from '../../bouille/model';
  import { renderBouille, toDataUrl } from '../../bouille/render';
  import { friendState, profilesWithBouille } from '../../social/api';
  import { auth } from '../../social/auth.svelte';
  import { t } from '../../lib/i18n/t.svelte';

  /** Peinture sur le visage, en pixels : crayon, gomme, pot, pipette, symétrie ; aperçu en direct à gauche. */
  /** sheet : quelle feuille (visage, arrière de la tête, corps devant, dos) ; guide : image de fond pour le corps. */
  let { bouille, sheet = 'face', guide = null, onsave, oncancel }: {
    bouille: BouilleData; sheet?: PaintSheet; guide?: string | null; onsave: (paint: string | null) => void; oncancel: () => void;
  } = $props();

  // Taille de la feuille (fixe pendant l'édition)
  const info = PAINT_SHEETS[(() => sheet)()];
  const N = info.w;
  const M = info.h;
  const initial = (() => bouille[info.key as keyof BouilleData] as string | undefined)();
  const PALETTE = ['#1f1a17', '#ffffff', '#8a5a3a', '#e8463a', '#f59f2f', '#f7d046', '#9bd33f', '#2a8a4a', '#3d7be0', '#5cb8e6', '#8a5cd6', '#ef8fb7', '#f2c6a0', '#9aa0a6'];
  type Tool = 'pen' | 'eraser' | 'fill' | 'picker';
  let tool = $state<Tool>('pen');
  let color = $state(PALETTE[0]);
  let size = $state(2);
  let mirror = $state(false);
  let grid = $state(true);
  let canvas = $state<HTMLCanvasElement>();
  let ctx: CanvasRenderingContext2D;
  let past = $state<ImageData[]>([]);
  let future = $state<ImageData[]>([]);
  let current = $state<string | undefined>(undefined);
  let friends = $state<{ name: string; b: BouilleData }[] | null>(null);
  let showFriends = $state(false);

  const background = $derived(renderBouille({ ...bouille, paint: undefined }, { only: 'face', noPaint: true, viewBox: `${PAINT_BOX.x} ${PAINT_BOX.y} ${PAINT_BOX.s} ${PAINT_BOX.s}` }));
  const isFace = info.key === 'paint';
  const preview = $derived(isFace ? renderBouille({ ...bouille, paint: current }, { view: 'head' }) : '');

  onMount(async () => {
    ctx = canvas!.getContext('2d', { willReadFrequently: true })!;
    ctx.imageSmoothingEnabled = false;
    if (initial) await drawImage(initial.startsWith('data:') ? initial : await toDataUrl(initial).catch(() => ''));
    refresh();
  });

  async function drawImage(src: string) {
    if (!src) return;
    const img = new Image();
    img.src = src;
    await img.decode().catch(() => {});
    ctx.clearRect(0, 0, N, M);
    ctx.drawImage(img, 0, 0, N, M);
  }

  function isEmpty(): boolean {
    const d = ctx.getImageData(0, 0, N, M).data;
    for (let i = 3; i < d.length; i += 4) if (d[i]) return false;
    return true;
  }
  /** Met à jour l'aperçu (image de la peinture). */
  function refresh() {
    current = isEmpty() ? undefined : canvas!.toDataURL('image/png');
  }
  function snapshot() {
    past = [...past.slice(-40), ctx.getImageData(0, 0, N, M)];
    future = [];
  }
  function undo() {
    if (!past.length) return;
    future = [...future, ctx.getImageData(0, 0, N, M)];
    ctx.putImageData(past.at(-1)!, 0, 0);
    past = past.slice(0, -1);
    refresh();
  }
  function redo() {
    if (!future.length) return;
    past = [...past, ctx.getImageData(0, 0, N, M)];
    ctx.putImageData(future.at(-1)!, 0, 0);
    future = future.slice(0, -1);
    refresh();
  }

  function dot(x: number, y: number) {
    const x0 = x - Math.floor(size / 2);
    const y0 = y - Math.floor(size / 2);
    const put = (px: number) => (tool === 'eraser' ? ctx.clearRect(px, y0, size, size) : ctx.fillRect(px, y0, size, size));
    ctx.fillStyle = color;
    put(x0);
    if (mirror) put(N - x0 - size);
  }
  function line(a: [number, number], b: [number, number]) {
    let [x0, y0] = a;
    const [x1, y1] = b;
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      dot(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) (err += dy), (x0 += sx);
      if (e2 <= dx) (err += dx), (y0 += sy);
    }
  }
  function hexToRgba(h: string): [number, number, number, number] {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
  }
  function fill(x: number, y: number, mirrored = false) {
    const img = ctx.getImageData(0, 0, N, M);
    const d = img.data;
    const at = (px: number, py: number) => (py * N + px) * 4;
    const start = at(x, y);
    const target = [d[start], d[start + 1], d[start + 2], d[start + 3]];
    const rep = hexToRgba(color);
    if (target.every((v, i) => v === rep[i])) return;
    const same = (i: number) => d[i] === target[0] && d[i + 1] === target[1] && d[i + 2] === target[2] && d[i + 3] === target[3];
    const stack = [[x, y]];
    while (stack.length) {
      const [px, py] = stack.pop()!;
      if (px < 0 || py < 0 || px >= N || py >= M) continue;
      const i = at(px, py);
      if (!same(i)) continue;
      d.set(rep, i);
      stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
    }
    ctx.putImageData(img, 0, 0);
    if (mirror && !mirrored) fill(N - 1 - x, y, true);
  }
  function pick(x: number, y: number) {
    const [r, g, b, a] = ctx.getImageData(x, y, 1, 1).data;
    if (!a) return;
    color = `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
    tool = 'pen';
  }

  let last: [number, number] | null = null;
  const cell = (e: PointerEvent): [number, number] => {
    const r = canvas!.getBoundingClientRect();
    return [Math.min(N - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * N))), Math.min(M - 1, Math.max(0, Math.floor(((e.clientY - r.top) / r.height) * M)))];
  };
  function down(e: PointerEvent) {
    e.preventDefault();
    const p = cell(e);
    if (tool === 'picker') return pick(...p);
    snapshot();
    if (tool === 'fill') {
      fill(...p);
      return refresh();
    }
    try {
      canvas!.setPointerCapture(e.pointerId);
    } catch {
      /* rien */
    }
    last = p;
    dot(...p);
  }
  function move(e: PointerEvent) {
    if (!last) return;
    const p = cell(e);
    line(last, p);
    last = p;
  }
  function up() {
    if (!last) return;
    last = null;
    refresh();
  }

  function clearAll() {
    snapshot();
    ctx.clearRect(0, 0, N, M);
    refresh();
  }

  async function openFriends() {
    showFriends = !showFriends;
    if (friends || !auth.userId) return;
    const fs = await friendState().catch(() => null);
    const list = fs ? await profilesWithBouille(fs.friends.map((f) => f.id)) : [];
    friends = list.flatMap((p) => {
      const b = parseBouille(p.bouille);
      return b?.paint ? [{ name: p.display_name || p.username, b }] : [];
    });
  }
  async function copyFrom(b: BouilleData) {
    snapshot();
    await drawImage(await toDataUrl(b.paint!).catch(() => ''));
    refresh();
    showFriends = false;
  }

  const TOOLS: [Tool, string, string][] = [
    ['pen', 'paint.pen', 'M4 20l4-1 11-11-3-3L5 16zM14 6l3 3'],
    ['eraser', 'paint.eraser', 'M8 20h12M5 15l9-9 5 5-7 7H8z'],
    ['fill', 'paint.fill', 'M5 11l7-7 7 7-7 7zM20 15q2 3 0 5'],
    ['picker', 'paint.picker', 'M14 4l6 6-2 2-6-6zM12 8l-8 8v4h4l8-8'],
  ];
</script>

<div class="fp">
  <header class="bar">
    <button class="tool" onclick={undo} disabled={!past.length} aria-label={t('bou.undo')} title={t('bou.undo')}>
      <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </button>
    <button class="tool" onclick={redo} disabled={!future.length} aria-label={t('bou.redo')} title={t('bou.redo')}>
      <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="m15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </button>
    {#each TOOLS as [id, label, icon] (id)}
      <button class="tool" class:on={tool === id} aria-pressed={tool === id} aria-label={t(label as 'paint.pen')} title={t(label as 'paint.pen')} onclick={() => (tool = id)}>
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d={icon} fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </button>
    {/each}
    <div class="sizes" role="group" aria-label={t('paint.size')}>
      {#each [1, 2, 4, 7] as s (s)}
        <button class:on={size === s} aria-pressed={size === s} aria-label="{t('paint.size')} {s}" onclick={() => (size = s)}><span style:width="{4 + s * 2.4}px" style:height="{4 + s * 2.4}px"></span></button>
      {/each}
    </div>
    <button class="tool" class:on={mirror} aria-pressed={mirror} title={t('paint.mirror')} aria-label={t('paint.mirror')} onclick={() => (mirror = !mirror)}>
      <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M12 3v18M9 7l-5 5 5 5zM15 7l5 5-5 5z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" /></svg>
    </button>
    <button class="tool" class:on={grid} aria-pressed={grid} title={t('paint.grid')} aria-label={t('paint.grid')} onclick={() => (grid = !grid)}>
      <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M4 4h16v16H4zM4 10h16M4 15h16M10 4v16M15 4v16" fill="none" stroke="currentColor" stroke-width="1.8" /></svg>
    </button>
    <span class="grow"></span>
    <div class="finish">
      <button class="pill done" onclick={() => onsave(current ?? null)}>＋ {t('bou.done')}</button>
      <button class="pill quit" onclick={oncancel}>－ {t('bou.quit')}</button>
    </div>
  </header>

  <aside class="side">
    {#if isFace}<div class="preview">{@html preview}</div>
    {:else}<p class="zone">{t(`paint.sheet.${sheet}` as 'paint.title')}</p>{/if}
    {#if auth.userId}<button class="act" onclick={openFriends} aria-expanded={showFriends}>{t('paint.copy')}</button>{/if}
    <button class="act" onclick={clearAll} disabled={!current}>{t('paint.clear')}</button>
    {#if showFriends}
      <div class="friends">
        {#if friends && !friends.length}<p>{t('paint.noFriends')}</p>{/if}
        {#each friends ?? [] as f (f.name)}
          <button onclick={() => copyFrom(f.b)} title={f.name}><span>{@html renderBouille(f.b, { view: 'head' })}</span>{f.name}</button>
        {/each}
      </div>
    {/if}
  </aside>

  <div class="board">
    <div class="sheet" style:aspect-ratio="{N} / {M}" style:width={M > N ? `min(100%, calc((100dvh - 120px) * ${N / M}))` : undefined}>
      <div class="bg" aria-hidden="true">{#if guide}<img src={guide} alt="" />{:else}{@html background}{/if}</div>
      <canvas bind:this={canvas} width={N} height={M} class:grid aria-label={t('paint.title')}
        onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} onpointerleave={up}></canvas>
      {#if grid}<div class="lines" aria-hidden="true"></div>{/if}
    </div>
  </div>

  <div class="palette" role="group" aria-label={t('bou.color')}>
    {#each PALETTE as c (c)}
      <button class:on={color === c && tool !== 'eraser'} style:--c={c} aria-label={c} onclick={() => ((color = c), tool === 'eraser' || tool === 'picker' ? (tool = 'pen') : null)}></button>
    {/each}
    <label class="custom" title={t('paint.custom')}><input type="color" bind:value={color} aria-label={t('paint.custom')} /></label>
  </div>
</div>

<style>
  .fp {
    --orange: #f28c1d; --amber: #f5b425; --ink-b: #2c2a33;
    position: fixed; inset: 0; z-index: 70; display: grid; grid-template-columns: minmax(180px, 22%) 1fr 84px; grid-template-rows: auto 1fr;
    background: #f7edd5; color: var(--ink-b);
  }
  .bar { grid-column: 1 / -1; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 8px 12px; padding-top: max(8px, env(safe-area-inset-top)); background: linear-gradient(var(--amber), #efa714); }
  .tool { width: 52px; height: 52px; display: grid; place-items: center; border: 0; border-radius: 16px; background: #fff; color: var(--ink-b); box-shadow: 0 4px 0 rgba(0, 0, 0, 0.12); cursor: pointer; }
  .tool.on { background: var(--orange); color: #fff; }
  .tool:disabled { opacity: 0.45; cursor: default; }
  .sizes { display: flex; gap: 4px; background: rgba(255, 255, 255, 0.45); padding: 4px; border-radius: 16px; }
  .sizes button { width: 40px; height: 44px; border: 0; border-radius: 12px; background: none; display: grid; place-items: center; cursor: pointer; }
  .sizes button span { display: block; background: var(--ink-b); border-radius: 2px; }
  .sizes .on { background: #fff; }
  .grow { flex: 1; }
  .finish { display: grid; gap: 6px; }
  .pill { border: 0; border-radius: 14px; padding: 6px 22px; font: inherit; font-weight: 800; cursor: pointer; box-shadow: 0 3px 0 rgba(0, 0, 0, 0.12); min-width: 140px; }
  .done { color: #fff; background: linear-gradient(#f6a83a, var(--orange)); }
  .quit { background: #f9d37a; color: var(--ink-b); }

  .side { padding: 14px; display: grid; gap: 10px; align-content: start; overflow: auto; }
  .preview { aspect-ratio: 1; border-radius: 14px; border: 6px solid #f2dfae; background: repeating-conic-gradient(#e9e2d2 0 25%, #f3eee3 0 50%) 0 0 / 20px 20px; }
  .preview :global(svg) { width: 100%; height: 100%; }
  .act { border: 0; border-radius: 14px; padding: 10px; font: inherit; font-weight: 800; background: #fff; color: var(--ink-b); box-shadow: 0 3px 0 rgba(0, 0, 0, 0.1); cursor: pointer; }
  .act:disabled { opacity: 0.5; cursor: default; }
  .friends { display: grid; gap: 6px; }
  .friends p { margin: 0; font-size: 0.85rem; color: #7a6a4a; }
  .friends button { display: flex; align-items: center; gap: 8px; border: 0; border-radius: 12px; background: #fff; padding: 4px 8px; font: inherit; font-weight: 700; cursor: pointer; color: var(--ink-b); }
  .friends span { width: 36px; height: 36px; display: block; }
  .friends span :global(svg) { width: 100%; height: 100%; }

  .board { display: grid; place-items: center; padding: 14px; min-height: 0; min-width: 0; }
  .sheet { position: relative; width: min(100%, calc(100dvh - 120px)); aspect-ratio: 1; border-radius: 10px; overflow: hidden; background: repeating-conic-gradient(#ddd6c6 0 25%, #ebe5d8 0 50%) 0 0 / 24px 24px; }
  .bg, canvas, .lines { position: absolute; inset: 0; width: 100%; height: 100%; }
  .bg img { width: 100%; height: 100%; display: block; opacity: 0.85; }
  .zone { margin: 0; font-weight: 800; padding: 10px 12px; background: #fff; border-radius: 14px; }
  .bg :global(svg) { width: 100%; height: 100%; display: block; }
  canvas { image-rendering: pixelated; touch-action: none; cursor: crosshair; }
  .lines {
    pointer-events: none;
    background:
      linear-gradient(90deg, transparent calc(50% - 1px), rgba(242, 140, 29, 0.6) calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px)),
      linear-gradient(transparent calc(50% - 1px), rgba(242, 140, 29, 0.6) calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px)),
      linear-gradient(90deg, rgba(0, 0, 0, 0.12) 1px, transparent 1px) 0 0 / 6.25% 6.25%,
      linear-gradient(rgba(0, 0, 0, 0.12) 1px, transparent 1px) 0 0 / 6.25% 6.25%;
  }

  .palette { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 14px 10px; margin: 14px 10px 14px 0; border-radius: 26px; background: linear-gradient(var(--amber), #efa714); overflow-y: auto; }
  .palette button, .custom { flex: none; width: 48px; height: 40px; border-radius: 48% 52% 46% 54% / 55% 48% 52% 45%; border: 3px solid #fff; background: var(--c); cursor: pointer; box-shadow: 0 2px 0 rgba(0, 0, 0, 0.15); }
  .palette .on { outline: 4px solid #c25e00; outline-offset: 1px; }
  .custom { position: relative; background: conic-gradient(red, yellow, lime, cyan, blue, magenta, red); }
  .custom input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }

  @media (max-width: 760px) {
    .fp { grid-template-columns: 1fr 64px; grid-template-rows: auto auto 1fr; }
    .bar { gap: 5px; padding: 6px; }
    .tool { width: 42px; height: 42px; border-radius: 12px; }
    .sizes button { width: 32px; height: 38px; }
    .finish { grid-template-columns: 1fr 1fr; width: 100%; }
    .pill { min-width: 0; }
    .side { grid-column: 1 / -1; grid-template-columns: 72px 1fr 1fr; align-items: center; padding: 8px 10px 0; }
    .friends { grid-column: 1 / -1; }
    .board { padding: 8px; }
    .sheet { width: min(100%, calc(100dvh - 300px)); }
    .palette { margin: 8px 8px 8px 0; padding: 10px 6px; }
    .palette button, .custom { width: 40px; height: 34px; }
  }
</style>
