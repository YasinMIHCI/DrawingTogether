import { BRUSH_PRESETS, getPreset } from '../engine/brush/presets';
import { BASE_BRUSH, type BrushSettings } from '../engine/brush/settings';
import { load, save } from './storage';

export interface CustomBrush {
  name: string;
  settings: BrushSettings;
}

/** Réglages modifiés par l'utilisateur, pinceaux personnalisés, et pinceau choisi par outil. */
interface BrushPrefs {
  overrides: Record<string, Partial<BrushSettings>>;
  custom: Record<string, CustomBrush>;
  selected: { brush: string; eraser: string };
}

const KEY = 'dt.brushes';

export const brushPrefs: BrushPrefs = $state(
  load<BrushPrefs>(KEY, { overrides: {}, custom: {}, selected: { brush: 'pen-fine', eraser: 'eraser-hard' } }),
);

$effect.root(() => {
  $effect(() => save(KEY, $state.snapshot(brushPrefs)));
});

export function isCustomBrush(id: string): boolean {
  return id in brushPrefs.custom;
}

export function brushSettings(id: string): BrushSettings {
  const base = brushPrefs.custom[id]?.settings ?? (getPreset(id) ?? BRUSH_PRESETS[0]).settings;
  return { ...BASE_BRUSH, ...base, ...brushPrefs.overrides[id] };
}

export function setBrushOverride(id: string, patch: Partial<BrushSettings>): void {
  brushPrefs.overrides[id] = { ...brushPrefs.overrides[id], ...patch };
}

/** « Réinitialiser les options » */
export function resetBrush(id: string): void {
  delete brushPrefs.overrides[id];
}

/** Crée un pinceau personnalisé à partir des réglages actuels d'un pinceau. */
export function createCustomBrush(fromId: string, name: string): string {
  const id = `custom-${Date.now().toString(36)}`;
  brushPrefs.custom[id] = { name, settings: brushSettings(fromId) };
  return id;
}

export function renameCustomBrush(id: string, name: string): void {
  if (brushPrefs.custom[id]) brushPrefs.custom[id].name = name;
}

export function deleteCustomBrush(id: string): void {
  delete brushPrefs.custom[id];
  delete brushPrefs.overrides[id];
  if (brushPrefs.selected.brush === id) brushPrefs.selected.brush = 'pen-fine';
  if (brushPrefs.selected.eraser === id) brushPrefs.selected.eraser = 'eraser-hard';
}
