import { games, comingSoon } from '../games/registry';
import { getState } from '../storage';
import { go } from '../router';
import { sessionTier, setTier } from '../three/quality';
import { bindParentLongPress, escapeHtml, makeMuteButton, renderHome } from './home';

const SHOWN_KEY = 'rani-jar-shown';

function readShown(total: number): number {
  try {
    const v = localStorage.getItem(SHOWN_KEY);
    return v === null ? total : Math.min(Number(v) || 0, total);
  } catch {
    return total;
  }
}
function writeShown(n: number): void {
  try {
    localStorage.setItem(SHOWN_KEY, String(n));
  } catch {
    /* ignore */
  }
}

/**
 * The home screen: the 3D island carousel when the device can do it, otherwise exactly the old 2D cards.
 * The title, mute button and star counter stay real DOM on top of the canvas, so the long press for the
 * parent area works as before; below the canvas a visually hidden list of buttons keeps it usable by keyboard
 * and screen reader.
 */
export function renderHomeAuto(root: HTMLElement): () => void {
  const st = getState();
  const pref = st.settings.graphics;
  if (sessionTier(pref) === '2d') return renderHome(root);

  root.innerHTML = '';
  const screen = document.createElement('div');
  screen.className = 'screen home home3d';
  const header = document.createElement('header');
  header.className = 'home-header';
  header.innerHTML = `
    <div class="avatar" aria-hidden="true">${st.profile.avatar}</div>
    <h1 class="title">המשחקים של ${escapeHtml(st.profile.name)}</h1>`;
  const stars = document.createElement('div');
  stars.className = 'stars stars3d';
  stars.textContent = `⭐ ${st.stars}`;
  const nav = document.createElement('nav');
  nav.className = 'sr-only';
  nav.setAttribute('aria-label', 'המשחקים');
  for (const g of games) {
    const b = document.createElement('button');
    b.textContent = g.title;
    b.addEventListener('click', () => go({ name: 'gate', gameId: g.id }));
    nav.appendChild(b);
  }
  for (const c of comingSoon) {
    const b = document.createElement('button');
    b.textContent = `${c.title} (נעול)`;
    b.setAttribute('aria-disabled', 'true');
    nav.appendChild(b);
  }
  screen.append(makeMuteButton(), header, stars, nav);
  root.appendChild(screen);
  const cancelPress = bindParentLongPress(header.querySelector('.title') as HTMLElement);

  let dead = false;
  let handle: { dispose(): void } | null = null;
  let cleanup2d: (() => void) | null = null;

  const fallback = () => {
    if (dead) return;
    handle?.dispose();
    handle = null;
    setTier('2d');
    cleanup2d = renderHome(root);
  };

  void (async () => {
    try {
      const [stage, scene] = await Promise.all([import('../three/stage'), import('../three/home-scene')]);
      if (dead) return;
      const total = getState().stars;
      const h = await stage.showScene(
        (env) =>
          scene.createHomeScene(env, {
            kinds: [...games.map((g) => (g.id === 'brick-breaker' ? 'brick' : g.id === 'memory' ? 'memory' : 'generic') as 'brick' | 'memory' | 'generic'), ...comingSoon.map(() => 'locked' as const)],
            tints: [...games.map((g) => g.color), ...comingSoon.map((c) => c.color)],
            stars: total,
            shownStars: readShown(total),
            onPick: (i) => games[i] && go({ name: 'gate', gameId: games[i].id }),
            onJarShown: writeShown,
          }),
        { autoDowngrade: pref === 'auto', onFallback: fallback },
      );
      if (dead) h.dispose();
      else handle = h;
    } catch {
      fallback();
    }
  })();

  return () => {
    dead = true;
    cancelPress();
    handle?.dispose();
    cleanup2d?.();
  };
}
