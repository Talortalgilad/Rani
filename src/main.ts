import './ui/styles.css';
import { onRoute, go, type Route } from './router';
import { renderHome } from './ui/home';
import { renderGate } from './ui/gate';
import { renderParent } from './ui/parent';
import { games } from './games/registry';
import { sound } from './sound';
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
  if (!game) return go({ name: 'home' });
  app.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'screen game';
  app.appendChild(container);
  const store = gameStore(game.id);
  activeGame = game;
  game.mount({
    container,
    onExit: () => go({ name: 'home' }),
    onRoundEnd: (r) => {
      if (r.stars > 0) update((s) => (s.stars += r.stars));
    },
    sound,
    ...store,
  });
}

onRoute((route: Route) => {
  teardown();
  switch (route.name) {
    case 'home':
      cleanup = renderHome(app);
      break;
    case 'gate':
      cleanup = renderGate(app, route.gameId);
      break;
    case 'game':
      mountGame(route.gameId);
      break;
    case 'parent':
      cleanup = renderParent(app);
      break;
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) activeGame?.pause();
});

go({ name: 'home' });
