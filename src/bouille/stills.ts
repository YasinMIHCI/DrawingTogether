import type { BouilleData } from './model';
import { stringifyBouille } from './model';
import type { Expression, View } from './render';
import type { Bouille3D } from './three3d';
import { GESTURES, walkPose, type GestureName } from './poses';

/**
 * Images fixes de Bouilles en 3D pour tout le site (place, fil, salles…) : un seul moteur 3D caché,
 * une file d'attente, et un cache par (Bouille, vue, expression, rotation, taille).
 */

export interface StillOptions {
  view: View;
  expr?: Expression;
  yaw?: number;
  w: number;
  h: number;
  background?: string | null;
}

let engine: Promise<Bouille3D | null> | null = null;
const cache = new Map<string, Promise<string | null>>();
let chain: Promise<unknown> = Promise.resolve();

function getEngine(): Promise<Bouille3D | null> {
  engine ??= import('./three3d')
    .then(({ Bouille3D, webglAvailable }) => (webglAvailable() ? new Bouille3D(document.createElement('canvas'), false) : null))
    .catch(() => null);
  return engine;
}

/** La 3D est-elle utilisable ici (et voulue) ? */
export function stills3d(): boolean {
  try {
    return localStorage.getItem('dt.bouille3d') !== '0';
  } catch {
    return true;
  }
}

/** Image 3D d'une Bouille (data URL), ou null si la 3D n'est pas disponible. */
export function bouilleStill(b: BouilleData, opt: StillOptions): Promise<string | null> {
  const key = `${stringifyBouille(b)}|${opt.view}|${opt.expr ?? 'neutral'}|${(opt.yaw ?? 0).toFixed(2)}|${opt.w}x${opt.h}|${opt.background ?? ''}`;
  let p = cache.get(key);
  if (!p) {
    // Un rendu à la fois : le moteur est partagé
    p = chain.then(async () => {
      const e = await getEngine();
      if (!e) return null;
      try {
        return await e.still(b, { view: opt.view, expr: opt.expr ?? 'neutral', yaw: opt.yaw, w: opt.w, h: opt.h, background: opt.background });
      } catch {
        return null;
      }
    });
    chain = p;
    cache.set(key, p);
    if (cache.size > 300) cache.delete(cache.keys().next().value!);
  }
  return p;
}

/** Images par pas dans les planches de marche. */
export const WALK_FRAMES = 8;
/** Rotations des planches de marche : ligne 0 vers la droite, ligne 1 vers la gauche. */
export const WALK_YAWS = [0.6, -0.6];
/** Hauteur en plus au-dessus des planches de gestes (sauts, bras levés), en fraction de la hauteur. */
export const GESTURE_ABOVE = 0.4;
const sheetCache = new Map<string, Promise<string | null>>();

function sheet(key: string, make: (e: Bouille3D) => Promise<string>): Promise<string | null> {
  let p = sheetCache.get(key);
  if (!p) {
    p = chain.then(async () => {
      const e = await getEngine();
      if (!e) return null;
      try {
        return await make(e);
      } catch {
        return null;
      }
    });
    chain = p;
    sheetCache.set(key, p);
    if (sheetCache.size > 80) sheetCache.delete(sheetCache.keys().next().value!);
  }
  return p;
}

/** Planche de marche 3D (voir Bouille3D.animSheet), mise en file et en cache comme les images fixes. */
export function bouilleWalk(b: BouilleData, opt: { w: number; h: number }): Promise<string | null> {
  return sheet(`walk|${stringifyBouille(b)}|${opt.w}x${opt.h}`, (e) =>
    e.animSheet(b, { expr: 'neutral', yaws: WALK_YAWS, frames: WALK_FRAMES, w: opt.w, h: opt.h, pose: walkPose }),
  );
}

/** Planche d'un geste (une seule ligne, tournée selon `yaw`). */
export function bouilleGesture(b: BouilleData, name: GestureName, opt: { yaw: number; w: number; h: number }): Promise<string | null> {
  const g = GESTURES[name];
  return sheet(`${name}|${stringifyBouille(b)}|${opt.yaw}|${opt.w}x${opt.h}`, (e) =>
    e.animSheet(b, {
      expr: g.expr, yaws: [opt.yaw], frames: g.frames, w: opt.w, h: opt.h, above: GESTURE_ABOVE,
      // Le bras qui salue est celui qui fait face à la caméra
      pose: (t, yaw) => g.pose(t, yaw > 0 ? 0 : 1),
    }),
  );
}
