<script lang="ts">
  import TopBar from './components/TopBar.svelte';
  import Home from './pages/Home.svelte';
  import Settings from './pages/Settings.svelte';
  import Draw from './pages/Draw.svelte';
  import Shared from './pages/Shared.svelte';
  import Games from './pages/Games.svelte';
  import { router } from './lib/router.svelte';
  import { settings } from './lib/settings.svelte';
  import { uiStyle } from './lib/screen.svelte';
  import { appChrome } from './lib/appChrome.svelte';

  $effect(() => {
    document.documentElement.lang = settings.locale;
    document.documentElement.dataset.ui = uiStyle();
    if (settings.theme === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = settings.theme;
  });
</script>

{#if router.route !== 'draw' && !appChrome.fullscreen}<TopBar />{/if}
{#if router.route === 'draw'}
  <Draw />
{:else if router.route === 'shared'}
  <Shared />
{:else if router.route === 'games'}
  <Games />
{:else if router.route === 'settings'}
  <Settings />
{:else}
  <Home />
{/if}
