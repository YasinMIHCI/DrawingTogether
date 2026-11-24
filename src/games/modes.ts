import type { Key } from '../lib/i18n/i18n.svelte';

export type ModeId = 'classic' | 'story' | 'flipbook' | 'corpse' | 'scribble' | 'atelier' | 'relay';
export type StepKind = 'write' | 'draw';
/** Présentation du résultat dans l'album */
export type ResultKind = 'chain' | 'story' | 'flipbook' | 'stack' | 'single' | 'relay';

export interface ModeDef {
  id: ModeId;
  /** Petite illustration (dessin SVG du projet, voir ModeIcon) */
  icon: ModeId;
  name: Key;
  desc: Key;
  /** Nombre de tours par défaut selon le nombre de joueurs */
  rounds: (players: number) => number;
  /** Écrire ou dessiner à ce tour */
  step: (round: number) => StepKind;
  result: ResultKind;
  /** Temps par défaut (secondes, 0 = illimité) */
  writeTime: number;
  drawTime: number;
}

export const MODES: ModeDef[] = [
  {
    id: 'classic', icon: 'classic', name: 'mode.classic', desc: 'mode.classic.desc',
    rounds: (n) => Math.max(n, 2), step: (r) => (r % 2 === 0 ? 'write' : 'draw'), result: 'chain', writeTime: 45, drawTime: 90,
  },
  {
    id: 'story', icon: 'story', name: 'mode.story', desc: 'mode.story.desc',
    rounds: (n) => Math.max(n, 3), step: () => 'write', result: 'story', writeTime: 60, drawTime: 0,
  },
  {
    id: 'flipbook', icon: 'flipbook', name: 'mode.flipbook', desc: 'mode.flipbook.desc',
    rounds: (n) => Math.max(n, 3), step: () => 'draw', result: 'flipbook', writeTime: 0, drawTime: 45,
  },
  {
    id: 'corpse', icon: 'corpse', name: 'mode.corpse', desc: 'mode.corpse.desc',
    rounds: (n) => Math.min(Math.max(n, 3), 5), step: () => 'draw', result: 'stack', writeTime: 0, drawTime: 75,
  },
  {
    id: 'scribble', icon: 'scribble', name: 'mode.scribble', desc: 'mode.scribble.desc',
    rounds: (n) => Math.max(n, 2), step: (r) => (r % 2 === 0 ? 'draw' : 'write'), result: 'chain', writeTime: 45, drawTime: 75,
  },
  {
    id: 'atelier', icon: 'atelier', name: 'mode.atelier', desc: 'mode.atelier.desc',
    rounds: () => 1, step: () => 'draw', result: 'single', writeTime: 0, drawTime: 0,
  },
  {
    id: 'relay', icon: 'relay', name: 'mode.relay', desc: 'mode.relay.desc',
    rounds: (n) => Math.max(n, 2) + 1, step: (r) => (r === 0 ? 'write' : 'draw'), result: 'relay', writeTime: 45, drawTime: 60,
  },
];

export function getMode(id: ModeId): ModeDef {
  return MODES.find((m) => m.id === id) ?? MODES[0];
}

/** Réglages de la partie (onglet « Personnalisations ») */
export interface GameConfig {
  mode: ModeId;
  /** 0 = automatique (selon le mode et le nombre de joueurs) */
  rounds: number;
  /** null = temps du mode ; 0 = illimité */
  writeTime: number | null;
  drawTime: number | null;
  /** Éditeur proposé au départ quand on dessine */
  editor: 'simple' | 'full';
}

export const DEFAULT_CONFIG: GameConfig = { mode: 'classic', rounds: 0, writeTime: null, drawTime: null, editor: 'simple' };

export function roundsFor(cfg: GameConfig, players: number): number {
  return cfg.rounds > 0 ? Math.min(cfg.rounds, 12) : getMode(cfg.mode).rounds(players);
}

/** Durée d'une étape en secondes (0 = illimitée). */
export function stepTime(cfg: GameConfig, kind: StepKind): number {
  const m = getMode(cfg.mode);
  return kind === 'write' ? (cfg.writeTime ?? m.writeTime) : (cfg.drawTime ?? m.drawTime);
}

/**
 * Rotation : au tour r, le joueur n° p travaille sur la chaîne (p + r) mod n.
 * Chaque chaîne passe ainsi par un joueur différent à chaque tour.
 */
export function chainFor(player: number, round: number, n: number): number {
  return (player + round) % n;
}

export function authorOf(chain: number, round: number, n: number): number {
  return (((chain - round) % n) + n) % n;
}

// Toile des jeux
export const GAME_W = 960;
export const GAME_H = 720;
/** Cadavre exquis : hauteur d'une partie et de la bande visible du dessin précédent */
export const CORPSE_H = 480;
export const CORPSE_STRIP = 80;
