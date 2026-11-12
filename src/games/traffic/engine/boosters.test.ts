import { describe, expect, it } from 'vitest';
import { FREE_UNDOS, HELPER_COST, canAfford, dailyFreeAvailable, dayKey, newBook, priceOf, recordUse, starsFor } from './boosters';

describe('helper prices', () => {
  it('costs: shuffle 5, extra place 5, VIP 8, undo 2 after the three free ones', () => {
    expect(HELPER_COST).toEqual({ undo: 2, shuffle: 5, slot: 5, vip: 8 });
    expect(priceOf('shuffle', newBook())).toEqual({ stars: 5, free: false });
    expect(priceOf('vip', newBook())).toEqual({ stars: 8, free: false });
  });
  it('the first three undos of a level are free, then 2 stars', () => {
    let b = newBook();
    for (let i = 0; i < FREE_UNDOS; i++) {
      expect(priceOf('undo', b).free).toBe(true);
      b = recordUse('undo', b);
    }
    expect(priceOf('undo', b)).toEqual({ stars: 2, free: false });
  });
  it('the daily helper is free, once a day', () => {
    expect(priceOf('slot', newBook(), true)).toEqual({ stars: 0, free: true });
    expect(dailyFreeAvailable(null, '2026-11-12')).toBe(true);
    expect(dailyFreeAvailable('2026-11-12', '2026-11-12')).toBe(false);
    expect(dailyFreeAvailable('2026-11-11', '2026-11-12')).toBe(true);
    expect(dayKey(new Date(2026, 10, 5))).toBe('2026-11-05');
  });
  it('can only be paid with the stars you have', () => {
    expect(canAfford(priceOf('vip', newBook()), 7)).toBe(false);
    expect(canAfford(priceOf('vip', newBook()), 8)).toBe(true);
    expect(canAfford(priceOf('undo', newBook()), 0)).toBe(true);
  });
});

describe('stars of a level', () => {
  it('three without helpers (the free undos do not count), two with one, one with more', () => {
    let b = newBook();
    b = recordUse('undo', recordUse('undo', recordUse('undo', b)));
    expect(starsFor(b.helpersUsed)).toBe(3);
    b = recordUse('undo', b); // the fourth undo is a paid helper
    expect(starsFor(b.helpersUsed)).toBe(2);
    expect(starsFor(recordUse('shuffle', b).helpersUsed)).toBe(1);
    expect(starsFor(recordUse('slot', newBook()).helpersUsed)).toBe(2);
  });
});
