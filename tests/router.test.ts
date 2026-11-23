import { expect, it } from 'vitest';
import { parseHash } from '../src/lib/router.svelte';

it('parses hash routes', () => {
  expect(parseHash('')).toBe('home');
  expect(parseHash('#/draw')).toBe('draw');
  expect(parseHash('#/shared/ABCD')).toBe('shared');
  expect(parseHash('#/nope')).toBe('home');
});
