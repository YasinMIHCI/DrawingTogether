import type { Editor } from '../engine/editor';
import type { BrushSettings } from '../engine/brush/settings';
import { brushPrefs, brushSettings, setBrushOverride } from '../lib/brushPrefs.svelte';
import { colorPrefs } from '../lib/colorPrefs.svelte';

/** Pinceau (ou gomme) utilisé par l'outil actif. */
export function activeBrushKind(editor: Editor): 'brush' | 'eraser' {
  return editor.tool === 'eraser' ? 'eraser' : 'brush';
}

/** Modifie le pinceau actif (mémorisé pour ce pinceau). */
export function tweakActiveBrush(editor: Editor, patch: Partial<BrushSettings>): void {
  const which = activeBrushKind(editor);
  const id = brushPrefs.selected[which];
  setBrushOverride(id, patch);
  editor.setBrush(brushSettings(id), which);
}

export function selectBrush(editor: Editor, which: 'brush' | 'eraser', id: string): void {
  brushPrefs.selected[which] = id;
  editor.setBrush(brushSettings(id), which);
}

/** Échange couleur principale et secondaire. */
export function swapColors(editor: Editor): void {
  const s = colorPrefs.secondary;
  colorPrefs.secondary = editor.color;
  editor.setColor(s);
}

export function defaultColors(editor: Editor): void {
  colorPrefs.secondary = '#ffffff';
  editor.setColor('#000000');
}
