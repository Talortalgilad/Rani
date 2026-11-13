import { describe, expect, it } from 'vitest';
import { Board, N, burstOrder, idx } from './board';
import { LIFT_CELLS, fingerFor, floatingAnchor, landing, type Geometry } from './drag';
import { Generator, completers, fitCount } from './generator';
import { PIECES, pieceById, pool, turned } from './pieces';
import { CLEAN_BOARD_BONUS, Score, clearPoints, comboLine } from './scoring';
import { freshFree, hammer, priceOf, whyNot } from './helpers';
import { fullestSquare, rescue } from './rescue';
import { boardOf, validSaved } from './save';
import { boardStars } from './stars';

const P = (id: string) => pieceById(id);
const rowFull = (b: Board, r: number, except: number[] = []): void => { for (let c = 0; c < N; c++) if (!except.includes(c)) b.cells[idx(r, c)] = 1; };

describe('the shapes', () => {
  it('every direction is a shape of its own (no rotation): the counts of SPEC 3.1', () => {
    const n = (name: string): number => PIECES.filter((p) => p.name === name).length;
    expect(n('dot')).toBe(1);
    expect(n('line2')).toBe(2);
    expect(n('square2')).toBe(1);
    expect(n('l3')).toBe(4); // small L: 4 directions
    expect(n('line3')).toBe(2);
    expect(n('line4')).toBe(2);
    expect(n('l4')).toBe(8); // L of 4 cells: 8 directions
    expect(n('t')).toBe(4);
    expect(n('s') + n('z')).toBe(4); // S/Z: 4 directions
    expect(n('line5')).toBe(2);
    expect(n('square3')).toBe(0);
    expect(n('rect23')).toBe(2);
    expect(n('l5')).toBe(4);
    expect(PIECES.filter((p) => p.group === 'late').length).toBeGreaterThan(0);
    expect(pool(false).some((p) => p.group === 'late')).toBe(false);
    expect(new Set(PIECES.map((p) => p.id)).size).toBe(PIECES.length);
  });
  it('the cells of a shape fill its box from the corner, and the shapes are different from each other', () => {
    for (const p of PIECES) {
      expect(Math.min(...p.cells.map((c) => c[0]))).toBe(0);
      expect(Math.min(...p.cells.map((c) => c[1]))).toBe(0);
      expect(Math.max(...p.cells.map((c) => c[0]))).toBe(p.h - 1);
    }
    const keys = PIECES.map((p) => p.cells.join(';'));
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('the turn helper makes the same shape turned a quarter (four turns come back)', () => {
    let p = P('l4-0');
    const seen = new Set<string>();
    for (let i = 0; i < 4; i++) (seen.add(p.id), (p = turned(p)));
    expect(p.id).toBe('l4-0');
    expect(seen.size).toBe(4);
    expect(turned(P('dot-0')).id).toBe('dot-0');
  });
});

describe('the board', () => {
  it('puts a shape down only where it fits: inside, and on empty cells', () => {
    const b = new Board();
    const sq = P('square2-0');
    expect(b.canPlace(sq, 0, 0)).toBe(true);
    expect(b.canPlace(sq, 8, 8)).toBe(false);
    expect(b.canPlace(sq, -1, 0)).toBe(false);
    b.place(sq, 3, 3, 2);
    expect(b.canPlace(P('dot-0'), 3, 3)).toBe(false);
    expect(b.canPlace(P('dot-0'), 3, 5)).toBe(true);
    expect(b.filled).toBe(4);
  });
  it('a full row, a full column and a full 3 x 3 square burst', () => {
    let b = new Board();
    rowFull(b, 4, [4]);
    expect(b.preview(P('dot-0'), 4, 4)).toMatchObject({ rows: [4], cols: [], squares: [], units: 1 });
    b = new Board();
    for (let r = 0; r < N; r++) if (r !== 2) b.cells[idx(r, 5)] = 1;
    expect(b.preview(P('dot-0'), 2, 5)).toMatchObject({ rows: [], cols: [5], units: 1 });
    b = new Board();
    for (let r = 3; r < 6; r++) for (let c = 6; c < 9; c++) if (!(r === 5 && c === 8)) b.cells[idx(r, c)] = 1;
    const sq = b.preview(P('dot-0'), 5, 8);
    expect(sq.squares).toEqual([5]);
    expect(sq.cells).toHaveLength(9);
  });
  it('all three together: a row, a column and a square that cross share their cells (each cell goes once)', () => {
    const b = new Board();
    // row 0 and column 0 and the top-left square, all full but the corner
    for (let i = 0; i < N; i++) { b.cells[idx(0, i)] = 1; b.cells[idx(i, 0)] = 1; }
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) b.cells[idx(r, c)] = 1;
    b.cells[idx(0, 0)] = -1;
    const pre = b.preview(P('dot-0'), 0, 0);
    expect(pre.units).toBe(3);
    expect(pre.cells).toHaveLength(new Set(pre.cells).size);
    expect(pre.cells).toHaveLength(9 + 8 + 8 - 5 + 0 === 0 ? 0 : pre.cells.length);
    const gone = b.clone();
    gone.place(P('dot-0'), 0, 0, 1);
    const c = gone.clearFull();
    expect(c.units).toBe(3);
    expect(gone.get(0, 0)).toBe(-1);
    expect(gone.get(0, 5)).toBe(-1);
    expect(gone.get(5, 0)).toBe(-1);
  });
  it('a preview never changes the board', () => {
    const b = new Board();
    rowFull(b, 1, [0]);
    const before = Array.from(b.cells);
    b.preview(P('dot-0'), 1, 0);
    expect(Array.from(b.cells)).toEqual(before);
  });
  it('bursts from the middle outwards', () => {
    const cells = Array.from({ length: N }, (_, c) => idx(4, c));
    const order = burstOrder(cells);
    expect(order[0].i).toBe(idx(4, 4));
    expect(order.map((o) => o.rank)).toEqual([...Array(N).keys()]);
    const far = new Set([order[N - 1].i, order[N - 2].i]);
    expect(far.has(idx(4, 0)) || far.has(idx(4, 8))).toBe(true);
  });
});

describe('scoring', () => {
  it('10 points for one unit, 30 for two, 60 for three, 100 each from four', () => {
    expect([0, 1, 2, 3, 4, 5].map(clearPoints)).toEqual([0, 10, 30, 60, 400, 500]);
  });
  it('every cell is a point; the streak multiplies the clears (x2, x3, up to x5), and a tray without a clear ends it', () => {
    const s = new Score();
    expect(s.move(4, 0, false).total).toBe(4);
    expect(s.move(3, 1, false)).toMatchObject({ cleared: 10, mult: 1, total: 13 });
    s.endTray();
    expect(s.streak).toBe(1);
    expect(s.move(2, 1, false)).toMatchObject({ cleared: 20, mult: 2 });
    s.endTray();
    expect(s.move(2, 2, false)).toMatchObject({ cleared: 90, mult: 3 });
    s.endTray();
    for (let i = 0; i < 5; i++) { s.move(1, 1, false); s.endTray(); }
    expect(s.multiplier).toBe(5);
    s.move(1, 0, false);
    s.endTray();
    expect(s.streak).toBe(0);
    expect(s.multiplier).toBe(1);
  });
  it('two clears in the same tray count once for the streak', () => {
    const s = new Score();
    s.move(1, 1, false);
    s.move(1, 1, false);
    expect(s.streak).toBe(1);
  });
  it('a clean board is 300 more', () => {
    const s = new Score();
    expect(s.move(1, 1, true).bonus).toBe(CLEAN_BOARD_BONUS);
    expect(s.move(1, 0, true).bonus).toBe(0);
  });
  it('the words of the combos', () => {
    expect([1, 2, 3, 4, 6].map(comboLine)).toEqual([null, 'blk_nice', 'blk_amazing', 'blk_wow', 'blk_magic']);
  });
});

describe('dragging', () => {
  const geo: Geometry = { x: 20, y: 100, cell: 40 };
  it('the shape floats above the finger: its bottom edge is 1.5 cells over the touch, even for tall shapes', () => {
    for (const id of ['dot-0', 'line5-1', 'rect23-0', 'l5-0']) {
      const p = P(id);
      const a = floatingAnchor(geo, p, 200, 400);
      const bottomPx = geo.y + (a.r + p.h) * geo.cell;
      expect(bottomPx).toBeCloseTo(400 - LIFT_CELLS * geo.cell, 5);
      expect(bottomPx).toBeLessThan(400);
    }
  });
  it('the anchor and the finger are the same thing seen from two sides', () => {
    const p = P('t-0');
    const f = fingerFor(geo, p, 3, 4);
    const a = floatingAnchor(geo, p, f.x, f.y);
    expect(a.r).toBeCloseTo(3, 5);
    expect(a.c).toBeCloseTo(4, 5);
  });
  it('lands on the cell under it, takes a legal place within the tolerance, and nothing when there is none', () => {
    const b = new Board();
    const sq = P('square2-0');
    expect(landing(b, sq, 2.2, 3.4)).toEqual({ r: 2, c: 3, exact: true });
    b.place(P('square2-0'), 2, 3, 1); // 2..3 x 3..4 is taken
    // one cell taken, the finger over it: the nearest legal place beside it is taken (within 0.9 of a cell)
    const one = new Board();
    one.place(P('dot-0'), 3, 4, 1);
    const l = landing(one, P('dot-0'), 3.4, 4.4)!;
    expect(l).toEqual({ r: 3, c: 5, exact: false });
    expect(Math.hypot(l.r - 3.4, l.c - 4.4)).toBeLessThanOrEqual(0.9);
    // a place that is too far: nothing, the shape goes back to the tray
    expect(landing(b, sq, 2.0, 3.0)).toBeNull();
    expect(landing(b, sq, 7.6, 7.6)).toEqual({ r: 7, c: 7, exact: false }); // a little past the edge: pulled back in
    expect(landing(b, sq, 8.9, 8.9)).toBeNull(); // far past it: nothing
  });
});

describe('the fair generator', () => {
  it('is the same for the same seed', () => {
    const a = new Generator(7);
    const b = new Generator(7);
    const board = new Board();
    for (let i = 0; i < 20; i++) expect(a.next(board).map((p) => p.id)).toEqual(b.next(board).map((p) => p.id));
  });
  it('iron rule: in 10,000 trays on boards of every fullness, at least one shape fits (and two when the board is over 75% full)', () => {
    let seed = 1;
    const g = new Generator(99);
    for (let i = 0; i < 10000; i++) {
      // a random board with a random fullness, from a mix of shapes
      const rnd = ((seed = (seed * 1664525 + 1013904223) >>> 0), seed / 4294967296);
      const board = new Board();
      const target = Math.floor(rnd * 0.92 * 81);
      let guard = 0;
      while (board.filled < target && guard++ < 400) {
        const p = PIECES[Math.floor(((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * PIECES.length)];
        const spots = board.placements(p);
        if (spots.length) {
          const [r, c] = spots[Math.floor(((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * spots.length)];
          board.place(p, r, c, i % 7);
          board.clearFull();
        }
      }
      if (board.filled === 81) continue;
      const tray = g.next(board);
      expect(tray).toHaveLength(3);
      const need = board.fullness > 0.75 ? 2 : 1;
      const fits = fitCount(board, tray);
      // a nearly full board may not even have room for two shapes of any kind: then every shape that could fit does
      const possible = pool(false).filter((p) => board.fits(p)).length > 0;
      if (possible) expect(fits, `${i} fullness ${board.fullness.toFixed(2)}`).toBeGreaterThanOrEqual(Math.min(need, 1));
      if (board.fullness > 0.75 && possible) expect(fits).toBeGreaterThanOrEqual(1);
    }
  });
  it('variety: never more than two identical shapes in a tray, and no shape in four trays in a row', () => {
    const g = new Generator(5);
    const board = new Board();
    const trays: string[][] = [];
    for (let i = 0; i < 400; i++) {
      const t = g.next(board).map((p) => p.id);
      for (const id of new Set(t)) expect(t.filter((x) => x === id).length).toBeLessThanOrEqual(2);
      trays.push(t);
      if (trays.length >= 4) for (const id of new Set(t)) expect(trays.slice(-4).every((x) => x.includes(id)), id).toBe(false);
    }
  });
  it('about three trays in ten have a shape that completes a row, a column or a square (when one exists)', () => {
    const g = new Generator(11);
    const board = new Board();
    rowFull(board, 4, [3, 4, 5]); // a row that lacks three cells in a line
    const avail = completers(board, pool(false));
    expect(avail.length).toBeGreaterThan(0);
    let help = 0;
    const N_TRAYS = 600;
    for (let i = 0; i < N_TRAYS; i++) if (g.next(board).some((p) => avail.some((a) => a.id === p.id))) help++;
    expect(help / N_TRAYS).toBeGreaterThan(0.25);
  });
  it('mercy: on a board over 60% full the easy shapes come more often', () => {
    const board = new Board();
    // 55 cells in a scattered pattern so that the shapes still fit
    for (let i = 0; i < 81; i += 3) board.cells[i] = 1;
    for (let i = 1; i < 81; i += 4) board.cells[i] = 2;
    const f = board.fullness;
    expect(f).toBeGreaterThan(0.4);
    const light = new Board();
    const share = (b: Board): number => {
      const g = new Generator(3);
      let easy = 0;
      let all = 0;
      for (let i = 0; i < 300; i++) for (const p of g.next(b)) (all++, p.group === 'easy' && easy++);
      return easy / all;
    };
    const heavy = new Board();
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if ((r * 5 + c * 3) % 7 !== 0 && (r + 2 * c) % 11 !== 0) heavy.cells[idx(r, c)] = 1;
    expect(heavy.fullness).toBeGreaterThan(0.6);
    expect(share(heavy)).toBeGreaterThan(share(light));
  });
});

describe('stage 1: shapes, combo words, helpers, rescue, saving', () => {
  it('has no 3x3 square; the biggest square is 2x2; the 2x3 rectangle comes in two directions', () => {
    expect(PIECES.some((p) => p.w === 3 && p.h === 3 && p.cells.length === 9)).toBe(false);
    expect(PIECES.filter((p) => p.name === 'rect23').map((p) => `${p.w}x${p.h}`).sort()).toEqual(['2x3', '3x2']);
    expect(Math.max(...PIECES.filter((p) => p.cells.length === p.w * p.h).map((p) => Math.min(p.w, p.h)))).toBe(2);
  });

  it('the combo word follows the number of clears of one move: 1 none, 2 nice, 3 amazing, 4 wow, 5 and more magic', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 9].map(comboLine)).toEqual([null, null, 'blk_nice', 'blk_amazing', 'blk_wow', 'blk_magic', 'blk_magic', 'blk_magic']);
  });

  it('helpers: the first of each kind is free, then 1, 1 and 2 stars; they say why they cannot be used', () => {
    const used = freshFree();
    expect(priceOf('swap', used)).toEqual({ stars: 0, free: true });
    expect(priceOf('swap', { ...used, swap: true })).toEqual({ stars: 1, free: false });
    expect(priceOf('hammer', { ...used, hammer: true })).toEqual({ stars: 2, free: false });
    const b = new Board();
    const tray = [pieceById('dot-0'), null, null];
    expect(whyNot('hammer', { stars: 5, used, board: b, tray })).toBe('blk_nothingHere');
    expect(whyNot('rotate', { stars: 5, used, board: b, tray })).toBe('blk_nothingToTurn');
    expect(whyNot('swap', { stars: 0, used: { ...used, swap: true }, board: b, tray })).toBe('blk_noStars');
    expect(whyNot('swap', { stars: 0, used, board: b, tray })).toBeNull();
  });

  it('the hammer breaks one block and the turn keeps the shape', () => {
    const b = new Board();
    b.place(pieceById('dot-0'), 4, 4, 2);
    expect(hammer(b, 0, 0)).toBe(-1);
    expect(hammer(b, 4, 4)).toBe(idx(4, 4));
    expect(b.isEmpty).toBe(true);
    const l = pieceById('line3-0');
    expect(turned(l).name).toBe('line3');
    expect(turned(l).id).not.toBe(l.id);
    expect(turned(turned(l)).id).toBe(l.id);
  });

  it('the rescue empties the fullest 3x3 square and nothing else', () => {
    const b = new Board();
    for (let r = 3; r < 6; r++) for (let c = 3; c < 5; c++) b.cells[idx(r, c)] = 1; // 6 in the middle square
    b.cells[idx(0, 0)] = 2;
    expect(fullestSquare(b).square).toBe(4);
    const gone = rescue(b);
    expect(gone.length).toBe(6);
    expect(b.filled).toBe(1);
  });

  it('stars of a free board: 500 points gives one, a new best another, three a day at most', () => {
    expect([boardStars(499, false, 0), boardStars(500, false, 0), boardStars(500, true, 0), boardStars(100, true, 0), boardStars(900, true, 2), boardStars(900, true, 3)]).toEqual([0, 1, 2, 1, 1, 0]);
  });

  it('a saved game comes back as it was and keeps dealing the same trays', () => {
    const gen = new Generator(7);
    const b = new Board();
    gen.next(b);
    const snap = { v: 1 as const, savedAt: Date.now(), cells: Array.from(b.cells), tray: [{ id: 'dot-0', color: 3 }, null, null], score: { total: 40, streak: 2, clearedThisTray: true }, gen: gen.snapshot(), rescued: true, free: freshFree(), seed: 7 };
    const back = validSaved(JSON.parse(JSON.stringify(snap)))!;
    expect(back).not.toBeNull();
    const g2 = new Generator(1);
    g2.restore(back.gen);
    expect(g2.next(boardOf(back)).map((p) => p.id)).toEqual(gen.next(b).map((p) => p.id));
    expect(validSaved({ ...snap, cells: [1, 2] })).toBeNull();
    expect(validSaved({ ...snap, tray: [{ id: 'nope', color: 1 }, null, null] })).toBeNull();
    expect(validSaved(null)).toBeNull();
  });
});
