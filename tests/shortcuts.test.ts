import { describe, expect, it } from 'vitest';
import { matchKeys } from '../src/ui/desktop/commands';

const key = (key: string, o: Partial<KeyboardEventInit> = {}) => new KeyboardEvent('keydown', { key, ...o });

describe('shortcuts', () => {
  it('matches modifiers exactly', () => {
    expect(matchKeys(key('z', { ctrlKey: true }), 'Mod+Z')).toBe(true);
    expect(matchKeys(key('z', { metaKey: true }), 'Mod+Z')).toBe(true);
    expect(matchKeys(key('Z', { ctrlKey: true, shiftKey: true }), 'Mod+Z')).toBe(false);
    expect(matchKeys(key('Z', { ctrlKey: true, shiftKey: true }), 'Mod+Shift+Z')).toBe(true);
    expect(matchKeys(key('b'), 'B')).toBe(true);
    expect(matchKeys(key('b', { ctrlKey: true }), 'B')).toBe(false);
  });
  it('handles symbols and named keys', () => {
    expect(matchKeys(key('['), '[')).toBe(true);
    expect(matchKeys(key('+', { ctrlKey: true, shiftKey: true }), 'Mod++')).toBe(true);
    expect(matchKeys(key('?', { shiftKey: true }), 'Shift+?')).toBe(true);
    expect(matchKeys(key('Tab'), 'Tab')).toBe(true);
    expect(matchKeys(key('Backspace', { altKey: true }), 'Alt+Backspace')).toBe(true);
  });
});
