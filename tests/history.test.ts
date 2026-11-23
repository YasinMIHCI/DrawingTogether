import { describe, expect, it } from 'vitest';
import { History, type Command } from '../src/engine/history';

function counter(bytes = 10) {
  const state = { value: 0 };
  const make = (): Command => ({ label: 'inc', bytes, redo: () => state.value++, undo: () => state.value-- });
  return { state, make };
}

describe('History', () => {
  it('undoes and redoes, and a new action clears redo', () => {
    const h = new History({ maxBytes: 1e9, maxSteps: 100 });
    const { state, make } = counter();
    for (let i = 0; i < 3; i++) {
      const c = make();
      c.redo();
      h.push(c);
    }
    expect(h.undo()).toBe(true);
    expect(h.undo()).toBe(true);
    expect(state.value).toBe(1);
    expect(h.redo()).toBe(true);
    expect(state.value).toBe(2);
    h.push(make());
    expect(h.canRedo).toBe(false);
  });

  it('forgets oldest steps beyond the memory and step limits', () => {
    const h = new History({ maxBytes: 35, maxSteps: 100 });
    const { make } = counter(10);
    for (let i = 0; i < 5; i++) h.push(make());
    expect(h.size).toBe(3);
    const h2 = new History({ maxBytes: 1e9, maxSteps: 2 });
    for (let i = 0; i < 5; i++) h2.push(make());
    expect(h2.size).toBe(2);
  });
});
