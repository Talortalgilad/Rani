import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { easeOutBack, easeOutCubic, Spring, squashStretch } from './motion';
import { FPS_FLOOR, initialTier, lowerTier, QualityMonitor } from './quality';
import { skyFor } from './sky';
import { JAR_CAPACITY, jarSlots, roundedBox, starGeometry } from './shapes';

describe('quality tiers', () => {
  it('starts in 2D without WebGL or when the parent chose regular', () => {
    expect(initialTier('auto', false, false)).toBe('2d');
    expect(initialTier('3d', false, false)).toBe('2d');
    expect(initialTier('2d', true, false)).toBe('2d');
  });
  it('auto picks high, or medium on a weak device; the parent can force 3D', () => {
    expect(initialTier('auto', true, false)).toBe('high');
    expect(initialTier('auto', true, true)).toBe('medium');
    expect(initialTier('3d', true, true)).toBe('high');
  });
  it('tiers only go down, and stop at 2D', () => {
    expect(lowerTier('high')).toBe('medium');
    expect(lowerTier('medium')).toBe('2d');
    expect(lowerTier('2d')).toBe('2d');
  });
});

describe('quality monitor: below 45 fps for 3 seconds in a row lowers the tier', () => {
  /** One entry per second: that many frames of equal length (dt exactly 1/fps, so sums are exact for powers of two). */
  const run = (fps: number[]) => {
    let downs = 0;
    const m = new QualityMonitor(() => downs++);
    for (const f of fps) for (let i = 0; i < f; i++) m.sample(1 / f);
    return downs;
  };
  it('3 slow seconds -> one downgrade', () => expect(run([32, 32, 32])).toBe(1));
  it('2 slow seconds then a good one -> none', () => expect(run([32, 32, 64, 32, 32, 64])).toBe(0));
  it('smooth 60 fps never downgrades', () => expect(run(Array(20).fill(64))).toBe(0));
  it('exactly at the floor is fine', () => expect(run(Array(5).fill(FPS_FLOOR))).toBe(0));
  it('6 slow seconds -> two downgrades (high -> medium -> 2D)', () => expect(run(Array(6).fill(16))).toBe(2));
});

describe('motion', () => {
  it('a spring settles on its target without running away', () => {
    const s = new Spring(0, 120, 14);
    s.target = 1;
    let max = 0;
    for (let i = 0; i < 240; i++) max = Math.max(max, s.step(1 / 60));
    expect(s.settled).toBe(true);
    expect(s.value).toBeCloseTo(1, 2);
    expect(max).toBeLessThan(1.3); // bounces a little, never explodes
  });
  it('stays stable even with a very long frame', () => {
    const s = new Spring(0, 200, 8);
    s.target = 1;
    s.step(0.5);
    expect(Number.isFinite(s.value)).toBe(true);
    expect(Math.abs(s.value)).toBeLessThan(3);
  });
  it('snap jumps straight to the target (reduced motion)', () => {
    const s = new Spring(0);
    s.target = 5;
    s.snap();
    expect([s.value, s.velocity, s.settled]).toEqual([5, 0, true]);
  });
  it('easing ends at 1, squash & stretch keeps volume and returns to normal', () => {
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutBack(1)).toBeCloseTo(1, 5);
    for (let t = 0; t <= 1; t += 0.05) {
      const q = squashStretch(t);
      expect(q.sx * q.sz * q.sy).toBeCloseTo(1, 5); // volume is kept
      expect(q.sy).toBeGreaterThan(0.5);
      expect(q.sy).toBeLessThan(1.5);
    }
    const end = squashStretch(1);
    expect(end.sy).toBeCloseTo(1, 1);
  });
});

describe('sky by time of day', () => {
  const at = (h: number, m = 0) => skyFor(new Date(2026, 0, 1, h, m));
  it('differs between morning, noon, evening and night', () => {
    const tops = [at(8).top, at(12).top, at(18, 30).top, at(23).top];
    expect(new Set(tops).size).toBe(4);
  });
  it('is a valid colour at every minute of the day, and changes smoothly', () => {
    let prev = at(0).top;
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 15) {
        const s = at(h, m);
        expect(s.top).toMatch(/^#[0-9a-f]{6}$/);
        expect(s.bottom).toMatch(/^#[0-9a-f]{6}$/);
        expect(s.intensity).toBeGreaterThan(0);
        const d = [1, 3, 5].reduce((a, i) => a + Math.abs(parseInt(s.top.slice(i, i + 2), 16) - parseInt(prev.slice(i, i + 2), 16)), 0);
        expect(d).toBeLessThan(120); // no jumps
        prev = s.top;
      }
    }
  });
  it('evening is warmer (more red than blue) than noon', () => {
    const e = at(18, 30).top;
    const n = at(12).top;
    const rb = (c: string) => parseInt(c.slice(1, 3), 16) - parseInt(c.slice(5, 7), 16);
    expect(rb(e)).toBeGreaterThan(rb(n));
  });
});

describe('shapes', () => {
  it('rounded box and star build real geometry of the requested size', () => {
    const b = roundedBox(0.5, 0.22, 0.24, 0.07);
    b.computeBoundingBox();
    const size = b.boundingBox!.getSize(new Vector3());
    expect(size.x).toBeCloseTo(0.5, 1);
    expect(size.y).toBeCloseTo(0.22, 1);
    expect(size.z).toBeCloseTo(0.24, 1);
    const s = starGeometry(0.1, 0.045, 0.04);
    expect(s.attributes.position.count).toBeGreaterThan(30);
  });
  it('the jar packs stars in layers: distinct slots, inside the glass, filled from the bottom', () => {
    const slots = jarSlots(JAR_CAPACITY);
    expect(slots).toHaveLength(JAR_CAPACITY);
    expect(new Set(slots.map((s) => `${s.x.toFixed(3)},${s.y.toFixed(3)},${s.z.toFixed(3)}`)).size).toBe(JAR_CAPACITY);
    slots.forEach((s) => expect(Math.hypot(s.x, s.z)).toBeLessThanOrEqual(0.36));
    for (let i = 1; i < slots.length; i++) expect(slots[i].y).toBeGreaterThanOrEqual(slots[i - 1].y);
    expect(slots[slots.length - 1].y + 0.12).toBeLessThan(1.0); // below the rim of the 1.1-high jar
  });
});
