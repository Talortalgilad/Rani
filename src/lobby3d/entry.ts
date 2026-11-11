import { comingSoon, games } from '../games/registry';
import { go } from '../router';
import { sound } from '../sound';
import { getState } from '../storage';
import { renderHome } from '../ui/home';
import './lobby.css';
import { sessionTier, setTier } from './quality';

const LAST_KEY = 'rani-lobby-last';
const SHOWN_KEY = 'rani-jar-shown';
const FADE_MS = 300;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function lastGameIndex(): number {
  try {
    const id = localStorage.getItem(LAST_KEY);
    const i = games.findIndex((g) => g.id === id);
    return i >= 0 ? i : 0;
  } catch {
    return 0;
  }
}
/** How many stars the jar has already shown. The first time ever, all of them (nothing falls in). */
function readShown(total: number): number {
  try {
    const v = localStorage.getItem(SHOWN_KEY);
    return v === null ? total : Math.min(Number(v) || 0, total);
  } catch {
    return total;
  }
}
const writeShown = (n: number) => {
  try {
    localStorage.setItem(SHOWN_KEY, String(n));
  } catch {
    /* ignore */
  }
};
const rememberGame = (id: string) => {
  try {
    localStorage.setItem(LAST_KEY, id);
  } catch {
    /* ignore */
  }
};

/**
 * The home screen. The regular home shows at once; if the device can do 3D, the lobby is loaded in the background
 * and fades in over it (300 ms). Without WebGL, or when the parent chose "regular", nothing else ever loads.
 * Everything here is light: Three.js lives behind a dynamic import.
 */
export function renderHomeAuto(root: HTMLElement): () => void {
  const pref = getState().settings.lobby;
  if (sessionTier(pref) === '2d') return renderHome(root);

  let cleanup2d: (() => void) | null = renderHome(root);
  let dead = false;
  let lobby: { dispose(): void } | null = null;

  const fallback = () => {
    if (dead) return;
    lobby?.dispose();
    lobby = null;
    document.body.classList.remove('lobby3d-on');
    setTier('2d');
    cleanup2d?.();
    cleanup2d = renderHome(root);
  };

  void (async () => {
    try {
      const mod = await import('./index');
      if (dead) return;
      const specs = [
        ...games.map((g) => ({ kind: 'game' as const, title: g.title, icon: g.icon, color: g.color, lobbyIsland: g.lobbyIsland })),
        ...comingSoon.map((c) => ({ kind: 'locked' as const, title: c.title, color: c.color })),
      ];
      let chrome: Chrome | null = null;
      const l = await mod.startLobby({
        islands: specs,
        startIndex: lastGameIndex(),
        autoDowngrade: pref === 'auto',
        onFront: (i) => chrome?.front(i),
        onEnter: (i) => {
          if (!games[i]) return;
          rememberGame(games[i].id);
          go({ name: 'gate', gameId: games[i].id });
        },
        onFallback: fallback,
        stars: getState().stars,
        shownStars: readShown(getState().stars),
        onJarShown: writeShown,
        onStarLand: (n) => sound.play('pop', 660 + (n % 10) * 55),
        onJarTap: () => sound.play('bonus'),
      });
      if (dead) {
        l.dispose();
        return;
      }
      lobby = l;
      // The cards fade out while the canvas fades in. The title, avatar, mute button and star count are never
      // rebuilt: they are the very same elements as on the regular home, so a long press on the title that is
      // already under way carries on through the swap.
      const screen = root.querySelector<HTMLElement>('.screen.home');
      const grid = screen?.querySelector<HTMLElement>('.grid') ?? null;
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      const ms = reduced ? 0 : FADE_MS;
      if (grid && ms) {
        grid.style.transition = `opacity ${ms}ms ease`;
        grid.style.opacity = '0';
      }
      l.fadeIn(ms);
      window.setTimeout(() => {
        if (dead || lobby !== l || !screen) return;
        grid?.remove();
        chrome = upgradeScreen(screen, l.info.front);
        document.body.classList.add('lobby3d-on');
      }, ms);
    } catch {
      fallback();
    }
  })();

  return () => {
    dead = true;
    lobby?.dispose();
    cleanup2d?.();
    document.body.classList.remove('lobby3d-on');
  };
}

interface Chrome { front(i: number): void }

/**
 * Turns the regular home screen into the lobby's by adding to it: the name of the front island, the dots and the
 * hidden buttons. What was already there (title, avatar, mute, star count) stays exactly as it is.
 */
function upgradeScreen(screen: HTMLElement, startFront: number): Chrome {
  screen.classList.add('lobby-screen');
  screen.querySelector('.stars')?.classList.add('lobby-stars');

  // the avatar sits on a little cloud (drawn in CSS) and waves when tapped
  const avatar = screen.querySelector<HTMLElement>('.avatar');
  avatar?.addEventListener('click', () => {
    avatar.classList.remove('wave');
    void avatar.offsetWidth;
    avatar.classList.add('wave');
  });

  const name = document.createElement('div');
  name.className = 'lobby-name';
  name.setAttribute('aria-live', 'polite');

  const total = games.length + comingSoon.length;
  const dots = document.createElement('div');
  dots.className = 'lobby-dots';
  dots.setAttribute('aria-hidden', 'true');
  dots.innerHTML = Array.from({ length: total }, () => '<i></i>').join('');

  // keyboard and screen reader: the same buttons as the regular home, hidden from view
  const nav = document.createElement('nav');
  nav.className = 'sr-only';
  nav.setAttribute('aria-label', 'המשחקים');
  for (const g of games) {
    const b = document.createElement('button');
    b.textContent = g.title;
    b.addEventListener('click', () => {
      rememberGame(g.id);
      go({ name: 'gate', gameId: g.id });
    });
    nav.appendChild(b);
  }
  for (const c of comingSoon) {
    const b = document.createElement('button');
    b.textContent = `${c.title} (נעול)`;
    b.setAttribute('aria-disabled', 'true');
    nav.appendChild(b);
  }
  screen.append(name, dots, nav);

  const front = (i: number) => {
    dots.querySelectorAll('i').forEach((d, k) => d.classList.toggle('on', k === i));
    const g = games[i];
    if (!g) name.textContent = 'בקרוב';
    else {
      const best = (getState().games[g.id] as { best?: number } | undefined)?.best;
      name.innerHTML = `${esc(g.title)}${best ? `<small>🏆 ${best}</small>` : ''}`;
    }
  };
  front(startFront);
  return { front };
}
