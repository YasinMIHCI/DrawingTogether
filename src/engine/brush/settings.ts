export interface BrushSettings {
  /** Diamètre en pixels du document. */
  size: number;
  /** Opacité du trait entier, 0 à 1 (les tampons d'un même trait ne s'accumulent pas au-delà). */
  opacity: number;
  /** Densité de chaque tampon, 0 à 1 (s'accumule à l'intérieur du trait). */
  flow: number;
  /** Dureté du bord, 0 (flou) à 1 (net). */
  hardness: number;
  /** Écart entre deux tampons, en fraction du diamètre. */
  spacing: number;
  /** Stabilisateur, 0 (aucun) à 0,95 (très lissé). */
  smoothing: number;
  pressureSize: boolean;
  pressureOpacity: boolean;
  /** Taille relative à pression nulle quand pressureSize est actif. */
  minSize: number;
  /** Couleur #rrggbb */
  color: string;
  eraser: boolean;
}

export const DEFAULT_BRUSH: BrushSettings = {
  size: 7,
  opacity: 1,
  flow: 1,
  hardness: 1,
  spacing: 0.1,
  smoothing: 0.3,
  pressureSize: true,
  pressureOpacity: false,
  minSize: 0.15,
  color: '#000000',
  eraser: false,
};
