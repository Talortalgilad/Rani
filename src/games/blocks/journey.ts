/** The journey (SPEC-blocks.md 4): goals, the progress of a level and its stars. Pure. */
import { Board, N, idx, type Clears } from './board';
import { mulberry } from './generator';

export const ITEMS = ['candy', 'ladybug', 'butterfly', 'paintdrop', 'star', 'gem'] as const;
export type ItemId = (typeof ITEMS)[number];
export const itemIndex = (i: ItemId): number => ITEMS.indexOf(i);

export type Goal =
  | { kind: 'score'; target: number }
  | { kind: 'clears'; target: number }
  | { kind: 'collect'; item: ItemId; target: number }
  /** every ice, crate and chain of the board */
  | { kind: 'obstacles' };

export interface Level {
  id: number;
  world: 1 | 2 | 3 | 4;
  /** 1-15 inside the world */
  n: number;
  goal: Goal;
  /** how hard it is: 1 easy, 2 medium, 3 hard ("קשה!" in purple) */
  hard: 1 | 2 | 3;
  boss?: boolean;
  seed: number;
  /** a start board drawn by hand (9 rows of 9: . empty, 0-6 a block, o an item on a block, g a gem on a block, i or I a block in ice, c crate, k chain) */
  rows?: string[];
  /** otherwise: a scattered start board */
  gen?: { density: number; items: number; ice: number; crates: number; locks: number };
  /** the shapes of the first tray (the tutorial), as drawn: rows of # */
  forced?: string[][];
  tutorial?: 'row' | 'col' | 'square';
}

/** The star targets (trays used): 3 stars up to `three`, 2 up to `two`, and always one. Computed by scripts/blocks-sim.ts. */
export interface StarTarget { three: number; two: number }

export interface GoalView { cur: number; target: number; done: boolean }

/** Builds the start board of a level. */
export function startBoard(level: Level): Board {
  const b = new Board();
  const rnd = mulberry(level.seed);
  const goalItem = level.goal.kind === 'collect' ? itemIndex(level.goal.item) : 0;
  const put = (i: number, ch: string): void => {
    if (ch >= '0' && ch <= '6') b.cells[i] = Number(ch);
    else if (ch === 'o' || ch === 'g') {
      b.cells[i] = Math.floor(rnd() * 7);
      b.item[i] = ch === 'g' ? itemIndex('gem') : goalItem;
    } else if (ch === 'i' || ch === 'I') {
      b.cells[i] = Math.floor(rnd() * 7);
      b.ice[i] = 2;
    } else if (ch === 'c') b.crate[i] = 1;
    else if (ch === 'k') b.lock[i] = 1;
  };
  if (level.rows) level.rows.forEach((row, r) => [...row].forEach((ch, c) => put(idx(r, c), ch)));
  else if (level.gen) scatter(b, level, rnd);
  return b;
}

/** A scattered board: blocks, then items on blocks, then obstacles on empty cells; no row, column or square starts full. */
function scatter(b: Board, level: Level, rnd: () => number): void {
  const g = level.gen!;
  const cells = Array.from({ length: N * N }, (_, i) => i).sort(() => rnd() - 0.5);
  const blocks = Math.round(g.density * N * N);
  let k = 0;
  const take = (): number => cells[k++];
  for (let n = 0; n < blocks; n++) b.cells[take()] = Math.floor(rnd() * 7);
  const goalItem = level.goal.kind === 'collect' ? itemIndex(level.goal.item) : 0;
  for (let n = 0; n < g.items; n++) {
    const i = take();
    b.cells[i] = Math.floor(rnd() * 7);
    b.item[i] = goalItem;
  }
  for (let n = 0; n < g.ice; n++) {
    // ice always holds a coloured block
    const i = take();
    b.cells[i] = Math.floor(rnd() * 7);
    b.ice[i] = 2;
  }
  for (let n = 0; n < g.crates; n++) b.crate[take()] = 1;
  for (let n = 0; n < g.locks; n++) b.lock[take()] = 1;
  // nothing may start full: take a plain block off a full unit
  for (let guard = 0; guard < 40; guard++) {
    const f = b.fullUnits();
    if (!f.units) break;
    const plain = f.cells.find((i) => b.cells[i] !== -1 && b.item[i] < 0);
    if (plain === undefined) break;
    b.cells[plain] = -1;
  }
}

/** The state of a level that is being played. */
export class Run {
  /** trays dealt so far, the one on the table included */
  trays = 1;
  clears = 0;
  collected = 0;
  /** the board was full twice: the level is finished with one star at most (SPEC-blocks.md 3.6) */
  twice = false;
  readonly obstaclesAtStart: number;
  constructor(public level: Level, board: Board) {
    this.obstaclesAtStart = board.obstacles;
  }

  /** The result of a move: units that were cleared and the items that were freed. */
  onClears(c: Clears): void {
    this.clears += c.units;
    const g = this.level.goal;
    if (g.kind === 'collect' && c.events) this.collected += c.events.collected.filter((i) => i === itemIndex(g.item)).length;
  }

  view(board: Board, score: number): GoalView {
    const g = this.level.goal;
    switch (g.kind) {
      case 'score': return { cur: Math.min(score, g.target), target: g.target, done: score >= g.target };
      case 'clears': return { cur: Math.min(this.clears, g.target), target: g.target, done: this.clears >= g.target };
      case 'collect': return { cur: Math.min(this.collected, g.target), target: g.target, done: this.collected >= g.target };
      case 'obstacles': {
        const total = this.obstaclesAtStart;
        const left = board.obstacles;
        return { cur: total - left, target: total, done: left === 0 };
      }
    }
  }

  /** 3 stars up to `three` trays, 2 up to `two`, otherwise 1; a level where the board filled up twice gives one. */
  stars(t: StarTarget | undefined): 1 | 2 | 3 {
    if (this.twice || !t) return 1;
    return this.trays <= t.three ? 3 : this.trays <= t.two ? 2 : 1;
  }
}

/** After the wave of a second full board: plain blocks go, the items, the obstacles and the ice stay, so that the goal can still be reached. */
export function wave(board: Board): number[] {
  const gone: number[] = [];
  for (let i = 0; i < N * N; i++) {
    if (board.cells[i] !== -1 && board.item[i] < 0) {
      board.cells[i] = -1;
      gone.push(i);
    }
  }
  return gone;
}
