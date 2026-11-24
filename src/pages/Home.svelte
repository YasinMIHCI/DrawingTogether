<script lang="ts">
  import ProfileCard from '../components/ProfileCard.svelte';
  import Plaza from '../ui/home/Plaza.svelte';
  import { auth } from '../social/auth.svelte';
  import { t } from '../lib/i18n/t.svelte';
</script>

<main>
  <h1 class="sr-only">{t('app.tagline')}</h1>
  <Plaza />
  {#if !auth.userId}
    <div class="below"><ProfileCard /></div>
  {/if}
</main>

<style>
  main { max-width: 1200px; margin: 0 auto; padding: 4px 16px 24px; display: grid; gap: 16px; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  .below { max-width: 520px; width: 100%; justify-self: center; }
</style>
