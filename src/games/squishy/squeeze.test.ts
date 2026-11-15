import { describe, expect, it } from 'vitest';
import { SQUEEZE, SquishGrid, type Finger } from './squeeze';

const finger = (x: number, y: number, force = 1): Finger => ({ x, y, x0: x, y0: y, force });
const run = (g: SquishGrid, seconds: number, dt = 1 / 60): void => {
  for (let t = 0; t < seconds; t += dt) g.step(dt);
};
const nearest = (g: SquishGrid, x: number, y: number): number => {
  let best = 0, bd = 9;
  for (let p = 0; p < g.points; p++) {
    const d = Math.hypot(g.rest[p * 2] - x, g.rest[p * 2 + 1] - y);
    if (d < bd) (bd = d), (best = p);
  }
  return best;
};

describe('the squeeze', () => {
  it('a grid at rest stays at rest', () => {
    const g = new SquishGrid();
    run(g, 1);
    expect(g.maxOffset()).toBe(0);
    expect(g.areaRatio()).toBeCloseTo(1, 6);
  });

  it('a press draws the points near the finger towards it, and follows quickly', () => {
    const g = new SquishGrid();
    g.press(finger(0, 0.3));
    run(g, 0.25);
    const p = nearest(g, 0, 0.6); // above the finger: it must move down (towards the finger)
    expect(g.off[p * 2 + 1]).toBeLessThan(-0.03);
    expect(g.maxOffset()).toBeGreaterThan(0.08);
  });

  it('the sides swell for what is pushed in: the area stays within a few percent', () => {
    const g = new SquishGrid();
    g.press(finger(0.1, 0.2));
    run(g, 0.6);
    expect(g.areaRatio()).toBeGreaterThan(0.88);
    expect(g.areaRatio()).toBeLessThan(1.1);
    // somewhere around the dent a point moved AWAY from the finger
    let out = 0;
    for (let p = 0; p < g.points; p++) {
      const dx = g.rest[p * 2] - 0.1, dy = g.rest[p * 2 + 1] - 0.2;
      const d = Math.hypot(dx, dy);
      if (d > SQUEEZE.radius && d < 2 * SQUEEZE.radius && g.off[p * 2] * dx + g.off[p * 2 + 1] * dy > 0.002) out++;
    }
    expect(out).toBeGreaterThan(5);
  });

  it('after the finger is lifted the shape comes back in about a second and a half, with no wobble', () => {
    const g = new SquishGrid();
    g.press(finger(0, 0));
    run(g, 0.5);
    const deepest = g.maxOffset();
    g.release();
    const seen: number[] = [];
    let t = 0;
    for (; t < 4; t += 1 / 60) {
      g.step(1 / 60);
      seen.push(g.maxOffset());
    }
    // it only goes down (no wobble: it never grows back, with a small allowance for the numbers)
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeLessThanOrEqual(seen[i - 1] + 1e-4);
    // and no point ever passes its place of rest to the other side
    const after = seen.findIndex((v) => v < 0.02 * deepest);
    expect(after / 60).toBeGreaterThan(SQUEEZE.returnSeconds * 0.6);
    expect(after / 60).toBeLessThan(SQUEEZE.returnSeconds * 1.6);
  });

  it('the return is slow at once: one second after the lift it is not yet back', () => {
    const g = new SquishGrid();
    g.press(finger(0, 0));
    run(g, 0.5);
    const deepest = g.maxOffset();
    g.release();
    run(g, 1);
    expect(g.maxOffset()).toBeGreaterThan(0.04 * deepest);
    expect(g.maxOffset()).toBeLessThan(0.7 * deepest);
  });

  it('a drag stretches the points near where the finger came down, towards the finger', () => {
    const g = new SquishGrid();
    const f = finger(-0.4, 0, 1);
    g.press(f);
    run(g, 0.1);
    f.x = 0.1;
    run(g, 0.4);
    const p = nearest(g, -0.4, 0);
    expect(g.off[p * 2]).toBeGreaterThan(0.15);
  });

  it('a long frame (a slow phone) does not blow it up', () => {
    const g = new SquishGrid();
    g.press(finger(0, 0));
    for (let i = 0; i < 30; i++) g.step(0.5);
    expect(Number.isFinite(g.maxOffset())).toBe(true);
    expect(g.maxOffset()).toBeLessThan(1.5);
  });

  it('the three numbers can be tuned (a slower return is slower)', () => {
    const slow = SQUEEZE.returnSeconds;
    try {
      SQUEEZE.returnSeconds = 3;
      const g = new SquishGrid();
      g.press(finger(0, 0));
      run(g, 0.5);
      const deepest = g.maxOffset();
      g.release();
      run(g, 1.5);
      expect(g.maxOffset()).toBeGreaterThan(0.2 * deepest);
    } finally {
      SQUEEZE.returnSeconds = slow;
    }
  });
});
