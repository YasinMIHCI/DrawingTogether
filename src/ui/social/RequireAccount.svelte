<script lang="ts">
  import type { Snippet } from 'svelte';
  import { auth } from '../../social/auth.svelte';
  import { href } from '../../lib/router.svelte';
  import { t } from '../../lib/i18n/t.svelte';

  /** Affiche le contenu seulement si l'on est connecté. */
  let { children }: { children: Snippet } = $props();
</script>

{#if !auth.ready}
  <p class="muted">…</p>
{:else if !auth.userId}
  <div class="card">
    <p class="muted">{t('social.needAccount')}</p>
    <a class="btn primary" href={href('account')}>{t('nav.signin')}</a>
  </div>
{:else}
  {@render children()}
{/if}
