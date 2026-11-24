import { describe, expect, it } from 'vitest';
import { isPenEraser } from '../src/engine/input';

describe('stylus buttons', () => {
  it('detects the side button and the eraser end of a pen', () => {
    expect(isPenEraser({ pointerType: 'pen', button: 0, buttons: 1 })).toBe(false);
    expect(isPenEraser({ pointerType: 'pen', button: 2, buttons: 2 })).toBe(true); // bouton latéral (S Pen)
    expect(isPenEraser({ pointerType: 'pen', button: 0, buttons: 3 })).toBe(true); // bouton tenu en touchant
    expect(isPenEraser({ pointerType: 'pen', button: 5, buttons: 32 })).toBe(true); // bout gomme
    expect(isPenEraser({ pointerType: 'mouse', button: 2, buttons: 2 })).toBe(false);
    expect(isPenEraser({ pointerType: 'touch', button: 0, buttons: 1 })).toBe(false);
  });
});
