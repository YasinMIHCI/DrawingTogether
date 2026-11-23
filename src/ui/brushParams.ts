import type { BrushSettings } from '../engine/brush/settings';
import type { Key } from '../lib/i18n/i18n.svelte';

/** Réglages avancés d'un pinceau, affichés sous forme de curseurs. */
export interface BrushSlider {
  key: keyof BrushSettings;
  label: Key;
  min: number;
  max: number;
  step: number;
  /** Afficher en pourcentage */
  pct?: boolean;
  /** Réglage utile seulement dans certains cas */
  when?: (s: BrushSettings) => boolean;
}

const smudgeLike = (s: BrushSettings) => s.mode === 'smudge' || s.mode === 'blur';

export const BRUSH_SLIDERS: BrushSlider[] = [
  { key: 'flow', label: 'brush.flow', min: 0.01, max: 1, step: 0.01, pct: true },
  { key: 'hardness', label: 'brush.hardness', min: 0, max: 1, step: 0.01, pct: true },
  { key: 'spacing', label: 'brush.spacing', min: 0.02, max: 2, step: 0.01, pct: true },
  { key: 'smoothing', label: 'brush.smoothing', min: 0, max: 0.95, step: 0.01, pct: true },
  { key: 'minSize', label: 'brush.minSize', min: 0, max: 1, step: 0.01, pct: true },
  { key: 'roundness', label: 'brush.roundness', min: 0.05, max: 1, step: 0.01, pct: true },
  { key: 'angle', label: 'brush.angle', min: 0, max: 180, step: 1 },
  { key: 'angleJitter', label: 'brush.angleJitter', min: 0, max: 360, step: 1 },
  { key: 'scatter', label: 'brush.scatter', min: 0, max: 2, step: 0.01, pct: true },
  { key: 'sizeJitter', label: 'brush.sizeJitter', min: 0, max: 1, step: 0.01, pct: true },
  { key: 'opacityJitter', label: 'brush.opacityJitter', min: 0, max: 1, step: 0.01, pct: true },
  { key: 'count', label: 'brush.count', min: 1, max: 60, step: 1 },
  { key: 'particleSize', label: 'brush.particleSize', min: 0.01, max: 1, step: 0.01, pct: true, when: (s) => s.count > 1 },
  { key: 'grain', label: 'brush.grain', min: 0, max: 1, step: 0.01, pct: true },
  { key: 'grainScale', label: 'brush.grainScale', min: 0.3, max: 4, step: 0.1, when: (s) => s.grain > 0 },
  { key: 'taperIn', label: 'brush.taperIn', min: 0, max: 15, step: 0.5 },
  { key: 'taperOut', label: 'brush.taperOut', min: 0, max: 15, step: 0.5 },
  { key: 'strength', label: 'brush.strength', min: 0.05, max: 1, step: 0.01, pct: true, when: smudgeLike },
  { key: 'pickup', label: 'brush.pickup', min: 0, max: 1, step: 0.01, pct: true, when: (s) => s.mode === 'smudge' },
  { key: 'colorMix', label: 'brush.colorMix', min: 0, max: 1, step: 0.01, pct: true, when: (s) => s.mode === 'smudge' },
];
