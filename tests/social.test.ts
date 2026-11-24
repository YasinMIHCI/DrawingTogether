import { describe, expect, it } from 'vitest';
import { accountEmail, isValidUsername, normalizeUsername } from '../src/social/username';

describe('usernames', () => {
  it('normalizes and validates', () => {
    expect(normalizeUsername(' Yasin_Mihçi ')).toBe('yasin_mihci');
    expect(normalizeUsername('Léa 2!')).toBe('lea2');
    expect(isValidUsername('lea2')).toBe(true);
    expect(isValidUsername('ab')).toBe(false);
    expect(isValidUsername('a'.repeat(21))).toBe(false);
    expect(accountEmail('lea2')).toBe('lea2@users.drawingtogether.app');
  });
});
