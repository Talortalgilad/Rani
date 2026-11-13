import { describe, expect, it } from 'vitest';
import { Board } from './board';
import { LEVELS, WORLDS, pieceByArt, worldOf } from './levels';
import { Run, startBoard, wave, itemIndex } from './journey';

describe('the journey: levels', () => {
  it('has 4 worlds of 15 levels, 60 in all, with the curve of SPEC 4.3 and a boss at the end of each world', () => {
    expect(LEVELS).toHaveLength(60);
    for (const w of WORLDS) {
      const l = LEVELS.filter((x) => x.world === w.id);
      expect(l).toHaveLength(15);
      expect(l[14].boss).toBe(true);
      expect(l.slice(0, 5).every((x) => x.hard === 1)).toBe(true);
      expect(l.filter((x) => x.hard === 3).map((x) => x.n)).toEqual([9, 14, 15]);
    }
  });

  it('every start board is legal: nothing starts full, there are enough items for the goal, and the obstacles of the world are there', () => {
    for (const l of LEVELS) {
      const b = startBoard(l);
      expect(b.fullUnits().units, `level ${l.id} starts full`).toBe(0);
      if (l.goal.kind === 'collect') {
        const idx = itemIndex(l.goal.item);
        expect(b.item.filter((i) => i === idx).length, `items of level ${l.id}`).toBeGreaterThanOrEqual(l.goal.target);
      }
      if (l.goal.kind === 'obstacles') expect(b.obstacles, `obstacles of level ${l.id}`).toBeGreaterThan(0);
      if (l.world === 1) expect(b.obstacles).toBe(0);
    }
  });

  it('the three lessons are one move from a clear: a row, a column, then a square', () => {
    const lessons = LEVELS.slice(0, 3);
    expect(lessons.map((l) => l.tutorial)).toEqual(['row', 'col', 'square']);
    for (const l of lessons) {
      const b = startBoard(l);
      const p = pieceByArt(l.forced![0]);
      expect(b.placements(p).some(([r, c]) => b.preview(p, r, c).units === 1), `lesson ${l.id}`).toBe(true);
    }
  });
});

describe('obstacles', () => {
  const clearRow = (b: Board, r: number): void => { for (let c = 0; c < 9; c++) if (!b.lock[r * 9 + c] && !b.crate[r * 9 + c]) b.cells[r * 9 + c] = 1; };

  it('ice needs two clears and cracks after the first', () => {
    const b = new Board();
    b.ice[4 * 9 + 2] = 2;
    clearRow(b, 4);
    let c = b.clearFull();
    expect(c.events!.iceCracked).toEqual([4 * 9 + 2]);
    expect(b.ice[4 * 9 + 2]).toBe(1);
    clearRow(b, 4);
    c = b.clearFull();
    expect(c.events!.iceBroken).toEqual([4 * 9 + 2]);
    expect(b.obstacles).toBe(0);
  });

  it('a crate cannot be filled, does not count as full, and falls apart when a cleared row touches it', () => {
    const b = new Board();
    b.crate[5 * 9 + 3] = 1;
    clearRow(b, 4);
    expect(b.fullUnits().units).toBe(1);
    expect(b.canPlace(pieceByArt(['#']), 5, 3)).toBe(false);
    const c = b.clearFull();
    expect(c.events!.crates).toEqual([5 * 9 + 3]);
    expect(b.crate[5 * 9 + 3]).toBe(0);
    // a crate in the row itself keeps the row from being full
    const d = new Board();
    d.crate[4 * 9 + 3] = 1;
    clearRow(d, 4);
    expect(d.fullUnits().units).toBe(0);
  });

  it('a chain blocks its cell, counts as full, and is freed when its row is cleared', () => {
    const b = new Board();
    b.lock[4 * 9 + 6] = 1;
    expect(b.canPlace(pieceByArt(['#']), 4, 6)).toBe(false);
    clearRow(b, 4);
    const c = b.clearFull();
    expect(c.units).toBe(1);
    expect(c.events!.unlocked).toEqual([4 * 9 + 6]);
    expect(b.lock[4 * 9 + 6]).toBe(0);
  });
});

describe('goals and stars', () => {
  it('an item on a block flies to the counter when its row is cleared; the run counts it', () => {
    const l = LEVELS.find((x) => x.goal.kind === 'collect' && x.world === 1)!;
    const b = new Board();
    const run = new Run(l, b);
    b.item[4 * 9] = itemIndex('candy');
    for (let c = 0; c < 9; c++) b.cells[4 * 9 + c] = 2;
    run.onClears(b.clearFull());
    expect(run.collected).toBe(1);
    expect(run.view(b, 0).cur).toBe(1);
  });

  it('the obstacle goal is done when none is left', () => {
    const l = LEVELS.find((x) => x.goal.kind === 'obstacles')!;
    const b = new Board();
    b.crate[10] = 1;
    b.ice[20] = 2;
    const run = new Run(l, b);
    expect(run.view(b, 0)).toEqual({ cur: 0, target: 3, done: false });
    b.crate[10] = 0;
    b.ice[20] = 0;
    expect(run.view(b, 0).done).toBe(true);
  });

  it('stars follow the trays used; a level whose board filled twice gives one star; a level never fails', () => {
    const l = LEVELS[3];
    const run = new Run(l, new Board());
    const t = { three: 5, two: 9 };
    run.trays = 5;
    expect(run.stars(t)).toBe(3);
    run.trays = 9;
    expect(run.stars(t)).toBe(2);
    run.trays = 30;
    expect(run.stars(t)).toBe(1);
    run.trays = 2;
    run.twice = true;
    expect(run.stars(t)).toBe(1);
  });

  it('the wave after a second full board keeps the items and the obstacles, so that the goal can still be reached', () => {
    const b = new Board();
    b.cells.fill(1);
    b.item[7] = 0;
    b.crate[9] = 1;
    b.cells[9] = -1;
    wave(b);
    expect(b.filled).toBe(1);
    expect(b.item[7]).toBe(0);
    expect(b.crate[9]).toBe(1);
    expect(worldOf(1).name).toBeTruthy();
  });
});

import { STAR_TARGETS } from './starTargets';
describe('star targets (scripts/blocks-sim.ts)', () => {
  it('every level has them, and 2 stars are always easier to get than 3', () => {
    for (const l of LEVELS) {
      const t = STAR_TARGETS[l.id];
      expect(t, `level ${l.id}`).toBeTruthy();
      expect(t.three).toBeGreaterThanOrEqual(1);
      expect(t.two).toBeGreaterThan(t.three);
    }
  });
});

import { validSaved, boardOf } from './save';
import { freshFree } from './helpers';
describe('saving a level in the middle', () => {
  it('keeps the layers (ice, crates, chains, items) and the progress of the goal', () => {
    const b = new Board();
    b.ice[3] = 1;
    b.crate[4] = 1;
    b.lock[5] = 1;
    b.item[6] = 2;
    const sv = { v: 1 as const, savedAt: Date.now(), cells: Array.from(b.cells), tray: [null, null, null], score: { total: 5, streak: 0, clearedThisTray: false }, gen: { a: 1, history: [] }, rescued: false, free: freshFree(), seed: 1, layers: { ice: Array.from(b.ice), crate: Array.from(b.crate), lock: Array.from(b.lock), item: Array.from(b.item) }, journey: { level: 6, trays: 3, clears: 2, collected: 1, twice: false } };
    const back = validSaved(JSON.parse(JSON.stringify(sv)))!;
    const b2 = boardOf(back);
    expect([b2.ice[3], b2.crate[4], b2.lock[5], b2.item[6]]).toEqual([1, 1, 1, 2]);
    expect(back.journey!.collected).toBe(1);
    expect(validSaved({ ...sv, layers: { ...sv.layers, ice: [1] } })).toBeNull();
  });
});
