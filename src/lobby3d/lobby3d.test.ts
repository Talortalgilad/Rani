import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { Carousel } from './carousel';
import { buildGameIsland, buildLockedIsland } from './islands';
import { easeOutBack, easeOutCubic, Spring, squashStretch } from './motion';
import { FPS_FLOOR, initialTier, lowerTier, QualityMonitor } from './quality';
import { Materials, roundedBox, starGeometry } from './shapes';
import { isNight, skyFor } from './sky';

const settle = (c: Carousel) => {
  for (let i = 0; i < 400; i++) c.update(1 / 60);
};

describe('carousel', () => {
  it('starts on the requested island and reports it as the front', () => {
    const c = new Carousel(4, false, 2);
    expect(c.front).toBe(2);
    expect(c.nearest).toBe(2);
  });
  it('a slow drag settles on the nearest island, however far it was dragged', () => {
    const c = new Carousel(4);
    c.dragStart();
    c.dragBy(-c.step * 0.4, -0.2); // less than half a step to the left
    c.release(-0.2);
    settle(c);
    expect(c.nearest).toBe(0);
    c.dragStart();
    c.dragBy(-c.step * 0.7, -0.2);
    c.release(-0.2);
    settle(c);
    expect(c.nearest).toBe(1);
    expect(c.rot.value).toBeCloseTo(-c.step, 2); // exactly in front of an island
  });
  it('a fast flick skips to the next island, in the direction of the flick', () => {
    const c = new Carousel(4);
    c.dragStart();
    c.dragBy(-c.step * 0.15, -4); // tiny drag, quick
    c.release(-4);
    settle(c);
    expect(c.nearest).toBe(1);
    c.dragStart();
    c.dragBy(c.step * 0.1, 4);
    c.release(4);
    settle(c);
    expect(c.nearest).toBe(0);
  });
  it('a long fast drag carries on as far as it went instead of stopping after one island', () => {
    const c = new Carousel(6);
    c.dragStart();
    c.dragBy(-c.step * 1.7, -3.2); // already 1.7 islands along, still moving
    c.release(-3.2);
    settle(c);
    expect(c.nearest).toBe(2);
    c.dragStart();
    c.dragBy(c.step * 2.6, 3.2);
    c.release(3.2);
    settle(c);
    expect(c.nearest).toBe(5); // 2 - 3 = -1 -> wraps to 5
  });
  it('wraps around: flicking left from the last island lands on the first', () => {
    const c = new Carousel(4, false, 3);
    c.dragStart();
    c.dragBy(-0.2, -4);
    c.release(-4);
    settle(c);
    expect(c.nearest).toBe(0);
  });
  it('tapping a side island turns it to the middle; tapping the middle one opens it', () => {
    const c = new Carousel(4);
    expect(c.tap(0)).toBe('enter');
    expect(c.tap(1)).toBe('rotate');
    settle(c);
    expect(c.nearest).toBe(1);
    expect(c.tap(1)).toBe('enter');
    expect(c.tap(3)).toBe('rotate'); // 3 is the other neighbour: it goes the short way round
    settle(c);
    expect(c.nearest).toBe(3);
  });
  it('does not open an island while the carousel is still turning', () => {
    const c = new Carousel(4);
    c.tap(1);
    c.update(1 / 60);
    expect(c.tap(0)).toBe('rotate');
  });
  it('leans toward the way it moves while dragging, and straightens afterwards', () => {
    const c = new Carousel(4);
    c.dragStart();
    for (let i = 0; i < 20; i++) {
      c.dragBy(-0.05 * i, -3);
      c.update(1 / 60);
    }
    expect(c.lean).toBeLessThan(-0.05);
    expect(Math.abs(c.lean)).toBeLessThanOrEqual(0.31);
    c.release(0);
    settle(c);
    expect(Math.abs(c.lean)).toBeLessThan(0.01);
  });
  it('with reduced motion it jumps between islands with no swing', () => {
    const c = new Carousel(4, true);
    c.tap(2);
    expect(c.rot.value).toBeCloseTo(-2 * c.step, 6);
    expect(c.lean).toBe(0);
  });
});

describe('quality tiers', () => {
  it('starts in regular mode without WebGL or when the parent chose it', () => {
    expect(initialTier('auto', false, false)).toBe('2d');
    expect(initialTier('3d', false, false)).toBe('2d');
    expect(initialTier('2d', true, false)).toBe('2d');
  });
  it('auto picks high, or medium on a weak device; the parent can force the lobby', () => {
    expect(initialTier('auto', true, false)).toBe('high');
    expect(initialTier('auto', true, true)).toBe('medium');
    expect(initialTier('3d', true, true)).toBe('high');
  });
  it('tiers only go down, and stop at regular', () => {
    expect(lowerTier('high')).toBe('medium');
    expect(lowerTier('medium')).toBe('2d');
    expect(lowerTier('2d')).toBe('2d');
  });
  describe('monitor: below 45 fps for 3 seconds in a row lowers the tier', () => {
    const run = (fps: number[]) => {
      let downs = 0;
      const m = new QualityMonitor(() => downs++);
      for (const f of fps) for (let i = 0; i < f; i++) m.sample(1 / f);
      return downs;
    };
    it('3 slow seconds -> one downgrade', () => expect(run([32, 32, 32])).toBe(1));
    it('2 slow seconds then a good one -> none', () => expect(run([32, 32, 64, 32, 32, 64])).toBe(0));
    it('smooth 64 fps never downgrades', () => expect(run(Array(20).fill(64))).toBe(0));
    it('a steady 45 fps is fine', () => expect(run(Array(5).fill(FPS_FLOOR))).toBe(0));
    it('6 slow seconds -> two downgrades (high -> medium -> regular)', () => expect(run(Array(6).fill(16))).toBe(2));
  });
});

describe('motion', () => {
  it('a spring settles on its target and does not run away, even after a very long frame', () => {
    const s = new Spring(0, 120, 14);
    s.target = 1;
    let max = 0;
    for (let i = 0; i < 240; i++) max = Math.max(max, s.step(1 / 60));
    expect(s.settled).toBe(true);
    expect(max).toBeLessThan(1.3);
    const t = new Spring(0, 200, 8);
    t.target = 1;
    t.step(0.5);
    expect(Math.abs(t.value)).toBeLessThan(3);
  });
  it('easing ends at 1; squash & stretch keeps its volume and returns to normal', () => {
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutBack(1)).toBeCloseTo(1, 5);
    for (let t = 0; t <= 1; t += 0.05) {
      const q = squashStretch(t);
      expect(q.sx * q.sz * q.sy).toBeCloseTo(1, 5);
      expect(q.sy).toBeGreaterThan(0.5);
      expect(q.sy).toBeLessThan(1.5);
    }
    expect(squashStretch(1).sy).toBeCloseTo(1, 1);
  });
});

describe('sky by time of day', () => {
  const at = (h: number, m = 0) => skyFor(new Date(2026, 0, 1, h, m));
  it('differs between morning, noon, evening and night; evening is the warmest', () => {
    expect(new Set([at(8).top, at(12).top, at(18, 30).top, at(23).top]).size).toBe(4);
    const rb = (c: string) => parseInt(c.slice(1, 3), 16) - parseInt(c.slice(5, 7), 16);
    expect(rb(at(18, 30).top)).toBeGreaterThan(rb(at(12).top));
  });
  it('is a valid colour at every moment and never jumps', () => {
    let prev = at(0).top;
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 15) {
        const s = at(h, m);
        expect(s.top).toMatch(/^#[0-9a-f]{6}$/);
        expect(s.intensity).toBeGreaterThan(0);
        const d = [1, 3, 5].reduce((a, i) => a + Math.abs(parseInt(s.top.slice(i, i + 2), 16) - parseInt(prev.slice(i, i + 2), 16)), 0);
        expect(d).toBeLessThan(120);
        prev = s.top;
      }
    }
  });
  it('stars come out only at night', () => {
    expect(isNight(new Date(2026, 0, 1, 23))).toBe(true);
    expect(isNight(new Date(2026, 0, 1, 3))).toBe(true);
    expect(isNight(new Date(2026, 0, 1, 12))).toBe(false);
    expect(isNight(new Date(2026, 0, 1, 18))).toBe(false);
  });
});

describe('islands', () => {
  it('rounded box and star have real geometry of the requested size', () => {
    const b = roundedBox(0.5, 0.22, 0.24, 0.07);
    b.computeBoundingBox();
    const size = b.boundingBox!.getSize(new Vector3());
    expect([size.x, size.y, size.z].map((v) => Math.round(v * 10) / 10)).toEqual([0.5, 0.2, 0.2]);
    expect(starGeometry(0.1, 0.045, 0.04).attributes.position.count).toBeGreaterThan(30);
  });
  it('any game gets a basic island, with an emoji icon or an svg one, even a game with nothing special', () => {
    const mats = new Materials();
    for (const icon of ['🧱', '<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"></svg>', undefined]) {
      const isl = buildGameIsland({ kind: 'game', title: 'משחק חדש', icon, color: '#ff8800' }, mats, false);
      expect(isl.kind).toBe('game');
      expect(isl.group.children.length).toBeGreaterThanOrEqual(3);
      isl.update(0.016, 1, false);
      isl.update(0.016, 1, true);
      isl.dispose();
    }
    mats.dispose();
  });
  it('locked islands carry cloud and padlock, react to a tap, and never open', () => {
    const mats = new Materials();
    const isl = buildLockedIsland(mats, 0);
    expect(isl.kind).toBe('locked');
    isl.tap(false);
    for (let i = 0; i < 60; i++) isl.update(1 / 60, i / 60, false);
    isl.tap(true); // reduced motion: nothing moves
    isl.dispose();
    mats.dispose();
  });
});

import { buildJar } from './jar';
import { JAR_CAPACITY, jarSlots } from './shapes';
import { Birds } from './sky';
import { games } from '../games/registry';
import { createLobbyIsland as brickIsland } from '../games/brick-breaker/lobby-island';
import { createLobbyIsland as memoryIsland } from '../games/memory/lobby-island';

describe('star jar', () => {
  it('holds 100 stars in layers: distinct slots, inside the glass, filled from the bottom', () => {
    const slots = jarSlots(JAR_CAPACITY);
    expect(JAR_CAPACITY).toBe(100);
    expect(new Set(slots.map((s) => `${s.x.toFixed(3)},${s.y.toFixed(3)},${s.z.toFixed(3)}`)).size).toBe(100);
    slots.forEach((s) => expect(Math.hypot(s.x, s.z)).toBeLessThanOrEqual(0.37));
    for (let i = 1; i < slots.length; i++) expect(slots[i].y).toBeGreaterThanOrEqual(slots[i - 1].y);
    expect(slots[99].y + 0.12).toBeLessThan(1.2); // below the rim of the 1.3-high jar
  });
  const run = (total: number, shown: number, reduced = false) => {
    const mats = new Materials();
    const lands: number[] = [];
    const shownCalls: number[] = [];
    const jar = buildJar(mats, total, shown, reduced, { onLand: (n) => lands.push(n), onShown: (n) => shownCalls.push(n) });
    for (let i = 0; i < 60 * 30; i++) jar.update(1 / 60);
    return { jar, lands, shownCalls, mats };
  };
  it('new stars fall in one by one, each landing makes a sound, and the count ends at the total', () => {
    const { jar, lands, shownCalls } = run(12, 5);
    expect(lands).toEqual([6, 7, 8, 9, 10, 11, 12]);
    expect(jar.count()).toBe(12);
    expect(shownCalls[shownCalls.length - 1]).toBe(12);
  });
  it('with nothing new, nothing falls', () => {
    const { lands, jar } = run(9, 9);
    expect(lands).toEqual([]);
    expect(jar.count()).toBe(9);
  });
  it('it fills up to 100 and then stays full, however many stars there are', () => {
    const { lands, jar } = run(250, 97);
    expect(lands).toEqual([98, 99, 100]);
    expect(jar.count()).toBe(100);
  });
  it('with reduced motion the stars just appear, and the jar will not hop', () => {
    const { lands, jar } = run(10, 4, true);
    expect(lands).toEqual([]);
    expect(jar.count()).toBe(10);
    jar.hop();
    jar.update(0.1);
  });
  it('tapping makes the stars hop, then settle', () => {
    const { jar } = run(20, 20);
    jar.hop();
    for (let i = 0; i < 120; i++) jar.update(1 / 60);
    jar.dispose();
  });
});

describe('birds', () => {
  it('never appear when disabled (medium quality or reduced motion)', () => {
    const b = new Birds(false, () => 0.1);
    for (let i = 0; i < 60 * 60; i++) b.update(1 / 60, i / 60);
    expect(b.flying).toBe(0);
  });
  it('cross the sky now and then, and leave it again', () => {
    const b = new Birds(true, () => 0.5);
    let seen = 0;
    let flights = 0;
    let was = 0;
    for (let i = 0; i < 60 * 90; i++) {
      b.update(1 / 60, i / 60);
      seen = Math.max(seen, b.flying);
      if (b.flying > 0 && was === 0) flights++;
      was = b.flying;
    }
    expect(seen).toBeGreaterThanOrEqual(1);
    expect(flights).toBeGreaterThanOrEqual(3); // every 10-20 seconds
    expect(flights).toBeLessThanOrEqual(8);
  });
  it('drops to none when the quality is lowered', () => {
    const b = new Birds(true, () => 0);
    for (let i = 0; i < 60 * 12; i++) b.update(1 / 60, i / 60);
    expect(b.flying).toBeGreaterThan(0);
    b.setTier('medium');
    expect(b.flying).toBe(0);
  });
});

describe('game miniatures', () => {
  it('both games bring one, and a game without one is fine (it gets the basic island)', () => {
    expect(games.find((g) => g.id === 'brick-breaker')!.lobbyIsland).toBeTypeOf('function');
    expect(games.find((g) => g.id === 'memory')!.lobbyIsland).toBeTypeOf('function');
  });
  it.each([
    ['brick breaker', brickIsland],
    ['memory', memoryIsland],
  ])('%s: builds, animates for a minute, reacts to a tap and frees everything', (_n, make) => {
    for (const reduced of [false, true]) {
      const h = make({ shadows: true, reduced });
      expect(h.object.children.length).toBeGreaterThan(3);
      for (let i = 0; i < 60 * 60; i++) h.update(1 / 60, i / 60);
      h.tap?.();
      h.update(0.016, 61);
      h.dispose();
    }
  });
  it('the brick breaker wall stays whole and the ball stays over the island', () => {
    const h = brickIsland({ shadows: false, reduced: false });
    for (let i = 0; i < 60 * 40; i++) {
      h.update(1 / 60, i / 60);
      h.object.traverse((o) => {
        if (o.position.length() > 4) throw new Error('something flew away');
      });
    }
    h.dispose();
  });
});

import { SETTLE } from './carousel';

describe('carousel feel (spring tuning)', () => {
  /** Simulates a one-island move at 240 Hz and reports overshoot and time to rest. */
  const sim = (distance: number) => {
    const s = new Spring(0, SETTLE.stiffness, SETTLE.damping);
    s.target = distance;
    let peak = 0;
    let rest = -1;
    for (let i = 1; i <= 240 * 3; i++) {
      s.step(1 / 240);
      peak = Math.max(peak, s.value);
      if (rest < 0 && Math.abs(s.value - distance) < 0.01 && Math.abs(s.velocity) < 0.05) rest = i / 240;
    }
    return { overshoot: (peak - distance) / distance, rest };
  };
  it('moving one island: a soft bounce (about 4%, never above 6%) and at rest within 0.7 s', () => {
    const r = sim(Math.PI / 2);
    expect(r.overshoot).toBeGreaterThan(0.01); // it does bounce a little
    expect(r.overshoot).toBeLessThan(0.06);
    expect(r.rest).toBeGreaterThan(0);
    expect(r.rest).toBeLessThan(0.7);
  });
  it('a short snap-back settles a little faster, with the same bounce', () => {
    const short = sim((Math.PI / 2) * 0.3);
    expect(short.rest).toBeLessThan(0.65);
    expect(short.overshoot).toBeLessThan(0.06);
  });
  it('is critically-ish damped: the damping ratio is between 0.6 and 0.8', () => {
    expect(SETTLE.damping / (2 * Math.sqrt(SETTLE.stiffness))).toBeGreaterThan(0.6);
    expect(SETTLE.damping / (2 * Math.sqrt(SETTLE.stiffness))).toBeLessThan(0.8);
  });
  it('the carousel reports when it is at rest, so the lobby can play the settle sound once', () => {
    const c = new Carousel(4);
    expect(c.settled).toBe(true);
    c.dragStart();
    expect(c.settled).toBe(false);
    c.dragBy(-0.5, -1);
    c.release(-1);
    expect(c.settled).toBe(false);
    for (let i = 0; i < 400; i++) c.update(1 / 60);
    expect(c.settled).toBe(true);
  });
});
