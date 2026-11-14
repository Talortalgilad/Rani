import { describe, expect, it } from 'vitest';
import { sway } from './ride3d';
import { buildPath, finish, newTrack, addLoop } from './track';

describe('the bends of the 3D track', () => {
  const t = newTrack();
  for (const [x, y] of [[8, 0.9], [10.8, 0.9], [13, 1.6], [16, 2.6], [18.5, 1.8], [20.4, 1.6]]) t.pts.push({ x, y });
  addLoop(t, 8);
  finish(t);
  const p = buildPath(t);
  it('are gentle, always the same for the same seed, and different for another', () => {
    let a = 0;
    for (let s = 0; s < p.s[p.n - 1]; s += 0.5) a = Math.max(a, Math.abs(sway(p, s, 7)));
    expect(a).toBeLessThan(6.5);
    const m = p.loopS![1] + (p.endS - 7 - p.loopS![1]) * 0.75;
    expect(sway(p, m, 7)).toBe(sway(p, m, 7));
    expect(sway(p, m, 7)).not.toBe(sway(p, m, 8));
  });
  it('are zero on the lift, inside the loop and at the station, so that the loop stays a circle and the station straight', () => {
    expect(sway(p, 3, 7)).toBeCloseTo(0, 9);
    const [a, b] = p.loopS!;
    expect(Math.abs(sway(p, (a + b) / 2, 7))).toBeLessThan(1e-9);
    expect(Math.abs(sway(p, p.endS + 1, 7))).toBeLessThan(1e-9);
  });
});
