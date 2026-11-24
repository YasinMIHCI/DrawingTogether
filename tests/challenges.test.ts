import { describe, expect, it } from 'vitest';
import { daysLeft, recentWeeks, themeOf, THEMES, weekKey } from '../src/social/challenges';

describe('défis de la semaine', () => {
  it('calcule la semaine ISO', () => {
    expect(weekKey(new Date(2026, 0, 1))).toBe('2026-W01');
    expect(weekKey(new Date(2024, 11, 30))).toBe('2025-W01');
    expect(weekKey(new Date(2026, 10, 24))).toBe('2026-W48');
    expect(weekKey(new Date(2027, 0, 3))).toBe('2026-W53');
  });
  it('change de thème chaque semaine, dans l’ordre de la liste', () => {
    const weeks = recentWeeks(3, new Date(2026, 10, 24));
    expect(weeks).toEqual(['2026-W48', '2026-W47', '2026-W46']);
    const i = THEMES.indexOf(themeOf(weeks[0]));
    expect(THEMES.indexOf(themeOf(weeks[1]))).toBe((i - 1 + THEMES.length) % THEMES.length);
    expect(themeOf('2024-W01')).toBe(THEMES[0]);
  });
  it('compte les jours restants', () => {
    expect(daysLeft(new Date(2026, 10, 23, 9))).toBe(7); // lundi
    expect(daysLeft(new Date(2026, 10, 29, 20))).toBe(1); // dimanche soir
  });
});
