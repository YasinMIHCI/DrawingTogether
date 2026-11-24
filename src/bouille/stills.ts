import type { BouilleData } from './model';
import { stringifyBouille } from './model';
import type { Expression, View } from './render';
import type { Bouille3D } from './three3d';

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
