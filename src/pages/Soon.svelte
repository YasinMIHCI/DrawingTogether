<script lang="ts">
  import { href } from '../lib/router.svelte';
  import { t } from '../lib/i18n/t.svelte';
  import type { Key } from '../lib/i18n/i18n.svelte';
  let { title }: { title: Key } = $props();
</script>

<main>
  <h1>{t(title)}</h1>
  <p><strong>{t('common.soon')}</strong> — {t('common.soonDesc')}</p>
  <a href={href('home')}>← {t('nav.back')}</a>
</main>

<style>
  main { max-width: 640px; margin: 0 auto; padding: 24px 16px; }
</style>
