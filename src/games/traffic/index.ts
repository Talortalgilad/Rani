import type { GameContext, GameModule } from '../types';
import { getTier, initialTier, setTier } from '../../lobby3d/quality';
import { buildHud, type Hud } from './ui/hud';

let ctx: GameContext | null = null;
let hud: Hud | null = null;
let handle: { dispose(): void; fadeIn(ms: number): void } | null = null;
let ctl: { destroy(): void } | null = null;
let token = 0;

async function start(): Promise<void> {
  const my = ++token;
  handle?.dispose();
  ctl?.destroy();
  handle = null;
  ctl = null;
  ctx!.container.innerHTML = '';
  document.body.classList.add('traffic-on');
  const [{ showScene }, { createTrafficScene }, { Controller }, { SLICE_LEVEL, SLICE_QUEUE }] = await Promise.all([
    import('../../lobby3d/stage'),
    import('./render/scene'),
    import('./controller'),
    import('./levels/beach-slice'),
  ]);
  if (my !== token) return;
  if (getTier() === '2d') setTier(initialTier('auto') === '2d' ? '2d' : initialTier('auto'));
  hud = buildHud(ctx!.container, { level: SLICE_LEVEL, hard: true, total: SLICE_QUEUE.length, onHome: () => ctx!.onExit() });
  let scene: Awaited<ReturnType<typeof createTrafficScene>> | null = null;
  try {
    handle = await showScene(
      (env) => (scene = createTrafficScene(env, Controller.view, env.tier === 'high' ? 'high' : 'medium')),
      { autoDowngrade: true, minTier: 'medium', onFallback: () => hud?.message('המשחק הזה צריך גרפיקה תלת־ממדית') },
    );
  } catch {
    hud.message('המכשיר הזה לא תומך בגרפיקה של המשחק');
    return;
  }
  if (my !== token || !scene) return;
  const c = new Controller(ctx!, scene, hud);
  c.restart = () => void start();
  ctl = c;
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__traffic = { scene, state: c.state, ctl: c };
  handle.fadeIn(ctx!.resuming ? 0 : 250);
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
  mount(c) {
    ctx = c;
    void start();
  },
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
