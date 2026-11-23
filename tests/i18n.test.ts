import { describe, expect, it } from 'vitest';
import { detectLocale, translate } from '../src/lib/i18n/i18n.svelte';
import { fr } from '../src/lib/i18n/fr';
import { en } from '../src/lib/i18n/en';

describe('i18n', () => {
  it('has the same keys in every language', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
  });
  it('detects the browser language, English otherwise', () => {
    expect(detectLocale(['fr-FR', 'en'])).toBe('fr');
    expect(detectLocale(['de-DE', 'en-US'])).toBe('en');
    expect(detectLocale(['es'])).toBe('en');
  });
  it('fills parameters', () => {
    expect(translate('en', 'settings.ui.detected', { style: 'X' })).toBe('Detected on this device: X');
  });
});
