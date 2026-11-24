import { settings } from './settings.svelte';

const media = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
const system = $state({ reduce: media?.matches ?? false });
media?.addEventListener?.('change', (e) => (system.reduce = e.matches));

/** Animations réduites : choix de l'utilisateur, sinon réglage du système. */
export function reducedMotion(): boolean {
  return settings.motion === 'reduce' || (settings.motion === 'auto' && system.reduce);
}
