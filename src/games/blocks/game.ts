import type { SoundApi } from '../../sound';
import { buzz } from '../../haptics';
import { Board, N, burstOrder, idx, COLORS, type Clears } from './board';
import { LIFT_CELLS, floatingAnchor, landing, type Geometry, type Landing } from './drag';
import { Generator } from './generator';
import type { Piece } from './pieces';
import { Score, comboLine } from './scoring';
import { PALETTE, makeSprites, type Sprite } from './render/blockSprites';
import { Particles } from './render/particles';

/** A shape in the tray, with its colour. */
export interface Slot { piece: Piece; color: number }

export interface GameHooks {
  sound: SoundApi;
  /** say a Hebrew line (recorded or read by the phone) */
  say(id: string): void;
  onScore(total: number, mult: number, streak: number): void;
  onCombo(text: string, kind: 'combo' | 'clean'): void;
  onGain(points: number, x: number, y: number): void;
  onFull(score: number): void;
  onShake(): void;
  best(): number;
}

const SLOT_SCALE = 0.6;
const GROW_MS = 130;
const POP_MS = 170;
const FLASH_MS = 130;
const STAGGER_MS = 25;
const REST_MS = 220;
const ease = (t: number): number => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const easeBack = (t: number): number => {
  const c = 1.9;
  const x = Math.min(1, Math.max(0, t)) - 1;
  return 1 + (c + 1) * x * x * x + c * x * x;
};

interface Blast { i: number; color: number; at: number; done: boolean }
interface Drag { slot: number; px: number; py: number; t0: number; landing: Landing | null; clears: Clears | null; back?: { t0: number; fx: number; fy: number; fs: number } }
interface Enter { t0: number }

/**
 * The block game: the board, the tray, the dragging and every effect, drawn on one canvas (SPEC-blocks.md section 2). The rules are in
 * board.ts, generator.ts and scoring.ts (pure); this class is the picture and the finger.
 */
export class BlockGame {
  board = new Board();
  score = new Score();
  tray: (Slot | null)[] = [null, null, null];
  private gen: Generator;
  private g: CanvasRenderingContext2D;
  private sprites: Sprite[] = [];
  private spriteCell = 0;
  private particles = new Particles();
  private blasts: Blast[] = [];
  private pop = new Float64Array(N * N).fill(-1e9);
  private drag: Drag | null = null;
  private returning: (Drag & { back: NonNullable<Drag['back']> })[] = [];
  private enter: (Enter | null)[] = [null, null, null];
  private shownScore = 0;
  private geo: Geometry = { x: 0, y: 0, cell: 40 };
  private W = 0;
  private H = 0;
  private dpr = 1;
  private slotRects: { x: number; y: number; w: number; h: number }[] = [];
  private raf = 0;
  private last = 0;
  private dirty = true;
  private nextTrayAt = 0;
  private ended = false;
  private cleanedAt = -1e9;
  private reduced = false;
  private ro: ResizeObserver;

  constructor(private canvas: HTMLCanvasElement, private hooks: GameHooks, seed = Date.now() % 1e9) {
    this.g = canvas.getContext('2d')!;
    this.gen = new Generator(seed);
    this.reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onCancel);
    this.resize();
    this.newTray(0);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('pointercancel', this.onCancel);
  }

  /** A new empty board (and a new tray). */
  restart(seed = Date.now() % 1e9): void {
    this.board = new Board();
    this.score = new Score();
    this.gen = new Generator(seed);
    this.blasts = [];
    this.particles.clear();
    this.drag = null;
    this.returning = [];
    this.ended = false;
    this.shownScore = 0;
    this.pop.fill(-1e9);
    this.tray = [null, null, null];
    this.hooks.onScore(0, 1, 0);
    this.newTray(performance.now());
    this.dirty = true;
  }

  /** For tests and screenshots: set the board (rows of 9 characters, '.' empty, 0-6 a colour) and the tray (piece ids). */
  setup(rows: string[], trayIds: Piece[]): void {
    this.board = new Board();
    rows.forEach((row, r) => [...row].forEach((ch, c) => (this.board.cells[idx(r, c)] = ch === '.' ? -1 : Number(ch))));
    this.tray = trayIds.map((piece, i) => ({ piece, color: i % COLORS }));
    this.drag = null;
    this.ended = false;
    this.dirty = true;
  }

  // ---- layout ----

  private resize(): void {
    const r = this.canvas.getBoundingClientRect();
    this.W = Math.max(200, r.width);
    this.H = Math.max(260, r.height);
    this.dpr = Math.min(3, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
    const cell = Math.floor(Math.min((this.W * 0.92) / N, (this.H - 28) / (N + 3.2)));
    const board = cell * N;
    this.geo = { x: Math.round((this.W - board) / 2), y: 8, cell };
    if (this.spriteCell !== cell * this.dpr) {
      this.spriteCell = cell * this.dpr;
      this.sprites = makeSprites(Math.round(cell * this.dpr));
    }
    const ty = this.geo.y + board + 14;
    const th = Math.max(cell * 2.8, this.H - ty - 6);
    const sw = this.W / 3;
    this.slotRects = [0, 1, 2].map((i) => ({ x: i * sw, y: ty, w: sw, h: th }));
    this.dirty = true;
  }

  // ---- the tray ----

  private newTray(now: number): void {
    const pieces = this.gen.next(this.board);
    const colors = shuffledColors(pieces.length);
    this.tray = pieces.map((piece, i) => ({ piece, color: colors[i] }));
    this.enter = this.tray.map(() => ({ t0: now }));
    this.hooks.sound.play('trayin', 380);
    this.dirty = true;
    this.checkFull();
  }

  private slotScale(p: Piece): number {
    const r = this.slotRects[0];
    const c = this.geo.cell;
    return Math.min(SLOT_SCALE, (r.w * 0.86) / (p.w * c), (r.h * 0.92) / (p.h * c));
  }

  /** Where the shape of a slot is in the tray (its top-left, in px) at its tray size. */
  private slotPos(i: number, p: Piece): { x: number; y: number; s: number } {
    const r = this.slotRects[i];
    const s = this.slotScale(p);
    const c = this.geo.cell * s;
    return { x: r.x + (r.w - p.w * c) / 2, y: r.y + (r.h - p.h * c) / 2, s };
  }

  private checkFull(): void {
    if (this.ended) return;
    if (this.tray.every((s) => !s || !this.board.fits(s.piece)) && this.tray.some(Boolean)) {
      this.ended = true;
      this.hooks.sound.play('gentle');
      window.setTimeout(() => this.hooks.onFull(this.score.total), 700);
      this.particles.confetti(this.W, PALETTE.map((p) => p.mid), 60);
      this.dirty = true;
    }
  }

  // ---- the finger ----

  private pt(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private onDown = (e: PointerEvent): void => {
    if (this.drag || this.ended) return;
    const { x, y } = this.pt(e);
    const i = this.slotRects.findIndex((r) => x >= r.x && x < r.x + r.w && y >= r.y - 10 && y < r.y + r.h + 10);
    const slot = i >= 0 ? this.tray[i] : null;
    if (!slot) return;
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    this.drag = { slot: i, px: x, py: y, t0: performance.now(), landing: null, clears: null };
    this.hooks.sound.play('tick', 700);
    this.update(x, y);
  };

  private onMove = (e: PointerEvent): void => {
    if (!this.drag) return;
    const { x, y } = this.pt(e);
    this.update(x, y);
  };

  private update(x: number, y: number): void {
    const d = this.drag!;
    d.px = x;
    d.py = y;
    const slot = this.tray[d.slot]!;
    const a = floatingAnchor(this.geo, slot.piece, x, y);
    d.landing = landing(this.board, slot.piece, a.r, a.c);
    d.clears = d.landing ? this.board.preview(slot.piece, d.landing.r, d.landing.c) : null;
    if (d.clears && d.clears.units === 0) d.clears = null;
    this.dirty = true;
  }

  private onUp = (e: PointerEvent): void => {
    const d = this.drag;
    if (!d) return;
    const { x, y } = this.pt(e);
    this.update(x, y);
    this.drag = null;
    const slot = this.tray[d.slot]!;
    if (d.landing) this.place(d.slot, slot, d.landing.r, d.landing.c);
    else this.sendBack(d, slot);
  };

  private onCancel = (): void => {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    this.sendBack(d, this.tray[d.slot]!);
  };

  /** A shape let go where it cannot land goes back to the tray softly (no sound, no penalty). */
  private sendBack(d: Drag, slot: Slot): void {
    const pos = this.floatPos(d, slot.piece);
    this.returning.push({ ...d, back: { t0: performance.now(), fx: pos.x, fy: pos.y, fs: pos.s } });
    this.dirty = true;
  }

  private floatPos(d: Drag, p: Piece, now = performance.now()): { x: number; y: number; s: number } {
    const home = this.slotPos(d.slot, p);
    const a = floatingAnchor(this.geo, p, d.px, d.py);
    const fx = this.geo.x + a.c * this.geo.cell;
    const fy = this.geo.y + a.r * this.geo.cell;
    const t = ease((now - d.t0) / GROW_MS);
    return { x: home.x + (fx - home.x) * t, y: home.y + (fy - home.y) * t, s: home.s + (1 - home.s) * t };
  }

  // ---- a move ----

  private place(i: number, slot: Slot, r: number, c: number): void {
    const now = performance.now();
    const cells = this.board.place(slot.piece, r, c, slot.color);
    cells.forEach((k) => (this.pop[k] = now));
    this.tray[i] = null;
    this.hooks.sound.play('thock');
    const colorAt = (k: number): number => this.board.cells[k];
    const before = Array.from(this.board.cells);
    const clears = this.board.clearFull();
    const empty = this.board.isEmpty;
    const res = this.score.move(cells.length, clears.units, empty);
    if (clears.units > 0) {
      const order = burstOrder(clears.cells);
      order.forEach(({ i: k, rank }) => this.blasts.push({ i: k, color: before[k] >= 0 ? before[k] : colorAt(k), at: now + FLASH_MS + REST_MS * 0 + rank * STAGGER_MS, done: false }));
      const p = this.cellCenter(c + slot.piece.w / 2 - 0.5 + 0.5 - 0.5, r);
      this.hooks.onGain(res.total, p.x, p.y);
      const line = comboLine(clears.units);
      if (line) {
        this.hooks.say(line);
        this.hooks.onCombo(({ blk_nice: 'יופי!', blk_amazing: 'מדהים!', blk_wow: 'וואו!', blk_magic: 'קסם!' } as Record<string, string>)[line], 'combo');
        this.hooks.sound.play('arpeggio', 440 + clears.units * 60);
        this.hooks.onShake();
      }
      if (res.mult > 1) this.hooks.sound.play('streak', 500 + res.mult * 90);
      buzz(15);
      if (empty) {
        this.cleanedAt = now;
        this.hooks.say('blk_clean');
        this.hooks.onCombo('לוח נקי!', 'clean');
        this.hooks.sound.play('fanfare');
        this.particles.confetti(this.W, PALETTE.map((p) => p.mid), 90);
      }
    } else {
      const p = this.cellCenter(c, r);
      this.hooks.onGain(res.total, p.x, p.y);
    }
    this.hooks.onScore(this.score.total, this.score.multiplier, this.score.streak);
    if (this.tray.every((s) => !s)) {
      this.score.endTray();
      this.hooks.onScore(this.score.total, this.score.multiplier, this.score.streak);
      this.nextTrayAt = now + 380;
    } else this.checkFull();
    this.dirty = true;
  }

  private cellCenter(c: number, r: number): { x: number; y: number } {
    return { x: this.geo.x + (c + 0.5) * this.geo.cell, y: this.geo.y + (r + 0.5) * this.geo.cell };
  }

  // ---- the loop ----

  private frame = (t: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    if (this.nextTrayAt && t >= this.nextTrayAt) {
      this.nextTrayAt = 0;
      this.newTray(t);
    }
    const busy = this.animating(t);
    if (!busy && !this.dirty) return;
    this.step(t, dt);
    this.draw(t);
    this.dirty = this.animating(t);
  };

  private animating(t: number): boolean {
    return !!this.drag || this.returning.length > 0 || this.blasts.length > 0 || this.particles.count > 0 || this.enter.some((e) => e && t - e.t0 < 900) || Math.abs(this.shownScore - this.score.total) > 0.5 || t - this.cleanedAt < 1200 || t < this.nextTrayAt + 10 || this.nextTrayAt > 0;
  }

  private step(t: number, dt: number): void {
    // the blocks that burst: each at its time, with a bit of jelly and a pop
    let k = 0;
    for (const b of this.blasts) {
      if (!b.done && t >= b.at) {
        b.done = true;
        const p = this.cellCenter(b.i % N, Math.floor(b.i / N));
        this.particles.burst(p.x, p.y, PALETTE[b.color % COLORS].mid, this.geo.cell, this.reduced ? 3 : 7);
        this.hooks.sound.play('blast', 420 * Math.pow(2, Math.min(k, 14) / 12));
        k++;
      }
    }
    this.blasts = this.blasts.filter((b) => t < b.at + 260);
    this.particles.update(dt, this.geo.cell * 12);
    this.returning = this.returning.filter((r) => t - r.back.t0 < 220);
    this.enter = this.enter.map((e) => (e && t - e.t0 < 900 ? e : null));
    this.shownScore += (this.score.total - this.shownScore) * Math.min(1, dt * 9);
    if (Math.abs(this.shownScore - this.score.total) < 0.5) this.shownScore = this.score.total;
  }

  // ---- drawing ----

  private spriteAt(color: number, x: number, y: number, size: number, alpha = 1, squash = 1): void {
    const s = this.sprites[color % COLORS];
    const k = size / this.geo.cell; // 1 = a full cell
    const w = (s.canvas.width / this.dpr) * k * squash;
    const h = (s.canvas.height / this.dpr) * k * squash;
    const pad = (s.pad / this.dpr) * k * squash;
    this.g.globalAlpha = alpha;
    this.g.drawImage(s.canvas as CanvasImageSource, x - pad - ((squash - 1) * size) / 2, y - pad - ((squash - 1) * size) / 2, w, h);
    this.g.globalAlpha = 1;
  }

  private draw(t: number): void {
    const g = this.g;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.W, this.H);
    this.drawBoard();
    const { x: bx, y: by, cell } = this.geo;

    // the blocks on the board
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const v = this.board.get(r, c);
        if (v < 0) continue;
        const age = t - this.pop[idx(r, c)];
        const sq = age < POP_MS && !this.reduced ? 1 + 0.08 * (1 - ease(age / POP_MS)) : 1;
        this.spriteAt(v, bx + c * cell, by + r * cell, cell, 1, sq);
      }
    }

    // the preview of what bursts: the full units glow, and their blocks take the colour of the shape that is dragged
    const d = this.drag;
    const slotD = d ? this.tray[d.slot] : null;
    if (d && slotD && d.clears) {
      const pulse = 0.5 + 0.5 * Math.sin(t / 110);
      for (const k of d.clears.cells) {
        const r = Math.floor(k / N);
        const c = k % N;
        const cur = this.board.get(r, c);
        if (cur >= 0) this.spriteAt(slotD.color, bx + c * cell, by + r * cell, cell, 0.55);
        g.fillStyle = `rgba(255, 255, 255, ${0.18 + pulse * 0.3})`;
        g.beginPath();
        g.roundRect(bx + c * cell + 2, by + r * cell + 2, cell - 4, cell - 4, cell * 0.22);
        g.fill();
      }
      g.lineWidth = 3;
      g.strokeStyle = `rgba(255, 255, 255, ${0.55 + pulse * 0.4})`;
      for (const r of d.clears.rows) strokeRect(g, bx, by + r * cell, N * cell, cell, cell * 0.2);
      for (const c of d.clears.cols) strokeRect(g, bx + c * cell, by, cell, N * cell, cell * 0.2);
      for (const s of d.clears.squares) strokeRect(g, bx + (s % 3) * 3 * cell, by + Math.floor(s / 3) * 3 * cell, 3 * cell, 3 * cell, cell * 0.2);
    }

    // the ghost: where the shape will land
    if (d && slotD && d.landing) {
      for (const [dr, dc] of slotD.piece.cells) {
        const x = bx + (d.landing.c + dc) * cell;
        const y = by + (d.landing.r + dr) * cell;
        this.spriteAt(slotD.color, x, y, cell, 0.42);
        g.strokeStyle = 'rgba(255, 255, 255, .85)';
        g.lineWidth = 2;
        g.beginPath();
        g.roundRect(x + 2, y + 2, cell - 4, cell - 4, cell * 0.22);
        g.stroke();
      }
    }

    // blocks that are bursting: a white flash, then they swell and vanish
    for (const b of this.blasts) {
      const r = Math.floor(b.i / N);
      const c = b.i % N;
      const x = bx + c * cell;
      const y = by + r * cell;
      if (t < b.at) {
        this.spriteAt(b.color, x, y, cell);
        const f = Math.max(0, 1 - (b.at - t) / FLASH_MS);
        g.fillStyle = `rgba(255, 255, 255, ${0.15 + f * 0.7})`;
        g.beginPath();
        g.roundRect(x + 1, y + 1, cell - 2, cell - 2, cell * 0.24);
        g.fill();
      } else {
        const k = (t - b.at) / 260;
        this.spriteAt(b.color, x + (cell * (1 - (1 - k * 0.8))) / 2 * 0, y, cell * (1 + 0.25 * k), 1 - k);
      }
    }

    this.drawTray(t);
    this.particles.draw(g);
    // the shape that floats over the finger
    if (d && slotD) {
      const p = this.floatPos(d, slotD.piece, t);
      g.save();
      g.shadowColor = 'rgba(40, 20, 60, .35)';
      g.shadowBlur = cell * 0.5;
      g.shadowOffsetY = cell * 0.35;
      this.drawPiece(slotD, p.x, p.y, p.s, 1);
      g.restore();
    }
    for (const rt of this.returning) {
      const slot = this.tray[rt.slot];
      if (!slot) continue;
      const home = this.slotPos(rt.slot, slot.piece);
      const k = ease((t - rt.back.t0) / 220);
      this.drawPiece(slot, rt.back.fx + (home.x - rt.back.fx) * k, rt.back.fy + (home.y - rt.back.fy) * k, rt.back.fs + (home.s - rt.back.fs) * k, 1);
    }
  }

  private drawPiece(slot: Slot, x: number, y: number, s: number, alpha: number): void {
    const c = this.geo.cell * s;
    for (const [dr, dc] of slot.piece.cells) this.spriteAt(slot.color, x + dc * c, y + dr * c, c, alpha);
  }

  private drawTray(t: number): void {
    this.tray.forEach((slot, i) => {
      if (!slot) return;
      if (this.drag?.slot === i || this.returning.some((r) => r.slot === i)) return;
      const home = this.slotPos(i, slot.piece);
      let y = home.y;
      const en = this.enter[i];
      if (en && !this.reduced) {
        const k = (t - en.t0 - i * 110) / 380;
        if (k < 0) return;
        y = home.y + (1 - easeBack(k)) * (this.H - home.y);
      }
      const fits = this.board.fits(slot.piece);
      this.drawPiece(slot, home.x, y, home.s, fits ? 1 : 0.4);
    });
  }

  private drawBoard(): void {
    const g = this.g;
    const { x, y, cell } = this.geo;
    const size = cell * N;
    const pad = cell * 0.14;
    // the light wooden tray
    g.save();
    g.shadowColor = 'rgba(90, 50, 20, .28)';
    g.shadowBlur = cell * 0.4;
    g.shadowOffsetY = cell * 0.12;
    const wood = g.createLinearGradient(0, y - pad, 0, y + size + pad);
    wood.addColorStop(0, '#f6dfb2');
    wood.addColorStop(1, '#e4bb7c');
    g.fillStyle = wood;
    g.beginPath();
    g.roundRect(x - pad, y - pad, size + pad * 2, size + pad * 2, cell * 0.4);
    g.fill();
    g.restore();
    g.strokeStyle = 'rgba(255, 255, 255, .55)';
    g.lineWidth = 2;
    g.beginPath();
    g.roundRect(x - pad + 1, y - pad + 1, size + pad * 2 - 2, size + pad * 2 - 2, cell * 0.4);
    g.stroke();
    // the sunken cells
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const cx = x + c * cell;
        const cy = y + r * cell;
        g.fillStyle = (Math.floor(r / 3) + Math.floor(c / 3)) % 2 ? '#f3e2bd' : '#f8ebcd';
        g.beginPath();
        g.roundRect(cx + 1.5, cy + 1.5, cell - 3, cell - 3, cell * 0.2);
        g.fill();
        const inner = g.createLinearGradient(0, cy, 0, cy + cell);
        inner.addColorStop(0, 'rgba(120, 80, 30, .22)');
        inner.addColorStop(0.35, 'rgba(120, 80, 30, 0)');
        inner.addColorStop(1, 'rgba(255, 255, 255, .35)');
        g.fillStyle = inner;
        g.beginPath();
        g.roundRect(cx + 1.5, cy + 1.5, cell - 3, cell - 3, cell * 0.2);
        g.fill();
      }
    }
    // the lines of the nine squares are twice as thick as the others
    g.strokeStyle = 'rgba(150, 100, 40, .55)';
    g.lineCap = 'round';
    for (let i = 0; i <= N; i += 3) {
      g.lineWidth = i === 0 || i === N ? 0 : 4;
      if (g.lineWidth) {
        g.beginPath();
        g.moveTo(x + i * cell, y + 2);
        g.lineTo(x + i * cell, y + size - 2);
        g.moveTo(x + 2, y + i * cell);
        g.lineTo(x + size - 2, y + i * cell);
        g.stroke();
      }
    }
  }
}

function strokeRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.roundRect(x + 1, y + 1, w - 2, h - 2, r);
  g.stroke();
}

function shuffledColors(n: number): number[] {
  const all = Array.from({ length: COLORS }, (_, i) => i).sort(() => Math.random() - 0.5);
  return all.slice(0, n);
}

export { LIFT_CELLS };
