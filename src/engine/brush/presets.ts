import { BASE_BRUSH, type BrushSettings } from './settings';

export const BRUSH_CATEGORIES = ['pen', 'sketch', 'paint', 'spray', 'blend', 'decoration', 'eraser'] as const;
export type BrushCategory = (typeof BRUSH_CATEGORIES)[number];

export interface BrushPreset {
  id: string;
  category: BrushCategory;
  settings: BrushSettings;
}

const b = (id: string, category: BrushCategory, s: Partial<BrushSettings>): BrushPreset => ({
  id,
  category,
  settings: { ...BASE_BRUSH, ...s },
});

const deco = (id: string, tip: BrushSettings['tip'], s: Partial<BrushSettings> = {}) =>
  b(id, 'decoration', {
    tip, size: 32, spacing: 1.6, scatter: 0.5, sizeJitter: 0.5, angleMode: 'random', pressureSize: false, smoothing: 0.1, ...s,
  });

/** Bibliothèque de pinceaux intégrés, par catégorie. */
export const BRUSH_PRESETS: BrushPreset[] = [
  // Stylo
  b('pen-fine', 'pen', { size: 7, minSize: 0.05, taperIn: 3, taperOut: 6 }),
  b('pen-real', 'pen', { size: 7, minSize: 0.05, taperIn: 3, taperOut: 6, grain: 0.3, grainScale: 0.6, hardness: 0.9 }),
  b('pen-round', 'pen', { size: 7, minSize: 0.3, taperIn: 2, taperOut: 4 }),
  b('pen-bold', 'pen', { size: 10, minSize: 0.55, taperIn: 1, taperOut: 2 }),
  b('pen-textured', 'pen', { size: 9, minSize: 0.4, tip: 'noise', grain: 0.45, grainScale: 0.8, spacing: 0.06, angleMode: 'random', taperOut: 3 }),
  b('pen-sketch', 'pen', { size: 5, minSize: 0.1, grain: 0.4, grainScale: 0.6, opacity: 0.85, pressureOpacity: true, taperIn: 2, taperOut: 5 }),
  b('calligraphy', 'pen', { size: 14, roundness: 0.22, angle: 45, minSize: 0.6, spacing: 0.04, taperOut: 2 }),
  b('marker-fine', 'pen', { size: 6, pressureSize: false, hardness: 0.95 }),
  b('marker', 'pen', { size: 14, pressureSize: false, hardness: 0.9, opacity: 0.9 }),
  // Croquis
  b('pencil', 'sketch', { size: 4, hardness: 0.7, grain: 0.55, grainScale: 0.7, pressureOpacity: true, minSize: 0.5, opacity: 0.95, spacing: 0.08 }),
  b('mechanical-pencil', 'sketch', { size: 2, hardness: 0.9, grain: 0.3, grainScale: 0.5, pressureOpacity: true, minSize: 0.7, opacity: 0.9 }),
  b('charcoal', 'sketch', { size: 14, tip: 'noise', grain: 0.7, grainScale: 1.4, pressureOpacity: true, flow: 0.8, angleMode: 'random', minSize: 0.4 }),
  b('oil-pastel', 'sketch', { size: 16, tip: 'noise', grain: 0.75, grainScale: 2, flow: 0.9, scatter: 0.04, angleMode: 'random', minSize: 0.6 }),
  b('pastel', 'sketch', { size: 24, hardness: 0.4, grain: 0.8, grainScale: 1.2, flow: 0.35, opacity: 0.75, pressureOpacity: true, minSize: 0.7 }),
  b('chalk', 'sketch', { size: 20, hardness: 0.85, grain: 0.65, grainScale: 1.6, minSize: 0.6 }),
  // Pinceau
  b('watercolor-round', 'paint', { size: 30, tip: 'wet', flow: 0.25, opacity: 0.6, spacing: 0.08, grain: 0.2, grainScale: 2, minSize: 0.4 }),
  b('flat-brush', 'paint', { size: 26, hardness: 0.8, roundness: 0.28, angle: 90, angleMode: 'direction', flow: 0.6, opacity: 0.75, grain: 0.25, minSize: 0.6, spacing: 0.05 }),
  b('watercolor-diluted', 'paint', { size: 44, hardness: 0, flow: 0.12, opacity: 0.45, scatter: 0.05, minSize: 0.5 }),
  b('watercolor-wet', 'paint', { size: 40, tip: 'wet', flow: 0.2, opacity: 0.85, spacing: 0.05, scatter: 0.05, sizeJitter: 0.12, grain: 0.15, grainScale: 2, minSize: 0.5 }),
  b('watercolor-raw', 'paint', { size: 24, tip: 'noise', flow: 0.4, grain: 0.5, grainScale: 1.5, angleMode: 'random', minSize: 0.3, taperOut: 3 }),
  b('splash', 'paint', { size: 60, tip: 'splatter', spacing: 1.2, scatter: 0.6, sizeJitter: 0.6, angleMode: 'random', flow: 0.75, pressureSize: false }),
  b('wet-brush', 'paint', { size: 30, mode: 'smudge', hardness: 0.3, strength: 0.75, pickup: 0.4, colorMix: 0.6 }),
  b('round-mixer', 'paint', { size: 18, mode: 'smudge', hardness: 0.7, strength: 0.9, pickup: 0.3, colorMix: 0.45, minSize: 0.3 }),
  b('gouache', 'paint', { size: 24, tip: 'bristle', angle: 90, angleMode: 'direction', flow: 0.9, grain: 0.35, spacing: 0.04, minSize: 0.5 }),
  // Pulvérisation
  b('airbrush', 'spray', { size: 60, hardness: 0, flow: 0.06, spacing: 0.05, pressureSize: false, pressureOpacity: true }),
  b('spray', 'spray', { size: 60, count: 24, particleSize: 0.04, scatter: 1, spacing: 0.3, pressureSize: false, pressureOpacity: true }),
  b('droplets', 'spray', { size: 60, count: 4, particleSize: 0.12, hardness: 0.9, sizeJitter: 0.8, scatter: 1, spacing: 0.5, pressureSize: false }),
  b('noise', 'spray', { size: 50, tip: 'noise', hardness: 0.2, flow: 0.25, spacing: 0.15, angleMode: 'random', pressureSize: false }),
  b('spray-soft', 'spray', { size: 50, count: 12, particleSize: 0.08, hardness: 0.3, opacityJitter: 0.7, scatter: 1, spacing: 0.25, pressureSize: false }),
  // Mélange
  b('color-blend', 'blend', { size: 40, mode: 'smudge', hardness: 0.3, strength: 0.6, pickup: 0.5, colorMix: 0.25 }),
  b('blur', 'blend', { size: 40, mode: 'blur', hardness: 0.4, strength: 0.6, pressureSize: false }),
  b('finger', 'blend', { size: 25, mode: 'smudge', hardness: 0.6, strength: 0.85, pickup: 0.15 }),
  b('paint-mixer', 'blend', { size: 30, mode: 'smudge', roundness: 0.5, angle: 90, angleMode: 'direction', strength: 0.8, pickup: 0.35, colorMix: 0.5 }),
  b('fiber-mixer', 'blend', { size: 30, mode: 'smudge', tip: 'bristle', angle: 90, angleMode: 'direction', strength: 0.8, pickup: 0.3 }),
  b('texture-mixer', 'blend', { size: 30, mode: 'smudge', tip: 'noise', angleMode: 'random', strength: 0.7, pickup: 0.4 }),
  // Décoration
  deco('stars', 'star'),
  deco('hearts', 'heart', { angleMode: 'fixed', angleJitter: 30 }),
  deco('sparkles', 'sparkle', { sizeJitter: 0.7 }),
  deco('flowers', 'flower'),
  deco('bubbles', 'bubble', { angleMode: 'fixed', opacityJitter: 0.4 }),
  deco('leaves', 'leaf', { angleMode: 'direction', angleJitter: 40, spacing: 1.2, scatter: 0.3 }),
  // Gomme
  b('eraser-hard', 'eraser', { mode: 'erase', size: 20, pressureSize: false }),
  b('eraser-soft', 'eraser', { mode: 'erase', size: 50, hardness: 0, flow: 0.5, pressureSize: false }),
  b('eraser-textured', 'eraser', { mode: 'erase', size: 24, hardness: 0.8, grain: 0.6, grainScale: 1.2, pressureOpacity: true }),
];

export function getPreset(id: string): BrushPreset | undefined {
  return BRUSH_PRESETS.find((p) => p.id === id);
}
