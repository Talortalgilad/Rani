import { describe, expect, it } from 'vitest';
import { simulate } from './coaster/physics';
import { END, addLoop, addPart, buildPath, newTrack } from './coaster/track';
import { evaluate, gateSpeed, hitMask, peaks, starsGot, noGoals, type Goals } from './goals';
import { funOf, starsFor } from './fun';
import { LEVEL_COUNT, ZONES, allLevels, makeLevel, zoneOf } from './levels';
import { PARK_TARGETS } from './parkTargets';

const MAXES = [5, 10, 20];

describe('the 40 challenges', () => {
  it('there are 40, in 4 zones of 10, with the parts opening zone by zone', () => {
    expect(LEVEL_COUNT).toBe(40);
    expect(ZONES.map((z) => z.loops)).toEqual([0, 1, 1, 2]);
    expect(zoneOf(1).bg).toBe('candy');
    expect(zoneOf(40).bg).toBe('space');
    for (const l of allLevels()) {
      for (const q of l.goals.parts) {
        if (q.kind === 'loop') expect(l.allow.loops).toBeGreaterThanOrEqual(q.n);
        else expect(l.allow.parts).toContain(q.kind);
      }
      expect(l.zone).toBe(zoneOf(l.id).id);
    }
  });

  for (const max of MAXES) {
    it(`every challenge has a solution that finishes and does all its goals (maths level ${max})`, () => {
      for (const l of allLevels(max)) {
        const path = buildPath(l.solution);
        const ride = simulate(path);
        expect(ride.outcome, `level ${l.id}`).toBe('finished');
        const e = evaluate(l.goals, l.solution, path, ride);
        expect(e.fails, `level ${l.id}`).toEqual([]);
      }
    });
  }

  it('each kind of goal is in the journey, and obstacles are away from the solution', () => {
    const all = allLevels();
    expect(all.some((l) => l.goals.stars.length > 0)).toBe(true);
    expect(all.some((l) => l.goals.obstacles.length > 0)).toBe(true);
    expect(all.some((l) => l.goals.speed?.mode === 'fast') && all.some((l) => l.goals.speed?.mode === 'slow')).toBe(true);
    expect(all.some((l) => l.goals.height?.kind === 'peak') && all.some((l) => l.goals.height?.kind === 'lower')).toBe(true);
    expect(all.some((l) => l.goals.parts.length > 0)).toBe(true);
    const kinds = new Set(all.flatMap((l) => l.goals.obstacles.map((o) => o.kind)));
    expect([...kinds].sort()).toEqual(['bridge', 'palm', 'pine', 'rock']);
    for (const l of all) {
      const p = buildPath(l.solution);
      expect(hitMask(l.goals, p).some((h) => h), `level ${l.id}`).toBe(false);
    }
  });

  it('the numbers of the height goals follow the maths level', () => {
    for (const l of allLevels(5)) if (l.goals.height) expect(l.goals.height.kind === 'peak' ? l.goals.height.h : l.goals.height.d).toBeLessThanOrEqual(5);
    for (const l of allLevels(10)) if (l.goals.height?.kind === 'peak') expect(l.goals.height.h).toBeLessThanOrEqual(9);
  });

  it('a lazy straight track does not do the goals of a challenge that has some', () => {
    for (const l of allLevels()) {
      const g = l.goals;
      if (!(g.stars.length || g.obstacles.length || g.speed || g.height || g.parts.length)) continue;
      const t = newTrack();
      t.pts.push({ ...END });
      t.complete = true;
      const p = buildPath(t);
      const r = simulate(p);
      if (r.outcome === 'finished') expect(evaluate(g, t, p, r).ok, `level ${l.id}`).toBe(false);
    }
  });

  it('the first levels are the tutorial, with a hand', () => {
    expect(allLevels().filter((l) => l.tutorial).map((l) => l.id)).toEqual([1, 2, 3]);
  });

  it('is the same every time (no luck in it)', () => {
    const a = makeLevel(23, 10).solution;
    const b = makeLevel(23, 10).solution;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('the goals', () => {
  const g = (over: Partial<Goals>): Goals => ({ ...noGoals(), ...over });
  const track = (): ReturnType<typeof newTrack> => {
    const t = newTrack();
    t.pts.push({ x: 8.4, y: 0.9 }, { x: 11, y: 3 }, { x: 14, y: 1 }, { ...END });
    t.complete = true;
    return t;
  };

  it('a star is got when the track goes through it', () => {
    const t = track();
    const p = buildPath(t);
    const r = simulate(p);
    expect(r.outcome).toBe('finished');
    const on = p.n >> 1;
    const got = starsGot(g({ stars: [{ x: p.x[on], y: p.y[on] }, { x: 12, y: 9 }] }), p, r);
    expect(got).toEqual([true, false]);
  });

  it('an obstacle that the track goes through is a hit', () => {
    const p = buildPath(track());
    const goal = g({ obstacles: [{ kind: 'rock', x0: 13.4, x1: 14.6, y0: 0, y1: 1.3 }] });
    expect(hitMask(goal, p).some((h) => h)).toBe(true);
    expect(hitMask(g({ obstacles: [{ kind: 'rock', x0: 13.4, x1: 14.6, y0: 0, y1: 0.3 }] }), p).some((h) => h)).toBe(false);
  });

  it('the speed gate: fast and slow', () => {
    const t = track();
    const p = buildPath(t);
    const r = simulate(p);
    const v = gateSpeed({ x: 14, y: 1, mode: 'fast', limit: 0 }, p, r)!;
    expect(v).toBeGreaterThan(3);
    const miss = gateSpeed({ x: 14, y: 8, mode: 'fast', limit: 0 }, p, r);
    expect(miss).toBeNull();
    const fast = evaluate(g({ speed: { x: 14, y: 1, mode: 'fast', limit: v + 3 } }), t, p, r);
    expect(fast.fails).toEqual([{ kind: 'gate', why: 'slow' }]);
    const slow = evaluate(g({ speed: { x: 14, y: 1, mode: 'slow', limit: v - 3 } }), t, p, r);
    expect(slow.fails).toEqual([{ kind: 'gate', why: 'fast' }]);
  });

  it('the height of a hill: counting the tops', () => {
    const p = buildPath(track());
    const tops = peaks(p);
    expect(tops).toHaveLength(1);
    expect(Math.abs(tops[0].y - 3)).toBeLessThan(0.5);
    const t = track();
    const r = simulate(p);
    expect(evaluate(g({ height: { kind: 'peak', h: 3, d: 0 } }), t, p, r).ok).toBe(true);
    expect(evaluate(g({ height: { kind: 'peak', h: 5, d: 0 } }), t, p, r).fails).toEqual([{ kind: 'height' }]);
  });

  it('a part that has to be on the track', () => {
    const t = track();
    const p = buildPath(t);
    const r = simulate(p);
    const need = g({ parts: [{ kind: 'tunnel', n: 1 }, { kind: 'loop', n: 1 }] });
    expect(evaluate(need, t, p, r).fails).toHaveLength(2);
    expect(addPart(t, 'tunnel', 11)).toBe(true);
    expect(addLoop(t, 8.4)).toBe(true);
    const p2 = buildPath(t);
    expect(evaluate(need, t, p2, simulate(p2)).fails).toEqual([]);
  });
});

describe('the fun meter', () => {
  it('a bigger drop and a loop are more fun; the stars follow the targets', () => {
    const calm = makeLevel(1, 10).solution;
    const loop = makeLevel(31, 10).solution;
    const f1 = funOf(calm, buildPath(calm), simulate(buildPath(calm)));
    const f2 = funOf(loop, buildPath(loop), simulate(buildPath(loop)));
    expect(f2.score).toBeGreaterThan(f1.score);
    expect(f2.loops).toBe(2);
    expect(f1.loops).toBe(0);
    for (const f of [f1, f2]) for (const v of Object.values(f.bars)) expect(v >= 0 && v <= 1).toBe(true);
    expect(starsFor(10, [40, 60])).toBe(1);
    expect(starsFor(40, [40, 60])).toBe(2);
    expect(starsFor(60, [40, 60])).toBe(3);
  });

  it('every challenge has its targets, from the simulation', () => {
    for (let id = 1; id <= LEVEL_COUNT; id++) {
      const t = PARK_TARGETS[id];
      expect(t, `level ${id}`).toBeTruthy();
      expect(t[0]).toBeLessThan(t[1]);
      const l = makeLevel(id, 10);
      const fun = funOf(l.solution, buildPath(l.solution), simulate(buildPath(l.solution))).score;
      // the solution itself is worth three stars (the targets are made from it)
      expect(starsFor(fun, t)).toBe(3);
    }
  });
});
