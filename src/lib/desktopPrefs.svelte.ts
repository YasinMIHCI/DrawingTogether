import { load, save } from './storage';

export type DockerId = 'color' | 'brushes' | 'layers' | 'navigator';

/** Disposition des interfaces bureau, mémorisée. */
interface DesktopPrefs {
  /** Largeur du panneau de droite (px). */
  dockWidth: number;
  /** Panneaux repliés */
  collapsed: Record<DockerId, boolean>;
  /** Hauteur de chaque panneau déplié (px), 0 = automatique */
  heights: Record<DockerId, number>;
  /** Tab : masquer tous les panneaux */
  hidden: boolean;
  /** Style Paint : panneau des calques ouvert */
  paintLayers: boolean;
}

const KEY = 'dt.desktop';

export const desktopPrefs: DesktopPrefs = $state(
  load<DesktopPrefs>(KEY, {
    dockWidth: 300,
    collapsed: { color: false, brushes: false, layers: false, navigator: true },
    heights: { color: 0, brushes: 230, layers: 0, navigator: 0 },
    hidden: false,
    paintLayers: false,
  }),
);

$effect.root(() => {
  $effect(() => save(KEY, $state.snapshot(desktopPrefs)));
});
