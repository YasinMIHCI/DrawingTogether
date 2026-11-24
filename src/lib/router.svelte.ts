/** Routage par hash (#/draw…) : compatible GitHub Pages sans configuration serveur. */
export type Route = 'home' | 'draw' | 'shared' | 'games' | 'settings';

const ROUTES: Route[] = ['home', 'draw', 'shared', 'games', 'settings'];

export function parseHash(hash: string): Route {
  const name = hash.replace(/^#\/?/, '').split(/[/?]/)[0];
  return (ROUTES as string[]).includes(name) ? (name as Route) : 'home';
}

export const router = $state({ route: parseHash(location.hash) });

window.addEventListener('hashchange', () => {
  router.route = parseHash(location.hash);
});

export function href(route: Route): string {
  return route === 'home' ? '#/' : `#/${route}`;
}

export function navigate(route: Route): void {
  location.hash = href(route);
}
