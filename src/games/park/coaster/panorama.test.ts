import { describe, expect, it } from 'vitest';
import { tilesFor } from './panorama';

describe('the panorama in the parallax', () => {
  it('covers the whole screen, and every second copy is turned over, so that the copies meet with the same edge', () => {
    const tiles = tilesFor(130, 390, 200);
    expect(tiles[0].x).toBeLessThanOrEqual(0);
    const last = tiles[tiles.length - 1];
    expect(last.x + 200).toBeGreaterThanOrEqual(390);
    tiles.forEach((t, i) => {
      if (i) {
        expect(t.mirrored).toBe(!tiles[i - 1].mirrored);
        expect(t.x).toBeCloseTo(tiles[i - 1].x + 200, 6);
      }
    });
    expect(tiles.find((t) => t.index === 0)?.mirrored ?? false).toBe(false);
    expect(tiles.find((t) => t.index === 1)?.mirrored).toBe(true);
  });
  it('goes on to the left of the start in the same way (negative copies)', () => {
    const tiles = tilesFor(-250, 390, 200);
    expect(tiles[0].index).toBe(-2);
    expect(tiles.map((t) => t.mirrored)).toEqual([false, true, false, true].slice(0, tiles.length));
  });
});
