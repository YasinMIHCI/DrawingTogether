import { fr } from './fr';
import { en } from './en';

export type Key = keyof typeof fr;
/** Chaque langue doit fournir toutes les clés du français. */
export type Dict = Record<Key, string>;
export type Locale = 'fr' | 'en';

export const LOCALES: { id: Locale; label: string }[] = [
  { id: 'fr', label: 'Français' },
  { id: 'en', label: 'English' },
];

const dicts: Record<Locale, Dict> = { fr, en };

export function detectLocale(languages: readonly string[] = navigator.languages ?? []): Locale {
  for (const lang of languages) {
    const base = lang.toLowerCase().split('-')[0];
    if (base === 'fr' || base === 'en') return base;
  }
  return 'en';
}

/** Traduit une clé ; {nom} dans le texte est remplacé par params.nom. */
export function translate(locale: Locale, key: Key, params: Record<string, string> = {}): string {
  const text = dicts[locale][key] ?? fr[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (m, name) => params[name] ?? m);
}
