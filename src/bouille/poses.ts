import type { Expression } from './render';

/**
 * Poses du corps 3D (sans squelette : voir le shader de three3d.ts). Angles en radians, côtés [gauche (x < 0), droite (x > 0)].
 * leg : jambe vers l'avant (< 0) ou l'arrière (> 0) ; knee : pli du genou ; armX : bras vers l'arrière (> 0) ;
 * armZ : bras levé sur le côté ; y : hauteur du personnage ; rotY : rotation en plus ; headX / headZ : tête penchée.
 */
export interface Pose {
  leg?: [number, number];
  knee?: [number, number];
  armX?: [number, number];
  armZ?: [number, number];
  y?: number;
  rotY?: number;
  headX?: number;
  headZ?: number;
}

const TAU = Math.PI * 2;
/** Monte en début de geste, redescend à la fin. */
const env = (t: number, k = 0.16) => Math.min(1, t / k, (1 - t) / k);
const ease = (t: number) => t * t * (3 - 2 * t);

/** Un pas complet pour t ∈ [0, 1). */
export function walkPose(t: number): Pose {
  const s = Math.sin(t * TAU);
  // Jambe gauche en avant quand la droite est en arrière (genou plié), bras à l'opposé de la jambe
  return {
    leg: [0.42 * s, -0.42 * s],
    knee: [0.75 * Math.max(0, s), 0.75 * Math.max(0, -s)],
    armX: [-0.5 * s, 0.5 * s],
    y: 0.025 * Math.abs(Math.cos(t * TAU)),
    headZ: 0.035 * s,
  };
}

export type GestureName = 'wave' | 'cheer' | 'jump' | 'spin' | 'dance';

export interface Gesture {
  frames: number;
  /** Durée (s) */
  dur: number;
  expr: Expression;
  /** `front` : côté du bras qui fait face à la caméra (0 = gauche, 1 = droite) */
  pose: (t: number, front: 0 | 1) => Pose;
}

export const GESTURES: Record<GestureName, Gesture> = {
  // Coucou de la main
  wave: {
    frames: 16, dur: 1.5, expr: 'happy',
    pose: (t, front) => {
      const up = env(t, 0.18);
      const arm = up * (1.85 + 0.4 * Math.sin(t * TAU * 3));
      return { armZ: front === 0 ? [arm, 0] : [0, arm], armX: front === 0 ? [-0.7 * up, 0] : [0, -0.7 * up], headZ: (front === 0 ? -0.08 : 0.08) * up };
    },
  },
  // Hourra : deux bras en l'air, petits sauts
  cheer: {
    frames: 14, dur: 1.3, expr: 'happy',
    pose: (t) => {
      const up = env(t, 0.15);
      const a = up * (2.0 + 0.2 * Math.sin(t * TAU * 2));
      return { armZ: [a, a], armX: [-0.45 * up, -0.45 * up], y: 0.12 * Math.abs(Math.sin(t * TAU * 2)) * up };
    },
  },
  // Saut : on s'accroupit, on saute bras en l'air, on atterrit
  jump: {
    frames: 16, dur: 1.2, expr: 'surprised',
    pose: (t) => {
      const crouch = t < 0.22 ? Math.sin((t / 0.22) * Math.PI) : t > 0.72 ? Math.sin(((t - 0.72) / 0.28) * Math.PI) * 0.8 : 0;
      const air = t >= 0.22 && t <= 0.72 ? Math.sin(((t - 0.22) / 0.5) * Math.PI) : 0;
      const arms = air * 1.7 + crouch * 0.2;
      return {
        y: air * 0.42 - crouch * 0.1, leg: [-0.45 * crouch - 0.25 * air, -0.45 * crouch - 0.25 * air], knee: [0.9 * crouch + 0.5 * air, 0.9 * crouch + 0.5 * air],
        armZ: [arms, arms], armX: [0.4 * crouch - 0.3 * air, 0.4 * crouch - 0.3 * air],
      };
    },
  },
  // Pirouette, bras écartés
  spin: {
    frames: 16, dur: 1.2, expr: 'wink',
    pose: (t) => {
      const up = env(t, 0.2);
      return { rotY: TAU * ease(t), armZ: [1.2 * up, 1.2 * up], y: 0.06 * Math.sin(t * Math.PI) };
    },
  },
  // Petite danse : bras qui montent l'un après l'autre, balancement
  dance: {
    frames: 16, dur: 1.6, expr: 'happy',
    pose: (t) => {
      const up = env(t, 0.12);
      const s = Math.sin(t * TAU * 2);
      return {
        armZ: [up * (0.8 + 1.1 * Math.max(0, s)), up * (0.8 + 1.1 * Math.max(0, -s))], armX: [-0.4 * up, -0.4 * up],
        knee: [0.35 * Math.max(0, s) * up, 0.35 * Math.max(0, -s) * up],
        y: -0.03 * Math.abs(s) * up, headZ: 0.12 * s * up, rotY: 0.25 * s * up,
      };
    },
  },
};

export const GESTURE_NAMES = Object.keys(GESTURES) as GestureName[];
