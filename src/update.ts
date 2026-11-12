/**
 * A new version of the app is downloaded and activated by the service worker by itself (`autoUpdate`); this decides when the page
 * that is already open switches to it: only in the lobby (never at the gate, in a game or in the parents' area). If the new
 * version is ready in the middle of a game, the page waits and reloads when the player is back in the lobby.
 */
export interface Updater {
  /** The service worker that controls the page changed. `hadController` is false for the very first install (nothing to update). */
  newWorker(hadController: boolean): void;
  /** The screen changed (or is checked again). */
  routeChanged(): void;
  readonly pending: boolean;
}

export function createUpdater(deps: { route(): string; reload(): void }): Updater {
  let pending = false;
  let done = false;
  const check = (): void => {
    if (!pending || done || deps.route() !== 'home') return;
    done = true; // once: no loop of reloads
    deps.reload();
  };
  return {
    newWorker(hadController) {
      if (!hadController) return;
      pending = true;
      check();
    },
    routeChanged: check,
    get pending() {
      return pending;
    },
  };
}

/** Starts watching the service worker; returns what the router calls on every screen change. */
export function initUpdate(route: () => string): () => void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return () => {};
  const updater = createUpdater({ route, reload: () => location.reload() });
  let had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    updater.newWorker(had);
    had = true;
  });
  return () => updater.routeChanged();
}
