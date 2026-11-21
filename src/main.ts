import { loadSave as loadCarnivalSave, writeSave as writeCarnivalSave } from './lobby/carnival/save';
import '@fontsource/rubik/latin-400.css';
import '@fontsource/rubik/latin-600.css';
import '@fontsource/rubik/latin-800.css';
import '@fontsource/rubik/hebrew-400.css';
import '@fontsource/rubik/hebrew-600.css';
import '@fontsource/rubik/hebrew-800.css';
import './ui/styles.css';
import { onRoute, go, type Route } from './router';
import { renderHomeCarnival as renderHomeAuto } from './lobby/carnival/entry';
import { fpsEnabled } from './lobby3d/quality';
import { renderGate } from './ui/gate';
import { initInstall } from './install';
import { initUpdate } from './update';
import { renderParent } from './ui/parent';
import { showTimeUp } from './ui/timeup';
import { isTimeUp, trackUsage } from './usage';
import { games } from './games/registry';
import { sound, unlockAudio } from './sound';
import { allowParent, clearPass, consumeParent, grantPass, hasFreshSession, startRound } from './access';
import { gameStore, getState, update } from './storage';
import type { GameModule } from './games/types';

initInstall(); // before anything else: the browser sends its install offer early
const app = document.getElementById('app')!;

let cleanup: (() => void) | null = null;
let activeGame: GameModule | null = null;

function teardown(): void {
  activeGame?.unmount();
  activeGame = null;
  cleanup?.();
  cleanup = null;
}

function mountGame(gameId: string, own?: GameModule): void {
  const game = own ?? games.find((g) => g.id === gameId);
  if (!game) return go({ name: 'home' }, { replace: true });
  // No route reaches a game without a round granted by the gate.
  // The one exception: a round paused less than 10 minutes ago resumes (paused) after a reload.
  let resuming = false;
  if (!own && !startRound(gameId)) {
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
      if (own) return;
      // the carnival gives the hearts of the ones who waited for this game when she gets back
      try {
        const cs = loadCarnivalSave();
        cs.pendingRounds.push(game.id);
        writeCarnivalSave(cs);
      } catch {
        /* the carnival is optional */
      }
    },
    requestRound: (start) => {
      if (own || startRound(game.id)) start();
      else go({ name: 'gate', gameId: game.id });
    },
    sound,
    addStars: (n) => update((s) => (s.stars += n)),
    getSettings: () => getState().settings,
    ...store,
  });
}

if (import.meta.env.DEV) (window as unknown as { __grantPass?: (id: string) => void }).__grantPass = grantPass; // for the browser tests: a pass without the gate
// `?runner` in the address opens the prototype of the chase of the balloons (stage 0) and cleans the address
if (/[?&]runner(?:[=&]|$)/.test(location.search)) {
  try {
    sessionStorage.setItem('runner-lab', '1');
  } catch {
    /* ignore */
  }
  history.replaceState(null, '', `${location.pathname}#/runner`);
}
let current: Route = { name: 'home' };
// a new version of the app switches in only in the lobby
const updateCheck = initUpdate(() => current.name);

onRoute((route: Route) => {
  teardown();
  current = route;
  updateCheck();
  if ((route.name === 'gate' || route.name === 'game') && isTimeUp()) {
    showTimeUp();
    return go({ name: 'home' }, { replace: true });
  }
  switch (route.name) {
    case 'home':
      clearPass();
      cleanup = renderHomeAuto(app);
      break;
    case 'gate':
      if (!games.some((g) => g.id === route.gameId)) return go({ name: 'home' }, { replace: true });
      if (games.find((g) => g.id === route.gameId)?.resumeWithoutGate && hasFreshSession(route.gameId)) {
        // a board left less than 10 minutes ago goes on, without the gate
        grantPass(route.gameId);
        return go({ name: 'game', gameId: route.gameId }, { replace: true });
      }
      if (games.find((g) => g.id === route.gameId)?.noGate) {
        // a game that is learning in itself has no maths gate
        grantPass(route.gameId);
        return go({ name: 'game', gameId: route.gameId }, { replace: true });
      }
      cleanup = renderGate(app, route.gameId, () => {
        grantPass(route.gameId);
        go({ name: 'game', gameId: route.gameId }, { replace: true });
      });
      break;
    case 'game':
      mountGame(route.gameId);
      break;
    case 'squishy': {
      // the prototype of the squishy workshop: only through its door in the parents area
      let ok = false;
      try {
        ok = sessionStorage.getItem('squishy-lab') === '1';
      } catch {
        /* ignore */
      }
      if (!ok) return go({ name: 'home' }, { replace: true });
      let stop: (() => void) | null = null;
      let gone = false;
      void import('./games/squishy/lab').then((m) => {
        if (gone) return;
        stop = m.renderSquishyLab(app, () => (allowParent(), go({ name: 'parent' })));
      });
      cleanup = () => {
        gone = true;
        stop?.();
      };
      break;
    }
    case 'runner': {
      // the chase of the balloons (stage 0): only through its door in the parents area, or `?runner`
      let ok = false;
      try {
        ok = sessionStorage.getItem('runner-lab') === '1';
      } catch {
        /* ignore */
      }
      if (!ok) return go({ name: 'home' }, { replace: true });
      let gone = false;
      void import('./games/runner').then((m) => {
        if (!gone) mountGame('runner', m.default);
      });
      cleanup = () => {
        gone = true;
      };
      break;
    }
    case 'parent':
      if (!consumeParent()) return go({ name: 'home' }, { replace: true });
      cleanup = renderParent(app);
      break;
  }
});

// iOS only lets audio start inside a user gesture
for (const ev of ['pointerdown', 'touchend', 'keydown']) {
  document.addEventListener(ev, unlockAudio, { capture: true, passive: true });
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) activeGame?.pause();
});


// Daily limit: count play time in the gate and games; when it runs out, wait for a calm moment.
trackUsage({
  active: () => current.name === 'gate' || current.name === 'game',
  canInterrupt: () => current.name !== 'game' || (activeGame?.canInterrupt?.() ?? true),
  onTimeUp: () => {
    activeGame?.pause();
    showTimeUp();
  },
});

// `#fps` in the address shows a small frame-rate display (for measuring on a phone); nothing loads otherwise
if (fpsEnabled()) void import('./lobby3d/fps').then((m) => m.startFpsOverlay());
