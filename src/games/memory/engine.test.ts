import { describe, expect, it } from 'vitest';
import { DECKS } from './decks';
import { MemoryGame, buildCards, shuffle, starsFor } from './engine';

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
const keys = DECKS.farm.keys;
const counts = (cards: { art: string }[]) => {
  const m = new Map<string, number>();
  cards.forEach((c) => m.set(c.art, (m.get(c.art) ?? 0) + 1));
  return m;
};

describe('board building', () => {
  it.each([2, 3] as const)('every picture appears exactly %i times and the size divides evenly', (group) => {
    for (const pairs of [3, 6, 8, 12, 15]) {
      const cards = buildCards(keys, pairs, group, rng(pairs));
      expect(cards).toHaveLength(pairs * group);
      expect(cards.length % group).toBe(0);
      const m = counts(cards);
      expect(m.size).toBe(pairs);
      for (const n of m.values()) expect(n).toBe(group);
      expect(cards.map((c) => c.id)).toEqual(cards.map((_, i) => i));
    }
  });
  it('shuffles randomly: same seed repeats, different seeds differ, and nothing is lost', () => {
    const a = buildCards(keys, 8, 2, rng(1)).map((c) => c.art).join();
    expect(buildCards(keys, 8, 2, rng(1)).map((c) => c.art).join()).toBe(a);
    const distinct = new Set(Array.from({ length: 20 }, (_, i) => buildCards(keys, 8, 2, rng(100 + i)).map((c) => c.art).join()));
    expect(distinct.size).toBeGreaterThan(15);
    expect([...shuffle([1, 2, 3, 4, 5], rng(3))].sort()).toEqual([1, 2, 3, 4, 5]);
  });
  it('refuses a board the deck cannot fill, or one that does not divide', () => {
    expect(() => buildCards(keys, keys.length + 1, 2)).toThrow();
    expect(() => new MemoryGame([{ id: 0, art: 'a' }, { id: 1, art: 'a' }, { id: 2, art: 'b' }], 2)).toThrow();
  });
});

describe('flipping', () => {
  const game = () => new MemoryGame([
    { id: 0, art: 'a' }, { id: 1, art: 'b' }, { id: 2, art: 'a' }, { id: 3, art: 'b' },
  ]);
  it('counts one attempt per completed pair, right or wrong', () => {
    const g = game();
    expect(g.flip(0).kind).toBe('open');
    expect(g.attempts).toBe(0);
    expect(g.flip(1).kind).toBe('miss');
    expect(g.attempts).toBe(1);
    g.unflip();
    expect(g.flip(0).kind).toBe('open');
    expect(g.flip(2).kind).toBe('match');
    expect(g.attempts).toBe(2);
  });
  it('tracks the streak and its best', () => {
    const g = game();
    g.flip(0); g.flip(2);
    g.flip(1); g.flip(3);
    expect([g.streak, g.bestStreak, g.done]).toEqual([2, 2, true]);
    const h = game();
    h.flip(0); h.flip(1); h.unflip();
    h.flip(0); h.flip(2);
    expect([h.streak, h.bestStreak]).toEqual([1, 1]);
  });
  it('ignores the same card twice, matched cards, and bad indices', () => {
    const g = game();
    g.flip(0);
    expect(g.flip(0).kind).toBe('ignored');
    g.flip(2);
    expect(g.flip(0).kind).toBe('ignored');
    expect(g.flip(-1).kind).toBe('ignored');
    expect(g.flip(99).kind).toBe('ignored');
    expect(g.flip(1.5).kind).toBe('ignored');
  });
  it('never has more than 2 cards open, however fast the taps come', () => {
    const cards = buildCards(keys, 8, 2, rng(5));
    const g = new MemoryGame(cards);
    for (let burst = 0; burst < 50; burst++) {
      for (let k = 0; k < 30; k++) {
        g.flip(Math.floor(Math.random() * cards.length));
        expect(g.open.length).toBeLessThanOrEqual(2);
      }
      g.unflip();
    }
  });
  it('never has more than 3 open in triples, and blocks every tap while a miss is showing', () => {
    const cards = buildCards(keys, 6, 3, rng(9));
    const g = new MemoryGame(cards, 3);
    for (let k = 0; k < 500; k++) {
      g.flip(k % cards.length);
      expect(g.open.length).toBeLessThanOrEqual(3);
      if (g.resolving) {
        const before = g.attempts;
        for (let i = 0; i < cards.length; i++) expect(g.flip(i).kind).toBe('ignored');
        expect(g.attempts).toBe(before);
        g.unflip();
      }
    }
  });
  it('a triple only matches when all three are the same', () => {
    const g = new MemoryGame(buildCards(['a', 'b'], 2, 3, rng(2)), 3);
    const a = g.cards.flatMap((c, i) => (c.art === 'a' ? [i] : []));
    g.flip(a[0]); g.flip(a[1]);
    expect(g.flip(a[2]).kind).toBe('match');
    expect(g.found).toBe(1);
  });
});

describe('stars', () => {
  it('3 up to 1.5x attempts, 2 up to 2.2x, otherwise 1 (never 0, mistakes never cost the first star)', () => {
    const P = 8;
    expect(starsFor(P, P)).toBe(3);
    expect(starsFor(12, P)).toBe(3);
    expect(starsFor(13, P)).toBe(2);
    expect(starsFor(17, P)).toBe(2);
    expect(starsFor(18, P)).toBe(1);
    expect(starsFor(500, P)).toBe(1);
  });
});

describe('farm deck art', () => {
  it('has 15 distinct pictures drawn in code, no emoji', () => {
    expect(DECKS.farm.keys).toHaveLength(15);
    expect(new Set(Object.values(DECKS.farm.art)).size).toBe(15);
    const all = Object.values(DECKS.farm.art).join('') + DECKS.farm.back;
    expect(all).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(DECKS.farm.back.startsWith('<svg')).toBe(true);
  });
});
