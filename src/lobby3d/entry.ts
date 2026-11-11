import { allowParent } from '../access';
import { comingSoon, games } from '../games/registry';
import { go } from '../router';
import { sound } from '../sound';
import { getState } from '../storage';
import { renderHome } from '../ui/home';
import './lobby.css';
import { sessionTier, setTier } from './quality';

const LAST_KEY = 'rani-lobby-last';
const FADE_MS = 300;
const LONG_PRESS_MS = 3000;

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
  let chromeCancel: (() => void) | null = null;

  const fallback = () => {
    if (dead) return;
    lobby?.dispose();
    lobby = null;
    chromeCancel?.();
    chromeCancel = null;
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
        ...games.map((g) => ({ kind: 'game' as const, title: g.title, icon: g.icon, color: g.color })),
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
      });
      if (dead) {
        l.dispose();
        return;
      }
      lobby = l;
      // swap: the regular home fades out while the canvas fades in, then the lobby's own controls take over
      const old = root.querySelector<HTMLElement>('.screen');
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      const ms = reduced ? 0 : FADE_MS;
      if (old && ms) {
        old.style.transition = `opacity ${ms}ms ease`;
        old.style.opacity = '0';
      }
      l.fadeIn(ms);
      window.setTimeout(() => {
        if (dead || lobby !== l) return;
        cleanup2d?.();
        cleanup2d = null;
        chrome = buildChrome(root, l.info.front);
        chromeCancel = chrome.cancel;
        document.body.classList.add('lobby3d-on');
        chrome.front(l.info.front);
      }, ms);
    } catch {
      fallback();
    }
  })();

  return () => {
    dead = true;
    lobby?.dispose();
    chromeCancel?.();
    cleanup2d?.();
    document.body.classList.remove('lobby3d-on');
  };
}

interface Chrome { front(i: number): void; cancel(): void }

/** Real DOM over the canvas: title (long press for parents), mute, star count, name of the front island, dots. */
function buildChrome(root: HTMLElement, startFront: number): Chrome {
  const st = getState();
  root.innerHTML = '';
  const screen = document.createElement('div');
  screen.className = 'screen home lobby-screen';

  const header = document.createElement('header');
  header.className = 'home-header';
  header.innerHTML = `
    <div class="avatar" aria-hidden="true">${st.profile.avatar}</div>
    <h1 class="title">המשחקים של ${esc(st.profile.name)}</h1>`;

  const mute = document.createElement('button');
  mute.className = 'icon-btn mute';
  const paint = () => {
    mute.textContent = sound.isMuted() ? '🔇' : '🔊';
    mute.setAttribute('aria-label', sound.isMuted() ? 'הפעלת צליל' : 'השתקה');
  };
  paint();
  mute.addEventListener('click', () => {
    sound.setMuted(!sound.isMuted());
    paint();
    sound.play('bonus');
  });

  const stars = document.createElement('div');
  stars.className = 'stars lobby-stars';
  stars.textContent = `⭐ ${st.stars}`;

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

  screen.append(mute, header, name, stars, dots, nav);
  root.appendChild(screen);

  // Parent area: hold the title for 3 seconds, exactly as on the regular home.
  let timer: number | undefined;
  const cancel = () => {
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timer = undefined;
    }
  };
  const title = header.querySelector('.title') as HTMLElement;
  title.addEventListener('pointerdown', () => {
    cancel();
    timer = window.setTimeout(() => {
      allowParent();
      go({ name: 'parent' });
    }, LONG_PRESS_MS);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) title.addEventListener(ev, cancel);
  title.addEventListener('contextmenu', (e) => e.preventDefault());

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
  return { front, cancel };
}
