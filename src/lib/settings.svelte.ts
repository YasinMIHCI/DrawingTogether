import { load, save } from './storage';
import type { UiPreference } from './device';
import type { Locale } from './i18n/i18n.svelte';
import { detectLocale } from './i18n/i18n.svelte';

export type ThemePreference = 'auto' | 'light' | 'dark';
export type MotionPreference = 'auto' | 'full' | 'reduce';

export interface Settings {
  locale: Locale;
  ui: UiPreference;
  theme: ThemePreference;
  /** Petits sons de l'interface (jeux, discussion…) */
  sound: boolean;
  /** Animations : auto = selon le réglage « réduire les animations » du système */
  motion: MotionPreference;
  nickname: string;
  avatar: number;
  /** Avatar importé (photo ou dessin) du compte connecté, sinon null */
  avatarUrl: string | null;
  /** Personnage créé dans le créateur de Bouille (JSON), sinon null */
  bouille?: string | null;
}

const KEY = 'dt.settings';

export const settings: Settings = $state(
  load<Settings>(KEY, {
    locale: detectLocale(),
    ui: 'auto',
    theme: 'auto',
    sound: true,
    motion: 'auto',
    nickname: '',
    avatar: Math.floor(Math.random() * 12),
    avatarUrl: null,
  }),
);

$effect.root(() => {
  $effect(() => save(KEY, $state.snapshot(settings)));
});
