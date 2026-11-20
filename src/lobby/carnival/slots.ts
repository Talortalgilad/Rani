/**
 * The places of the carnival (SPEC-carnival.md 5.1): 10 for stalls and shops, 8 for rides, 24 for decorations. Fixed, and locked by the level of the carnival.
 * Pure: numbers only. Stalls stand along the vertical path inside the ring (their queue forms on the path); rides and decorations stand outside the ring,
 * away from the plots of the games.
 */
import { PATH_W, PLAZA_R, PLOT_PAD, RING_R, ZS, ISLAND_R, plots } from './layout';
import type { SlotKind } from './catalog';

export interface Slot {
  id: string;
  kind: SlotKind;
  x: number;
  z: number;
  /** the level of the carnival that opens it */
  level: number;
  /** where a resident stands to use it (the front), and where the queue goes on from there (a step each) */
  front: { x: number; z: number };
  step: { x: number; z: number };
}
export const COUNTS: Record<SlotKind, number> = { stall: 10, ride: 8, decor: 24 };

/** The level at which each place opens: 3 stalls, 2 rides and 6 decorations from the start, then more with every level (the last at level 12). */
const openLevel = (kind: SlotKind, i: number): number => {
  const start = kind === 'stall' ? 3 : kind === 'ride' ? 2 : 6;
  return i < start ? 1 : 1 + Math.ceil(((i - start + 1) * 11) / (COUNTS[kind] - start));
};

const dist = (a: { x: number; z: number }, b: { x: number; z: number }): number => Math.hypot(a.x - b.x, a.z - b.z);

/** The places, given how many plots there are (games and locked tents). Deterministic. */
export function makeSlots(nPlots: number): Slot[] {
  const ps = plots(nPlots);
  const out: Slot[] = [];
  // stalls: beside the vertical path, in two columns, four places toward the back and four toward the front, two more beside the plaza
  const zs = [-7.2, -5.6, -4.0, 4.0, 5.6, 7.2];
  const stalls: { x: number; z: number; dir: 1 | -1 }[] = [];
  for (const z of zs) for (const x of [-1.55, 1.55]) stalls.push({ x, z, dir: z < 0 ? 1 : -1 });
  stalls.push({ x: -3.3, z: 0, dir: 1 }, { x: 3.3, z: 0, dir: 1 });
  // the order of opening: those near the plaza first
  const rank = (s: { x: number; z: number }): number => Math.abs(s.z) + Math.abs(s.x) * 0.2;
  stalls.sort((a, b) => rank(a) - rank(b));
  stalls.slice(0, COUNTS.stall).forEach((s, i) => {
    const side = s.x < 0 ? -1 : 1;
    // the queue stands on the path, on the side of the stall, and goes toward the plaza (or along the path for the two beside the plaza)
    const front = s.z === 0 ? { x: side * 2.9, z: 0.9 } : { x: side * 0.3, z: s.z };
    const step = s.z === 0 ? { x: 0, z: 0.5 } : { x: 0, z: 0.5 * s.dir };
    out.push({ id: `s${i}`, kind: 'stall', x: s.x, z: s.z, level: openLevel('stall', i), front, step });
  });
  // rides and decorations: on a grid, outside the ring, not on a plot, not on the paths; the ones near the ring first
  const cand: { x: number; z: number }[] = [];
  for (let gx = -7; gx <= 7; gx += 0.55) for (let gz = -15; gz <= 15; gz += 0.55) {
    const p = { x: gx, z: gz };
    if ((gx / (ISLAND_R - 0.7)) ** 2 + (gz / ((ISLAND_R - 0.7) * ZS)) ** 2 > 1) continue; // inside the island
    if ((gx / (RING_R + PATH_W * 1.02)) ** 2 + (gz / ((RING_R + PATH_W * 1.02) * ZS)) ** 2 < 1) continue; // outside the ring and its lamps
    if (ps.some((q) => dist(p, q) < PLOT_PAD + 0.5)) continue;
    cand.push(p);
  }
  const far = (min: number, taken: { x: number; z: number }[], n: number, sortKey: (p: { x: number; z: number }) => number): { x: number; z: number }[] => {
    const pool = [...cand].sort((a, b) => sortKey(a) - sortKey(b));
    const chosen: { x: number; z: number }[] = [];
    for (const c of pool) {
      if (chosen.length >= n) break;
      if ([...taken, ...chosen].every((t) => dist(c, t) >= min)) chosen.push(c);
    }
    return chosen;
  };
  const ringKey = (p: { x: number; z: number }): number => Math.hypot(p.x / (RING_R + 1), p.z / ((RING_R + 1) * ZS));
  const rides = far(2.0, [], COUNTS.ride, ringKey);
  rides.forEach((p, i) => {
    // the queue of a ride forms on the ring path, at its nearest point
    const a = Math.atan2(p.x / (RING_R + 1), -p.z / ((RING_R + 1) * ZS));
    const front = { x: Math.sin(a) * RING_R, z: -Math.cos(a) * RING_R * ZS };
    const tangent = { x: Math.cos(a), z: Math.sin(a) * ZS };
    const l = Math.hypot(tangent.x, tangent.z) || 1;
    out.push({ id: `r${i}`, kind: 'ride', x: p.x, z: p.z, level: openLevel('ride', i), front, step: { x: (tangent.x / l) * 0.5, z: (tangent.z / l) * 0.5 } });
  });
  const decor = far(1.0, rides.map((r) => ({ x: r.x * 1, z: r.z })), COUNTS.decor, (p) => ringKey(p) * 0.7 + Math.abs(Math.sin(p.x * 3.1 + p.z * 1.7)) * 0.4);
  decor.forEach((p, i) => out.push({ id: `d${i}`, kind: 'decor', x: p.x, z: p.z, level: openLevel('decor', i), front: { x: p.x, z: p.z }, step: { x: 0, z: 0 } }));
  void PLAZA_R;
  return out;
}
export const slotsOf = (all: Slot[], kind: SlotKind): Slot[] => all.filter((s) => s.kind === kind);
