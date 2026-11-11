import { describe, expect, it } from 'vitest';
import { angledShare, densityOf, replay } from './analyze';
import { generate, paramsFor, typesFor, mulberry } from './generator';
import { overlaps } from './geometry';
import { sameDirectionClusters, type Item } from './packing';
import { boxOf } from './solver-types';
import { Solver } from './solver';

/** The class of a vehicle's direction: 0 horizontal, 1 vertical, 2 and 3 the two diagonals. */
export const classOf = (heading: number): number => ({ 0: 0, 90: 1, 45: 2, 135: 3 } as Record<number, number>)[heading % 180];

/** A small level (12 vehicles) with the rules of level `level`, from the first seed that works. */
function small(level: number, vehicles = 12) {
  const p = { ...paramsFor(level), vehicles };
  for (let s = 1; s < 60; s++) {
    const b = generate(p, 100 * level + s);
    if (b) return { p, b };
  }
  throw new Error(`no level ${level}`);
}

describe('generator', () => {
  it('gives the same level for the same seed', () => {
    const p = { ...paramsFor(3), vehicles: 8 };
    expect(JSON.stringify(generate(p, 11)?.data)).toBe(JSON.stringify(generate(p, 11)?.data));
  });
  for (const L of [3, 7, 12]) {
    it(`level ${L} rules: dense, can be cleared, nothing overlaps, directions mixed`, () => {
      const { p, b } = small(L);
      const d = b.data;
      expect(densityOf(d)).toBeGreaterThanOrEqual(p.minDensity);
      if (L >= 10) expect(angledShare(d.vehicles)).toBeGreaterThanOrEqual(0.3);
      const boxes = d.vehicles.map(boxOf);
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlaps(boxes[i], boxes[j], 0.01)).toBe(false);
      expect(replay(d, [...d.vehicles].sort((a, c) => c.id - a.id).map((v) => v.id)).won).toBe(true);
      expect(new Solver(d).solve().solvable).toBe(true);
      const items: Item[] = d.vehicles.map((v) => ({ type: v.type, cls: classOf(v.heading), x: v.x, z: v.z }));
      expect(Math.max(...sameDirectionClusters(items, 0.15).map((c) => c.length))).toBeLessThanOrEqual(3);
    });
  }
  it('most of the vehicles of a lot start blocked', () => {
    const { p, b } = small(9);
    const s = new Solver(b.data);
    const free = s.legal(s.initial(), 99).length;
    expect(free).toBeLessThanOrEqual(p.maxFree);
  });
});

describe('the mix of sizes', () => {
  const share = (level: number, vehicles: number) => {
    const t = typesFor({ ...paramsFor(level), vehicles }, mulberry(1));
    return { big: t.filter((x) => x !== 'car').length / t.length, buses: t.filter((x) => x === 'bus').length };
  };
  it('from level 6, at least 35% of the vehicles are vans or buses', () => {
    for (let L = 6; L <= 30; L++) {
      const p = paramsFor(L);
      expect(share(L, p.vehicles).big, `level ${L}`).toBeGreaterThanOrEqual(0.35);
    }
  });
  it('a very hard level has at least three buses', () => {
    for (const L of [5, 10, 15, 20, 25, 30]) {
      const p = paramsFor(L);
      for (const dv of [-1, 0, 1, 2]) expect(share(L, p.vehicles + dv).buses, `level ${L} (${dv})`).toBeGreaterThanOrEqual(3);
    }
  });
});
