import type { Editor, ToolId } from '../../engine/editor';
import { FILTERS, type FilterKind } from '../../engine/tools/filters';
import { brushSettings, brushPrefs } from '../../lib/brushPrefs.svelte';
import { settings, type ThemePreference } from '../../lib/settings.svelte';
import type { UiPreference } from '../../lib/device';
import type { Key } from '../../lib/i18n/i18n.svelte';
import { navigate } from '../../lib/router.svelte';
import type { IconName } from '../common/icons';
import type { FileActions } from '../common/types';
import { activeBrushKind, defaultColors, swapColors, tweakActiveBrush } from '../brushActions';

/** Une action de l'interface bureau : menus, ruban, raccourcis. */
export interface Command {
  id: string;
  label: Key;
  /** Raccourcis, ex. 'Mod+Shift+Z' (Mod = Ctrl, ou ⌘ sur Mac). */
  keys?: string[];
  /** Raccourci déjà géré par le moteur : seulement affiché. */
  displayOnly?: boolean;
  icon?: IconName;
  run: () => void;
  enabled?: () => boolean;
  checked?: () => boolean;
}

export type MenuEntry = string | '-' | { head: Key };
export interface MenuDef {
  label: Key;
  items: MenuEntry[];
}

export interface UiHooks {
  togglePanels(): void;
  showShortcuts(): void;
}

const ROT = Math.PI / 12;

export function createCommands(editor: Editor, files: FileActions, ui: UiHooks): Record<string, Command> {
  const e = editor;
  const off = (k: NonNullable<FileActions['disabled']>[number]) => files.disabled?.includes(k) ?? false;
  const tool = (id: ToolId, label: Key, key: string, icon: IconName): Command => ({
    id: `tool.${id}`, label, keys: [key], icon, run: () => e.setTool(id), checked: () => e.tool === id,
  });
  const list: Command[] = [
    // Fichier
    { id: 'file.new', label: 'file.new', keys: ['Mod+Alt+N'], icon: 'newDoc', run: () => files.newDoc(), enabled: () => !off('newDoc') },
    { id: 'file.open', label: 'file.open', keys: ['Mod+O'], icon: 'open', run: () => files.open(), enabled: () => !off('open') },
    { id: 'file.save', label: 'file.save', keys: ['Mod+S'], icon: 'save', run: () => files.save(), enabled: () => !off('save') },
    { id: 'file.import', label: 'file.import', keys: ['Mod+Shift+O'], icon: 'import', run: () => files.importImage(), enabled: () => !off('importImage') },
    { id: 'file.exportPng', label: 'file.exportPng', keys: ['Mod+Shift+E'], icon: 'export', run: () => files.exportImage('png') },
    { id: 'file.exportJpg', label: 'file.exportJpg', icon: 'export', run: () => files.exportImage('jpeg') },
    { id: 'file.home', label: 'm.home', icon: 'home', run: () => navigate('home') },
    { id: 'file.gallery', label: 'file.gallery', icon: 'image', run: () => navigate('gallery') },
    // Édition
    { id: 'edit.undo', label: 'draw.undo', keys: ['Mod+Z'], displayOnly: true, icon: 'undo', run: () => e.undo(), enabled: () => e.history.canUndo },
    { id: 'edit.redo', label: 'draw.redo', keys: ['Mod+Shift+Z', 'Mod+Y'], displayOnly: true, icon: 'redo', run: () => e.redo(), enabled: () => e.history.canRedo },
    { id: 'edit.cut', label: 'select.cut', keys: ['Mod+X'], displayOnly: true, icon: 'cut', run: () => e.cut() },
    { id: 'edit.copy', label: 'select.copy', keys: ['Mod+C'], displayOnly: true, icon: 'duplicate', run: () => e.copy() },
    { id: 'edit.paste', label: 'select.paste', keys: ['Mod+V'], displayOnly: true, icon: 'paste', run: () => e.paste(), enabled: () => e.hasClipboard },
    { id: 'edit.clear', label: 'select.delete', keys: ['Delete'], displayOnly: true, icon: 'eraser', run: () => e.deleteSelection() },
    { id: 'edit.fill', label: 'cmd.fillSelection', keys: ['Alt+Backspace'], icon: 'fill', run: () => e.fillSelection() },
    { id: 'edit.swapColors', label: 'cmd.swapColors', keys: ['X'], icon: 'swapColors', run: () => swapColors(e) },
    { id: 'edit.defaultColors', label: 'cmd.defaultColors', keys: ['D'], run: () => defaultColors(e) },
    // Image
    { id: 'image.bgWhite', label: 'cmd.bgWhite', run: () => e.setBackground('#ffffff'), checked: () => e.doc.background !== null },
    { id: 'image.bgTransparent', label: 'cmd.bgTransparent', run: () => e.setBackground(null), checked: () => e.doc.background === null },
    { id: 'image.flipH', label: 'cmd.flipH', icon: 'flipH', run: () => quickTransform(e, (t) => t.flip(true)) },
    { id: 'image.flipV', label: 'cmd.flipV', icon: 'flipV', run: () => quickTransform(e, (t) => t.flip(false)) },
    { id: 'image.rotateLeft', label: 'cmd.rotateLeft', icon: 'rotateLeft', run: () => quickTransform(e, (t) => t.rotate90(-1)) },
    { id: 'image.rotateRight', label: 'cmd.rotateRight', icon: 'rotateRight', run: () => quickTransform(e, (t) => t.rotate90(1)) },
    // Calque
    { id: 'layer.new', label: 'layers.add', keys: ['Insert', 'Mod+Shift+L'], icon: 'plus', run: () => e.addLayer() },
    { id: 'layer.duplicate', label: 'layers.duplicate', keys: ['Mod+J'], icon: 'duplicate', run: () => e.duplicateLayer() },
    { id: 'layer.remove', label: 'layers.remove', icon: 'trash', run: () => e.removeLayer(), enabled: () => e.doc.layers.length > 1 },
    { id: 'layer.merge', label: 'layers.merge', keys: ['Mod+E'], icon: 'mergeDown', run: () => e.mergeDown(), enabled: () => e.doc.indexOf(e.doc.activeId) > 0 },
    { id: 'layer.up', label: 'layers.up', keys: ['Mod+]'], icon: 'arrowUp', run: () => e.moveLayer(e.doc.activeId, 1), enabled: () => e.doc.indexOf(e.doc.activeId) < e.doc.layers.length - 1 },
    { id: 'layer.down', label: 'layers.down', keys: ['Mod+['], icon: 'arrowDown', run: () => e.moveLayer(e.doc.activeId, -1), enabled: () => e.doc.indexOf(e.doc.activeId) > 0 },
    { id: 'layer.clear', label: 'layers.clear', icon: 'eraser', run: () => e.clearLayer() },
    { id: 'layer.visible', label: 'layers.visible', icon: 'eye', run: () => e.setLayerProps(e.doc.activeId, { visible: !e.doc.active.visible }), checked: () => e.doc.active.visible },
    { id: 'layer.lock', label: 'layers.lock', icon: 'lock', run: () => e.setLayerProps(e.doc.activeId, { locked: !e.doc.active.locked }), checked: () => e.doc.active.locked },
    // Sélection
    { id: 'select.all', label: 'select.all', keys: ['Mod+A'], displayOnly: true, run: () => e.selectAll() },
    { id: 'select.none', label: 'select.none', keys: ['Mod+Shift+A', 'Mod+D'], displayOnly: true, run: () => e.deselect(), enabled: () => e.selection.active },
    { id: 'select.invert', label: 'select.invert', keys: ['Mod+Shift+I'], displayOnly: true, run: () => e.invertSelection() },
    // Affichage
    { id: 'view.fit', label: 'draw.fit', keys: ['Mod+0'], icon: 'fit', run: () => e.fit() },
    { id: 'view.100', label: 'draw.zoom100', keys: ['Mod+1'], run: () => e.setZoom(1) },
    { id: 'view.zoomIn', label: 'cmd.zoomIn', keys: ['Mod+=', 'Mod++'], icon: 'zoomIn', run: () => e.setZoom(e.view.zoom * 1.25) },
    { id: 'view.zoomOut', label: 'cmd.zoomOut', keys: ['Mod+-'], icon: 'zoomOut', run: () => e.setZoom(e.view.zoom / 1.25) },
    { id: 'view.rotateLeft', label: 'cmd.viewRotateLeft', keys: ['4'], icon: 'rotateLeft', run: () => e.setRotation(e.view.rotation - ROT) },
    { id: 'view.rotateRight', label: 'cmd.viewRotateRight', keys: ['6'], icon: 'rotateRight', run: () => e.setRotation(e.view.rotation + ROT) },
    { id: 'view.resetRotation', label: 'draw.resetRotation', keys: ['5'], run: () => e.setRotation(0) },
    { id: 'view.panels', label: 'cmd.togglePanels', keys: ['Tab'], icon: 'sidebar', run: () => ui.togglePanels() },
    ...(['auto', 'light', 'dark'] as ThemePreference[]).map((t): Command => ({
      id: `view.theme.${t}`, label: `theme.${t}` as Key, run: () => (settings.theme = t), checked: () => settings.theme === t,
    })),
    ...(['auto', 'krita', 'paint', 'mobile'] as UiPreference[]).map((u): Command => ({
      id: `view.ui.${u}`, label: `settings.ui.${u}` as Key, run: () => (settings.ui = u), checked: () => settings.ui === u,
    })),
    // Outils
    tool('brush', 'tools.brush', 'B', 'brush'),
    tool('eraser', 'tools.eraser', 'E', 'eraser'),
    tool('fill', 'tools.fill', 'G', 'fill'),
    tool('eyedropper', 'tools.eyedropper', 'I', 'eyedropper'),
    tool('shape', 'tools.shape', 'U', 'shape'),
    tool('text', 'tools.text', 'T', 'text'),
    tool('select', 'tools.select', 'M', 'select'),
    tool('transform', 'tools.transform', 'V', 'move'),
    tool('liquify', 'tools.liquify', 'L', 'liquify'),
    { id: 'brush.smaller', label: 'cmd.brushSmaller', keys: ['['], run: () => resize(e, 1 / 1.15) },
    { id: 'brush.bigger', label: 'cmd.brushBigger', keys: [']'], run: () => resize(e, 1.15) },
    // Aide
    { id: 'help.shortcuts', label: 'cmd.shortcuts', keys: ['Shift+?'], icon: 'keyboard', run: () => ui.showShortcuts() },
    // Filtres
    ...(Object.keys(FILTERS) as FilterKind[]).map((k): Command => ({
      id: `filter.${k}`, label: `filter.${k}` as Key, icon: FILTERS[k].group === 'effect' ? 'effect' : 'filters', run: () => e.beginFilter(k),
    })),
  ];
  return Object.fromEntries(list.map((c) => [c.id, c]));
}

/** Retourne / pivote d'un coup le calque (ou la sélection). */
function quickTransform(e: Editor, op: (t: Editor['transform']) => void): void {
  const prev = e.tool;
  e.setTool('transform');
  if (!e.transform.active) {
    e.setTool(prev);
    return;
  }
  op(e.transform);
  e.finishTransform(true);
  e.setTool(prev);
}

function resize(e: Editor, k: number): void {
  const which = activeBrushKind(e);
  const size = brushSettings(brushPrefs.selected[which]).size;
  tweakActiveBrush(e, { size: Math.max(1, Math.min(300, Math.round(size * k * 10) / 10)) });
}

// ---------- Raccourcis ----------

export const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** Affichage d'un raccourci : « Ctrl+Maj+Z » ou « ⌘⇧Z ». */
export function formatKeys(spec: string, shift = settings.locale === 'fr' ? 'Maj' : 'Shift'): string {
  const parts = spec.split('+').filter(Boolean);
  if (spec.endsWith('++')) parts.push('+');
  return parts
    .map((p) => (p === 'Mod' ? (IS_MAC ? '⌘' : 'Ctrl') : p === 'Shift' ? (IS_MAC ? '⇧' : shift) : p === 'Alt' ? (IS_MAC ? '⌥' : 'Alt') : p))
    .join(IS_MAC ? '' : '+');
}

export function matchKeys(e: KeyboardEvent, spec: string): boolean {
  const parts = spec.split('+');
  let key = parts.pop()!;
  if (key === '' && spec.endsWith('++')) key = '+';
  const mod = parts.includes('Mod');
  const shift = parts.includes('Shift');
  const alt = parts.includes('Alt');
  if ((e.ctrlKey || e.metaKey) !== mod || e.altKey !== alt) return false;
  // Pour les symboles (« ? », « + »…), Maj fait partie de la touche : on ne la vérifie pas.
  const symbol = key.length === 1 && !/[a-z0-9]/i.test(key);
  if (!symbol && e.shiftKey !== shift) return false;
  if (key.length === 1) return e.key.toLowerCase() === key.toLowerCase();
  return e.key === key;
}

function isTextField(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return true;
  return t instanceof HTMLInputElement && !['range', 'color', 'checkbox', 'radio', 'button'].includes(t.type);
}

/** Écoute le clavier et lance la commande correspondante. Renvoie la fonction d'arrêt. */
export function bindShortcuts(commands: Record<string, Command>): () => void {
  const onKey = (ev: KeyboardEvent) => {
    if (isTextField(ev.target)) return;
    if (ev.repeat && ev.key !== '[' && ev.key !== ']') return;
    // Tab sert aussi à naviguer au clavier : on ne le prend que si rien d'autre n'a le focus.
    const active = document.activeElement;
    if (ev.key === 'Tab' && active && active !== document.body && active.tagName !== 'CANVAS') return;
    for (const c of Object.values(commands)) {
      if (c.displayOnly || !c.keys) continue;
      if (c.keys.some((k) => matchKeys(ev, k))) {
        if (c.enabled && !c.enabled()) return;
        ev.preventDefault();
        c.run();
        return;
      }
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}
