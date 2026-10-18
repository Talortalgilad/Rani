import type { GameContext, GameModule } from '../types';
import { Engine, STEP, W, starsFor, type Snapshot } from './engine';
import { LEVELS } from './levels';
import { draw } from './render';

interface Progress { completed: number; stars: Record<number, number> }
interface Session extends Snapshot { level: number; savedAt: number }

let ctx: GameContext | null = null;
let root: HTMLElement;
let canvas: HTMLCanvasElement;
let g: CanvasRenderingContext2D;
let hud: HTMLElement;
let overlay: HTMLElement;
let engine: Engine;
let level = 1;
let paused = false;
let ended = false;
let raf = 0;
let last = 0;
let acc = 0;
let k = 1;
let dpr = 1;
let ro: ResizeObserver | null = null;
let down: { x: number; y: number; t: number } | null = null;
let dragging = false;

const progress = (): Progress => ctx!.load<Progress>('progress', { completed: 0, stars: {} });

function resize(): void {
  const r = canvas.getBoundingClientRect();
  if (!r.width || !r.height) return;
  dpr = Math.min(window.devicePixelRatio || 1, 3);
  k = r.width / W;
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  engine?.setHeight(r.height / k);
}

function worldX(e: PointerEvent): number {
  const r = canvas.getBoundingClientRect();
  return ((e.clientX - r.left) / r.width) * W;
}

function paintHud(): void {
  const hearts = Array.from({ length: 3 }, (_, i) => (i < engine.lives ? '❤️' : '🤍')).join('');
  hud.querySelector('.bb-hearts')!.textContent = hearts;
  hud.querySelector('.bb-score')!.textContent = `⭐ ${engine.score}`;
  hud.querySelector('.bb-level')!.textContent = `${level}`;
}

function showOverlay(html: string): void {
  overlay.innerHTML = `<div class="bb-card">${html}</div>`;
  overlay.hidden = false;
}
function hideOverlay(): void {
  overlay.hidden = true;
  overlay.innerHTML = '';
}

function startLevel(n: number, snap?: Snapshot): void {
  level = n;
  ended = false;
  const r = canvas.getBoundingClientRect();
  engine = new Engine(LEVELS[n - 1], r.height / k, true);
  if (snap) engine.restore(snap);
  hideOverlay();
  paintHud();
}

function saveSession(): void {
  if (!ctx || ended || !engine) return;
  ctx.save<Session>('session', { ...engine.snapshot(), level, savedAt: Date.now() });
}

function pauseGame(): void {
  if (ended || paused) return;
  paused = true;
  saveSession();
  showOverlay(`
    <button class="btn big" id="bb-resume">▶ המשך</button>
    <button class="btn alt" id="bb-home">🏠 בית</button>`);
  overlay.querySelector('#bb-resume')!.addEventListener('click', resumeGame);
  overlay.querySelector('#bb-home')!.addEventListener('click', () => ctx!.onExit());
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
  if (won) {
    const p = progress();
    p.completed = Math.max(p.completed, level);
    p.stars[level] = Math.max(p.stars[level] ?? 0, stars);
    ctx!.save('progress', p);
    ctx!.sound.play('win');
    showOverlay(`
      <div class="bb-stars">${[1, 2, 3].map((i) => `<span class="${i <= stars ? 'on' : ''}">⭐</span>`).join('')}</div>
      <div class="bb-score-big">${engine.score}</div>
      ${hasNext ? '<button class="btn big" id="bb-next">▶ השלב הבא</button>' : ''}
      <button class="btn ${hasNext ? 'alt' : 'big'}" id="bb-again">🔁 שוב</button>
      <button class="btn alt" id="bb-home">🏠 בית</button>`);
  } else {
    showOverlay(`
      <div class="bb-almost">כמעט! ננסה שוב?</div>
      <button class="btn big" id="bb-again">🔁 שוב</button>
      <button class="btn alt" id="bb-home">🏠 בית</button>`);
  }
  const again = (n: number) => ctx!.requestRound(() => startLevel(n));
  overlay.querySelector('#bb-again')!.addEventListener('click', () => again(level));
  overlay.querySelector('#bb-next')?.addEventListener('click', () => again(level + 1));
  overlay.querySelector('#bb-home')!.addEventListener('click', () => ctx!.onExit());
}

function drain(): void {
  for (const ev of engine.events.splice(0)) {
    if (ev === 'brick') ctx!.sound.play('pop');
    else if (ev === 'lifeLost') paintHud();
    else if (ev === 'win') endRound(true);
    else if (ev === 'lose') endRound(false);
  }
}

function frame(t: number): void {
  raf = requestAnimationFrame(frame);
  if (!paused && !ended) {
    acc += Math.min((t - last) / 1000, 0.1);
    while (acc >= STEP) {
      engine.step(STEP);
      acc -= STEP;
    }
    drain();
    hud.querySelector('.bb-score')!.textContent = `⭐ ${engine.score}`;
  }
  last = t;
  draw(g, engine, k, dpr, t);
}

const onPointerDown = (e: PointerEvent): void => {
  if (paused || ended) return;
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
      <canvas class="bb-canvas"></canvas>
      <div class="bb-overlay" hidden></div>`;
    c.container.appendChild(root);
    canvas = root.querySelector('canvas')!;
    g = canvas.getContext('2d')!;
    hud = root.querySelector('.bb-hud')!;
    overlay = root.querySelector('.bb-overlay')!;

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
    const session = c.resuming ? c.load<Session | null>('session', null) : null;
    if (!c.resuming) c.save('session', null);
    const next = Math.min(progress().completed + 1, LEVELS.length);
    startLevel(session?.level ?? next, session ?? undefined);
    if (session) pauseGame();

    last = performance.now();
    acc = 0;
    raf = requestAnimationFrame(frame);

    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__bb = { get engine() { return engine; } };
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
