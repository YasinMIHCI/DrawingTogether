import { currentScreen, resolveUi, type UiStyle } from './device';
import { settings } from './settings.svelte';

/** Infos écran réactives (mises à jour au redimensionnement / rotation). */
export const screen = $state({ info: currentScreen() });

const update = () => (screen.info = currentScreen());
window.addEventListener('resize', update);
window.addEventListener('load', update);
window.visualViewport?.addEventListener('resize', update);
window.matchMedia?.('(pointer: coarse)').addEventListener?.('change', update);

/** Style d'interface effectif selon les réglages et l'appareil. */
export function uiStyle(): UiStyle {
  return resolveUi(settings.ui, screen.info);
}
