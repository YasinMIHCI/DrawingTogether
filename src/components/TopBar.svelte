<script lang="ts">
  import { href } from '../lib/router.svelte';
  import { settings } from '../lib/settings.svelte';
  import { LOCALES } from '../lib/i18n/i18n.svelte';
  import { t } from '../lib/i18n/t.svelte';
</script>

<header>
  <a class="brand" href={href('home')}>
    <img src="./favicon.svg" alt="" width="32" height="32" />
    <span>{t('app.name')}</span>
  </a>
  <nav>
    <select aria-label={t('settings.language')} bind:value={settings.locale}>
      {#each LOCALES as l (l.id)}<option value={l.id}>{l.id.toUpperCase()}</option>{/each}
    </select>
    <a class="icon" href={href('settings')} aria-label={t('nav.settings')} title={t('nav.settings')}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M19.4 13a7.5 7.5 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.3 7.3 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.3 7.3 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.5 7.5 0 0 0 0 2l-2 1.6 2 3.4 2.4-1c.5.4 1.1.7 1.7 1l.4 2.5h4l.4-2.5c.6-.3 1.2-.6 1.7-1l2.4 1 2-3.4zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" transform="translate(-1 0)"/></svg>
    </a>
  </nav>
</header>

<style>
  header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; padding-top: max(12px, env(safe-area-inset-top)); }
  .brand { display: flex; align-items: center; gap: 10px; text-decoration: none; font-weight: 800; font-size: 1.15rem; }
  nav { display: flex; align-items: center; gap: 8px; }
  select { padding: 6px 8px; border: 2px solid var(--line); border-radius: 10px; background: var(--surface); }
  .icon { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 12px; border: 2px solid var(--line); background: var(--surface); }
</style>
