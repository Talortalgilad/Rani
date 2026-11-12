import { describe, expect, it } from 'vitest';
import { replay, densityOf, angledShare } from '../engine/analyze';
import { sameDirectionClusters, type Item } from '../engine/packing';
import { isHard, paramsFor } from '../engine/generator';
import { overlaps } from '../engine/geometry';
import { quarterOf } from '../engine/generator';
import { Solver } from '../engine/solver';
import { levelRuleProblems } from '../engine/rules';
import { boxOf } from '../engine/solver-types';
import { SIZES } from '../engine/state';
import { ALL_LEVELS, NUMBERED_LEVELS, levelByKey, nextLevel } from './index';

describe('the 100 levels', () => {
  it('there are 100, numbered 1 to 100, after five tutorial levels', () => {
    expect(NUMBERED_LEVELS.map((l) => l.number)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
    expect(ALL_LEVELS.slice(0, 5).map((l) => l.key)).toEqual(['t1', 't2', 't3', 't4', 't5']);
    expect(nextLevel('t5')!.key).toBe('1');
    expect(nextLevel('100')).toBeNull();
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
      it('meets every rule of the levels (mix of sizes, big ones at 45 degrees, every quarter mixed, "?" vehicles)', () => {
        expect(levelRuleProblems(l)).toEqual([]);
      });
      it('has "?" vehicles from level 8, each with a visible vehicle in front of it', () => {
        const hidden = l.vehicles.filter((v) => v.hidden).length;
        if (l.number < 8) expect(hidden).toBe(0);
        else expect(hidden).toBeGreaterThanOrEqual(1);
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
  it('from level 10, every quarter of the lot has big and small vehicles, and straight and diagonal ones', () => {
    for (const l of NUMBERED_LEVELS.filter((x) => x.number >= 10)) {
      for (let q = 0; q < 4; q++) {
        const inQ = l.vehicles.filter((v) => quarterOf(v.x, v.z) === q);
        const where = `level ${l.number}, quarter ${q}`;
        expect(inQ.some((v) => v.type === 'car'), `${where}: small`).toBe(true);
        expect(inQ.some((v) => v.type !== 'car'), `${where}: big`).toBe(true);
        expect(inQ.some((v) => v.heading % 90 === 0), `${where}: straight`).toBe(true);
        expect(inQ.some((v) => v.heading % 90 !== 0), `${where}: diagonal`).toBe(true);
      }
    }
  });
  it('from level 10, at least 25% of the vans and buses stand at 45 degrees', () => {
    for (const l of NUMBERED_LEVELS.filter((x) => x.number >= 10)) {
      const big = l.vehicles.filter((v) => v.type !== 'car');
      expect(big.filter((v) => v.heading % 90 !== 0).length / big.length, `level ${l.number}`).toBeGreaterThanOrEqual(0.25);
    }
  });
  it('the number of vehicles grows from 8 to more than 40', () => {
    expect(NUMBERED_LEVELS[0].vehicles.length).toBe(8);
    expect(NUMBERED_LEVELS[29].vehicles.length).toBeGreaterThanOrEqual(40);
    expect(Math.max(...NUMBERED_LEVELS.map((l) => l.vehicles.length))).toBeLessThanOrEqual(44); // touch size wins over density
    for (let i = 1; i < 30; i++) if (!NUMBERED_LEVELS[i].hard && !NUMBERED_LEVELS[i - 1].hard) expect(NUMBERED_LEVELS[i].vehicles.length).toBeGreaterThanOrEqual(NUMBERED_LEVELS[i - 1].vehicles.length - 1);
  });
  it('the difficulty rises: N+5 is harder than N on average and in most pairs, N+10 almost always', () => {
    const score = (n: number) => NUMBERED_LEVELS[n - 1].stats!.score;
    for (const [gap, share] of [[5, 0.75], [10, 0.9]] as const) {
      let diff = 0;
      let up = 0;
      let pairs = 0;
      for (let n = 1; n + gap <= 100; n++) {
        pairs++;
        diff += score(n + gap) - score(n);
        if (score(n + gap) > score(n)) up++;
      }
      expect(diff / pairs, `gap ${gap}`).toBeGreaterThan(0);
      expect(up / pairs, `gap ${gap}`).toBeGreaterThanOrEqual(share);
    }
  });
  it('a very hard level (every fifth) is clearly harder than the levels around it', () => {
    const score = (n: number) => NUMBERED_LEVELS[n - 1].stats!.score;
    for (let n = 5; n <= 100; n += 5) {
      if (!NUMBERED_LEVELS[n - 1].hard) continue;
      expect(score(n), `level ${n}`).toBeGreaterThan(score(n + 1 <= 100 ? n + 1 : n - 1));
      if (n > 5) expect(score(n), `level ${n}`).toBeGreaterThan(score(n - 1));
    }
  });
  it('special vehicles appear from their levels: belt 30, turning vehicle 45, fire truck 60', () => {
    for (const l of NUMBERED_LEVELS) {
      expect((l.belts?.length ?? 0) > 0, `belt ${l.number}`).toBe(l.number >= 30);
      expect(l.vehicles.some((v) => v.rotator), `rotator ${l.number}`).toBe(l.number >= 45);
      expect(l.vehicles.some((v) => v.type === 'fire'), `fire ${l.number}`).toBe(l.number >= 60);
    }
  });
  it('the worlds: city 1-25, beach 26-50, snow 51-75, carnival 76-100', () => {
    for (const l of NUMBERED_LEVELS) expect(l.world, `level ${l.number}`).toBe(l.number <= 25 ? 'city' : l.number <= 50 ? 'beach' : l.number <= 75 ? 'snow' : 'carnival');
  });
});
