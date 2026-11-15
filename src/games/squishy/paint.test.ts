import { describe, expect, it } from 'vitest';
import { compose, PALETTE, partAt, SHINE, type RGB } from './paint';
import PARTS from './parts.json';

const mapOf = (size: number, f: (x: number, y: number) => [number, number, number, number]): Uint8ClampedArray => {
  const m = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) m.set(f(x, y), (y * size + x) * 4);
  return m;
};

describe('painting', () => {
  it('the colour of a part is multiplied by the shading, and the highlight adds white', () => {
    const map = new Uint8ClampedArray([1, 100, 0, 255, 1, 50, 0, 255, 1, 100, 255, 255, 0, 100, 0, 0]);
    const out = new Uint8ClampedArray(16);
    const c: RGB = [200, 100, 50];
    compose(map, [c], out);
    expect([...out.slice(0, 4)]).toEqual([200, 100, 50, 255]);
    expect([...out.slice(4, 8)]).toEqual([100, 50, 25, 255]);
    expect(out[8]).toBeGreaterThan(200 + (255 - 200) * SHINE - 2);
    expect(out[11]).toBe(255);
    expect([...out.slice(12, 16)]).toEqual([0, 0, 0, 0]);
  });

  it('two parts get their own colours, and a part with no colour is grey, not black', () => {
    const map = mapOf(2, (x) => [x + 1, 100, 0, 255]);
    const out = new Uint8ClampedArray(16);
    compose(map, [PALETTE[0].rgb], out);
    expect(out[0]).toBe(PALETTE[0].rgb[0]);
    expect(out[4]).toBe(200);
  });

  it('there are six colours of the palette, all different, all with a name in English', () => {
    expect(PALETTE).toHaveLength(6);
    expect(new Set(PALETTE.map((p) => p.rgb.join())).size).toBe(6);
    expect(PALETTE.map((p) => p.id)).toEqual(['pink', 'blue', 'yellow', 'purple', 'green', 'red']);
  });

  it('a tap on a part finds it; a tap just next to a small part finds the small part (a reach of 12 pixels)', () => {
    // a big part 1 with a thin ear 2 (6 pixels wide)
    const map = mapOf(100, (x, y) => (x >= 50 && x < 56 && y < 40 ? [2, 100, 0, 255] : x > 10 && x < 90 && y > 20 && y < 90 ? [1, 100, 0, 255] : [0, 0, 0, 0]));
    const areas = [0.9, 0.05];
    expect(partAt(map, 100, 30, 60, areas)).toBe(1);
    expect(partAt(map, 100, 52, 10, areas)).toBe(2);
    // 9 pixels to the side of the ear, on the body: the ear is meant
    expect(partAt(map, 100, 62, 30, areas)).toBe(2);
    // far from everything
    expect(partAt(map, 100, 3, 3, areas)).toBe(0);
    // 15 pixels from the ear, in the middle of the body: the body
    expect(partAt(map, 100, 71, 60, areas)).toBe(1);
  });

  it('every shape has 2-5 parts, all of a size that a finger can hit, and a colour for each', () => {
    for (const [name, m] of Object.entries(PARTS as Record<string, { parts: number; areas: number[]; colors: number[][] }>)) {
      expect(m.parts, name).toBeGreaterThanOrEqual(2);
      expect(m.parts, name).toBeLessThanOrEqual(5);
      expect(m.colors, name).toHaveLength(m.parts);
      expect(Math.min(...m.areas), name).toBeGreaterThan(0.008);
    }
    expect(Object.keys(PARTS)).toHaveLength(18);
  });
});
