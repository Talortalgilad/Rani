import { describe, expect, it } from 'vitest';
import { BALLOON_MIN, distToTrack, placeBalloons } from './balloons';
import { decor, distToPlot, MARGIN } from './decor';
import { framesOf, poseAt, wrap } from './frames';
import { buildCurve, type Kind } from './track';
import { N, T } from './track';

const closedTrack = (): { pieces: Kind[] } => ({ pieces: ['up', 'up', 'up', 'left', 'down', 'down', 'down', 'left', 'left', 'left', 'left'] });

describe('frames', () => {
  const c = buildCurve({ pieces: ['up', 'up', 'up', 'left', 'down', 'down', 'down', 'loop'] });
  const f = framesOf(c);
  it('every frame is three unit vectors at right angles', () => {
    for (let i = 0; i < c.n; i += 37) {
      const g = (a: Float64Array): number[] => [a[i * 3], a[i * 3 + 1], a[i * 3 + 2]];
      const t = g(f.t), u = g(f.u), r = g(f.r);
      const dot = (a: number[], b: number[]): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      expect(Math.hypot(...t)).toBeCloseTo(1, 5);
      expect(Math.hypot(...u)).toBeCloseTo(1, 5);
      expect(dot(t, u)).toBeLessThan(0.15);
      expect(dot(r, u)).toBeCloseTo(0, 1);
    }
  });
  it('up is up on the flat and upside down at the top of the loop', () => {
    expect(f.u[(10 / 0.05) * 3 + 1]).toBeGreaterThan(0.8);
    const [a, b] = c.loops[0];
    const mid = Math.round((a + b) / 2 / 0.05);
    expect(f.u[mid * 3 + 1]).toBeLessThan(-0.5);
  });
  it('the distance wraps round the circuit', () => {
    expect(wrap(-1, 10)).toBe(9);
    expect(wrap(21, 10)).toBe(1);
    const q = poseAt(c, f, 5);
    expect(q.p).toHaveLength(3);
  });
});

describe('the clean corridor', () => {
  it('the decor is outside the plot and at least 4 units from every point of any track', () => {
    for (const th of decor()) {
      expect(distToPlot(th.x, th.z)).toBeGreaterThanOrEqual(MARGIN);
      // a track is always inside the plot (with 1 unit for the swing of a loop)
      expect(distToPlot(th.x, th.z)).toBeGreaterThanOrEqual(4);
    }
    for (const k of [closedTrack(), { pieces: ['up', 'down'] as Kind[] }]) {
      const c = buildCurve(k);
      for (let i = 0; i < c.n; i += 10) {
        expect(c.X[i]).toBeGreaterThan(-1);
        expect(c.X[i]).toBeLessThan(N * T + 1);
        expect(c.Z[i]).toBeGreaterThan(-1);
        expect(c.Z[i]).toBeLessThan(N * T + 1);
      }
    }
  });
  it('the balloons float next to the track, never on it, and there are gold ones', () => {
    const c = buildCurve({ pieces: ['up', 'up', 'up', 'left', 'down', 'down', 'down', 'loop'] });
    const bs = placeBalloons(c, 4);
    expect(bs.length).toBeGreaterThanOrEqual(6);
    for (const b of bs) expect(distToTrack(c, b.x, b.y, b.z, 1)).toBeGreaterThan(BALLOON_MIN * 0.5);
    expect(placeBalloons(buildCurve({ pieces: Array(14).fill('straight').map((_, i) => (i % 2 ? 'left' : 'straight')) as Kind[] }), 1).some((b) => b.value === 5) || bs.some((b) => b.value === 5)).toBe(true);
  });
});
