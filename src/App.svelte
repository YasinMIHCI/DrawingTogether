<script lang="ts">
  import TopBar from './components/TopBar.svelte';
  import Home from './pages/Home.svelte';
  import Soon from './pages/Soon.svelte';
  import Settings from './pages/Settings.svelte';
  import { router } from './lib/router.svelte';
  import { settings } from './lib/settings.svelte';
  import { uiStyle } from './lib/screen.svelte';

  $effect(() => {
    document.documentElement.lang = settings.locale;
    document.documentElement.dataset.ui = uiStyle();
  });
</script>

<TopBar />
{#if router.route === 'draw'}
  <Soon title="home.draw.title" />
{:else if router.route === 'shared'}
  <Soon title="home.shared.title" />
{:else if router.route === 'games'}
  <Soon title="home.games.title" />
{:else if router.route === 'settings'}
  <Settings />
{:else}
  <Home />
{/if}
