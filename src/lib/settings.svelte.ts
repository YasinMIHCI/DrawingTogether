import { load, save } from './storage';
import type { UiPreference } from './device';
import type { Locale } from './i18n/i18n.svelte';
import { detectLocale } from './i18n/i18n.svelte';

export interface Settings {
  locale: Locale;
  ui: UiPreference;
  nickname: string;
  avatar: number;
}

const KEY = 'dt.settings';

export const settings: Settings = $state(
  load<Settings>(KEY, {
    locale: detectLocale(),
    ui: 'auto',
    nickname: '',
    avatar: Math.floor(Math.random() * 12),
  }),
);

$effect.root(() => {
  $effect(() => save(KEY, $state.snapshot(settings)));
});
