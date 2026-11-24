<script lang="ts">
  import Avatar from './Avatar.svelte';
  import { settings } from '../lib/settings.svelte';
  import { t } from '../lib/i18n/t.svelte';
</script>

<section class="card profile">
  <h2>{t('profile.title')}</h2>
  <label class="nick">
    <span>{t('profile.nickname')}</span>
    <input
      type="text"
      maxlength="20"
      placeholder={t('profile.nicknamePlaceholder')}
      bind:value={settings.nickname}
    />
  </label>
  <a class="bouille-link" href="#/bouille">{settings.bouille ? t('bou.edit') : t('bou.create')}</a>
  <fieldset>
    <legend>{t('profile.avatar')}</legend>
    <div class="avatars">
      {#each Array.from({ length: 12 }, (_, i) => i) as i (i)}
        <button
          type="button"
          class:selected={settings.avatar === i}
          aria-pressed={settings.avatar === i}
          aria-label="{t('profile.avatar')} {i + 1}"
          onclick={() => (settings.avatar = i)}
        >
          <Avatar id={i} size={44} />
        </button>
      {/each}
    </div>
  </fieldset>
</section>

<style>
  .bouille-link { display: block; text-align: center; margin-bottom: 14px; padding: 10px; border-radius: 12px; background: var(--accent); color: var(--accent-ink); font-weight: 800; text-decoration: none; }
  .card { background: var(--surface); border: 2px solid var(--line); border-radius: var(--radius); padding: 20px; box-shadow: var(--shadow); }
  h2 { margin: 0 0 12px; font-size: 1.1rem; }
  .nick { display: grid; gap: 6px; margin-bottom: 16px; }
  .nick span, legend { font-weight: 600; font-size: 0.9rem; color: var(--ink-soft); }
  input { padding: 10px 12px; border: 2px solid var(--line); border-radius: 12px; background: var(--surface-2); min-width: 0; }
  fieldset { border: 0; padding: 0; margin: 0; }
  .avatars { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; margin-top: 6px; }
  .avatars button { display: grid; place-items: center; padding: 4px; border: 2px solid transparent; border-radius: 12px; background: none; cursor: pointer; }
  .avatars button.selected { border-color: var(--accent); background: var(--surface-2); }
  @media (max-width: 380px) { .avatars { grid-template-columns: repeat(4, 1fr); } }
</style>
