import type { SoundApi } from '../../sound';
import { buzz } from '../../haptics';
import { Board, N, burstOrder, idx, COLORS, type Clears } from './board';
import { LIFT_CELLS, floatingAnchor, landing, type Geometry, type Landing } from './drag';
import { Generator } from './generator';
import type { Piece } from './pieces';
import { Score, comboLine } from './scoring';
import { fullestSquare } from './rescue';
import { freshFree, hammer, priceOf, whyNot, type FreeUsed, type Helper } from './helpers';
import { boardOf, type SavedGame } from './save';
import { pieceById, turned } from './pieces';
import { Run, startBoard, wave, ITEMS, type GoalView, type Level } from './journey';
import { STAR_TARGETS } from './starTargets';
import { pieceByArt } from './levels';
import { makeStone, type BlockStyle } from './render/blockSprites';
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
  onGain(points: number, x: number, y: number, big: boolean): void;
  onFull(score: number): void;
  onShake(): void;
  best(): number;
  /** where the row of helpers goes (px in the stage) and the size of a cell: the board, the tray and the helpers are centred as one group */
  onLayout(helpersTop: number, cell: number): void;
  /** a move is done (the game is saved) */
  onMoveDone(): void;
  /** the helper that waits for a tap on a shape or on a block (null: none) */
  onMode(h: Helper | null): void;
  /** what the helpers cost now */
  onHelpers(free: FreeUsed): void;
  /** a short friendly line over the stage (id of the line) */
  onSay(id: string): void;
  /** the stars of the jar, and paying with them */
  stars(): number;
  spend(n: number): void;
  /** the goal of the level changed */
  onGoal(v: GoalView): void;
  /** the goal is reached */
  onLevelDone(r: { stars: 1 | 2 | 3; trays: number; score: number }): void;
  /** where the picture of the goal is on the canvas, for the items that fly to it */
  goalPos(): { x: number; y: number } | null;
}

/** The set of blocks of each world (SPEC-blocks.md 2.2). */
const SKIN: Record<number, BlockStyle> = { 1: 'candy', 2: 'garden', 3: 'art', 4: 'space' };
interface Fly { x: number; y: number; item: number; t0: number }
const SRC = (name: string): string => (name === 'candy' || name === 'star' ? `english/words/${name}.webp` : `blocks/items/${name}.webp`);

/** the shapes of the tray are 70% of a cell of the board (SPEC-blocks.md 2.4, improved after the first look) */
const SLOT_SCALE = 0.7;
const TRAY_ROWS = 3.2;
const GAP_CELLS = 0.5;
const GROW_MS = 130;
const POP_MS = 170;
const FLASH_MS = 130;
const STAGGER_MS = 25;
const ease = (t: number): number => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const easeBack = (t: number): number => {
  const c = 1.9;
  const x = Math.min(1, Math.max(0, t)) - 1;
  return 1 + (c + 1) * x * x * x + c * x * x;
};

interface Blast { i: number; color: number; at: number; done: boolean; item?: number; kind?: 'crate' | 'lock' | 'ice' }
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
  /** the rescue of a full board is used once on every board */
  rescued = false;
  free: FreeUsed = freshFree();
  private mode: Helper | null = null;
  private locked = false;
  private trayTop = 0;
  private trayH = 0;
  private seed = 0;
  readonly level: Level | null;
  run: Run | null = null;
  private skin: BlockStyle = 'jelly';
  private imgs = new Map<string, HTMLImageElement>();
  /** the part of a picture that is not transparent, so that an obstacle fills its whole cell */
  private boxes = new Map<string, { sx: number; sy: number; sw: number; sh: number }>();
  private stone: Sprite | null = null;
  private bounce = new Float64Array(N * N).fill(-1e9);
  private flies: Fly[] = [];
  private finishing = false;
  private wand: { t0: number; x: number; y: number } | null = null;
  private lastWandSpark = 0;
  private cleanedAt = -1e9;
  private reduced = false;
  private ro: ResizeObserver;

  constructor(private canvas: HTMLCanvasElement, private hooks: GameHooks, seed = Date.now() % 1e9, saved: SavedGame | null = null, level: Level | null = null) {
    this.g = canvas.getContext('2d')!;
    this.seed = seed;
    this.gen = new Generator(seed);
    this.level = level;
    if (level) {
      this.skin = SKIN[level.world];
      this.board = startBoard(level);
      this.run = new Run(level, this.board);
      this.gen = new Generator(level.seed);
    }
    this.reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onCancel);
    this.resize();
    if (saved) this.restoreSaved(saved);
    else {
      this.newTray(0, level?.forced?.map((a) => pieceByArt(a)));
      this.reportGoal();
      if (level?.tutorial) window.setTimeout(() => this.hooks.onSay(`blk_tut_${level.tutorial}`), 700);
    }
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
    this.rescued = false;
    this.locked = false;
    this.free = freshFree();
    this.setMode(null);
    this.hooks.onHelpers(this.free);
    this.seed = seed;
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
    // the board, the tray (half a cell below it) and the row of helpers are one group, centred up and down
    const helpersH = (c: number): number => Math.min(72, Math.max(52, c * 1.5));
    let cell = Math.floor((this.W * 0.92) / N);
    const groupH = (c: number): number => (N + GAP_CELLS + TRAY_ROWS) * c + 0.35 * c + helpersH(c);
    while (cell > 20 && groupH(cell) > this.H - 8) cell--;
    const board = cell * N;
    const top = Math.max(4, Math.round((this.H - groupH(cell)) / 2));
    this.geo = { x: Math.round((this.W - board) / 2), y: top, cell };
    if (this.spriteCell !== cell * this.dpr) {
      this.spriteCell = cell * this.dpr;
      this.sprites = makeSprites(Math.round(cell * this.dpr), this.skin);
      this.stone = makeStone(Math.round(cell * this.dpr));
    }
    this.trayTop = top + board + GAP_CELLS * cell;
    this.trayH = TRAY_ROWS * cell;
    const sw = this.W / 3;
    this.slotRects = [0, 1, 2].map((i) => ({ x: i * sw, y: this.trayTop, w: sw, h: this.trayH }));
    this.hooks.onLayout(this.trayTop + this.trayH + 0.35 * cell, cell);
    this.dirty = true;
  }

  // ---- the tray ----

  private reportGoal(): void {
    if (this.run) this.hooks.onGoal(this.run.view(this.board, this.score.total));
  }

  /** A picture of the game, loaded once (null while it is on its way). */
  private img(name: string): HTMLImageElement | null {
    let im = this.imgs.get(name);
    if (!im) {
      im = new Image();
      const loaded = im;
      im.onload = () => {
        this.boxes.set(name, trimBox(loaded));
        this.dirty = true;
      };
      im.src = import.meta.env.BASE_URL + SRC(name);
      this.imgs.set(name, im);
    }
    return im.complete && im.naturalWidth ? im : null;
  }

  /** A picture drawn over a whole cell (its transparent margin cut off). */
  private drawFull(name: string, x: number, y: number, size: number, alpha = 1, inset = 0): void {
    const im = this.img(name);
    const b = this.boxes.get(name);
    if (!im || !b) return;
    const g = this.g;
    g.globalAlpha = alpha;
    g.drawImage(im, b.sx, b.sy, b.sw, b.sh, x + inset, y + inset, size - inset * 2, size - inset * 2);
    g.globalAlpha = 1;
  }

  private drawStone(x: number, y: number, size: number, alpha = 1): void {
    if (!this.stone) return;
    const k = size / this.geo.cell;
    const s = this.stone;
    const g = this.g;
    g.globalAlpha = alpha;
    g.drawImage(s.canvas as CanvasImageSource, x - (s.pad / this.dpr) * k, y - (s.pad / this.dpr) * k, (s.canvas.width / this.dpr) * k, (s.canvas.height / this.dpr) * k);
    g.globalAlpha = 1;
    this.drawFull('padlock', x + size * 0.2, y + size * 0.2, size * 0.6, alpha);
  }

  private newTray(now: number, forced?: Piece[]): void {
    const pieces = forced ?? this.gen.next(this.board);
    const colors = shuffledColors(pieces.length);
    this.tray = pieces.map((piece, i) => ({ piece, color: colors[i] }));
    this.enter = this.tray.map(() => ({ t0: now }));
    this.hooks.sound.play('trayin', 380);
    this.dirty = true;
    this.hooks.onMoveDone();
    this.checkFull();
  }

  private slotScale(p: Piece): number {
    const r = this.slotRects[0];
    const c = this.geo.cell;
    return Math.min(SLOT_SCALE, (r.w * 0.94) / (p.w * c), (r.h * 0.96) / (p.h * c));
  }

  /** Where the shape of a slot is in the tray (its top-left, in px) at its tray size. */
  private slotPos(i: number, p: Piece): { x: number; y: number; s: number } {
    const r = this.slotRects[i];
    const s = this.slotScale(p);
    const c = this.geo.cell * s;
    // the shapes hang close under the board: the middle of a shape is 1.25 cells under the top of the tray (a tall one starts at the top)
    return { x: r.x + (r.w - p.w * c) / 2, y: r.y + Math.max(0, this.geo.cell * 1.25 - (p.h * c) / 2), s };
  }

  private checkFull(): void {
    if (this.ended || this.locked) return;
    if (!(this.tray.every((s) => !s || !this.board.fits(s.piece)) && this.tray.some(Boolean))) return;
    if (!this.rescued) {
      this.rescue();
      return;
    }
    if (this.run) {
      this.waveClear();
      return;
    }
    this.ended = true;
    this.hooks.sound.play('gentle');
    window.setTimeout(() => this.hooks.onFull(this.score.total), 700);
    this.particles.confetti(this.W, PALETTE.map((p) => p.mid), 60);
    this.dirty = true;
  }

  /** A second full board in the journey does not end the level: a wave of confetti clears the plain blocks (the items and the obstacles stay), and the game goes on (SPEC-blocks.md 3.6). */
  private waveClear(): void {
    this.locked = true;
    this.run!.twice = true;
    this.hooks.onSay('blk_wave');
    const now = performance.now();
    const before = Array.from(this.board.cells);
    const gone = wave(this.board);
    burstOrder(gone).forEach(({ i, rank }) => this.blasts.push({ i, color: before[i], at: now + 500 + rank * 12, done: false }));
    this.hooks.sound.play('gentle');
    this.particles.confetti(this.W, PALETTE.map((p) => p.mid), 90);
    window.setTimeout(() => {
      this.locked = false;
      this.newTray(performance.now());
      this.reportGoal();
    }, 1700);
    this.dirty = true;
  }

  /** The first full board is saved by magic (SPEC-blocks.md 3.6): the fullest square of 3 x 3 bursts, with no points, and the game goes on. */
  private rescue(): void {
    this.rescued = true;
    this.locked = true;
    this.hooks.onSay('blk_idea');
    const sq = fullestSquare(this.board);
    // the items stay (the goal must still be reachable)
    const cells = sq.cells.filter((i) => this.board.item[i] < 0);
    const r0 = Math.floor(sq.square / 3) * 3;
    const c0 = (sq.square % 3) * 3;
    const mid = this.cellCenter(c0 + 1, r0 + 1);
    this.wand = { t0: performance.now(), x: mid.x, y: mid.y };
    window.setTimeout(() => {
      const now = performance.now();
      const order = burstOrder(cells);
      order.forEach(({ i, rank }) => this.blasts.push({ i, color: this.board.cells[i], at: now + FLASH_MS + rank * STAGGER_MS, done: false }));
      cells.forEach((i) => (this.board.cells[i] = -1));
      this.hooks.sound.play('fanfare');
      this.particles.confetti(this.W, PALETTE.map((p) => p.mid), 40);
      this.dirty = true;
      window.setTimeout(() => {
        this.locked = false;
        // a long shape may still not fit in the empty square: the fair generator deals a new tray in that case
        if (this.tray.every((s) => !s || !this.board.fits(s.piece))) this.newTray(performance.now());
        else this.hooks.onMoveDone();
        this.dirty = true;
      }, 900);
    }, 1400);
  }

  // ---- helpers (SPEC-blocks.md 3.5) ----

  private setMode(m: Helper | null): void {
    this.mode = m;
    this.hooks.onMode(m);
  }

  /** A helper button was pressed. */
  useHelper(h: Helper): void {
    if (this.ended || this.locked || this.drag) return;
    if (this.mode === h) return this.setMode(null);
    const why = whyNot(h, { stars: this.hooks.stars(), used: this.free, board: this.board, tray: this.tray.map((t) => t?.piece ?? null) });
    if (why) return this.hooks.onSay(why);
    this.setMode(null);
    if (h === 'swap') {
      this.charge(h);
      this.tray = [null, null, null];
      this.newTray(performance.now());
    } else {
      this.setMode(h);
      this.hooks.onSay(h === 'rotate' ? 'blk_pickShape' : 'blk_pickBlock');
    }
  }

  private charge(h: Helper): void {
    const price = priceOf(h, this.free);
    if (!price.free) this.hooks.spend(price.stars);
    this.free = { ...this.free, [h]: true };
    this.hooks.onHelpers(this.free);
    this.hooks.sound.play('streak', 600);
  }

  private tapWithHelper(x: number, y: number): boolean {
    if (this.mode === 'rotate') {
      const i = this.slotRects.findIndex((r) => x >= r.x && x < r.x + r.w);
      const slot = i >= 0 && y > this.trayTop - this.geo.cell && y < this.trayTop + this.trayH + this.geo.cell ? this.tray[i] : null;
      if (!slot) return true;
      const t = turned(slot.piece);
      if (t === slot.piece || t.id === slot.piece.id) return true;
      this.charge('rotate');
      this.tray[i] = { piece: t, color: slot.color };
      this.enter[i] = { t0: performance.now() - 150 };
      this.setMode(null);
      this.hooks.onMoveDone();
      this.dirty = true;
      return true;
    }
    if (this.mode === 'hammer') {
      const c = Math.floor((x - this.geo.x) / this.geo.cell);
      const r = Math.floor((y - this.geo.y) / this.geo.cell);
      const color = this.board.get(r, c);
      const k = hammer(this.board, r, c);
      if (k < 0) return true;
      this.charge('hammer');
      this.blasts.push({ i: k, color, at: performance.now(), done: false });
      this.setMode(null);
      this.hooks.onMoveDone();
      this.dirty = true;
      return true;
    }
    return false;
  }

  // ---- saving ----

  snapshot(): SavedGame {
    return {
      v: 1,
      savedAt: Date.now(),
      cells: Array.from(this.board.cells),
      tray: this.tray.map((t) => (t ? { id: t.piece.id, color: t.color } : null)),
      score: { total: this.score.total, streak: this.score.streak, clearedThisTray: this.score.clearedThisTray },
      gen: this.gen.snapshot(),
      rescued: this.rescued,
      free: { ...this.free },
      seed: this.seed,
      layers: { ice: Array.from(this.board.ice), crate: Array.from(this.board.crate), lock: Array.from(this.board.lock), item: Array.from(this.board.item) },
      journey: this.run && this.level ? { level: this.level.id, trays: this.run.trays, clears: this.run.clears, collected: this.run.collected, twice: this.run.twice } : undefined,
    };
  }

  private restoreSaved(sv: SavedGame): void {
    this.board = boardOf(sv);
    if (this.level && sv.journey) {
      this.run = new Run(this.level, startBoard(this.level));
      this.run.trays = sv.journey.trays;
      this.run.clears = sv.journey.clears;
      this.run.collected = sv.journey.collected;
      this.run.twice = sv.journey.twice;
    }
    this.score = new Score();
    this.score.total = sv.score.total;
    this.score.streak = sv.score.streak;
    this.score.clearedThisTray = sv.score.clearedThisTray;
    this.shownScore = sv.score.total;
    this.gen.restore(sv.gen);
    this.rescued = sv.rescued;
    this.free = sv.free;
    this.tray = sv.tray.map((t) => (t ? { piece: pieceById(t.id), color: t.color } : null));
    this.hooks.onScore(this.score.total, this.score.multiplier, this.score.streak);
    this.hooks.onHelpers(this.free);
    this.reportGoal();
    if (this.tray.every((t) => !t)) this.newTray(performance.now());
    else this.checkFull();
    this.dirty = true;
  }

  // ---- the finger ----

  private pt(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private onDown = (e: PointerEvent): void => {
    if (this.drag || this.ended || this.locked) return;
    const { x, y } = this.pt(e);
    if (this.mode && this.tapWithHelper(x, y)) return;
    // the whole third of the tray is the touch area of a shape, not only its blocks (and the half cell above it)
    const i = this.slotRects.findIndex((r) => x >= r.x && x < r.x + r.w && y >= r.y - this.geo.cell * 0.5 && y < r.y + r.h + this.geo.cell * 0.4);
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
    else {
      this.bumpObstacles(d, slot);
      this.sendBack(d, slot);
    }
  };

  private onCancel = (): void => {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    this.sendBack(d, this.tray[d.slot]!);
  };

  /** A shape let down on obstacles does not stay: the obstacles it would have covered jump a little. */
  private bumpObstacles(d: Drag, slot: Slot): void {
    const a = floatingAnchor(this.geo, slot.piece, d.px, d.py);
    const r0 = Math.round(a.r);
    const c0 = Math.round(a.c);
    const now = performance.now();
    for (const [dr, dc] of slot.piece.cells) {
      const r = r0 + dr;
      const c = c0 + dc;
      if (r < 0 || c < 0 || r >= N || c >= N) continue;
      const i = idx(r, c);
      if (this.board.crate[i] || this.board.lock[i] || this.board.ice[i]) this.bounce[i] = now;
    }
    this.dirty = true;
  }

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
    const itemBefore = Array.from(this.board.item);
    const lockBefore = Array.from(this.board.lock);
    const clears = this.board.clearFull();
    this.run?.onClears(clears);
    const empty = this.board.isEmpty;
    const res = this.score.move(cells.length, clears.units, empty);
    if (clears.units > 0) {
      const order = burstOrder(clears.cells);
      order.forEach(({ i: k, rank }) => this.blasts.push({ i: k, color: before[k] >= 0 ? before[k] : colorAt(k), at: now + FLASH_MS + rank * STAGGER_MS, done: false, item: itemBefore[k], kind: lockBefore[k] ? 'lock' : undefined }));
      this.obstacleFx(clears.events, now + FLASH_MS + order.length * STAGGER_MS * 0.5);
      const p = this.cellCenter(c + slot.piece.w / 2 - 0.5 + 0.5 - 0.5, r);
      this.hooks.onGain(res.total, p.x, p.y, clears.units >= 2);
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
      this.hooks.onGain(res.total, p.x, p.y, false);
    }
    this.hooks.onScore(this.score.total, this.score.multiplier, this.score.streak);
    this.reportGoal();
    if (this.run && !this.finishing && this.run.view(this.board, this.score.total).done) {
      this.finish(now);
      return;
    }
    if (this.tray.every((s) => !s)) {
      if (this.run) this.run.trays++;
      this.score.endTray();
      this.hooks.onScore(this.score.total, this.score.multiplier, this.score.streak);
      this.nextTrayAt = now + 380;
    } else this.checkFull();
    if (!this.tray.every((s) => !s)) this.hooks.onMoveDone();
    this.dirty = true;
  }

  /** The ice that cracks or breaks and the crates that fall apart. */
  private obstacleFx(ev: import('./board').ClearEvents | undefined, at: number): void {
    if (!ev) return;
    ev.iceCracked.forEach((i) => {
      const p = this.cellCenter(i % N, Math.floor(i / N));
      window.setTimeout(() => this.particles.burst(p.x, p.y, '#bfe9ff', this.geo.cell, 5), Math.max(0, at - performance.now()));
    });
    ev.crates.forEach((i) => this.blasts.push({ i, color: -1, at: at + 120, done: false, kind: 'crate' }));
  }

  /** The goal is reached: a celebration, and then the end-of-level window. */
  private finish(now: number): void {
    this.finishing = true;
    this.locked = true;
    this.hooks.sound.play('fanfare');
    this.particles.confetti(this.W, PALETTE.map((p) => p.mid), 80);
    const stars = this.run!.stars(STAR_TARGETS[this.level!.id]);
    window.setTimeout(() => this.hooks.onLevelDone({ stars, trays: this.run!.trays, score: this.score.total }), 1500);
    void now;
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
    return !!this.drag || this.returning.length > 0 || this.blasts.length > 0 || this.particles.count > 0 || this.flies.length > 0 || !!this.wand || this.handShown() || this.enter.some((e) => e && t - e.t0 < 900) || Math.abs(this.shownScore - this.score.total) > 0.5 || t - this.cleanedAt < 1200 || t < this.nextTrayAt + 10 || this.nextTrayAt > 0;
  }

  private step(t: number, dt: number): void {
    // the blocks that burst: each at its time, with a bit of jelly and a pop
    let k = 0;
    for (const b of this.blasts) {
      if (!b.done && t >= b.at) {
        b.done = true;
        const p = this.cellCenter(b.i % N, Math.floor(b.i / N));
        const col = b.kind === 'crate' ? '#c98a45' : b.kind === 'ice' ? '#bfe9ff' : b.kind === 'lock' ? '#f2c94c' : PALETTE[Math.max(0, b.color) % COLORS].mid;
        this.particles.burst(p.x, p.y, col, this.geo.cell, this.reduced ? 3 : 7);
        if (b.item !== undefined && b.item >= 0) this.flies.push({ x: p.x, y: p.y, item: b.item, t0: t });
        this.hooks.sound.play('blast', 420 * Math.pow(2, Math.min(k, 14) / 12));
        k++;
      }
    }
    this.blasts = this.blasts.filter((b) => t < b.at + 260);
    this.flies = this.flies.filter((f) => t - f.t0 < 700);
    if (this.wand && t - this.wand.t0 > 2300) this.wand = null;
    if (this.wand && t - this.lastWandSpark > 90) {
      this.lastWandSpark = t;
      this.particles.burst(this.wand.x + this.geo.cell * 1.1, this.wand.y - this.geo.cell * 0.9, '#ffe36a', this.geo.cell * 0.7, 3);
    }
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
        this.spriteAt(v, bx + c * cell, by + r * cell + this.lift(idx(r, c), t), cell, 1, sq);
      }
    }

    this.drawLayers(t);

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
        this.spriteAt(slotD.color, x, y, cell, 0.4);
        // the ghost: the colour of the shape at 40%, with a dashed white outline (the blocks that burst are tinted, not dashed)
        g.setLineDash([cell * 0.14, cell * 0.1]);
        g.strokeStyle = '#fff';
        g.lineWidth = 2.5;
        g.beginPath();
        g.roundRect(x + 2, y + 2, cell - 4, cell - 4, cell * 0.22);
        g.stroke();
        g.setLineDash([]);
      }
    }

    // blocks that are bursting: a white flash, then they swell and vanish
    for (const b of this.blasts) {
      const r = Math.floor(b.i / N);
      const c = b.i % N;
      const x = bx + c * cell;
      const y = by + r * cell;
      const k = t < b.at ? 0 : (t - b.at) / 260;
      const grow = 1 + 0.25 * k;
      const alpha = 1 - k;
      if (b.kind) {
        const sz = cell * grow;
        const o = (cell * (grow - 1)) / 2;
        if (b.kind === 'lock') this.drawStone(x - o, y - o, sz, alpha);
        else this.drawFull(b.kind, x - o, y - o, sz, alpha);
        continue;
      }
      if (t < b.at) {
        this.spriteAt(b.color, x, y, cell);
        const f = Math.max(0, 1 - (b.at - t) / FLASH_MS);
        g.fillStyle = `rgba(255, 255, 255, ${0.15 + f * 0.7})`;
        g.beginPath();
        g.roundRect(x + 1, y + 1, cell - 2, cell - 2, cell * 0.24);
        g.fill();
        if (b.item !== undefined && b.item >= 0) this.drawItem(b.item, x, y);
      } else {
        this.spriteAt(b.color, x, y, cell * grow, alpha);
      }
    }

    // the items that fly to the goal
    const to = this.hooks.goalPos();
    for (const f of this.flies) {
      const k = ease((t - f.t0) / 650);
      const tx = to?.x ?? this.W / 2;
      const ty = to?.y ?? 0;
      const x = f.x + (tx - f.x) * k;
      const y = f.y + (ty - f.y) * k - Math.sin(k * Math.PI) * cell * 1.5;
      const im = this.img(ITEMS[f.item]);
      if (im) g.drawImage(im, x - cell * 0.5 * (1 - 0.4 * k), y - cell * 0.5 * (1 - 0.4 * k), cell * (1 - 0.4 * k), cell * (1 - 0.4 * k));
    }

    this.drawTray(t);
    this.particles.draw(g);
    this.drawWand(t);
    this.drawHand(t);
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

  /** How far an obstacle that was bumped is lifted (px). */
  private lift(i: number, t: number): number {
    const k = (t - this.bounce[i]) / 360;
    return k >= 0 && k < 1 ? -Math.sin(k * Math.PI) * this.geo.cell * 0.22 : 0;
  }

  /** Ice, crates, chains and items lie over the cells; each obstacle fills its whole cell. */
  private drawLayers(t: number): void {
    const g = this.g;
    const { x: bx, y: by, cell } = this.geo;
    for (let i = 0; i < N * N; i++) {
      const x = bx + (i % N) * cell;
      const y = by + Math.floor(i / N) * cell + this.lift(i, t);
      const b = this.board;
      if (b.lock[i]) this.drawStone(x, y, cell);
      if (b.crate[i]) this.drawFull('crate', x, y, cell);
      if (b.item[i] >= 0) this.drawItem(b.item[i], x, y);
      if (b.ice[i] > 0) {
        // the coloured block is under a layer of ice as big as the cell; after the first clear the ice is cracked
        this.drawFull('ice', x, y, cell, b.ice[i] === 2 ? 0.9 : 0.65, -cell * 0.06);
        if (b.ice[i] === 1) {
          g.strokeStyle = 'rgba(255, 255, 255, .95)';
          g.lineWidth = Math.max(2, cell * 0.06);
          g.lineCap = 'round';
          g.beginPath();
          g.moveTo(x + cell * 0.3, y + cell * 0.1);
          g.lineTo(x + cell * 0.45, y + cell * 0.4);
          g.lineTo(x + cell * 0.32, y + cell * 0.6);
          g.lineTo(x + cell * 0.55, y + cell * 0.9);
          g.moveTo(x + cell * 0.45, y + cell * 0.4);
          g.lineTo(x + cell * 0.8, y + cell * 0.5);
          g.stroke();
        }
      }
    }
  }

  /** An item (candy, ladybug...) on a block. */
  private drawItem(item: number, x: number, y: number): void {
    const im = this.img(ITEMS[item]);
    const cell = this.geo.cell;
    const g = this.g;
    g.fillStyle = 'rgba(255, 255, 255, .55)';
    g.beginPath();
    g.arc(x + cell / 2, y + cell / 2, cell * 0.38, 0, Math.PI * 2);
    g.fill();
    if (im) g.drawImage(im, x + cell * 0.1, y + cell * 0.1, cell * 0.8, cell * 0.8);
  }

  // ---- the hand of the lessons (SPEC-blocks.md 3.7) ----

  /** The hand shows while a lesson waits for its first move. */
  private handShown(): boolean {
    return !!this.level?.tutorial && !this.drag && !this.finishing && !this.locked && !!this.tray[0];
  }

  private drawHand(t: number): void {
    if (!this.handShown() || !this.level?.forced) return;
    const p = pieceByArt(this.level.forced[0]);
    const goal = this.board.placements(p).find(([r, c]) => this.board.preview(p, r, c).units > 0);
    if (!goal) return;
    const g = this.g;
    const cell = this.geo.cell;
    const home = this.slotPos(0, p);
    const from = { x: home.x + (p.w * cell * home.s) / 2, y: home.y + (p.h * cell * home.s) / 2 };
    const to = { x: this.geo.x + (goal[1] + p.w / 2) * cell, y: this.geo.y + (goal[0] + p.h / 2) * cell };
    const T = 2800;
    const k = (t % T) / T;
    const move = k < 0.12 ? 0 : k < 0.62 ? ease((k - 0.12) / 0.5) : 1;
    const x = from.x + (to.x - from.x) * move;
    const y = from.y + (to.y - from.y) * move;
    const s = home.s + (1 - home.s) * move;
    // the shape is carried from the tray to its place, floating over the finger like in a real drag
    if (k >= 0.12) {
      g.save();
      g.globalAlpha = (k > 0.9 ? 1 - (k - 0.9) * 10 : 1) * 0.7;
      this.drawPiece({ piece: p, color: 4 }, x - (p.w * cell * s) / 2, y - (p.h * cell * s) / 2, s, 1);
      g.restore();
    }
    g.font = `${Math.round(cell * 1.5)}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.globalAlpha = k > 0.9 ? 1 - (k - 0.9) * 10 : 1;
    const tap = k < 0.12 || (k >= 0.62 && k < 0.9) ? Math.sin(k * 60) * cell * 0.07 : 0;
    g.fillText('👆', x, y + (p.h / 2 + 1.5) * cell * s + cell * 0.6 + tap);
    g.globalAlpha = 1;
  }

  /** The wand of the rescue: it waves over the square that is about to burst. */
  private drawWand(t: number): void {
    if (!this.wand) return;
    const im = this.img('wand');
    if (!im) return;
    const g = this.g;
    const cell = this.geo.cell;
    const k = (t - this.wand.t0) / 2300;
    g.save();
    g.globalAlpha = k > 0.8 ? (1 - k) * 5 : Math.min(1, k * 6);
    // the star of the wand is over the middle of the square
    g.translate(this.wand.x + cell * 0.4, this.wand.y + cell * 0.5);
    g.rotate(Math.sin(t / 90) * 0.3);
    const s = cell * 2.8;
    g.drawImage(im, -s * 0.5, -s * 0.5, s, s);
    g.restore();
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
      if (i === 0 && this.handShown()) {
        // the right shape of the lesson blinks gently
        const k = 1 + 0.1 * Math.sin(t / 170);
        const c = this.geo.cell * home.s;
        const w = slot.piece.w * c;
        const h = slot.piece.h * c;
        this.g.save();
        this.g.shadowColor = 'rgba(255, 255, 255, .95)';
        this.g.shadowBlur = this.geo.cell * (0.35 + 0.3 * Math.sin(t / 170));
        this.drawPiece(slot, home.x + (w * (1 - k)) / 2, y + (h * (1 - k)) / 2, home.s * k, 1);
        this.g.restore();
      } else this.drawPiece(slot, home.x, y, home.s, fits ? 1 : 0.4);
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

/** The box of a picture that holds its pixels (not the transparent margin). */
function trimBox(im: HTMLImageElement): { sx: number; sy: number; sw: number; sh: number } {
  const w = im.naturalWidth;
  const h = im.naturalHeight;
  try {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d')!;
    g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 <= x0 || y1 <= y0) return { sx: 0, sy: 0, sw: w, sh: h };
    // square, so that the picture is not stretched
    const side = Math.max(x1 - x0 + 1, y1 - y0 + 1);
    const cx = (x0 + x1 + 1) / 2;
    const cy = (y0 + y1 + 1) / 2;
    return { sx: Math.max(0, cx - side / 2), sy: Math.max(0, cy - side / 2), sw: Math.min(side, w), sh: Math.min(side, h) };
  } catch {
    return { sx: 0, sy: 0, sw: w, sh: h };
  }
}
