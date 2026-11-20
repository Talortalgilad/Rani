import { describe, expect, it } from 'vitest';
import { JARS, MAX_SPOONS, mixSpoons, nearestColorId, WHITE } from './mix';
import type { RGB } from './paint';

const hue = ([r, g, b]: RGB): number => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const d = mx - mn;
  if (!d) return 0;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};
const light = ([r, g, b]: RGB): number => (r + g + b) / 3;
const jar = (id: string): RGB => JARS.find((j) => j.id === id)!.rgb;

describe('mixing the spoons', () => {
  it('one colour stays as it is, and no spoons is white', () => {
    expect(mixSpoons([{ id: 'pink', n: 3 }])).toEqual(jar('pink'));
    expect(mixSpoons([])).toEqual(WHITE);
    expect(mixSpoons([{ id: 'red', n: 0 }])).toEqual(WHITE);
  });
  it('seven jars: the six colours and white', () => {
    expect(JARS.map((j) => j.id)).toEqual(['pink', 'blue', 'yellow', 'purple', 'green', 'red', 'white']);
    expect(MAX_SPOONS).toBe(10);
  });
  it('blue and yellow make green, red and yellow make orange, red and blue make purple (paint, not light)', () => {
    const green = mixSpoons([{ id: 'blue', n: 1 }, { id: 'yellow', n: 1 }]);
    expect(hue(green)).toBeGreaterThan(90);
    expect(hue(green)).toBeLessThan(170);
    const orange = mixSpoons([{ id: 'red', n: 1 }, { id: 'yellow', n: 1 }]);
    expect(hue(orange)).toBeGreaterThan(15);
    expect(hue(orange)).toBeLessThan(50);
    const purple = mixSpoons([{ id: 'red', n: 1 }, { id: 'blue', n: 1 }]);
    expect(hue(purple)).toBeGreaterThan(240);
    expect(hue(purple)).toBeLessThan(320);
  });
  it('white makes a colour paler, and more white is paler still, with the same hue', () => {
    const p1 = mixSpoons([{ id: 'pink', n: 3 }, { id: 'white', n: 1 }]);
    const p2 = mixSpoons([{ id: 'pink', n: 3 }, { id: 'white', n: 3 }]);
    expect(light(p1)).toBeGreaterThan(light(jar('pink')));
    expect(light(p2)).toBeGreaterThan(light(p1));
    expect(Math.abs(hue(p1) - hue(jar('pink')))).toBeLessThan(8);
    expect(Math.abs(hue(p2) - hue(jar('pink')))).toBeLessThan(8);
  });
  it('more spoons of one colour pull the mix towards it', () => {
    const a = mixSpoons([{ id: 'blue', n: 3 }, { id: 'yellow', n: 1 }]);
    const b = mixSpoons([{ id: 'blue', n: 1 }, { id: 'yellow', n: 3 }]);
    expect(hue(a)).toBeGreaterThan(hue(b)); // nearer to blue (240) than to yellow (60)
  });
  it('the order of the spoons does not matter', () => {
    const a = mixSpoons([{ id: 'pink', n: 2 }, { id: 'blue', n: 1 }, { id: 'white', n: 1 }]);
    const b = mixSpoons([{ id: 'white', n: 1 }, { id: 'blue', n: 1 }, { id: 'pink', n: 2 }]);
    expect(a).toEqual(b);
  });
  it('every colour that comes out is a real colour (0..255)', () => {
    for (const x of JARS) for (const y of JARS) for (const n of [1, 3, 9]) {
      const c = mixSpoons([{ id: x.id, n }, { id: y.id, n: 1 }]);
      for (const v of c) expect(v >= 0 && v <= 255 && Number.isInteger(v)).toBe(true);
    }
  });
  it('the colour he likes best: the nearest of the palette, or "mix" when it is far from all', () => {
    expect(nearestColorId(jar('green'))).toBe('green');
    expect(nearestColorId([250, 110, 168])).toBe('pink');
    expect(nearestColorId(mixSpoons([{ id: 'pink', n: 1 }, { id: 'white', n: 4 }]))).toBe('mix');
  });
});
