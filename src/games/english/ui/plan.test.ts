import { describe, expect, it } from 'vitest';
import { cardPlan } from './plan';

describe('the first station of world 1', () => {
  const plan = cardPlan();
  it('three new word cards come first, then five tasks: circle, tap, put, listen, match', () => {
    expect(plan.slice(0, 3).map((s) => s.kind)).toEqual(['card', 'card', 'card']);
    expect(plan.slice(3).map((s) => s.kind)).toEqual(['circle', 'tap', 'put', 'listen', 'match']);
  });
  it('every task asks about a word that was introduced, and its right answer is among the pictures', () => {
    const cards = plan.filter((s) => s.kind === 'card').map((s) => (s as { word: string }).word);
    for (const s of plan.slice(3)) {
      if (s.kind === 'card') continue;
      if (s.kind === 'match') expect(s.ids.every((w) => cards.includes(w))).toBe(true);
      else if (s.kind === 'put') {
        expect(cards).toContain(s.right);
        expect(s.others).not.toContain(s.right);
      } else {
        expect(cards).toContain(s.right);
        expect(s.ids).toContain(s.right);
      }
    }
  });
});
