/** Connexion Internet (pour prévenir que la toile partagée et les jeux en ont besoin). */
export const network = $state({ online: typeof navigator === 'undefined' ? true : navigator.onLine });
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => (network.online = true));
  window.addEventListener('offline', () => (network.online = false));
}
