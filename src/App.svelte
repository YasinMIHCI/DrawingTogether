<script lang="ts">
  import { fade } from 'svelte/transition';
  import Sidebar from './components/Sidebar.svelte';
  import Home from './pages/Home.svelte';
  import { router } from './lib/router.svelte';
  import { settings } from './lib/settings.svelte';
  import { uiStyle } from './lib/screen.svelte';
  import { appChrome } from './lib/appChrome.svelte';
  import { reducedMotion } from './lib/motion.svelte';
  import { auth, initAuth } from './social/auth.svelte';
  import { startSocial } from './social/store.svelte';

  initAuth();
  // Compteurs et messages en direct une fois connecté (Supabase n'est chargé que si un compte existe)
  $effect(() => {
    if (!auth.ready) return;
    void auth.userId;
    startSocial();
  });

  // Pages chargées à la demande : l'accueil s'affiche plus vite
  const pages = {
    draw: () => import('./pages/Draw.svelte'),
    shared: () => import('./pages/Shared.svelte'),
    games: () => import('./pages/Games.svelte'),
    gallery: () => import('./pages/Gallery.svelte'),
    settings: () => import('./pages/Settings.svelte'),
    'pen-test': () => import('./pages/PenTest.svelte'),
    account: () => import('./pages/Account.svelte'),
    friends: () => import('./pages/Friends.svelte'),
    messages: () => import('./pages/Messages.svelte'),
    feed: () => import('./pages/Feed.svelte'),
    u: () => import('./pages/Profile.svelte'),
    bouille: () => import('./pages/Bouille.svelte'),
    notifications: () => import('./pages/Notifications.svelte'),
    post: () => import('./pages/Post.svelte'),
  } as const;
  const chrome = $derived(router.route !== 'draw' && !appChrome.fullscreen);
  const loader = $derived(router.route === 'home' ? null : pages[router.route]());

  $effect(() => {
    const root = document.documentElement;
    root.lang = settings.locale;
    root.dataset.ui = uiStyle();
    if (settings.theme === 'auto') delete root.dataset.theme;
    else root.dataset.theme = settings.theme;
    root.dataset.motion = reducedMotion() ? 'reduce' : 'full';
  });
</script>

{#if chrome}<Sidebar />{/if}
{#key router.route === 'draw' || router.route === 'u' || router.route === 'post' ? `${router.route}/${router.param}` : router.route}
  <div class="page" class:chrome class:tiled-bg={chrome} in:fade={{ duration: reducedMotion() ? 0 : 160 }}>
    {#if loader}
      {#await loader then mod}
        <mod.default />
      {/await}
    {:else}
      <Home />
    {/if}
  </div>
{/key}

<style>
  .page { display: block; }
  .page.chrome { margin-left: var(--side-w); min-height: 100dvh; padding-top: max(12px, env(safe-area-inset-top)); }
</style>
