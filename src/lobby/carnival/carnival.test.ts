import { describe, expect, it } from 'vitest';
import { clampDist, clampTarget, DIST_MAX, DIST_MIN, eye, fitDist, isTap, PAN_LIMIT, PAN_Z } from './camera';
import { ISLAND_R, minGap, PLOT_PAD, PLOT_R, plots, ZS } from './layout';
import { residents } from './residents';
import { makeGraph, rng, Walker } from './walk';
import { NAME_KEYS } from '../../games/english/content/heLines';

describe('the camera', () => {
  it('a quick touch that hardly moves is a tap; a drag or a long press is not', () => {
    expect(isTap(0, 100)).toBe(true);
    expect(isTap(10, 399)).toBe(true);
    expect(isTap(11, 100)).toBe(false);
    expect(isTap(2, 900)).toBe(false);
  });
  it('zoom and pan stay inside the limits', () => {
    expect(clampDist(1)).toBe(DIST_MIN);
    expect(clampDist(999)).toBe(DIST_MAX);
    const s = clampTarget({ x: 50, z: 0, dist: 1 });
    expect(Math.hypot(s.x / PAN_LIMIT, s.z / PAN_Z)).toBeCloseTo(1);
    expect(s.dist).toBe(DIST_MIN);
  });
  it('the angle is fixed: the eye is above and in front of the target', () => {
    const e = eye({ x: 1, z: 2, dist: 20 });
    expect(e.x).toBe(1);
    expect(e.y).toBeGreaterThan(10);
    expect(e.z).toBeGreaterThan(2);
  });
  it('the start fits a narrow phone screen', () => {
    expect(fitDist(0.5, 9)).toBeGreaterThan(fitDist(1.3, 9));
  });
});

describe('the plan of the island', () => {
  it('the plots are round the island, inside it, and their pads do not touch', () => {
    for (const n of [5, 7, 9, 12]) {
      const ps = plots(n);
      expect(ps).toHaveLength(n);
      for (const p of ps) {
        expect(Math.hypot(p.x / PLOT_R, p.z / (PLOT_R * ZS))).toBeCloseTo(1);
        expect(Math.hypot(p.x / (ISLAND_R - PLOT_PAD), p.z / ((ISLAND_R - PLOT_PAD) * ZS))).toBeLessThan(1);
      }
      if (n <= 9) expect(minGap(ps)).toBeGreaterThan(0.3);
    }
  });
});

describe('walking', () => {
  it('the graph is connected and every node has a way on', () => {
    const g = makeGraph();
    expect(g.nodes.every((n) => n.next.length >= 2)).toBe(true);
    const seen = new Set<number>([0]);
    const q = [0];
    while (q.length) for (const m of g.nodes[q.pop()!].next) if (!seen.has(m)) (seen.add(m), q.push(m));
    expect(seen.size).toBe(g.nodes.length);
  });
  it('a walker never leaves the paths, and it does move', () => {
    const g = makeGraph();
    const w = new Walker(g, 0, rng(5));
    let moved = 0;
    let px = w.x, pz = w.z;
    for (let i = 0; i < 6000; i++) {
      w.update(1 / 60);
      // on a straight line between two linked nodes: its distance to the segment is nil
      const near = g.nodes.some((a) => a.next.some((bi) => {
        const b = g.nodes[bi];
        const dx = b.x - a.x, dz = b.z - a.z;
        const t = Math.max(0, Math.min(1, ((w.x - a.x) * dx + (w.z - a.z) * dz) / (dx * dx + dz * dz)));
        return Math.hypot(w.x - (a.x + t * dx), w.z - (a.z + t * dz)) < 1e-6;
      }));
      expect(near).toBe(true);
      expect(Math.hypot(w.x - px, w.z - pz)).toBeLessThan(0.05);
      moved += Math.hypot(w.x - px, w.z - pz);
      px = w.x;
      pz = w.z;
    }
    expect(moved).toBeGreaterThan(20);
  });
  it('a walker that is held stands still', () => {
    const w = new Walker(makeGraph(), 3, rng(1));
    w.held = true;
    const { x, z } = w;
    for (let i = 0; i < 300; i++) w.update(1 / 60);
    expect([w.x, w.z]).toEqual([x, z]);
  });
});

describe('the residents', () => {
  it('five, with different names, and every name is one that has a recording', () => {
    const rs = residents('לילה', 'bunny');
    expect(rs).toHaveLength(5);
    expect(new Set(rs.map((r) => r.name)).size).toBe(5);
    expect(rs[0].name).toBe('לילה');
    expect(rs[0].img).toContain('bunny');
    for (const r of residents(null, null)) expect(NAME_KEYS[r.name], r.name).toBeTruthy();
    for (const r of rs.slice(1)) expect(NAME_KEYS[r.name], r.name).toBeTruthy();
  });
});

import { wantsOldLobby } from './entry';
describe('the old lobby behind #lobby:old', () => {
  const mem = (): { s: Map<string, string>; getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void } => {
    const s = new Map<string, string>();
    return { s, getItem: (k) => s.get(k) ?? null, setItem: (k, v) => void s.set(k, v), removeItem: (k) => void s.delete(k) };
  };
  it('is off by default, `#lobby:old` turns it on and keeps it, `#lobby:new` turns it off', () => {
    const st = mem();
    expect(wantsOldLobby('#/', st)).toBe(false);
    expect(wantsOldLobby('#lobby:old', st)).toBe(true);
    expect(wantsOldLobby('#/', st)).toBe(true);
    expect(wantsOldLobby('#lobby:new', st)).toBe(false);
    expect(wantsOldLobby('#/', st)).toBe(false);
  });
});
