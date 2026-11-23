import { load, save } from './storage';

export interface Palette {
  name: string;
  colors: string[];
}

/** Couleur secondaire et ensembles de couleurs, mémorisés dans le navigateur. */
interface ColorPrefs {
  secondary: string;
  palettes: Palette[];
  active: number;
}

const KEY = 'dt.colors';

export const colorPrefs: ColorPrefs = $state(
  load<ColorPrefs>(KEY, {
    secondary: '#ffffff',
    palettes: [
      {
        name: '',
        colors: ['#1f2430', '#ffffff', '#e8463a', '#f59f2f', '#f7d046', '#7cc35c', '#2bb3a3', '#3d7be0', '#8a5cd6', '#e86fa8', '#8b5a3c', '#f2c6a0'],
      },
    ],
    active: 0,
  }),
);

$effect.root(() => {
  $effect(() => save(KEY, $state.snapshot(colorPrefs)));
});

export function activePalette(): Palette {
  return colorPrefs.palettes[colorPrefs.active] ?? colorPrefs.palettes[0];
}

export function addPalette(name: string): void {
  colorPrefs.palettes.push({ name, colors: [] });
  colorPrefs.active = colorPrefs.palettes.length - 1;
}

export function removePalette(index: number): void {
  if (colorPrefs.palettes.length <= 1) return;
  colorPrefs.palettes.splice(index, 1);
  colorPrefs.active = Math.max(0, Math.min(colorPrefs.active, colorPrefs.palettes.length - 1));
}
