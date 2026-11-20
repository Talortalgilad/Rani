/**
 * The carnival lobby (SPEC-carnival.md): the home screen of the app. Like the lobby before it, the regular home shows at once and the 3D carnival is
 * loaded in the background and fades in over it. Without WebGL (tier 2d) the regular home stays, with a strip of the residents. The old lobby is
 * still here, behind `#lobby:old` (it sticks until `#lobby:new`).
 */
import { comingSoon, games } from '../../games/registry';
import { sayLine } from '../../games/english/content/heLines';
import { go } from '../../router';
import { sound } from '../../sound';
import { getState, update } from '../../storage';
import { renderHome } from '../../ui/home';
import { pinnedTier, sessionTier, setTier } from '../../lobby3d/quality';
import { renderHomeAuto as renderOldLobby } from '../../lobby3d/entry';
import '../../lobby3d/lobby.css';
import './ui/carnival.css';
import './ui/world.css';
import { type Resident } from './residents';
import { Talks, type TalkHost } from './talk/ui';
import { CarnivalWorld } from './world';
import { WorldUI } from './ui/worldUi';
import { loadSave, writeSave } from './save';
import { hasNewLesson } from '../../games/english/tutor/badge';
import { dayNumber } from '../../games/english/engine/progress';
import { lessonsByUnit, progressFromEnglish } from './unlocks';
import { LESSONS } from '../../games/english/tutor/lessons';
import { plots } from './layout';

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

/** The world of the carnival (stage 2) for this visit: the save (one object, shared with the talks), the stars, what she finished in the learning games, and where the games' plots are. */
/** the school of Lolly and her round button: straight to her lessons (the English game opens on them) */
function goTutor(): void {
  try {
    sessionStorage.setItem('rani-open-tutor', '1');
  } catch {
    /* ignore */
  }
  go({ name: 'gate', gameId: 'english' });
}
/** is there a new lesson of Lolly today? (light: read from the saved state) */
function newLesson(): boolean {
  try {
    return hasNewLesson(dayNumber());
  } catch {
    return false;
  }
}

function makeWorld(): { world: CarnivalWorld; save: ReturnType<typeof loadSave>; visit: number } {
  const save = loadSave();
  let t = 0;
  const persist = (): void => {
    const now = Date.now();
    if (now - t > 1500) {
      t = now;
      writeSave(save);
    }
  };
  const ps = plots(games.length + comingSoon.length);
  const en = getState().games.english as { buddy?: string | null; companion?: { name?: string } } | undefined;
  const world = new CarnivalWorld({
    save,
    persist,
    stars: () => getState().stars,
    spend: (n) => update((s) => void (s.stars = Math.max(0, s.stars - n))),
    give: (n) => update((s) => void (s.stars += n)),
    progress: () => progressFromEnglish(getState().games.english, lessonsByUnit(LESSONS)),
    games: games.map((g) => g.id),
    plotCount: games.length + comingSoon.length,
    // the front of a plot: on the ring path in front of it
    plotFronts: Object.fromEntries(games.map((g, i) => [g.id, { x: ps[i].x * 0.72, z: ps[i].z * 0.72 }])),
    companion: { name: en?.companion?.name ?? null, buddy: en?.buddy ?? null },
    // what she did in Lolly's lessons and in the workshop (for the quests)
    external: () => {
      const g = getState().games as Record<string, { tutor?: { done?: unknown[] }; shelf?: unknown[] } | undefined>;
      return { lolly: g.english?.tutor?.done?.length ?? 0, workshop: g.squishy?.shelf?.length ?? 0 };
    },
  });
  // a visit: the ones who were waiting for the rounds that she played, and who is "at home" this time
  let visit = 0;
  try {
    visit = Number(localStorage.getItem('rani-carnival-visit') ?? 0) + 1;
    localStorage.setItem('rani-carnival-visit', String(visit));
  } catch {
    /* ignore */
  }
  return Object.assign({ world, save }, { visit });
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

/** The strip of the residents for the regular home (tier 2d): a tap says the name. It scrolls sideways when there are many. */
function stripButton(r: Resident): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'cv-res';
  b.setAttribute('aria-label', r.name);
  b.innerHTML = `<img src="${esc(r.img)}" alt="" draggable="false"><span>${esc(r.name)}</span>`;
  return b;
}
function strip(list: Resident[]): HTMLElement {
  const s = document.createElement('div');
  s.className = 'cv-strip';
  for (const r of list) s.appendChild(stripButton(r));
  return s;
}

/** The talks of the plain home (the strip): they stop when the 3D carnival takes over, so that two do not run at once. */
let plainStop: (() => void) | null = null;
/** the world of the visit that is on the screen (for the tests and the screenshots) */
const expose = (o: Record<string, unknown>): void => void Object.assign(window as unknown as Record<string, unknown>, o);

export function renderHomeCarnival(root: HTMLElement): () => void {
  if (wantsOldLobby()) return renderOldLobby(root);
  const pref = getState().settings.lobby;
  const { world, save, visit } = makeWorld();
  const tierGuess = sessionTier(pref);
  world.chooseHome(CarnivalWorld.visibleLimit(tierGuess === 'high' ? 'high' : tierGuess === 'medium' ? 'medium' : '2d'), visit);
  // the rounds that were played while she was away: the ones who waited for them give their hearts now
  const settled = world.settleRounds();
  expose({ __world: world });

  const plain = (): (() => void) => {
    const c = renderHome(root);
    const sc = root.querySelector('.screen.home');
    const st = strip(world.residents);
    sc?.insertBefore(st, sc.querySelector('.grid'));
    // the residents talk here too: the same bubbles, from the strip
    const layer = document.createElement('div');
    layer.className = 'cv-layer cv-2d';
    (sc ?? root).appendChild(layer);
    const btns = [...st.querySelectorAll<HTMLElement>('.cv-res')];
    const host: TalkHost = {
      layer,
      residents: world.residents,
      pos: (i) => {
        const r = btns[i]?.getBoundingClientRect();
        return r ? { x: r.left + r.width / 2, y: r.top } : null;
      },
      alertDy: 16,
      focus: () => void 0,
      hold: () => void 0,
      wave: (i) => {
        btns[i]?.classList.remove('hop');
        void btns[i]?.offsetWidth;
        btns[i]?.classList.add('hop');
      },
    };
    const talks = new Talks(host, undefined, save);
    expose({ __talks: talks });
    const ui = new WorldUI({
      layer,
      world,
      mode: '2d',
      pos: (i) => host.pos(i),
      takeMe: (i) => host.wave(i),
      trick: (i) => host.wave(i),
      goTutor,
      newLesson,
      addResident: (r) => {
        const b = stripButton(r);
        st.appendChild(b);
        btns.push(b);
        b.addEventListener('click', () => void talks.tapResident(btns.length - 1));
      },
      goWorld: (kind) => go(kind === 'world' ? { name: 'gate', gameId: 'english' } : { name: 'gate', gameId: 'english' }),
      heartsEl: () => layer.querySelector('.cv-hearts'),
      gamesBar: () => root.querySelector('.grid'),
      alerts: () => talks.save.alerts.alerts.map((a) => a.r),
    });
    ui.handle(settled);
    btns.forEach((b, i) =>
      b.addEventListener('click', () => {
        b.classList.remove('hop');
        void b.offsetWidth;
        b.classList.add('hop');
        if (!talks.tapResident(i)) {
          void sayLine('carnival_name', world.residents[i].name);
          ui.residentTapped(i);
        }
      }),
    );
    // the number of the ones who wait for a game, on its card
    const cards = [...(sc?.querySelectorAll<HTMLElement>('.grid .card:not(.locked)') ?? [])];
    cards.forEach((card) => (card.style.position = 'relative'));
    const badge = (): void =>
      cards.forEach((card, i) => {
        const n = games[i] ? world.sim.waitingFor(games[i].id) : 0;
        let el = card.querySelector<HTMLElement>('.cv-wait');
        if (!n) return el?.remove();
        if (!el) {
          el = document.createElement('span');
          el.className = 'cv-wait';
          card.appendChild(el);
        }
        el.textContent = String(n);
      });
    let raf = 0;
    let last = performance.now();
    let hearts = save.hearts;
    const loop = (t: number): void => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      ui.handle(world.tick(dt));
      talks.tick(dt);
      ui.tick(dt);
      if (save.hearts !== hearts) {
        hearts = save.hearts;
        talks.refreshHearts();
      }
      badge();
    };
    raf = requestAnimationFrame(loop);
    const stop = (): void => {
      cancelAnimationFrame(raf);
      talks.dispose();
      ui.dispose();
      writeSave(save);
      layer.remove();
    };
    plainStop = stop;
    return () => {
      stop();
      c();
    };
  };
  if (tierGuess === '2d') return plain();

  let cleanup2d: (() => void) | null = plain();
  let dead = false;
  let lobby: { dispose(): void } | null = null;
  let ui3: WorldUI | null = null;
  const fallback = (): void => {
    if (dead) return;
    (window as unknown as { __talks?: Talks }).__talks?.dispose();
    ui3?.dispose();
    ui3 = null;
    lobby?.dispose();
    lobby = null;
    document.querySelectorAll('.cv-sign, .cvw-slot').forEach((e) => e.remove());
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
      let talks: Talks | null = null;
      let hearts = save.hearts;
      const l = await mod.startCarnival({
        world,
        plots: [
          ...games.map((g) => ({ kind: 'game' as const, title: g.title, icon: g.icon, color: g.color, lobbyIsland: g.lobbyIsland })),
          ...comingSoon.map((c) => ({ kind: 'locked' as const, title: c.title, color: c.color })),
        ],
        residents: [...world.residents],
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
          if (!again) {
            void sayLine('carnival_name', r.name);
            ui3?.residentTapped(world.residents.indexOf(r));
          }
        },
        onTick: (dt) => {
          const ev = world.tick(dt);
          ui3?.handle(ev);
          talks?.tick(dt);
          ui3?.tick(dt);
          if (save.hearts !== hearts) {
            hearts = save.hearts;
            talks?.refreshHearts();
          }
        },
        onResidentTap: (i) => talks?.tapResident(i) ?? false,
        onResidentLong: (i) => ui3?.friends.openCard(i),
        onBoardTap: () => ui3?.openBoard(),
        onSlots: (list) => ui3?.onSlots(list),
        safeTop: 150,
        safeBottom: 104,
        onSigns: (list) => {
          // one small sign for each game (not for the locked tents), right above its plot; a sign that is outside the screen is hidden
          if (!signs.length) {
            games.forEach((g) => {
              const el = document.createElement('div');
              el.className = 'cv-sign';
              el.style.setProperty('--c', g.color);
              el.innerHTML = `<i>${g.icon}</i><b>${esc(g.title)}</b>`;
              (root.querySelector('.screen.home') ?? root).appendChild(el);
              signs.push(el);
            });
          }
          list.forEach((p, i) => {
            const el = signs[i];
            if (!el) return;
            const hw = (el.offsetWidth || 90) / 2;
            const inside = !p.behind && p.x - hw >= 0 && p.x + hw <= window.innerWidth && p.y >= 120 && p.y <= window.innerHeight - 104;
            el.style.visibility = inside ? 'visible' : 'hidden';
            if (inside) el.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
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
        const bar = gamesBar();
        screen.append(bar, homeBtn, label);
        const layer = document.createElement('div');
        layer.className = 'cv-layer';
        screen.appendChild(layer);
        const host: TalkHost = { layer, residents: world.residents, pos: (i) => l.residentScreen(i), focus: (i) => l.focus(i), hold: (i, on) => l.hold(i, on), wave: (i) => l.wave(i) };
        // the talks of the strip stop, the carnival's own begin
        plainStop?.();
        plainStop = null;
        talks = new Talks(host, undefined, save);
        expose({ __talks: talks });
        ui3 = new WorldUI({
          layer,
          world,
          mode: '3d',
          pos: (i) => l.residentScreen(i),
          focusSlot: (id) => {
            const p = world.slot(id);
            if (p) l.lookAt(p.x, p.z, 17);
          },
          trick: (i, k) => l.trick(i, k),
          residentAt: (x, y) => l.residentAt(x, y),
          goTutor,
          newLesson,
          takeMe: (i) => {
            l.focus(i);
            l.wave(i);
            window.setTimeout(() => l.focus(null), 3500);
          },
          addResident: (r) => void l.addResident(r),
          goWorld: () => go({ name: 'gate', gameId: 'english' }),
          heartsEl: () => layer.querySelector('.cv-hearts'),
          gamesBar: () => bar,
          alerts: () => talks?.save.alerts.alerts.map((a) => a.r) ?? [],
        });
        ui3.handle(settled);
        document.body.classList.add('lobby3d-on', 'carnival-on');
        performance.mark?.('carnival-ready');
        expose({ __carnivalHandle: l, __ui: ui3 });
      }, ms);
    } catch {
      fallback();
    }
  })();
  return () => {
    dead = true;
    (window as unknown as { __talks?: Talks }).__talks?.dispose();
    ui3?.dispose();
    writeSave(save);
    lobby?.dispose();
    cleanup2d?.();
    document.querySelectorAll('.cv-sign, .cvw-slot').forEach((e) => e.remove());
    document.body.classList.remove('lobby3d-on', 'carnival-on');
  };
}
