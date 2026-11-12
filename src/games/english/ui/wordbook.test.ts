import { describe, expect, it } from 'vitest';
import { bookWords } from './wordbook';
import { ACCESSORIES, unlockedAccessories } from '../art/accessories';

describe('the word book', () => {
  it('shows only the words that were met, the known ones first', () => {
    const b = bookWords({ ball: { level: 1, due: 5, seen: true }, phone: { level: 5, due: 5, seen: true }, tv: { level: 0, due: 0, seen: false } });
    expect(b.map((x) => x.id)).toEqual(['phone', 'ball']);
    expect(b[0].known).toBe(true);
    expect(b[1].known).toBe(false);
  });
});

describe('the accessories', () => {
  it('one more for every three worlds that are finished', () => {
    expect(unlockedAccessories({ 1: 5, 2: 5 }, 5)).toHaveLength(0);
    expect(unlockedAccessories({ 3: 5 }, 5).map((a) => a.id)).toEqual(['hat']);
    expect(unlockedAccessories({ 3: 5, 6: 5, 9: 4 }, 5).map((a) => a.id)).toEqual(['hat', 'glasses']);
    expect(ACCESSORIES.map((a) => a.world)).toEqual([3, 6, 9, 12]);
  });
});
