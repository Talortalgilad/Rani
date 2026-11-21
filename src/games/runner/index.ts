import './runner.css';
import { buzz } from '../../haptics';
import { activeLevel, recordAnswer } from '../../math/adaptive';
import { createGenerator, type Question } from '../../math/generator';
import { getState } from '../../storage';
import type { GameContext, GameModule } from '../types';
import { drawRunner } from './cat';
import { createRun, gateCount, jump, move, step, type Run } from './engine';
import { Painter, makeSprites } from './render';
import { DEFAULT_TUNING, SLIDERS, cleanTuning, type Tuning } from './tuning';

/** how far a finger goes before it is a swipe (px), and how still a tap is */
const SWIPE = 24;
const TAP_MOVE = 14;
const TAP_MS = 450;

const generator = createGenerator();

export interface Gesture { kind: 'move' | 'jump'; dir?: -1 | 1; via: 'swipe' | 'tap' | 'swipe-up' | 'key' }

function exerciseHtml(q: Question): string {
  const v = q.visual;
  if (q.text) return q.ltr ? `<span dir="ltr">${q.text}</span>` : q.text;
  if (v?.kind === 'emoji') return `<span dir="ltr">${v.emoji.repeat(Math.min(10, v.n))}</span><small>כמה?</small>`;
  if (v?.kind === 'tenframe') return `<span dir="ltr">${'●'.repeat(v.filled)}${'○'.repeat(10 - v.filled)}</span><small>כמה ●?</small>`;
  return '?';
}

class Chase {
  private root = document.createElement('div');
  private canvas = document.createElement('canvas');
  private g: CanvasRenderingContext2D;
  private painter: Painter;
  private run: Run;
  private tuning: Tuning;
  private ro: ResizeObserver | null = null;
  private raf = 0;
  private last = 0;
  private time = 0;
  private W = 0;
  private H = 0;
  private dpr = 1;
  private dprSet = false;
  private slowFrames = 0;
  private state: 'ready' | 'run' | 'end' = 'ready';
  private paused = false;
  private dead = false;
  private banked = 0;
  private stepT = 0;
  private qEl!: HTMLElement;
  private starsEl!: HTMLElement;
  private msgEl!: HTMLElement;
  private overlay!: HTMLElement;
  private panel!: HTMLElement;
  private reduced = false;
  private shownGate = -1;
  private shownStars = -1;
  private qOn = false;
  /** for the tests of the browser (dev only): what the screen recognised, how fast it drew, a player who plays by itself */
  gestures: Gesture[] = [];
  frames: number[] = [];
  brain: ((r: Run, dt: number) => void) | null = null;
  private finger: { id: number; x: number; y: number; t: number; fired: boolean } | null = null;
  private cleanups: (() => void)[] = [];

  constructor(private c: GameContext) {
    this.tuning = cleanTuning(c.load<unknown>('tuning', null));
    this.g = this.canvas.getContext('2d', { alpha: false })!;
    this.painter = new Painter(this.g, makeSprites());
    this.run = this.newRun();
    this.reduced = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.build();
    // the cat is drawn once (from the saved-data format of the workshop), then kept
    void drawRunner().then((p) => {
      this.painter.sp.back = p.back;
      this.painter.sp.front = p.front;
    });
    this.size();
    this.ro = new ResizeObserver(() => this.size());
    this.ro.observe(this.root);
    this.show('ready');
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  private newRun(): Run {
    return createRun({
      tuning: this.tuning,
      rng: Math.random,
      next: () => generator.next(activeLevel(), getState().settings.enabledTypes),
      solved: (q, attempts) => recordAnswer(q.type, attempts),
    });
  }

  private build(): void {
    const r = this.root;
    r.className = 'rn-root';
    r.innerHTML = `
      <div class="rn-hud">
        <button type="button" class="rn-x" aria-label="חזרה">✕</button>
        <div class="rn-stars">⭐ <b>0</b></div>
        <button type="button" class="rn-gear" aria-label="הגדרות">⚙️</button>
      </div>
      <div class="rn-q"></div>
      <div class="rn-msg"></div>
      <div class="rn-panel" hidden></div>
      <div class="rn-overlay"></div>`;
    r.insertBefore(this.canvas, r.firstChild);
    this.canvas.className = 'rn-canvas';
    this.c.container.appendChild(r);
    this.qEl = r.querySelector('.rn-q')!;
    this.starsEl = r.querySelector('.rn-stars b')!;
    this.msgEl = r.querySelector('.rn-msg')!;
    this.overlay = r.querySelector('.rn-overlay')!;
    this.panel = r.querySelector('.rn-panel')!;
    r.querySelector('.rn-x')!.addEventListener('click', () => this.exit());
    r.querySelector('.rn-gear')!.addEventListener('click', () => this.togglePanel());
    this.buildPanel();
    // the fingers: a swipe sideways changes lane, a swipe up or a tap jumps
    const on = <K extends keyof HTMLElementEventMap>(t: K, f: (e: HTMLElementEventMap[K]) => void): void => {
      r.addEventListener(t, f as EventListener);
      this.cleanups.push(() => r.removeEventListener(t, f as EventListener));
    };
    const free = (e: Event): boolean => !(e.target as HTMLElement).closest('button, .rn-panel, .rn-overlay');
    on('pointerdown', (e) => {
      if (!free(e) || this.finger) return;
      this.finger = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), fired: false };
    });
    on('pointermove', (e) => {
      const f = this.finger;
      if (!f || f.id !== e.pointerId || f.fired) return;
      const dx = e.clientX - f.x;
      const dy = e.clientY - f.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE) return;
      f.fired = true;
      if (Math.abs(dx) >= Math.abs(dy)) this.act({ kind: 'move', dir: dx > 0 ? 1 : -1, via: 'swipe' });
      else if (dy < 0) this.act({ kind: 'jump', via: 'swipe-up' });
    });
    const end = (e: PointerEvent): void => {
      const f = this.finger;
      if (!f || f.id !== e.pointerId) return;
      this.finger = null;
      if (f.fired) return;
      const moved = Math.hypot(e.clientX - f.x, e.clientY - f.y);
      if (moved <= TAP_MOVE && performance.now() - f.t <= TAP_MS) this.act({ kind: 'jump', via: 'tap' });
    };
    on('pointerup', end);
    on('pointercancel', () => (this.finger = null));
    const key = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowLeft') this.act({ kind: 'move', dir: -1, via: 'key' });
      else if (e.key === 'ArrowRight') this.act({ kind: 'move', dir: 1, via: 'key' });
      else if (e.key === 'ArrowUp' || e.key === ' ') this.act({ kind: 'jump', via: 'key' });
    };
    window.addEventListener('keydown', key);
    this.cleanups.push(() => window.removeEventListener('keydown', key));
  }

  private act(gst: Gesture): void {
    this.gestures.push(gst);
    if (this.state !== 'run' || this.paused) return;
    if (gst.kind === 'move') move(this.run, gst.dir!);
    else jump(this.run);
  }

  // ---------------------------------------------------------------- the ⚙️ panel
  private buildPanel(): void {
    const p = this.panel;
    p.innerHTML = `${SLIDERS.map((s) => `<label>${s.label}<b data-v="${s.key}"></b><input type="range" min="${s.min}" max="${s.max}" step="${s.step}" data-k="${s.key}"></label>`).join('')}
      <div class="rn-note">מהירות, קפיצה, מעבר מסלול והאטה משפיעים מיד. מרחק בין שערים בריצה הבאה.</div>
      <div class="rn-row"><button type="button" class="rn-btn" data-copy>העתק ערכים</button><button type="button" class="rn-btn alt" data-reset>ברירת מחדל</button></div>`;
    const paint = (): void => {
      p.querySelectorAll<HTMLInputElement>('input[data-k]').forEach((i) => (i.value = String(this.tuning[i.dataset.k as keyof Tuning])));
      p.querySelectorAll<HTMLElement>('b[data-v]').forEach((b) => (b.textContent = String(this.tuning[b.dataset.v as keyof Tuning])));
    };
    paint();
    p.addEventListener('input', (e) => {
      const i = e.target as HTMLInputElement;
      if (!i.dataset.k) return;
      (this.tuning as unknown as Record<string, number>)[i.dataset.k] = Number(i.value);
      this.c.save('tuning', this.tuning);
      paint();
    });
    p.querySelector('[data-reset]')!.addEventListener('click', () => {
      Object.assign(this.tuning, DEFAULT_TUNING);
      this.c.save('tuning', this.tuning);
      paint();
    });
    p.querySelector('[data-copy]')!.addEventListener('click', (e) => {
      const btn = e.currentTarget as HTMLButtonElement;
      const text = JSON.stringify(this.tuning, null, 1);
      const done = (): void => {
        btn.textContent = 'הועתק ✓';
        window.setTimeout(() => (btn.textContent = 'העתק ערכים'), 1400);
      };
      const fallback = (): void => {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0;top:0';
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
        } catch {
          /* ignore */
        }
        ta.remove();
        done();
      };
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, fallback);
      else fallback();
    });
  }
  private togglePanel(): void {
    this.panel.hidden = !this.panel.hidden;
    // while the panel is open the road waits
    this.paused = !this.panel.hidden;
  }

  // ---------------------------------------------------------------- the screens
  private show(s: 'ready' | 'run' | 'end'): void {
    this.state = s;
    const o = this.overlay;
    o.hidden = s === 'run';
    if (s === 'ready') {
      o.innerHTML = `<div class="rn-card"><h2>מרדף הבלונים</h2><p>שובי העורב חטף את הבלונים!</p><p>החליקי ימינה ושמאלה, הקישי כדי לקפוץ.</p><button type="button" class="rn-btn" data-go>יאללה!</button></div>`;
      o.querySelector('[data-go]')!.addEventListener('click', () => this.begin());
    } else if (s === 'end') {
      const r = this.run;
      const n = r.gates.length;
      o.innerHTML = `<div class="rn-card"><h2>${r.caught ? 'תפסת את שובי! 🎈' : 'שובי ברח הפעם'}</h2><p>⭐ ${r.stars}</p><p>שערים נכונים: ${r.correct} מתוך ${n}</p><div class="rn-row"><button type="button" class="rn-btn" data-again>עוד ריצה</button><button type="button" class="rn-btn alt" data-back>חזרה</button></div></div>`;
      o.querySelector('[data-again]')!.addEventListener('click', () => this.c.requestRound(() => this.again()));
      o.querySelector('[data-back]')!.addEventListener('click', () => this.exit());
    }
  }

  private begin(): void {
    this.state = 'run';
    this.overlay.hidden = true;
    this.paused = false;
    this.last = 0;
  }
  private again(): void {
    this.bank();
    this.run = this.newRun();
    this.banked = 0;
    this.shownGate = -1;
    this.qEl.classList.remove('on');
    this.begin();
  }
  private bank(): void {
    const n = this.run.stars - this.banked;
    if (n > 0) this.c.addStars(n);
    this.banked = this.run.stars;
  }
  private exit(): void {
    if (this.dead) return;
    this.bank();
    this.c.onExit();
  }

  // ---------------------------------------------------------------- the loop
  private size(): void {
    const rect = this.root.getBoundingClientRect();
    // the sharpness starts at 1.25x at most and goes down by itself on a slow phone (see `adapt`), never below 1x
    if (!this.dprSet) this.dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    this.W = Math.max(1, Math.round(rect.width));
    this.H = Math.max(1, Math.round(rect.height));
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
  }

  private loop(now: number): void {
    if (this.dead) return;
    this.raf = requestAnimationFrame((t) => this.loop(t));
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0;
    this.last = now;
    this.frames.push(now);
    if (this.frames.length > 400) this.frames.shift();
    this.time += dt;
    const r = this.run;
    if (this.state === 'run' && !this.paused) {
      this.brain?.(r, dt);
      step(r, dt);
      this.events(dt);
      if (r.phase === 'done') {
        this.bank();
        this.show('end');
      }
    }
    this.adapt(dt);
    this.hud();
    this.painter.flash = Math.max(0, this.painter.flash - dt * 2.5);
    this.g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.painter.draw(r, this.W, this.H, this.time, this.reduced);
  }

  /** a phone that cannot keep 50 frames a second gets a coarser picture (the canvas is smaller, the screen stretches it): 1.25x, then 1x */
  private adapt(dt: number): void {
    if (dt <= 0 || this.state !== 'run') return;
    this.slowFrames = dt > 0.019 ? this.slowFrames + 1 : Math.max(0, this.slowFrames - 1);
    if (this.slowFrames >= 15 && this.dpr > 1) {
      this.slowFrames = 0;
      this.dprSet = true;
      this.dpr = Math.max(1, this.dpr - 0.25);
      this.size();
    }
  }

  private events(dt: number): void {
    const r = this.run;
    const s = this.c.sound;
    for (const e of r.events) {
      switch (e.t) {
        case 'jump': s.play('jump'); break;
        case 'land': s.play('land'); break;
        case 'star': s.play('star', 760 + (r.stars % 8) * 55); break;
        case 'hit':
          s.play('squash');
          if (!e.shielded) buzz(10);
          break;
        case 'gate':
          if (e.ok) {
            s.play('gate');
            buzz(10);
            this.painter.flash = 0.5;
            this.say(e.bonus === 'magnet' ? 'נכון! 🧲' : e.bonus === 'shield' ? 'נכון! 🛡️' : 'נכון! 🎈');
          } else {
            s.play('oops');
            this.say('כמעט! הנה התשובה');
          }
          break;
        case 'finish': s.play(e.caught ? 'win' : 'gentle'); break;
        case 'lane': break;
      }
    }
    r.events.length = 0;
    // steps
    this.stepT -= dt * (r.speedNow / r.tune.speed);
    if (this.stepT <= 0 && r.jt < 0 && r.phase === 'run') {
      this.stepT = 0.28;
      s.play('step', 140 + (Math.floor(this.time * 3.5) % 2) * 25);
    }
  }

  private say(t: string): void {
    this.msgEl.textContent = t;
    this.msgEl.classList.remove('on');
    void this.msgEl.offsetWidth;
    this.msgEl.classList.add('on');
  }

  /** the exercise on the top of the screen: from the moment the gate comes into view until a moment after it */
  private hud(): void {
    const r = this.run;
    if (r.stars !== this.shownStars) {
      this.shownStars = r.stars;
      this.starsEl.textContent = String(r.stars);
    }
    const g = r.nextGate;
    const idx = g ? r.gates.indexOf(g) : -1;
    const show = !!g && g.prepared && !!r.ex;
    if (show && idx !== this.shownGate) {
      this.qEl.innerHTML = exerciseHtml(r.ex!.q);
      this.shownGate = idx;
    } else if (show && r.ex && this.qEl.dataset.q !== r.ex.q.key) {
      this.qEl.innerHTML = exerciseHtml(r.ex.q);
    }
    if (r.ex && this.qEl.dataset.q !== r.ex.q.key) this.qEl.dataset.q = r.ex.q.key;
    const on = show && r.phase === 'run';
    if (on !== this.qOn) {
      this.qOn = on;
      this.qEl.classList.toggle('on', on);
    }
  }

  // ---------------------------------------------------------------- the module's side
  pause(): void {
    if (this.state === 'run') {
      this.state = 'ready';
      this.show('ready');
      this.overlay.querySelector('h2')!.textContent = 'מחכים לך';
    }
  }
  unmount(): void {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.cleanups.forEach((f) => f());
    this.bank();
    this.root.remove();
  }
  /** for the browser tests */
  get api(): { run: Run; tuning: Tuning; gestures: Gesture[]; fps(): number; worst(): number; begin(): void; again(): void; setBrain(f: ((r: Run, dt: number) => void) | null): void; act(g: Gesture): void; state(): string; gates: number } {
    const self = this;
    return {
      get run() { return self.run; },
      tuning: this.tuning,
      gestures: this.gestures,
      fps: () => {
        // the last 120 frames (two seconds)
        const f = self.frames.slice(-120);
        return f.length > 30 ? ((f.length - 1) * 1000) / (f[f.length - 1] - f[0]) : 0;
      },
      worst: () => {
        const f = self.frames.slice(-120);
        let w = 0;
        for (let i = 1; i < f.length; i++) w = Math.max(w, f[i] - f[i - 1]);
        return w;
      },
      begin: () => self.begin(),
      act: (g) => self.act(g),
      again: () => self.again(),
      setBrain: (b) => (self.brain = b),
      state: () => self.state,
      gates: gateCount(self.tuning.gateGap),
    };
  }
}

let chase: Chase | null = null;

const runner: GameModule = {
  id: 'runner',
  title: 'מרדף הבלונים',
  icon: '🎈',
  color: '#9b5de5',
  mount(c) {
    chase = new Chase(c);
    if (import.meta.env.DEV) (window as unknown as { __runner?: unknown }).__runner = chase.api;
  },
  canInterrupt: () => true,
  pause() {
    chase?.pause();
  },
  resume() {},
  unmount() {
    chase?.unmount();
    chase = null;
  },
};
export default runner;
