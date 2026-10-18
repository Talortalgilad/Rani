import './ui/styles.css';
import { onRoute, go, type Route } from './router';
import { renderHome } from './ui/home';
import { renderGate } from './ui/gate';
import { renderParent } from './ui/parent';
import { games } from './games/registry';
import { sound } from './sound';
import { clearPass, consumeParent, grantPass, hasFreshSession, startRound } from './access';
import { gameStore, update } from './storage';
import type { GameModule } from './games/types';

const app = document.getElementById('app')!;

let cleanup: (() => void) | null = null;
let activeGame: GameModule | null = null;

function teardown(): void {
  activeGame?.unmount();
  activeGame = null;
  cleanup?.();
  cleanup = null;
}

function mountGame(gameId: string): void {
  const game = games.find((g) => g.id === gameId);
  if (!game) return go({ name: 'home' }, { replace: true });
  // No route reaches a game without a round granted by the gate.
  // The one exception: a round paused less than 10 minutes ago resumes (paused) after a reload.
  let resuming = false;
  if (!startRound(gameId)) {
    if (!hasFreshSession(gameId)) return go({ name: 'gate', gameId }, { replace: true });
    resuming = true;
  }
  app.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'screen game';
  app.appendChild(container);
  const store = gameStore(game.id);
  activeGame = game;
  game.mount({
    container,
    resuming,
    onExit: () => go({ name: 'home' }),
    onRoundEnd: (r) => {
      if (r.stars > 0) update((s) => (s.stars += r.stars));
    },
    requestRound: (start) => {
      if (startRound(game.id)) start();
      else go({ name: 'gate', gameId: game.id });
    },
    sound,
    ...store,
  });
}

onRoute((route: Route) => {
  teardown();
  switch (route.name) {
    case 'home':
      clearPass();
      cleanup = renderHome(app);
      break;
    case 'gate':
      if (!games.some((g) => g.id === route.gameId)) return go({ name: 'home' }, { replace: true });
      cleanup = renderGate(app, route.gameId, () => {
        grantPass(route.gameId);
        go({ name: 'game', gameId: route.gameId }, { replace: true });
      });
      break;
    case 'game':
      mountGame(route.gameId);
      break;
    case 'parent':
      if (!consumeParent()) return go({ name: 'home' }, { replace: true });
      cleanup = renderParent(app);
      break;
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) activeGame?.pause();
});

