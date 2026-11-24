import { describe, expect, it } from 'vitest';
import { ChunkAssembler, splitChunks } from '../src/net/chunks';

describe('chunks', () => {
  it('splits and reassembles in any order, ignoring duplicates', () => {
    const data = 'abcdefghij'.repeat(25);
    const parts = splitChunks(data, 30);
    expect(parts.length).toBe(9);
    const a = new ChunkAssembler();
    const order = [3, 0, 8, 1, 1, 2, 7, 6, 5];
    const results = order.map((i) => a.add('m1', i, parts.length, parts[i]));
    expect(results.filter(Boolean)).toEqual([]);
    expect(a.add('m1', 4, parts.length, parts[4])).toBe(data);
  });
  it('passes single-part messages straight through', () => {
    expect(new ChunkAssembler().add('x', 0, 1, 'hello')).toBe('hello');
    expect(splitChunks('')).toEqual(['']);
  });
});
