import { load, save } from './storage';
import type { UiPreference } from './device';
import type { Locale } from './i18n/i18n.svelte';
import { detectLocale } from './i18n/i18n.svelte';

export type ThemePreference = 'auto' | 'light' | 'dark';

export interface Settings {
  locale: Locale;
  ui: UiPreference;
  theme: ThemePreference;
  nickname: string;
  avatar: number;
}

const KEY = 'dt.settings';

export const settings: Settings = $state(
  load<Settings>(KEY, {
    locale: detectLocale(),
    ui: 'auto',
    theme: 'auto',
    nickname: '',
    avatar: Math.floor(Math.random() * 12),
  }),
);

$effect.root(() => {
  $effect(() => save(KEY, $state.snapshot(settings)));
});
