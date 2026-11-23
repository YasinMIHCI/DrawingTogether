<script lang="ts">
  import TopBar from './components/TopBar.svelte';
  import Home from './pages/Home.svelte';
  import Soon from './pages/Soon.svelte';
  import Settings from './pages/Settings.svelte';
  import Draw from './pages/Draw.svelte';
  import { router } from './lib/router.svelte';
  import { settings } from './lib/settings.svelte';
  import { uiStyle } from './lib/screen.svelte';

  $effect(() => {
    document.documentElement.lang = settings.locale;
    document.documentElement.dataset.ui = uiStyle();
  });
</script>

{#if router.route !== 'draw'}<TopBar />{/if}
{#if router.route === 'draw'}
  <Draw />
{:else if router.route === 'shared'}
  <Soon title="home.shared.title" />
{:else if router.route === 'games'}
  <Soon title="home.games.title" />
{:else if router.route === 'settings'}
  <Settings />
{:else}
  <Home />
{/if}
