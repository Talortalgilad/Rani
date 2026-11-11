import { describe, expect, it } from 'vitest';
import { replay, densityOf, angledShare } from '../engine/analyze';
import { sameDirectionClusters, type Item } from '../engine/packing';
import { isHard, paramsFor } from '../engine/generator';
import { overlaps } from '../engine/geometry';
import { Solver } from '../engine/solver';
import { boxOf } from '../engine/solver-types';
import { SIZES } from '../engine/state';
import { ALL_LEVELS, NUMBERED_LEVELS, levelByKey, nextLevel } from './index';

describe('the 30 levels of the city world', () => {
  it('there are 30, numbered 1 to 30, after five tutorial levels', () => {
    expect(NUMBERED_LEVELS.map((l) => l.number)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    expect(ALL_LEVELS.slice(0, 5).map((l) => l.key)).toEqual(['t1', 't2', 't3', 't4', 't5']);
    expect(nextLevel('t5')!.key).toBe('1');
    expect(nextLevel('30')).toBeNull();
    expect(levelByKey('17')!.number).toBe(17);
  });
  it('every fifth level is "very hard"', () => {
    for (const l of NUMBERED_LEVELS) expect(l.hard).toBe(isHard(l.number));
  });
  for (const l of NUMBERED_LEVELS) {
    describe(`level ${l.number}`, () => {
      const p = paramsFor(l.number);
      it('can be solved without helpers (the saved solution plays through the engine)', () => {
        expect(l.stats!.exact).toBe(true);
        expect(replay(l, l.stats!.solution).won).toBe(true);
      });
      it('is dense enough, and the numbers saved with it are true', () => {
        const d = densityOf(l);
        expect(d).toBeGreaterThanOrEqual(l.hard ? 0.7 : 0.65);
        expect(Math.abs(d - l.stats!.density)).toBeLessThan(0.001);
        expect(l.vehicles.length).toBe(l.stats!.vehicles);
        expect(l.queue.length).toBe(l.vehicles.reduce((n, v) => n + SIZES[v.type].seats, 0));
      });
      it('has at least 30% of the vehicles at 45 degrees from level 10', () => {
        if (l.number >= 10) expect(angledShare(l.vehicles)).toBeGreaterThanOrEqual(0.3);
      });
      it('has no two vehicles on top of each other, and all are inside the lot', () => {
        const boxes = l.vehicles.map(boxOf);
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlaps(boxes[i], boxes[j], 0.01), `${l.vehicles[i].id}/${l.vehicles[j].id}`).toBe(false);
        for (const b of boxes) for (const c of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          const u = { x: Math.cos((b.heading * Math.PI) / 180), z: Math.sin((b.heading * Math.PI) / 180) };
          const x = b.x + u.x * b.hl * c[0] - u.z * b.hw * c[1];
          const z = b.z + u.z * b.hl * c[0] + u.x * b.hw * c[1];
          expect(Math.abs(x)).toBeLessThanOrEqual(l.lot.halfW + 1e-6);
          expect(Math.abs(z)).toBeLessThanOrEqual(l.lot.halfH + 1e-6);
        }
      });
      it('mixes the directions: no more than 3 neighbours lie the same way', () => {
        const cls = (h: number): number => ({ 0: 0, 90: 1, 45: 2, 135: 3 } as Record<number, number>)[h % 180];
        const items: Item[] = l.vehicles.map((v) => ({ type: v.type, cls: cls(v.heading), x: v.x, z: v.z }));
        const groups = sameDirectionClusters(items, 0.15);
        expect(Math.max(...groups.map((g) => g.length))).toBeLessThanOrEqual(3);
        // and all four directions are in use from level 10, horizontal and vertical before
        const used = new Set(items.map((q) => q.cls));
        expect(used.has(0) && used.has(1)).toBe(true);
        if (l.number >= 10) expect(used.size).toBe(4);
      });
      it('has the mix of sizes asked for', () => {
        const big = l.vehicles.filter((v) => v.type !== 'car').length / l.vehicles.length;
        if (l.number >= 6) expect(big).toBeGreaterThanOrEqual(0.35);
        if (l.hard) expect(l.vehicles.filter((v) => v.type === 'bus').length).toBeGreaterThanOrEqual(3);
      });
      it('is a jam: only a few vehicles can leave at the start', () => {
        const s = new Solver(l);
        const free = s.legal(s.initial(), 99).length;
        expect(free).toBe(l.stats!.free);
        expect(free).toBeLessThanOrEqual(Math.max(p.maxFree, 2));
        if (l.number >= 4) expect(free).toBeLessThanOrEqual(l.vehicles.length * 0.25);
      });
      if (l.hard) {
        it('"very hard": at least three traps, and the whole queue is shuffled in the widest window', () => {
          expect(l.stats!.traps).toBeGreaterThanOrEqual(3);
          expect(l.stats!.window).toBe(4);
        });
      }
    });
  }
  it('the number of vehicles grows from 8 to more than 40', () => {
    expect(NUMBERED_LEVELS[0].vehicles.length).toBe(8);
    expect(NUMBERED_LEVELS[29].vehicles.length).toBeGreaterThanOrEqual(40);
    for (let i = 1; i < 30; i++) if (!NUMBERED_LEVELS[i].hard && !NUMBERED_LEVELS[i - 1].hard) expect(NUMBERED_LEVELS[i].vehicles.length).toBeGreaterThanOrEqual(NUMBERED_LEVELS[i - 1].vehicles.length - 1);
  });
  it('the difficulty of level N+5 is higher than that of N, on average and almost always', () => {
    const score = (n: number) => NUMBERED_LEVELS[n - 1].stats!.score;
    let diff = 0;
    let up = 0;
    let pairs = 0;
    for (let n = 1; n + 5 <= 30; n++) {
      pairs++;
      diff += score(n + 5) - score(n);
      if (score(n + 5) > score(n)) up++;
    }
    expect(diff / pairs).toBeGreaterThan(0);
    expect(up / pairs).toBeGreaterThanOrEqual(0.9);
  });
  it('a very hard level is clearly harder than the levels around it', () => {
    const score = (n: number) => NUMBERED_LEVELS[n - 1].stats!.score;
    for (const n of [5, 10, 15, 20, 25]) expect(score(n)).toBeGreaterThan(score(n + 1));
    for (const n of [10, 15, 20, 25, 30]) expect(score(n)).toBeGreaterThan(score(n - 1));
  });
});
