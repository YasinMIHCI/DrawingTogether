import { BRUSH_PRESETS, getPreset } from '../engine/brush/presets';
import type { BrushSettings } from '../engine/brush/settings';
import { load, save } from './storage';

/** Réglages modifiés par l'utilisateur pour chaque pinceau, et pinceau choisi par outil. */
interface BrushPrefs {
  overrides: Record<string, Partial<BrushSettings>>;
  selected: { brush: string; eraser: string };
}

const KEY = 'dt.brushes';

export const brushPrefs: BrushPrefs = $state(
  load<BrushPrefs>(KEY, { overrides: {}, selected: { brush: 'pen-fine', eraser: 'eraser-hard' } }),
);

$effect.root(() => {
  $effect(() => save(KEY, $state.snapshot(brushPrefs)));
});

export function brushSettings(id: string): BrushSettings {
  const preset = getPreset(id) ?? BRUSH_PRESETS[0];
  return { ...preset.settings, ...brushPrefs.overrides[id] };
}

export function setBrushOverride(id: string, patch: Partial<BrushSettings>): void {
  brushPrefs.overrides[id] = { ...brushPrefs.overrides[id], ...patch };
}

/** « Réinitialiser les options » */
export function resetBrush(id: string): void {
  delete brushPrefs.overrides[id];
}
