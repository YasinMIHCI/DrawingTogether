import { describe, expect, it } from 'vitest';
import { hexToRgb, hsvToHex, isHexColor, normalizeHex, rgbToHex, rgbToHsv } from '../src/engine/color';

describe('color', () => {
  it('converts hex ↔ rgb', () => {
    expect(hexToRgb('#ff8000')).toEqual([255, 128, 0]);
    expect(rgbToHex(255, 128, 0)).toBe('#ff8000');
  });
  it('converts hsv ↔ hex', () => {
    expect(hsvToHex(0, 1, 1)).toBe('#ff0000');
    expect(hsvToHex(120, 1, 1)).toBe('#00ff00');
    expect(hsvToHex(240, 1, 0.5)).toBe('#000080');
    const [h, s, v] = rgbToHsv(255, 128, 0);
    expect(hsvToHex(h, s, v)).toBe('#ff8000');
    expect(rgbToHsv(0, 0, 0)).toEqual([0, 0, 0]);
  });
  it('validates hex input', () => {
    expect(isHexColor('#A0b0C0')).toBe(true);
    expect(isHexColor('a0b0c0')).toBe(true);
    expect(isHexColor('#fff')).toBe(false);
    expect(normalizeHex('A0B0C0')).toBe('#a0b0c0');
  });
});
