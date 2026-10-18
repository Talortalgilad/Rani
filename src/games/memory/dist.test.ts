import { describe, expect, it } from 'vitest';
import { playLevel, type Strategy } from './bots';
import { composeLevel } from './compose';
import { starsFor } from './engine';
import { LEVELS, groupsOf } from './levels';

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function distribution(levelId: number, strategy: Strategy, games: number) {
  const level = LEVELS.find((l) => l.id === levelId)!;
  const stars = { 1: 0, 2: 0, 3: 0 } as Record<number, number>;
  let total = 0;
  for (let k = 0; k < games; k++) {
    const r = rng(k * 977 + levelId * 13 + strategy.length);
    const g = playLevel(composeLevel(level, 10, r), level.group, strategy, r);
    stars[starsFor(g.attempts, groupsOf(level), level.group)]++;
    total += g.attempts;
  }
  const pct = (n: number) => Math.round((n / games) * 1000) / 10;
  return { one: pct(stars[1]), two: pct(stars[2]), three: pct(stars[3]), avg: total / games };
}

describe('star spread on the triples level (16): 3 stars are possible but never automatic', () => {
  const N = 1000;
  const memory = distribution(16, 'memory', N);
  const limited = distribution(16, 'limited', N);
  const random = distribution(16, 'random', N);
  console.log('L16 stars %, 1000 games each', JSON.stringify({ memory, limited, random }));

  it('a perfect-memory player gets 3 stars sometimes, not always', () => {
    expect(memory.three).toBeGreaterThan(20);
    expect(memory.three).toBeLessThan(80);
    expect(memory.one).toBe(0);
  });
  it('a player who remembers only a few cards rarely gets more than 1-2 stars', () => {
    expect(limited.three).toBeLessThan(5);
    expect(limited.one).toBeGreaterThan(limited.two);
  });
  it('pure guessing never earns 3 stars, and still always finishes', () => {
    expect(random.three).toBe(0);
    expect(random.one + random.two + random.three).toBeCloseTo(100, 5);
  });
  it('triples use their own thresholds: 3 stars up to 2 per triple, 2 up to 3', () => {
    expect(starsFor(20, 10, 3)).toBe(3);
    expect(starsFor(21, 10, 3)).toBe(2);
    expect(starsFor(30, 10, 3)).toBe(2);
    expect(starsFor(31, 10, 3)).toBe(1);
    // pairs are unchanged
    expect(starsFor(15, 10)).toBe(3);
    expect(starsFor(16, 10)).toBe(2);
    expect(starsFor(22, 10)).toBe(2);
    expect(starsFor(23, 10)).toBe(1);
  });
});
