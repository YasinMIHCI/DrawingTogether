import { settings } from '../settings.svelte';
import { translate, type Key } from './i18n.svelte';

/** Traduction réactive dans la langue courante. */
export function t(key: Key, params?: Record<string, string>): string {
  return translate(settings.locale, key, params);
}
