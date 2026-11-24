/** Routage par hash (#/draw…) : compatible GitHub Pages sans configuration serveur. */
export type Route = 'home' | 'draw' | 'shared' | 'games' | 'settings' | 'gallery' | 'pen-test';

const ROUTES: Route[] = ['home', 'draw', 'shared', 'games', 'settings', 'gallery', 'pen-test'];

export function parseHash(hash: string): Route {
  const name = hash.replace(/^#\/?/, '').split(/[/?]/)[0];
  return (ROUTES as string[]).includes(name) ? (name as Route) : 'home';
}

/** Paramètre après la route : #/shared/ABC123 → « ABC123 ». */
export function parseParam(hash: string): string {
  return hash.replace(/^#\/?/, '').split('/')[1]?.split('?')[0] ?? '';
}

export const router = $state({ route: parseHash(location.hash), param: parseParam(location.hash) });

window.addEventListener('hashchange', () => {
  router.route = parseHash(location.hash);
  router.param = parseParam(location.hash);
});

export function href(route: Route): string {
  return route === 'home' ? '#/' : `#/${route}`;
}

export function navigate(route: Route): void {
  location.hash = href(route);
}
