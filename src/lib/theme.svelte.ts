import { settings } from './settings.svelte';

/** Thème effectif : choix de l'utilisateur, sinon celui du système. */
const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
const system = $state({ dark: media?.matches ?? false });
media?.addEventListener?.('change', (e) => (system.dark = e.matches));

export function isDark(): boolean {
  return settings.theme === 'dark' || (settings.theme === 'auto' && system.dark);
}
