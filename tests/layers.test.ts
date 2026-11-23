import { beforeAll, describe, expect, it } from 'vitest';
import { useFakeCanvas } from './fakeCanvas';
import { DrawingDocument, compositeOp } from '../src/engine/layers';
import { History } from '../src/engine/history';
import { AddLayer, MoveLayer, RemoveLayer, SetLayerProps } from '../src/engine/commands';

beforeAll(useFakeCanvas);

const ids = (d: DrawingDocument) => d.layers.map((l) => l.number);

describe('layers', () => {
  it('adds, moves and removes layers with undo', () => {
    const doc = new DrawingDocument(10, 10);
    const h = new History({ maxBytes: 1e9, maxSteps: 100 });
    const run = (c: { redo(): void } & Parameters<History['push']>[0]) => (c.redo(), h.push(c));

    const l2 = doc.createLayer();
    run(new AddLayer(doc, l2, 1, doc.activeId));
    const l3 = doc.createLayer();
    run(new AddLayer(doc, l3, 2, doc.activeId));
    expect(ids(doc)).toEqual([1, 2, 3]);
    expect(doc.activeId).toBe(l3.id);

    run(new MoveLayer(doc, l3.id, 2, 0));
    expect(ids(doc)).toEqual([3, 1, 2]);
    run(new RemoveLayer(doc, l2));
    expect(ids(doc)).toEqual([3, 1]);

    h.undo();
    expect(ids(doc)).toEqual([3, 1, 2]);
    h.undo();
    expect(ids(doc)).toEqual([1, 2, 3]);
    h.undo();
    h.undo();
    expect(ids(doc)).toEqual([1]);
  });

  it('merges consecutive opacity changes into one undo step', () => {
    const doc = new DrawingDocument(10, 10);
    const layer = doc.active;
    const h = new History({ maxBytes: 1e9, maxSteps: 100 });
    for (const o of [0.9, 0.7, 0.5]) {
      const c = new SetLayerProps(layer, { opacity: layer.opacity }, { opacity: o });
      c.redo();
      h.push(c);
    }
    expect(h.size).toBe(1);
    h.undo();
    expect(layer.opacity).toBe(1);
  });

  it('maps blend modes to canvas operations', () => {
    expect(compositeOp('normal')).toBe('source-over');
    expect(compositeOp('add')).toBe('lighter');
    expect(compositeOp('multiply')).toBe('multiply');
  });
});
