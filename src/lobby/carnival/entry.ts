/**
 * The carnival lobby (SPEC-carnival.md): the home screen of the app. Like the lobby before it, the regular home shows at once and the 3D carnival is
 * loaded in the background and fades in over it. Without WebGL (tier 2d) the regular home stays, with a strip of the residents. The old lobby is
 * still here, behind `#lobby:old` (it sticks until `#lobby:new`).
 */
import { comingSoon, games } from '../../games/registry';
import { sayLine } from '../../games/english/content/heLines';
import { go } from '../../router';
import { sound } from '../../sound';
import { getState } from '../../storage';
import { renderHome } from '../../ui/home';
import { pinnedTier, sessionTier, setTier } from '../../lobby3d/quality';
import { renderHomeAuto as renderOldLobby } from '../../lobby3d/entry';
import '../../lobby3d/lobby.css';
import './ui/carnival.css';
import { residents, type Resident } from './residents';

const OLD_KEY = 'rani-lobby-old';
const SHOWN_KEY = 'rani-jar-shown';
const FADE_MS = 300;

/** `#lobby:old` brings back the old lobby (and keeps it), `#lobby:new` the carnival. */
export function wantsOldLobby(hash = typeof location === 'undefined' ? '' : location.hash, store: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): boolean {
  try {
    if (/lobby:old/.test(hash)) store?.setItem(OLD_KEY, '1');
    else if (/lobby:new/.test(hash)) store?.removeItem(OLD_KEY);
    return store?.getItem(OLD_KEY) === '1';
  } catch {
    return /lobby:old/.test(hash);
  }
}

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
function readShown(total: number): number {
  try {
    const v = localStorage.getItem(SHOWN_KEY);
    return v === null ? total : Math.min(Number(v) || 0, total);
  } catch {
    return total;
  }
}
const writeShown = (n: number): void => {
  try {
    localStorage.setItem(SHOWN_KEY, String(n));
  } catch {
    /* ignore */
  }
};

function people(): Resident[] {
  const en = getState().games.english as { buddy?: string | null; companion?: { name?: string } } | undefined;
  return residents(en?.companion?.name ?? null, en?.buddy ?? null);
}

/** The games row at the bottom: a round icon for each game, one tap goes in. */
function gamesBar(): HTMLElement {
  const bar = document.createElement('nav');
  bar.className = 'carnival-bar';
  bar.setAttribute('aria-label', 'המשחקים');
  for (const g of games) {
    const b = document.createElement('button');
    b.className = 'cv-game';
    b.style.background = g.color;
    b.setAttribute('aria-label', g.title);
    b.innerHTML = g.icon;
    b.addEventListener('click', () => go({ name: 'gate', gameId: g.id }));
    bar.appendChild(b);
  }
  for (const c of comingSoon) {
    const b = document.createElement('button');
    b.className = 'cv-game locked';
    b.setAttribute('aria-disabled', 'true');
    b.setAttribute('aria-label', `${c.title} (נעול)`);
    b.textContent = '🔒';
    bar.appendChild(b);
  }
  return bar;
}

/** The strip of the residents for the regular home (tier 2d): a tap says the name. */
function strip(): HTMLElement {
  const s = document.createElement('div');
  s.className = 'cv-strip';
  for (const r of people()) {
    const b = document.createElement('button');
    b.className = 'cv-res';
    b.setAttribute('aria-label', r.name);
    b.innerHTML = `<img src="${esc(r.img)}" alt="" draggable="false"><span>${esc(r.name)}</span>`;
    b.addEventListener('click', () => {
      b.classList.remove('hop');
      void b.offsetWidth;
      b.classList.add('hop');
      void sayLine('carnival_name', r.name);
    });
    s.appendChild(b);
  }
  return s;
}

export function renderHomeCarnival(root: HTMLElement): () => void {
  if (wantsOldLobby()) return renderOldLobby(root);
  const pref = getState().settings.lobby;
  const plain = (): (() => void) => {
    const c = renderHome(root);
    const sc = root.querySelector('.screen.home');
    sc?.insertBefore(strip(), sc.querySelector('.grid'));
    return c;
  };
  if (sessionTier(pref) === '2d') return plain();

  let cleanup2d: (() => void) | null = plain();
  let dead = false;
  let lobby: { dispose(): void } | null = null;
  const fallback = (): void => {
    if (dead) return;
    lobby?.dispose();
    lobby = null;
    document.querySelectorAll('.cv-sign').forEach((e) => e.remove());
    document.body.classList.remove('lobby3d-on', 'carnival-on');
    setTier('2d');
    cleanup2d?.();
    cleanup2d = plain();
  };
  performance.mark?.('carnival-start');
  void (async () => {
    try {
      const mod = await import('./scene');
      if (dead) return;
      const label = document.createElement('div');
      label.className = 'cv-label';
      let hideTimer = 0;
      const signs: HTMLElement[] = [];
      const l = await mod.startCarnival({
        plots: [
          ...games.map((g) => ({ kind: 'game' as const, title: g.title, icon: g.icon, color: g.color, lobbyIsland: g.lobbyIsland })),
          ...comingSoon.map((c) => ({ kind: 'locked' as const, title: c.title, color: c.color })),
        ],
        residents: people(),
        autoDowngrade: pref === 'auto' && !pinnedTier(),
        onEnter: (i) => {
          if (!games[i]) return;
          sound.play('bell');
          go({ name: 'gate', gameId: games[i].id });
        },
        onFallback: fallback,
        stars: getState().stars,
        shownStars: readShown(getState().stars),
        onJarShown: writeShown,
        onStarLand: (n) => sound.play('pop', 660 + (n % 10) * 55),
        onJarTap: () => sound.play('bonus'),
        onResident: (r, again) => {
          label.textContent = r.name;
          label.classList.add('on');
          window.clearTimeout(hideTimer);
          hideTimer = window.setTimeout(() => label.classList.remove('on'), 3200);
          sound.play(again ? 'bonus' : 'pop', again ? 900 : 700);
          if (!again) void sayLine('carnival_name', r.name);
        },
        onSigns: (list) => {
          if (!signs.length) {
            const all = [...games.map((g) => ({ title: g.title, icon: g.icon, color: g.color })), ...comingSoon.map(() => ({ title: 'בקרוב', icon: '🔒', color: '#8a8497' }))];
            all.forEach((g, i) => {
              const el = document.createElement('div');
              el.className = 'cv-sign';
              el.style.setProperty('--c', g.color);
              el.innerHTML = `<i>${g.icon}</i><b>${esc(g.title)}</b>`;
              (root.querySelector('.screen.home') ?? root).appendChild(el);
              signs.push(el);
              void i;
            });
          }
          // inside the screen, and not on top of each other (the lower one moves down)
          const placed: { x: number; y: number; hw: number }[] = [];
          list
            .map((p, i) => ({ p, i }))
            .sort((a, b) => a.p.y - b.p.y)
            .forEach(({ p, i }) => {
              const el = signs[i];
              if (!el) return;
              const hw = (el.offsetWidth || 110) / 2 + 6;
              const x = Math.min(window.innerWidth - hw, Math.max(hw, p.x));
              let y = Math.max(160, p.y);
              for (const q of placed) if (Math.abs(x - q.x) < hw + q.hw && Math.abs(y - q.y) < 36) y = q.y + 36;
              y = Math.min(window.innerHeight - 96, y);
              placed.push({ x, y, hw });
              el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
            });
        },
        onLabelMove: (p) => {
          if (!p) {
            label.classList.remove('on');
            return;
          }
          const half = (label.offsetWidth || 120) / 2 + 8;
          label.style.transform = `translate(${Math.min(window.innerWidth - half, Math.max(half, p.x))}px, ${Math.max(60, p.y)}px) translate(-50%, -100%)`;
        },
      });
      if (dead) {
        l.dispose();
        return;
      }
      lobby = l;
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
        screen.querySelector('.cv-strip')?.remove();
        screen.classList.add('lobby-screen', 'carnival-screen');
        screen.querySelector('.stars')?.classList.add('lobby-stars');
        const avatar = screen.querySelector<HTMLElement>('.avatar');
        avatar?.addEventListener('click', () => {
          avatar.classList.remove('wave');
          void avatar.offsetWidth;
          avatar.classList.add('wave');
        });
        const homeBtn = document.createElement('button');
        homeBtn.className = 'cv-home';
        homeBtn.setAttribute('aria-label', 'חזרה למרכז');
        homeBtn.textContent = '🏠';
        homeBtn.addEventListener('click', () => l.home());
        screen.append(gamesBar(), homeBtn, label);
        document.body.classList.add('lobby3d-on', 'carnival-on');
        performance.mark?.('carnival-ready');
        (window as unknown as Record<string, unknown>).__carnivalHandle = l;
      }, ms);
    } catch {
      fallback();
    }
  })();
  return () => {
    dead = true;
    lobby?.dispose();
    cleanup2d?.();
    document.querySelectorAll('.cv-sign').forEach((e) => e.remove());
    document.body.classList.remove('lobby3d-on', 'carnival-on');
  };
}
