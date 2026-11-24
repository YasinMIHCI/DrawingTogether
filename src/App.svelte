<script lang="ts">
  import { fade } from 'svelte/transition';
  import TopBar from './components/TopBar.svelte';
  import Home from './pages/Home.svelte';
  import { router } from './lib/router.svelte';
  import { settings } from './lib/settings.svelte';
  import { uiStyle } from './lib/screen.svelte';
  import { appChrome } from './lib/appChrome.svelte';
  import { reducedMotion } from './lib/motion.svelte';

  // Pages chargées à la demande : l'accueil s'affiche plus vite
  const pages = {
    draw: () => import('./pages/Draw.svelte'),
    shared: () => import('./pages/Shared.svelte'),
    games: () => import('./pages/Games.svelte'),
    gallery: () => import('./pages/Gallery.svelte'),
    settings: () => import('./pages/Settings.svelte'),
    'pen-test': () => import('./pages/PenTest.svelte'),
  } as const;
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

{#if router.route !== 'draw' && !appChrome.fullscreen}<TopBar />{/if}
{#key router.route === 'draw' ? `draw/${router.param}` : router.route}
  <div class="page" in:fade={{ duration: reducedMotion() ? 0 : 160 }}>
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
</style>
