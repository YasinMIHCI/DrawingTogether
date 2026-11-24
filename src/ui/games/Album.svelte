<script lang="ts">
  import type { Game } from '../../games/game';
  import { authorOf, getMode } from '../../games/modes';
  import { chainEntries, composeChain, composeStack, entryImage, flipbookGif } from '../../games/media';
  import { downloadBlob, timestampedName } from '../../lib/download';
  import { t } from '../../lib/i18n/t.svelte';
  import PlayerAvatar from '../../components/PlayerAvatar.svelte';
  import EntryView from './EntryView.svelte';
  import { play } from '../../lib/sound';

  let { game, tick }: { game: Game; tick: number } = $props();
  const s = $derived.by(() => {
    void tick;
    const st = game.state!;
    return { st, pos: st.album, host: game.room.isHost, reactions: game.reactions };
  });
  const mode = $derived(getMode(s.st.config.mode));
  const n = $derived(s.st.players.length);
  const author = (chain: number, round: number) => s.st.players[authorOf(chain, round, n)];
  const entries = $derived((void tick, chainEntries(s.st, (c, r) => game.entry(c, r), s.pos.chain)));
  const shown = $derived(entries.slice(0, s.pos.step + 1));
  const lastChain = $derived(s.pos.chain >= n - 1);
  const lastStep = $derived(mode.result === 'single' || s.pos.step >= s.st.rounds - 1);

  function next() {
    if (!lastStep) game.showAlbum({ chain: s.pos.chain, step: s.pos.step + 1 });
    else if (!lastChain) game.showAlbum({ chain: s.pos.chain + 1, step: 0 });
  }
  function prev() {
    if (s.pos.step > 0 && mode.result !== 'single') game.showAlbum({ chain: s.pos.chain, step: s.pos.step - 1 });
    else if (s.pos.chain > 0) game.showAlbum({ chain: s.pos.chain - 1, step: mode.result === 'single' ? 0 : s.st.rounds - 1 });
  }
  const nameOf = (id: string) => s.st.players.find((p) => p.id === id)?.nickname ?? '?';

  // Flip-book : lecture en boucle des images révélées
  let flip = $state<HTMLCanvasElement>();
  $effect(() => {
    if (mode.result !== 'flipbook' || !flip) return;
    const frames = shown.filter((e) => e.kind === 'image');
    let i = 0;
    const draw = async () => {
      const ctx = flip?.getContext('2d');
      if (!ctx || !frames.length) return;
      const img = await entryImage(frames[i % frames.length]);
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, flip!.width, flip!.height);
      if (img) ctx.drawImage(img, 0, 0, flip!.width, flip!.height);
      i++;
    };
    draw();
    const id = setInterval(draw, 280);
    return () => clearInterval(id);
  });

  // Cadavre exquis : parties empilées
  let stack = $state<HTMLCanvasElement>();
  $effect(() => {
    if (mode.result !== 'stack' || !stack) return;
    const target = stack;
    composeStack(shown).then((c) => {
      target.width = c.width;
      target.height = c.height;
      target.getContext('2d')!.drawImage(c, 0, 0);
    });
  });

  async function download() {
    const name = timestampedName(`${mode.id}-${s.pos.chain + 1}`, '.png');
    const canvas = mode.result === 'stack' ? await composeStack(entries) : mode.result === 'single' ? await composeChain(
      // Atelier libre : toute la galerie révélée
      Array.from({ length: s.pos.chain + 1 }, (_, c) => game.entry(c, 0) ?? { kind: 'empty' as const, data: '', author: author(c, 0)?.id ?? '' }),
      nameOf, t('games.empty'),
    ) : await composeChain(
      entries.map((e, r) => ({ ...e, author: e.author || author(s.pos.chain, r)?.id || '' })), nameOf, t('games.empty'),
    );
    canvas.toBlob((b) => b && downloadBlob(b, name), 'image/png');
  }
  async function downloadGif() {
    downloadBlob(await flipbookGif(entries.filter((e) => e.kind === 'image')), timestampedName(`flipbook-${s.pos.chain + 1}`, '.gif'));
  }
  const EMOJIS = ['👍', '😂', '😮', '❤️', '🔥', '👏'];
  // Petit son à chaque révélation et à chaque réaction
  let lastPos = '';
  let lastReactions = 0;
  $effect(() => {
    const pos = `${s.pos.chain}:${s.pos.step}`;
    if (lastPos && pos !== lastPos) play('pop');
    lastPos = pos;
    if (s.reactions.length > lastReactions) play('tap');
    lastReactions = s.reactions.length;
  });
</script>

<section class="album">
  <header>
    <h2>{t('games.album')} — {t(mode.name)}</h2>
    {#if mode.result !== 'single'}
      {@const starter = author(s.pos.chain, 0)}
      <p class="who"><PlayerAvatar avatar={starter?.avatar ?? 0} url={starter?.avatarUrl} bouille={starter?.bouille} size={32} expr="happy" /> {t('games.chainOf', { name: starter?.nickname ?? '?' })} · {s.pos.chain + 1} / {n}</p>
    {/if}
  </header>

  {#if mode.result === 'single'}
    <div class="gallery">
      {#each Array.from({ length: s.pos.chain + 1 }, (_, c) => c) as c (c)}
        {@const e = game.entry(c, 0)}
        <figure>
          {#if e}<EntryView entry={e} max={420} />{:else}<EntryView entry={{ kind: 'empty', data: '', author: '' }} />{/if}
          <figcaption>{t('games.by', { name: author(c, 0)?.nickname ?? '?' })}</figcaption>
        </figure>
      {/each}
    </div>
  {:else if mode.result === 'flipbook'}
    <canvas class="flip" bind:this={flip} width="480" height="360"></canvas>
    <div class="strip">
      {#each shown as e, r (r)}
        <figure class="mini"><EntryView entry={e} max={140} /><figcaption>{author(s.pos.chain, r)?.nickname}</figcaption></figure>
      {/each}
    </div>
  {:else if mode.result === 'stack'}
    <canvas class="stack" bind:this={stack}></canvas>
    <p class="credits">{shown.map((_, r) => author(s.pos.chain, r)?.nickname).join(' · ')}</p>
  {:else}
    <ol class="chain">
      {#each shown as e, r (r)}
        {@const a = author(s.pos.chain, r)}
        <li>
          <span class="by"><PlayerAvatar avatar={a?.avatar ?? 0} url={a?.avatarUrl} bouille={a?.bouille} size={28} expr={r % 3 === 1 ? 'surprised' : 'happy'} /> {a?.nickname}</span>
          <EntryView entry={e} />
        </li>
      {/each}
    </ol>
  {/if}

  <div class="reactions">
    {#each EMOJIS as em (em)}<button onclick={() => game.react(em)} aria-label={em}>{em}</button>{/each}
    <div class="floating" aria-hidden="true">
      {#each s.reactions as r (r.at + r.from)}<span style:left="{(r.at % 90) + 5}%">{r.emoji}</span>{/each}
    </div>
  </div>

  <div class="controls">
    {#if s.host}
      <button class="btn" onclick={prev} disabled={s.pos.chain === 0 && s.pos.step === 0}>{t('games.prev')}</button>
      {#if mode.result !== 'single' && !lastStep}
        <button class="btn" onclick={() => game.showAlbum({ chain: s.pos.chain, step: s.st.rounds - 1 })}>{t('games.showAll')}</button>
      {/if}
      <button class="btn primary" onclick={next} disabled={lastStep && lastChain}>{lastStep && mode.result !== 'single' ? t('games.nextChain') : t('games.next')}</button>
    {:else}
      <p class="muted">{t('games.hostReveals')}</p>
    {/if}
  </div>
  <div class="controls">
    <button class="btn" onclick={download}>{t('games.download')}</button>
    {#if mode.result === 'flipbook'}<button class="btn" onclick={downloadGif}>{t('games.downloadGif')}</button>{/if}
    {#if s.host}<button class="btn" onclick={() => game.backToLobby()}>{t('games.backToLobby')}</button>{/if}
  </div>
</section>

<style>
  .album { display: grid; gap: 14px; max-width: 760px; margin: 0 auto; width: 100%; }
  header { display: grid; gap: 4px; }
  h2 { margin: 0; }
  .who { margin: 0; display: flex; align-items: center; gap: 8px; color: var(--ink-soft); font-weight: 600; }
  .chain { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; }
  .chain li { display: grid; gap: 6px; animation: pop 0.35s ease-out; }
  .by { display: flex; align-items: center; gap: 6px; font-size: 0.9rem; color: var(--ink-soft); font-weight: 600; }
  .gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; }
  figure { margin: 0; display: grid; gap: 4px; animation: pop 0.35s ease-out; }
  figcaption { text-align: center; color: var(--ink-soft); font-size: 0.9rem; }
  .flip { width: 100%; max-width: 560px; margin: 0 auto; display: block; border-radius: 14px; border: 2px solid var(--line); background: #fff; }
  .strip { display: flex; gap: 8px; overflow-x: auto; }
  .mini { width: 140px; flex: none; }
  .stack { width: 100%; max-width: 520px; margin: 0 auto; display: block; border-radius: 14px; border: 2px solid var(--line); background: #fff; }
  .credits { text-align: center; color: var(--ink-soft); margin: 0; }
  .reactions { position: relative; display: flex; gap: 6px; justify-content: center; }
  .reactions button { font-size: 1.5rem; width: 48px; height: 48px; border-radius: 50%; border: 2px solid var(--line); background: var(--surface); cursor: pointer; }
  .floating { position: absolute; inset: -160px 0 40px; pointer-events: none; overflow: hidden; }
  .floating span { position: absolute; bottom: 0; font-size: 2rem; animation: rise 2.5s ease-out forwards; }
  .controls { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
  .btn { font: inherit; min-height: 44px; padding: 0 18px; border-radius: 12px; border: 2px solid var(--line); background: var(--surface); color: var(--ink); cursor: pointer; }
  .btn.primary { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); font-weight: 700; }
  .btn:disabled { opacity: 0.4; cursor: default; }
  .muted { color: var(--ink-soft); margin: 0; }
  @keyframes pop { from { opacity: 0; transform: translateY(8px) scale(0.98); } to { opacity: 1; transform: none; } }
  @keyframes rise { from { transform: translateY(0); opacity: 1; } to { transform: translateY(-150px); opacity: 0; } }
</style>
