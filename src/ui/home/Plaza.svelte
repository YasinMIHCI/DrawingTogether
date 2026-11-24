<script lang="ts">
  import { onMount } from 'svelte';
  import { parseBouille, randomBouille, seeded, type BouilleData } from '../../bouille/model';
  import type { Expression } from '../../bouille/render';
  import BouilleImg from '../../components/BouilleImg.svelte';
  import { feed, friendState, postImage, profilesWithBouille, type Post } from '../../social/api';
  import { auth } from '../../social/auth.svelte';
  import { settings } from '../../lib/settings.svelte';
  import { reducedMotion } from '../../lib/motion.svelte';
  import { href, type Route } from '../../lib/router.svelte';
  import { t } from '../../lib/i18n/t.svelte';
  import type { Key } from '../../lib/i18n/i18n.svelte';

  /** Accueil « place publique » : grandes tuiles des modes, Bouilles qui se baladent, bulles des amis. */
  type Tile = { route: Route | 'bouille'; label: Key; icon: string; c1: string; c2: string };
  const tiles: Tile[] = [
    { route: 'draw', label: 'home.draw.title', icon: 'M4 20l4-1 11-11-3-3L5 16zM14 6l3 3', c1: '#7fd85a', c2: '#2d9a2a' },
    { route: 'shared', label: 'home.shared.title', icon: 'M3 5h18v12H3zM8 21h8M7 13c2-3 4-1 6-4s3 1 4 0', c1: '#5fd6c6', c2: '#1d978a' },
    { route: 'games', label: 'home.games.title', icon: 'M4 6h16v10H8l-4 4zM9 11h.01M12 11h.01M15 11h.01', c1: '#ffd866', c2: '#e9a21b' },
    { route: 'gallery', label: 'home.gallery.title', icon: 'M3 5h8v6H3zM13 5h8v6h-8zM3 13h8v6H3zM13 13h8v6h-8z', c1: '#c8b6ff', c2: '#7d62d8' },
    { route: 'feed', label: 'nav.feed', icon: 'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM8.5 10.5h.01M15.5 10.5h.01M8 14.5c2 2 6 2 8 0', c1: '#8fd0ff', c2: '#2f86d0' },
    { route: 'bouille', label: 'bou.title', icon: 'M12 3a7 7 0 0 1 7 7c0 4-3 7-7 7s-7-3-7-7a7 7 0 0 1 7-7zM9 9.5h.01M15 9.5h.01M9 13q3 2.5 6 0M7 21c1-2 3-3 5-3s4 1 5 3', c1: '#ffb0cf', c2: '#e0568f' },
  ];
  // Positions (centre, en %) : large et étroit
  const WIDE = [[14, 22], [38, 13], [62, 13], [86, 22], [30, 60], [70, 60]];
  const NARROW = [[27, 11], [73, 11], [27, 40], [73, 40], [27, 69], [73, 69]];

  interface Walker {
    key: string;
    b: BouilleData;
    name: string;
    username?: string;
    me?: boolean;
    x: number;
    y: number;
    dir: 1 | -1;
    dur: number;
    moving: boolean;
    next: number;
    emo: Expression;
    bubble: Post | null;
  }

  let el = $state<HTMLElement>();
  let narrow = $state(false);
  let walkers = $state<Walker[]>([]);
  let bubbleImg = $state<Record<string, string>>({});
  const pos = $derived(narrow ? NARROW : WIDE);

  const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
  const spot = () => (narrow ? { x: rand(6, 94), y: rand(18, 96) } : { x: rand(4, 96), y: rand(34, 97) });

  function walker(key: string, b: BouilleData, name: string, extra: Partial<Walker> = {}): Walker {
    const s = spot();
    return {
      key, b, name, ...s, dir: Math.random() < 0.5 ? 1 : -1, dur: 0, moving: false, next: Date.now() + rand(300, 4000), bubble: null,
      emo: 'neutral', ...extra,
    };
  }

  async function populate() {
    const list: Walker[] = [];
    const mine = parseBouille(settings.bouille);
    if (mine) list.push(walker('me', mine, auth.profile?.display_name || settings.nickname || t('nav.profile'), { me: true, username: auth.profile?.username }));
    let friendPosts: Post[] = [];
    if (auth.userId) {
      try {
        const fs = await friendState();
        const ids = fs.friends.map((f) => f.id);
        for (const p of await profilesWithBouille(ids)) {
          const b = parseBouille(p.bouille);
          if (b) list.push(walker(p.id, b, p.display_name || p.username, { username: p.username }));
        }
        friendPosts = (await feed({ limit: 12 })).filter((p) => p.owner_id !== auth.userId);
      } catch {
        /* hors ligne : seulement des passants */
      }
    }
    // Passants (toujours les mêmes)
    const total = narrow ? 9 : 15;
    for (let i = 0; list.length < total; i++) list.push(walker(`v${i}`, randomBouille(seeded(1000 + i)), ''));
    walkers = list;
    posts = friendPosts;
  }

  let posts: Post[] = [];
  let bubbleIndex = 0;

  const EMOTES: Expression[] = ['happy', 'surprised', 'wink', 'happy'];

  function step() {
    const now = Date.now();
    if (reducedMotion()) return;
    for (const w of walkers) {
      // Petite réaction de temps en temps quand on est à l'arrêt
      if (!w.moving && !w.bubble && w.emo === 'neutral' && Math.random() < 0.03) {
        w.emo = EMOTES[Math.floor(Math.random() * EMOTES.length)];
        setTimeout(() => (w.emo = 'neutral'), 2200);
      }
      if (now < w.next) continue;
      const s = spot();
      const dist = Math.hypot(s.x - w.x, (s.y - w.y) * 0.7);
      w.dur = Math.max(1.5, dist / 6);
      if (Math.abs(s.x - w.x) > 1) w.dir = s.x > w.x ? 1 : -1;
      w.x = s.x;
      w.y = s.y;
      w.moving = true;
      w.next = now + w.dur * 1000 + rand(1500, 6000);
      setTimeout(() => (w.moving = false), w.dur * 1000);
    }
  }

  async function nextBubble() {
    for (const w of walkers) if (w.bubble) (w.bubble = null), (w.emo = 'neutral');
    const usable = posts.filter((p) => walkers.some((w) => w.key === p.owner_id));
    if (!usable.length) return;
    const p = usable[bubbleIndex++ % usable.length];
    const w = walkers.find((x) => x.key === p.owner_id)!;
    if (p.image_path && !bubbleImg[p.id]) bubbleImg[p.id] = await postImage(p.image_path).catch(() => '');
    w.bubble = p;
    w.emo = 'happy';
  }

  onMount(() => {
    const measure = () => (narrow = (el?.clientWidth ?? 800) < 600);
    measure();
    const ro = new ResizeObserver(measure);
    if (el) ro.observe(el);
    populate();
    const a = setInterval(step, 700);
    const b = setInterval(nextBubble, 6000);
    setTimeout(nextBubble, 1500);
    return () => (ro.disconnect(), clearInterval(a), clearInterval(b));
  });

  // Repeuplée quand on se connecte, crée sa Bouille, ou change de taille d'écran
  let lastKey = '';
  $effect(() => {
    const key = `${auth.userId}|${settings.bouille?.length ?? 0}|${narrow}`;
    if (lastKey && key !== lastKey) populate();
    lastKey = key;
  });

  const tileHref = (r: Tile['route']) => (r === 'bouille' ? '#/bouille' : href(r));
</script>

<section class="plaza" bind:this={el} aria-label={t('app.tagline')}>
  <div class="floor" aria-hidden="true"></div>
  {#each tiles as tile, i (tile.route)}
    <a class="tile" href={tileHref(tile.route)} style:left="{pos[i][0]}%" style:top="{pos[i][1]}%" style:z-index={Math.round(pos[i][1] * 10) + 5}
      style:--c1={tile.c1} style:--c2={tile.c2} style:animation-delay="{i * -0.7}s">
      <span class="glass">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={tile.icon} fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
      </span>
      <span class="label">{t(tile.label)}</span>
    </a>
  {/each}
  {#each walkers as w (w.key)}
    <div class="walker" class:moving={w.moving} class:me={w.me}
      style:left="{w.x}%" style:top="{w.y}%" style:z-index={w.bubble ? 5000 : Math.round(w.y * 10)}
      style:transition-duration="{w.dur}s" style:--k={0.55 + w.y / 220}>
      {#if w.bubble}
        <a class="bubble" class:l={w.x < 32} class:r={w.x > 68} href="#/u/{w.username}">
          <b>{w.name}</b>
          {#if w.bubble.image_path && bubbleImg[w.bubble.id]}<img src={bubbleImg[w.bubble.id]} alt="" />{/if}
          {#if w.bubble.body || w.bubble.title}<span>{w.bubble.body || w.bubble.title}</span>{/if}
        </a>
      {/if}
      {#if w.me || w.username}<span class="name">{w.name}</span>{/if}
      <div class="body"><BouilleImg bouille={w.b} view="full" expr={w.emo} yaw={w.dir * 0.6} w={96} h={126} /></div>
    </div>
  {/each}
</section>

<style>
  .plaza {
    position: relative; height: max(520px, calc(100dvh - 40px)); overflow: hidden; border-radius: 26px;
    background: radial-gradient(ellipse at 50% 30%, #ffffff 0%, #f1f3f1 45%, #dde2de 100%);
    box-shadow: inset 0 0 0 1px var(--line), var(--shadow);
    user-select: none;
  }
  .floor {
    position: absolute; left: -50%; right: -50%; top: 30%; bottom: -40%;
    background:
      linear-gradient(rgba(0, 0, 0, 0.05) 2px, transparent 2px) 0 0 / 80px 80px,
      linear-gradient(90deg, rgba(0, 0, 0, 0.05) 2px, transparent 2px) 0 0 / 80px 80px;
    transform: perspective(500px) rotateX(58deg); transform-origin: 50% 0;
    mask-image: linear-gradient(transparent, #000 30%);
  }
  .tile {
    position: absolute; --s: clamp(80px, 13vw, 138px); width: var(--s); transform: translate(-50%, -50%);
    display: grid; justify-items: center; gap: 6px; text-decoration: none; animation: float 5s ease-in-out infinite;
  }
  .glass {
    width: var(--s); height: var(--s); border-radius: 28%; display: grid; place-items: center; position: relative; overflow: hidden;
    background: linear-gradient(160deg, var(--c1), var(--c2));
    border: 4px solid rgba(255, 255, 255, 0.95);
    box-shadow: 0 10px 18px rgba(0, 0, 0, 0.18), 0 2px 0 rgba(0, 0, 0, 0.12), inset 0 -6px 12px rgba(0, 0, 0, 0.12);
    transition: transform 0.15s;
  }
  .glass::after { content: ''; position: absolute; left: -10%; right: -10%; top: -40%; height: 75%; border-radius: 50%; background: linear-gradient(rgba(255, 255, 255, 0.65), rgba(255, 255, 255, 0.05)); }
  .glass svg { width: 52%; height: 52%; filter: drop-shadow(0 2px 1px rgba(0, 0, 0, 0.2)); }
  .tile:hover .glass { transform: scale(1.06); }
  .label { justify-self: center; background: rgba(255, 255, 255, 0.92); color: #2f3438; font-weight: 800; font-size: 0.82rem; padding: 3px 10px; border-radius: 10px; box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12); white-space: nowrap; }
  @keyframes float { 50% { margin-top: -6px; } }

  .walker {
    position: absolute; width: 96px; height: 126px; transform: translate(-50%, -100%) scale(var(--k));
    transform-origin: 50% 100%; transition-property: left, top; transition-timing-function: linear; pointer-events: none;
  }
  .walker::before { content: ''; position: absolute; left: 14%; right: 14%; bottom: -3px; height: 8px; border-radius: 50%; background: rgba(0, 0, 0, 0.12); }
  .body { width: 100%; height: 100%; }
  .body :global(svg) { width: 100%; height: 100%; }
  .moving .body { animation: walk 0.42s ease-in-out infinite; }
  @keyframes walk { 50% { transform: translateY(-4px) rotate(2deg); } }
  .name { position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); margin-bottom: 2px; font-size: 0.7rem; font-weight: 800; background: #5d6268; color: #fff; padding: 0 6px; border-radius: 6px; white-space: nowrap; }
  .me .name { background: var(--accent); }
  .bubble {
    position: absolute; bottom: calc(100% + 18px); left: 50%; transform: translateX(-50%) scale(calc(1 / var(--k)));
    transform-origin: 50% 100%; width: 170px; display: grid; gap: 4px; padding: 8px; border-radius: 14px; background: #fff; color: #2f3438;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18); text-decoration: none; pointer-events: auto; font-size: 0.85rem; animation: pop 0.25s ease-out;
  }
  .bubble.l { left: -10px; transform: scale(calc(1 / var(--k))); transform-origin: 0 100%; }
  .bubble.r { left: auto; right: -10px; transform: scale(calc(1 / var(--k))); transform-origin: 100% 100%; }
  .bubble.l::after { left: 40px; }
  .bubble.r::after { left: auto; right: 32px; }
  .bubble::after { content: ''; position: absolute; top: 100%; left: 50%; margin-left: -8px; border: 8px solid transparent; border-top-color: #fff; }
  .bubble b { font-size: 0.75rem; color: #6b7178; }
  .bubble img { width: 100%; max-height: 90px; object-fit: contain; border-radius: 8px; background: #fff; }
  .bubble span { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; }
  @keyframes pop { from { opacity: 0; transform: translateX(-50%) scale(0.6); } }

  :global(:root[data-theme='dark']) .plaza { background: radial-gradient(ellipse at 50% 30%, #3a403b 0%, #2a2f2b 50%, #1e221f 100%); }
  @media (prefers-color-scheme: dark) { :global(:root:not([data-theme='light'])) .plaza { background: radial-gradient(ellipse at 50% 30%, #3a403b 0%, #2a2f2b 50%, #1e221f 100%); } }
  :global(:root[data-theme='dark']) .floor { filter: invert(1); }
  @media (max-width: 600px) {
    .plaza { border-radius: 18px; }
    .walker { width: 70px; height: 92px; }
  }
</style>
