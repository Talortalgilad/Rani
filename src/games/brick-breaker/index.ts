import type { GameContext, GameModule } from '../types';
import { buzz } from '../../haptics';
import { Engine, SPEED_SCALE, STEP, W, starsFor, type GameEvent, type Snapshot } from './engine';
import { Fx } from './fx';
import { LEVELS } from './levels';
import { BONUS_ICON, draw } from './render';

interface Progress { completed: number; stars: Record<number, number> }
interface Session extends Snapshot { level: number; savedAt: number }
interface Queued { level: number; at: number }

const QUEUE_TTL_MS = 10 * 60 * 1000;
/** Pop pitch per brick colour (a pentatonic-ish scale). */
const PITCH: Record<string, number> = {
  '#ff5d73': 523.25, '#ffd23f': 587.33, '#3fb56b': 659.25, '#3aa0ff': 783.99,
  '#b57bff': 880, '#8c93b8': 698.46, '#ff9a3c': 1046.5, '#5b4b8a': 1174.66,
};

let ctx: GameContext | null = null;
let root: HTMLElement;
let canvas: HTMLCanvasElement;
let fxCanvas: HTMLCanvasElement;
let g: CanvasRenderingContext2D;
let fg: CanvasRenderingContext2D;
let hud: HTMLElement;
let overlay: HTMLElement;
let select: HTMLElement;
let engine: Engine;
const fx = new Fx();
let level = 1;
let paused = false;
let ended = false;
let inSelect = false;
/** The round the gate just granted is still unused (first level picked after entering). */
let fresh = true;
let raf = 0;
let last = 0;
let acc = 0;
let k = 1;
let dpr = 1;
let ro: ResizeObserver | null = null;
let down: { x: number; y: number; t: number } | null = null;
let dragging = false;
let shownScore = -1;

const progress = (): Progress => ctx!.load<Progress>('progress', { completed: 0, stars: {} });

function resize(): void {
  const r = canvas.getBoundingClientRect();
  if (!r.width || !r.height) return;
  // Capped at 2x: a 3x phone screen would cost 2.25x the fill rate for no visible gain.
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  k = r.width / W;
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  // particles are soft and short-lived, so they are drawn at 1x
  fxCanvas.width = Math.round(r.width);
  fxCanvas.height = Math.round(r.height);
  engine?.setHeight(r.height / k);
}

function worldX(e: PointerEvent): number {
  const r = canvas.getBoundingClientRect();
  return ((e.clientX - r.left) / r.width) * W;
}

function paintHud(): void {
  const slots = Math.max(3, engine.lives);
  hud.querySelector('.bb-hearts')!.textContent = Array.from({ length: slots }, (_, i) => (i < engine.lives ? '❤️' : '🤍')).join('');
  hud.querySelector('.bb-level')!.textContent = `${level}`;
  paintScore();
}

function paintScore(): void {
  if (shownScore === engine.score) return;
  shownScore = engine.score;
  hud.querySelector('.bb-score')!.textContent = `⭐ ${engine.score}`;
}

function showOverlay(html: string): void {
  overlay.innerHTML = `<div class="bb-card">${html}</div>`;
  overlay.hidden = false;
}
function hideOverlay(): void {
  overlay.hidden = true;
  overlay.innerHTML = '';
}

function newEngine(n: number, snap?: Snapshot): void {
  level = n;
  const r = canvas.getBoundingClientRect();
  const speed = SPEED_SCALE[ctx!.getSettings().ballSpeed] ?? 1;
  engine = new Engine(LEVELS[n - 1], r.height / k, { safetyNet: n <= 3, speedScale: speed });
  if (snap) engine.restore(snap);
  shownScore = -1;
}

function startLevel(n: number, snap?: Snapshot): void {
  newEngine(n, snap);
  ended = false;
  paused = false;
  inSelect = false;
  select.hidden = true;
  fx.clear();
  hideOverlay();
  paintHud();
  last = performance.now();
  acc = 0;
}

/** Start a round: the first one after the gate is free, later ones ask the host (which may show the gate). */
function begin(n: number): void {
  if (fresh) {
    fresh = false;
    startLevel(n);
    return;
  }
  ctx!.save<Queued>('queued', { level: n, at: Date.now() });
  ctx!.requestRound(() => {
    ctx!.save('queued', null);
    startLevel(n);
  });
}

function showSelect(): void {
  inSelect = true;
  hideOverlay();
  const p = progress();
  select.innerHTML = `
    <div class="bb-sel-top">
      <button class="icon-btn small" id="sel-home" aria-label="בית">🏠</button>
      <h2>שלבים</h2>
      <span class="bb-sel-sp"></span>
    </div>
    <div class="bb-sel-grid">${LEVELS.map((_, i) => {
      const n = i + 1;
      if (n > p.completed + 1) return `<button class="lvl locked" data-n="${n}" aria-label="נעול"><b>🔒</b></button>`;
      const st = p.stars[n] ?? 0;
      return `<button class="lvl" data-n="${n}"><b>${n}</b><span class="lvl-stars">${[1, 2, 3].map((s) => `<i class="${s <= st ? 'on' : ''}">⭐</i>`).join('')}</span></button>`;
    }).join('')}</div>`;
  select.hidden = false;
  select.querySelector('#sel-home')!.addEventListener('click', exitHome);
  select.querySelectorAll<HTMLButtonElement>('.lvl').forEach((b) =>
    b.addEventListener('click', () => {
      if (b.classList.contains('locked')) {
        b.classList.remove('wiggle');
        void b.offsetWidth;
        b.classList.add('wiggle');
      } else begin(Number(b.dataset.n));
    }),
  );
}

function exitHome(): void {
  ctx!.save('queued', null);
  ctx!.onExit();
}

function saveSession(): void {
  if (!ctx || ended || inSelect || !engine) return;
  ctx.save<Session>('session', { ...engine.snapshot(), level, savedAt: Date.now() });
}

function pauseGame(): void {
  if (ended || paused || inSelect) return;
  paused = true;
  saveSession();
  showOverlay(`
    <button class="btn big" id="bb-resume">▶ המשך</button>
    <button class="btn alt" id="bb-home">🏠 בית</button>`);
  overlay.querySelector('#bb-resume')!.addEventListener('click', resumeGame);
  overlay.querySelector('#bb-home')!.addEventListener('click', exitHome);
}

function resumeGame(): void {
  if (!paused) return;
  paused = false;
  last = performance.now();
  hideOverlay();
}

function endRound(won: boolean): void {
  ended = true;
  const stars = starsFor(won, engine.livesLost);
  ctx!.save('session', null);
  ctx!.onRoundEnd({ won, stars, score: engine.score });
  if (engine.score > ctx!.load('best', 0)) ctx!.save('best', engine.score);

  const hasNext = won && level < LEVELS.length;
  const row = `<div class="bb-row"><button class="btn alt" id="bb-levels">🔢 שלבים</button><button class="btn alt" id="bb-home">🏠 בית</button></div>`;
  if (won) {
    const p = progress();
    p.completed = Math.max(p.completed, level);
    p.stars[level] = Math.max(p.stars[level] ?? 0, stars);
    ctx!.save('progress', p);
    ctx!.sound.play('win');
    fx.confetti(engine.h);
    showOverlay(`
      <div class="bb-stars">${[1, 2, 3].map((i) => `<span class="${i <= stars ? 'on' : ''}">⭐</span>`).join('')}</div>
      <div class="bb-score-big">${engine.score}</div>
      ${hasNext ? '<button class="btn big" id="bb-next">▶ השלב הבא</button>' : ''}
      <button class="btn ${hasNext ? 'alt' : 'big'}" id="bb-again">🔁 שוב</button>
      ${row}`);
  } else {
    showOverlay(`
      <div class="bb-almost">כמעט! ננסה שוב?</div>
      <button class="btn big" id="bb-again">🔁 שוב</button>
      ${row}`);
  }
  overlay.querySelector('#bb-again')!.addEventListener('click', () => begin(level));
  overlay.querySelector('#bb-next')?.addEventListener('click', () => begin(level + 1));
  overlay.querySelector('#bb-levels')!.addEventListener('click', () => {
    fx.clear();
    showSelect();
  });
  overlay.querySelector('#bb-home')!.addEventListener('click', exitHome);
}

function onEvent(ev: GameEvent): void {
  const c = ctx!;
  switch (ev.type) {
    case 'brick':
      c.sound.play('pop', PITCH[ev.color]);
      fx.burst(ev.x, ev.y, ev.color);
      buzz(15);
      if (ev.kind === 'star') {
        c.addStars(1);
        fx.float(ev.x, ev.y, '⭐');
        c.sound.play('bonus');
      }
      break;
    case 'crack':
      c.sound.play('crack');
      fx.burst(ev.x, ev.y, '#8c93b8', 4);
      break;
    case 'bonus':
      c.sound.play(ev.bonus === 'life' ? 'life' : 'bonus');
      fx.float(ev.x, ev.y, BONUS_ICON[ev.bonus]);
      if (ev.bonus === 'life') paintHud();
      break;
    case 'net':
      c.sound.play('pop', 330);
      break;
    case 'lifeLost':
      c.sound.play('oops');
      paintHud();
      break;
    case 'win':
      endRound(true);
      break;
    case 'lose':
      endRound(false);
      break;
  }
}

let fxDirty = false;
function frame(t: number): void {
  raf = requestAnimationFrame(frame);
  const dt = Math.min((t - last) / 1000, 0.1);
  last = t;
  if (inSelect) return;
  if (!paused) {
    if (!ended) {
      acc += dt;
      while (acc >= STEP) {
        engine.step(STEP);
        acc -= STEP;
      }
      for (const ev of engine.events.splice(0)) onEvent(ev);
      paintScore();
    }
    fx.update(dt);
  }
  draw(g, engine, k, dpr, t);
  if (fx.p.length > 0) {
    fg.setTransform(k, 0, 0, k, 0, 0);
    fg.clearRect(0, 0, W, engine.h);
    fx.draw(fg);
    fxDirty = true;
  } else if (fxDirty) {
    fg.setTransform(1, 0, 0, 1, 0, 0);
    fg.clearRect(0, 0, fxCanvas.width, fxCanvas.height);
    fxDirty = false;
  }
}

const onPointerDown = (e: PointerEvent): void => {
  if (paused || ended || inSelect) return;
  canvas.setPointerCapture(e.pointerId);
  down = { x: e.clientX, y: e.clientY, t: performance.now() };
  const r = canvas.getBoundingClientRect();
  dragging = e.clientY - r.top > r.height / 2;
  if (dragging) engine.setTarget(worldX(e));
};
const onPointerMove = (e: PointerEvent): void => {
  if (down && dragging && !paused && !ended) engine.setTarget(worldX(e));
};
const onPointerUp = (e: PointerEvent): void => {
  if (down && !paused && !ended && engine.state === 'ready') {
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    if (moved < 14 && performance.now() - down.t < 400) engine.launch();
  }
  down = null;
  dragging = false;
};
// A paused round keeps the timestamp from when it was paused.
const onPageHide = (): void => { if (!paused) saveSession(); };

const brickBreaker: GameModule = {
  id: 'brick-breaker',
  title: 'שובר שורות',
  icon: '🧱',
  color: '#8e5cf0',

  mount(c: GameContext) {
    ctx = c;
    root = document.createElement('div');
    root.className = 'bb';
    root.innerHTML = `
      <div class="bb-hud">
        <div class="bb-hearts"></div>
        <div class="bb-info"><span class="bb-level-tag">שלב <b class="bb-level"></b></span><span class="bb-score"></span></div>
        <button class="icon-btn small" id="bb-pause" aria-label="השהיה">⏸</button>
      </div>
      <div class="bb-stage">
        <canvas class="bb-canvas"></canvas>
        <canvas class="bb-fx"></canvas>
        <div class="bb-overlay" hidden></div>
      </div>
      <div class="bb-select" hidden></div>`;
    c.container.appendChild(root);
    canvas = root.querySelector('.bb-canvas')!;
    fxCanvas = root.querySelector('.bb-fx')!;
    g = canvas.getContext('2d')!;
    fg = fxCanvas.getContext('2d')!;
    hud = root.querySelector('.bb-hud')!;
    overlay = root.querySelector('.bb-overlay')!;
    select = root.querySelector('.bb-select')!;

    resize();
    ro = new ResizeObserver(resize);
    ro.observe(canvas);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    root.querySelector('#bb-pause')!.addEventListener('click', pauseGame);
    window.addEventListener('pagehide', onPageHide);

    paused = false;
    ended = false;
    fresh = !c.resuming;
    fx.clear();
    const session = c.resuming ? c.load<Session | null>('session', null) : null;
    if (!c.resuming) c.save('session', null);
    const queued = c.load<Queued | null>('queued', null);
    c.save('queued', null);
    const unlocked = progress().completed + 1;

    newEngine(1);
    paintHud();
    if (session) {
      startLevel(session.level, session);
      fresh = false;
      pauseGame();
    } else if (queued && Date.now() - queued.at < QUEUE_TTL_MS && queued.level <= unlocked && queued.level <= LEVELS.length) {
      begin(queued.level);
    } else {
      showSelect();
    }

    last = performance.now();
    acc = 0;
    raf = requestAnimationFrame(frame);

    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__bb = {
        get engine() { return engine; },
        fx,
        startLevel,
      };
    }
  },

  pause: pauseGame,
  resume: resumeGame,

  unmount() {
    cancelAnimationFrame(raf);
    ro?.disconnect();
    window.removeEventListener('pagehide', onPageHide);
    ctx?.save('session', null);
    root?.remove();
    ctx = null;
  },
};

export default brickBreaker;
