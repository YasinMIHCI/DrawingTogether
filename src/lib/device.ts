export type UiStyle = 'krita' | 'paint' | 'mobile';
export type UiPreference = 'auto' | UiStyle;

export interface ScreenInfo {
  /** true si le pointeur principal est un doigt (pointer: coarse) */
  coarse: boolean;
  width: number;
  height: number;
}

/** Interface mobile si écran tactile et petit côté < 900 px (téléphones et tablettes). */
export function isTouchDevice(info: ScreenInfo): boolean {
  return info.coarse && Math.min(info.width, info.height) < 900;
}

/** Style d'interface effectif : préférence de l'utilisateur, sinon détection (Krita par défaut sur ordinateur). */
export function resolveUi(pref: UiPreference, info: ScreenInfo): UiStyle {
  if (pref !== 'auto') return pref;
  return isTouchDevice(info) ? 'mobile' : 'krita';
}

export function currentScreen(): ScreenInfo {
  return {
    coarse: hasCoarsePointer(),
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

function hasCoarsePointer(): boolean {
  if (typeof matchMedia !== 'function') return false;
  if (matchMedia('(pointer: coarse)').matches) return true;
  // Certains navigateurs ne signalent pas pointer:coarse : écran tactile sans survol = tactile.
  return (navigator.maxTouchPoints ?? 0) > 0 && !matchMedia('(hover: hover)').matches;
}
