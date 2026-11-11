import { describe, expect, it } from 'vitest';
import { angledShare, densityOf, replay } from './analyze';
import { generate, paramsFor } from './generator';
import { overlaps } from './geometry';
import { boxOf } from './solver-types';
import { Solver } from './solver';

/** A level that fits the rules for the level number, from the first seed that works. */
function first(level: number) {
  const p = paramsFor(level);
  for (let s = 1; s < 400; s++) {
    const b = generate(p, 100 * level + s);
    if (b) return { p, b, seed: 100 * level + s };
  }
  throw new Error(`no level ${level}`);
}

describe('generator', () => {
  it('gives the same level for the same seed', () => {
    const { p, seed } = first(12);
    expect(JSON.stringify(generate(p, seed)!.data)).toBe(JSON.stringify(generate(p, seed)!.data));
  });
  for (const L of [1, 7, 12, 22]) {
    it(`level ${L}: dense, can be cleared, nothing overlaps`, () => {
      const { p, b } = first(L);
      const d = b.data;
      expect(densityOf(d)).toBeGreaterThanOrEqual(p.minDensity);
      if (L >= 10) expect(angledShare(d.vehicles)).toBeGreaterThanOrEqual(0.3);
      const boxes = d.vehicles.map(boxOf);
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlaps(boxes[i], boxes[j], 0.01)).toBe(false);
      expect(replay(d, [...d.vehicles].sort((a, c) => c.id - a.id).map((v) => v.id)).won).toBe(true);
      expect(new Solver(d).solve().solvable).toBe(true);
    });
  }
  it('most of the vehicles of a lot start blocked', () => {
    const { p, b } = first(18);
    const s = new Solver(b.data);
    const free = s.legal(s.initial(), 99).length;
    expect(free).toBeLessThanOrEqual(p.maxFree);
    expect(free).toBeLessThan(b.data.vehicles.length * 0.25);
  });
});
