import { describe, expect, it } from 'vitest';
import { Timeline } from './animations';

describe('Timeline', () => {
  it('keeps an animation that a finishing animation starts', () => {
    const tl = new Timeline();
    let second = 0;
    tl.tween(0.1, () => {}, () => tl.tween(0.1, () => second++));
    for (let i = 0; i < 40; i++) tl.update(0.02);
    expect(second).toBeGreaterThan(0);
    expect(tl.busy).toBe(false);
  });
});
