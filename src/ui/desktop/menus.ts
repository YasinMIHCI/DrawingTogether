import { FILTERS, type FilterKind } from '../../engine/tools/filters';
import type { MenuDef } from './commands';

const filters = (group: 'filter' | 'effect') =>
  (Object.keys(FILTERS) as FilterKind[]).filter((k) => FILTERS[k].group === group).map((k) => `filter.${k}`);

/** Barre de menus (style Krita). Les entrées renvoient aux commandes de commands.ts. */
export const KRITA_MENUS: MenuDef[] = [
  { label: 'menu.file', items: ['file.new', 'file.open', 'file.save', '-', 'file.import', 'file.exportPng', 'file.exportJpg', 'file.share', '-', 'file.gallery', 'file.home'] },
  { label: 'menu.edit', items: ['edit.undo', 'edit.redo', '-', 'edit.cut', 'edit.copy', 'edit.paste', 'edit.clear', 'edit.fill', '-', 'edit.swapColors', 'edit.defaultColors'] },
  { label: 'menu.image', items: ['image.bgWhite', 'image.bgTransparent', '-', 'image.flipH', 'image.flipV', 'image.rotateLeft', 'image.rotateRight'] },
  { label: 'menu.layer', items: ['layer.new', 'layer.duplicate', 'layer.remove', '-', 'layer.merge', 'layer.up', 'layer.down', '-', 'layer.clear', 'layer.visible', 'layer.lock'] },
  { label: 'menu.select', items: ['select.all', 'select.none', 'select.invert', '-', 'edit.clear', 'edit.fill'] },
  { label: 'menu.filters', items: [...filters('filter'), '-', { head: 'menu.effects' }, ...filters('effect')] },
  {
    label: 'menu.view',
    items: [
      'view.fit', 'view.100', 'view.zoomIn', 'view.zoomOut', '-', 'view.rotateLeft', 'view.rotateRight', 'view.resetRotation', '-',
      'view.panels', '-', { head: 'menu.theme' }, 'view.theme.auto', 'view.theme.light', 'view.theme.dark',
      { head: 'menu.interface' }, 'view.ui.auto', 'view.ui.krita', 'view.ui.paint', 'view.ui.mobile',
    ],
  },
  { label: 'menu.help', items: ['help.shortcuts'] },
];

export const effectCommands = () => filters('effect');
export const filterCommands = () => filters('filter');
