<script lang="ts">
  import { settings, type ThemePreference } from '../lib/settings.svelte';
  import { LOCALES } from '../lib/i18n/i18n.svelte';
  import { t } from '../lib/i18n/t.svelte';
  import { href } from '../lib/router.svelte';
  import { screen } from '../lib/screen.svelte';
  import { resolveUi, type UiPreference } from '../lib/device';

  const options: UiPreference[] = ['auto', 'krita', 'paint', 'mobile'];
  const themes: ThemePreference[] = ['auto', 'light', 'dark'];
  const detected = $derived(resolveUi('auto', screen.info));
</script>

<main>
  <h1>{t('settings.title')}</h1>

  <section>
    <h2>{t('settings.language')}</h2>
    <div class="choices">
      {#each LOCALES as l (l.id)}
        <label class="choice"><input type="radio" name="locale" value={l.id} bind:group={settings.locale} /> {l.label}</label>
      {/each}
    </div>
  </section>

  <section>
    <h2>{t('settings.ui')}</h2>
    <div class="choices">
      {#each options as o (o)}
        <label class="choice"><input type="radio" name="ui" value={o} bind:group={settings.ui} /> {t(`settings.ui.${o}`)}</label>
      {/each}
    </div>
    <p class="hint">{t('settings.ui.detected', { style: t(`settings.ui.${detected}`) })}</p>
  </section>

  <section>
    <h2>{t('settings.theme')}</h2>
    <div class="choices">
      {#each themes as th (th)}
        <label class="choice"><input type="radio" name="theme" value={th} bind:group={settings.theme} /> {t(`theme.${th}`)}</label>
      {/each}
    </div>
  </section>

  <a href={href('home')}>← {t('nav.back')}</a>
</main>

<style>
  main { max-width: 640px; margin: 0 auto; padding: 8px 16px 32px; }
  section { background: var(--surface); border: 2px solid var(--line); border-radius: var(--radius); padding: 16px 20px; margin-bottom: 16px; }
  h2 { margin: 0 0 10px; font-size: 1rem; }
  .choices { display: grid; gap: 8px; }
  .choice { display: flex; gap: 10px; align-items: center; padding: 10px 12px; border-radius: 12px; background: var(--surface-2); cursor: pointer; }
  .hint { margin: 10px 0 0; color: var(--ink-soft); font-size: 0.9rem; }
</style>
