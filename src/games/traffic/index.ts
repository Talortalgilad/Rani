import type { GameContext, GameModule } from '../types';
import { getTier, initialTier, setTier } from '../../lobby3d/quality';
import type { LevelData } from './engine/level';
import type { HelperBook } from './engine/boosters';
import type { SaveData } from './engine/state';
import type { Controller } from './controller';
import { getState } from '../../storage';
import { buildHud, type Hud } from './ui/hud';

interface Progress {
  /** best stars per level key */
  stars: Record<string, number>;
  /** the level to start with */
  current: string;
}
interface Session { savedAt: number; key: string; data: SaveData; book?: HelperBook }

let ctx: GameContext | null = null;
let hud: Hud | null = null;
let handle: { dispose(): void; fadeIn(ms: number): void } | null = null;
let ctl: Controller | null = null;
let token = 0;

const progress = (): Progress => ctx!.load<Progress>('progress', { stars: {}, current: 't1' });

async function start(key: string, resume?: SaveData, book?: HelperBook): Promise<void> {
  const my = ++token;
  handle?.dispose();
  ctl?.destroy();
  handle = null;
  ctl = null;
  ctx!.container.innerHTML = '';
  document.body.classList.add('traffic-on');
  const [{ showScene }, { createTrafficScene }, { Controller }, { ALL_LEVELS, levelByKey, nextLevel }] = await Promise.all([
    import('../../lobby3d/stage'),
    import('./render/scene'),
    import('./controller'),
    import('./levels'),
  ]);
  if (my !== token) return;
  const level: LevelData = levelByKey(key) ?? ALL_LEVELS[0];
  if (getTier() === '2d') setTier(initialTier('auto') === '2d' ? '2d' : initialTier('auto'));
  hud = buildHud(ctx!.container, {
    title: level.kind === 'tutorial' ? `הדרכה ${level.number}` : `שלב ${level.number}`,
    hard: level.hard,
    total: level.queue.length,
    stars: getState().stars,
    onHome: () => exitHome(),
    onBooster: (k) => ctl?.useHelper(k),
  });
  let scene: Awaited<ReturnType<typeof createTrafficScene>> | null = null;
  try {
    handle = await showScene(
      (env) =>
        (scene = createTrafficScene(env, { vehicles: level.vehicles, queue: level.queue, lot: level.lot, world: level.world }, env.tier === 'high' ? 'high' : 'medium', () => {
          // the picture may use the rows between the title and the helper buttons
          const top = Math.max(...['.tr-title', '.tr-count', '.tr-home'].map((q) => hud?.root.querySelector(q)?.getBoundingClientRect().bottom ?? 0), 90) + 6;
          const boosters = hud?.root.querySelector('.tr-boosters')?.getBoundingClientRect().top ?? window.innerHeight - 110;
          return { top, bottom: boosters - 14 };
        })),
      { autoDowngrade: true, minTier: 'medium', onFallback: () => hud?.message('המשחק הזה צריך גרפיקה תלת־ממדית') },
    );
  } catch {
    hud.message('המכשיר הזה לא תומך בגרפיקה של המשחק');
    return;
  }
  if (my !== token || !scene) return;
  const c = new Controller(
    ctx!,
    scene,
    hud,
    level,
    {
      onWin(stars, moves) {
        const p = progress();
        const prev = p.stars[level.key] ?? 0;
        p.stars[level.key] = Math.max(prev, stars);
        const nxt = nextLevel(level.key);
        p.current = nxt ? nxt.key : level.key;
        ctx!.save('progress', p);
        const gained = Math.max(0, stars - prev);
        ctx!.onRoundEnd({ won: true, stars: gained as 0 | 1 | 2 | 3, score: moves });
        return { next: !!nxt, newStars: gained };
      },
      save: (data, b) => ctx!.save<Session>('session', { savedAt: Date.now(), key: level.key, data, book: b }),
      stars: () => getState().stars,
      spend: (n) => ctx!.addStars(-n),
      lastFreeDay: () => ctx!.load<{ day: string | null }>('daily', { day: null }).day,
      useFreeDay: (day) => ctx!.save('daily', { day }),
      clearSave: () => ctx!.save('session', null),
      restart: () => void start(level.key),
      replay: () => begin(level.key),
      next: () => {
        const nxt = nextLevel(level.key);
        if (nxt) begin(nxt.key);
      },
      home: () => exitHome(),
    },
    resume,
    book,
  );
  ctl = c;
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__traffic = { scene, state: c.state, ctl: c, load: (k: string) => void start(k) };
  handle.fadeIn(ctx!.resuming ? 0 : 250);
}

/** Start a level after the first one: asks the host, which may show the gate (the first level after entering is free). */
function begin(key: string): void {
  ctx!.save('session', null);
  ctx!.requestRound(() => void start(key));
}

function exitHome(): void {
  ctx!.save('session', null);
  ctx!.onExit();
}

const icon = `<svg viewBox="0 0 100 100" width="64" height="64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect x="8" y="46" width="84" height="34" rx="12" fill="#ff8a1f" stroke="#2a2540" stroke-width="5"/>
  <rect x="22" y="30" width="44" height="22" rx="8" fill="#bfe9ff" stroke="#2a2540" stroke-width="5"/>
  <circle cx="28" cy="82" r="10" fill="#2a2540"/><circle cx="72" cy="82" r="10" fill="#2a2540"/></svg>`;

const mod: GameModule = {
  id: 'traffic',
  title: 'פקק בתחנה',
  icon,
  color: '#ff8a1f',
  mount(c: GameContext) {
    ctx = c;
    const p = progress();
    if (c.resuming) {
      const s = c.load<Session | null>('session', null);
      if (s && Date.now() - s.savedAt < 10 * 60 * 1000) {
        void start(s.key, s.data, s.book);
        return;
      }
    } else c.save('session', null);
    void start(p.current);
  },
  /** Nothing runs on a clock here, so any moment is fine. */
  canInterrupt: () => true,
  pause() {},
  resume() {},
  unmount() {
    token++;
    ctl?.destroy();
    handle?.dispose();
    hud?.root.remove();
    ctl = handle = hud = null;
    document.body.classList.remove('traffic-on');
    ctx = null;
  },
};
export default mod;
