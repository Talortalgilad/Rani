import type { Piece } from './pieces';

/** The 9 x 9 board with its nine 3 x 3 squares (SPEC-blocks.md section 1). Pure: no DOM, no timers. A cell holds a colour (0-6) or -1 when it is empty. */
export const N = 9;
export const COLORS = 7;
export const EMPTY = -1;
export const idx = (r: number, c: number): number => r * N + c;
export const squareOf = (r: number, c: number): number => Math.floor(r / 3) * 3 + Math.floor(c / 3);

/** What a clear did to the obstacles and the items of the journey (SPEC-blocks.md 4). */
export interface ClearEvents {
  /** the item (index in ITEMS) of every item that was freed */
  collected: number[];
  /** ice that cracked (first clear) and ice that broke (second clear): cell indexes */
  iceCracked: number[];
  iceBroken: number[];
  /** crates that fell apart, because a cleared unit touched them */
  crates: number[];
  /** chained cells that were freed */
  unlocked: number[];
}
export const noEvents = (): ClearEvents => ({ collected: [], iceCracked: [], iceBroken: [], crates: [], unlocked: [] });
export interface Clears { rows: number[]; cols: number[]; squares: number[]; /** the cells that go, each once */ cells: number[]; /** rows + columns + squares that are full */ units: number; events?: ClearEvents }
export const NO_CLEARS: Clears = { rows: [], cols: [], squares: [], cells: [], units: 0 };

export class Board {
  cells: Int8Array;
  /** the journey's layers: ice on a cell (2 = whole, 1 = cracked), crates (block the cell, never count as full), chains (block the cell, count as full), items on blocks (-1 none) */
  ice = new Uint8Array(N * N);
  crate = new Uint8Array(N * N);
  lock = new Uint8Array(N * N);
  item = new Int8Array(N * N).fill(-1);
  constructor(cells?: ArrayLike<number>) {
    this.cells = new Int8Array(N * N).fill(EMPTY);
    if (cells) this.cells.set(cells as ArrayLike<number>);
  }
  clone(): Board {
    const b = new Board(this.cells);
    b.ice.set(this.ice);
    b.crate.set(this.crate);
    b.lock.set(this.lock);
    b.item.set(this.item);
    return b;
  }
  /** A cell that counts as full for a row, a column or a square. */
  isFull = (i: number): boolean => this.cells[i] !== EMPTY || this.lock[i] === 1;
  /** Obstacles left: every ice counts by its layers, every crate and every chain once. */
  get obstacles(): number {
    let n = 0;
    for (let i = 0; i < N * N; i++) n += this.ice[i] + this.crate[i] + this.lock[i];
    return n;
  }
  get = (r: number, c: number): number => this.cells[idx(r, c)];
  get filled(): number {
    return this.cells.reduce((a, v) => a + (v !== EMPTY ? 1 : 0), 0);
  }
  get fullness(): number {
    return this.filled / (N * N);
  }
  get isEmpty(): boolean {
    return this.filled === 0 && this.obstacles === 0;
  }

  canPlace(p: Piece, r: number, c: number): boolean {
    if (r < 0 || c < 0 || r + p.h > N || c + p.w > N) return false;
    return p.cells.every(([dr, dc]) => {
      const i = idx(r + dr, c + dc);
      return this.cells[i] === EMPTY && !this.crate[i] && !this.lock[i];
    });
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
      if (Array.from({ length: N }, (_, c) => idx(i, c)).every(this.isFull)) rows.push(i);
      if (Array.from({ length: N }, (_, r) => idx(r, i)).every(this.isFull)) cols.push(i);
      const r0 = Math.floor(i / 3) * 3;
      const c0 = (i % 3) * 3;
      let all = true;
      for (let r = r0; r < r0 + 3 && all; r++) for (let c = c0; c < c0 + 3; c++) if (!this.isFull(idx(r, c))) { all = false; break; }
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
    const ev = noEvents();
    const stayed = new Set<number>();
    for (const i of c.cells) {
      // ice holds its block: the first clear only cracks the ice (the block stays), the second one frees the cell
      if (this.ice[i] === 2 && this.cells[i] !== EMPTY) {
        this.ice[i] = 1;
        ev.iceCracked.push(i);
        stayed.add(i);
        continue;
      }
      this.cells[i] = EMPTY;
      if (this.lock[i]) { this.lock[i] = 0; ev.unlocked.push(i); }
      if (this.ice[i] > 0) { this.ice[i] = 0; ev.iceBroken.push(i); }
      if (this.item[i] >= 0) { ev.collected.push(this.item[i]); this.item[i] = -1; }
    }
    if (stayed.size) c.cells = c.cells.filter((i) => !stayed.has(i));
    // a crate falls apart when a cleared cell is next to it
    if (c.cells.length) {
      const gone = new Set(c.cells);
      for (let i = 0; i < N * N; i++) {
        if (!this.crate[i]) continue;
        const r = Math.floor(i / N);
        const col = i % N;
        if ((r > 0 && gone.has(i - N)) || (r < N - 1 && gone.has(i + N)) || (col > 0 && gone.has(i - 1)) || (col < N - 1 && gone.has(i + 1))) {
          this.crate[i] = 0;
          ev.crates.push(i);
        }
      }
    }
    c.events = ev;
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
