import type { Piece } from './pieces';

/** The 9 x 9 board with its nine 3 x 3 squares (SPEC-blocks.md section 1). Pure: no DOM, no timers. A cell holds a colour (0-6) or -1 when it is empty. */
export const N = 9;
export const COLORS = 7;
export const EMPTY = -1;
export const idx = (r: number, c: number): number => r * N + c;
export const squareOf = (r: number, c: number): number => Math.floor(r / 3) * 3 + Math.floor(c / 3);

export interface Clears { rows: number[]; cols: number[]; squares: number[]; /** the cells that go, each once */ cells: number[]; /** rows + columns + squares that are full */ units: number }
export const NO_CLEARS: Clears = { rows: [], cols: [], squares: [], cells: [], units: 0 };

export class Board {
  cells: Int8Array;
  constructor(cells?: ArrayLike<number>) {
    this.cells = new Int8Array(N * N).fill(EMPTY);
    if (cells) this.cells.set(cells as ArrayLike<number>);
  }
  clone(): Board {
    return new Board(this.cells);
  }
  get = (r: number, c: number): number => this.cells[idx(r, c)];
  get filled(): number {
    return this.cells.reduce((a, v) => a + (v !== EMPTY ? 1 : 0), 0);
  }
  get fullness(): number {
    return this.filled / (N * N);
  }
  get isEmpty(): boolean {
    return this.filled === 0;
  }

  canPlace(p: Piece, r: number, c: number): boolean {
    if (r < 0 || c < 0 || r + p.h > N || c + p.w > N) return false;
    return p.cells.every(([dr, dc]) => this.cells[idx(r + dr, c + dc)] === EMPTY);
  }
  /** Puts the shape down (the caller checked canPlace). Returns the cells that were filled. */
  place(p: Piece, r: number, c: number, color: number): number[] {
    return p.cells.map(([dr, dc]) => {
      const i = idx(r + dr, c + dc);
      this.cells[i] = color;
      return i;
    });
  }
  /** Is there any place for the shape? */
  fits(p: Piece): boolean {
    for (let r = 0; r + p.h <= N; r++) for (let c = 0; c + p.w <= N; c++) if (this.canPlace(p, r, c)) return true;
    return false;
  }
  /** Every place where the shape fits. */
  placements(p: Piece): [number, number][] {
    const out: [number, number][] = [];
    for (let r = 0; r + p.h <= N; r++) for (let c = 0; c + p.w <= N; c++) if (this.canPlace(p, r, c)) out.push([r, c]);
    return out;
  }

  /** The full rows, columns and squares of the board as it is. */
  fullUnits(): Clears {
    const rows: number[] = [];
    const cols: number[] = [];
    const squares: number[] = [];
    for (let i = 0; i < N; i++) {
      if (Array.from({ length: N }, (_, c) => this.get(i, c)).every((v) => v !== EMPTY)) rows.push(i);
      if (Array.from({ length: N }, (_, r) => this.get(r, i)).every((v) => v !== EMPTY)) cols.push(i);
      const r0 = Math.floor(i / 3) * 3;
      const c0 = (i % 3) * 3;
      let all = true;
      for (let r = r0; r < r0 + 3 && all; r++) for (let c = c0; c < c0 + 3; c++) if (this.get(r, c) === EMPTY) { all = false; break; }
      if (all) squares.push(i);
    }
    const set = new Set<number>();
    rows.forEach((r) => { for (let c = 0; c < N; c++) set.add(idx(r, c)); });
    cols.forEach((c) => { for (let r = 0; r < N; r++) set.add(idx(r, c)); });
    squares.forEach((s) => { const r0 = Math.floor(s / 3) * 3; const c0 = (s % 3) * 3; for (let r = r0; r < r0 + 3; r++) for (let c = c0; c < c0 + 3; c++) set.add(idx(r, c)); });
    return { rows, cols, squares, cells: [...set].sort((a, b) => a - b), units: rows.length + cols.length + squares.length };
  }

  /** What would burst if the shape were put down here (the board is not changed): for the preview while dragging. */
  preview(p: Piece, r: number, c: number): Clears {
    if (!this.canPlace(p, r, c)) return NO_CLEARS;
    const b = this.clone();
    b.place(p, r, c, 0);
    return b.fullUnits();
  }

  /** Takes the full units off the board. Returns what went. */
  clearFull(): Clears {
    const c = this.fullUnits();
    c.cells.forEach((i) => (this.cells[i] = EMPTY));
    return c;
  }

  /** The cells of the nine squares: how full each one is (for the rescue: the fullest 3 x 3 square). */
  squareFill(): number[] {
    return Array.from({ length: 9 }, (_, s) => {
      const r0 = Math.floor(s / 3) * 3;
      const c0 = (s % 3) * 3;
      let n = 0;
      for (let r = r0; r < r0 + 3; r++) for (let c = c0; c < c0 + 3; c++) if (this.get(r, c) !== EMPTY) n++;
      return n;
    });
  }
}

/** The order in which cleared cells burst: from the middle of what is cleared and outwards (SPEC 2.5). Returns the cells with the rank of each. */
export function burstOrder(cells: number[]): { i: number; rank: number }[] {
  if (!cells.length) return [];
  const cr = cells.reduce((a, i) => a + Math.floor(i / N), 0) / cells.length;
  const cc = cells.reduce((a, i) => a + (i % N), 0) / cells.length;
  return cells
    .map((i) => ({ i, d: Math.hypot(Math.floor(i / N) - cr, (i % N) - cc) }))
    .sort((a, b) => a.d - b.d)
    .map((x, rank) => ({ i: x.i, rank }));
}
