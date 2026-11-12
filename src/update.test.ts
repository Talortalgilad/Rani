import { describe, expect, it } from 'vitest';
import { createUpdater } from './update';

function setup(start: string) {
  let route = start;
  let reloads = 0;
  const u = createUpdater({ route: () => route, reload: () => reloads++ });
  return { u, go: (r: string) => { route = r; u.routeChanged(); }, reloads: () => reloads };
}

describe('refresh when a new version is ready', () => {
  it('in the lobby: reloads at once', () => {
    const t = setup('home');
    t.u.newWorker(true);
    expect(t.reloads()).toBe(1);
  });
  it('the very first install is not an update', () => {
    const t = setup('home');
    t.u.newWorker(false);
    expect(t.reloads()).toBe(0);
  });
  it('in a game, at the gate or in the parents\' area: waits, and reloads only when back in the lobby', () => {
    for (const where of ['game', 'gate', 'parent']) {
      const t = setup(where);
      t.u.newWorker(true);
      expect(t.reloads(), where).toBe(0);
      t.go('gate');
      t.go('game');
      t.go('parent');
      expect(t.reloads(), `${where}: moving between screens`).toBe(0);
      t.go('home');
      expect(t.reloads(), `${where}: back in the lobby`).toBe(1);
    }
  });
  it('reloads once only', () => {
    const t = setup('game');
    t.u.newWorker(true);
    t.go('home');
    t.go('game');
    t.go('home');
    expect(t.reloads()).toBe(1);
  });
});
