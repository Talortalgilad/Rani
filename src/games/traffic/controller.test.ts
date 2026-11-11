import { describe, expect, it } from 'vitest';
import { starsFor } from './controller';

describe('stars', () => {
  it('three without helpers, then two, then one', () => {
    expect(starsFor(0)).toBe(3);
    expect(starsFor(1)).toBe(2);
    expect(starsFor(4)).toBe(1);
  });
});
