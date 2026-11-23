/** Forme de la pointe du pinceau. */
export type TipKind =
  | 'round' | 'wet' | 'noise' | 'bristle' | 'splatter'
  | 'star' | 'heart' | 'sparkle' | 'flower' | 'bubble' | 'leaf';

/** paint = peindre, erase = gommer, smudge = étaler les couleurs, blur = flouter. */
export type BrushMode = 'paint' | 'erase' | 'smudge' | 'blur';

export type AngleMode = 'fixed' | 'direction' | 'random';

export interface BrushSettings {
  tip: TipKind;
  mode: BrushMode;
  /** Diamètre en pixels du document. */
  size: number;
  /** Opacité du trait entier, 0 à 1 (les tampons d'un même trait ne la dépassent pas). */
  opacity: number;
  /** Densité de chaque tampon, 0 à 1 (s'accumule à l'intérieur du trait). */
  flow: number;
  /** Dureté du bord (pointes rondes), 0 = flou, 1 = net. */
  hardness: number;
  /** Aplatissement de la pointe, 1 = ronde, 0,1 = très plate. */
  roundness: number;
  /** Angle de la pointe en degrés. */
  angle: number;
  angleMode: AngleMode;
  /** Variation aléatoire de l'angle, en degrés. */
  angleJitter: number;
  /** Écart entre deux tampons, en fraction du diamètre. */
  spacing: number;
  /** Stabilisateur, 0 (aucun) à 0,95 (très lissé). */
  smoothing: number;
  pressureSize: boolean;
  pressureOpacity: boolean;
  /** Taille relative à pression nulle quand pressureSize est actif. */
  minSize: number;
  /** Dispersion autour du trait, en diamètres. */
  scatter: number;
  /** Variation aléatoire de taille (0 à 1) et d'opacité (0 à 1) de chaque tampon. */
  sizeJitter: number;
  opacityJitter: number;
  /** Nombre de particules par tampon (pulvérisation) et taille de chaque particule (fraction du diamètre). */
  count: number;
  particleSize: number;
  /** Grain du papier, 0 à 1, et son échelle. */
  grain: number;
  grainScale: number;
  /** Affinage du début / de la fin du trait (en diamètres) quand il n'y a pas de pression réelle. */
  taperIn: number;
  taperOut: number;
  /** Étaler / flouter : force de l'effet, couleur reprise sous le pinceau, part de la couleur du pinceau. */
  strength: number;
  pickup: number;
  colorMix: number;
}

export const BASE_BRUSH: BrushSettings = {
  tip: 'round',
  mode: 'paint',
  size: 7,
  opacity: 1,
  flow: 1,
  hardness: 1,
  roundness: 1,
  angle: 0,
  angleMode: 'fixed',
  angleJitter: 0,
  spacing: 0.1,
  smoothing: 0.3,
  pressureSize: true,
  pressureOpacity: false,
  minSize: 0.15,
  scatter: 0,
  sizeJitter: 0,
  opacityJitter: 0,
  count: 1,
  particleSize: 1,
  grain: 0,
  grainScale: 1,
  taperIn: 0,
  taperOut: 0,
  strength: 0.6,
  pickup: 0.5,
  colorMix: 0,
};

/** Compatibilité : pinceau par défaut = plume fine. */
export const DEFAULT_BRUSH: BrushSettings = { ...BASE_BRUSH, taperIn: 3, taperOut: 6, minSize: 0.05 };
