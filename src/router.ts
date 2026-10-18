export type Route =
  | { name: 'home' }
  | { name: 'gate'; gameId: string }
  | { name: 'game'; gameId: string }
  | { name: 'parent' };

type Handler = (route: Route) => void;

let handler: Handler | null = null;

export function onRoute(h: Handler): void {
  handler = h;
}

export function go(route: Route): void {
  handler?.(route);
}
