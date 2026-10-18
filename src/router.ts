export type Route =
  | { name: 'home' }
  | { name: 'gate'; gameId: string }
  | { name: 'game'; gameId: string }
  | { name: 'parent' };

type Handler = (route: Route) => void;

let handler: Handler | null = null;

function toHash(r: Route): string {
  return r.name === 'home' ? '#/' : r.name === 'parent' ? '#/parent' : `#/${r.name}/${encodeURIComponent(r.gameId)}`;
}

function parse(hash: string): Route {
  const [, name, id] = hash.split('/');
  const gameId = id ? decodeURIComponent(id) : '';
  if ((name === 'gate' || name === 'game') && gameId) return { name, gameId };
  if (name === 'parent') return { name: 'parent' };
  return { name: 'home' };
}

export function onRoute(h: Handler): void {
  handler = h;
  window.addEventListener('hashchange', () => h(parse(location.hash)));
  h(parse(location.hash));
}

export function go(route: Route, opts: { replace?: boolean } = {}): void {
  const hash = toHash(route);
  if (location.hash === hash || (hash === '#/' && !location.hash)) return handler?.(route);
  if (opts.replace) location.replace(hash);
  else location.hash = hash;
}
