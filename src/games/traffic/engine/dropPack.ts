import { corners, overlaps, type Obb } from './geometry';
import { itemBox, sameDirectionClusters, type Item } from './packing';
import { SIZES, type VType } from './state';

/**
 * Packs by dropping the vehicles one at a time into a box of the given width: each one falls and slides toward the
 * bottom-left corner until it rests, and of many tries (in all four directions) the lowest, tightest resting place wins.
 * A direction is not allowed when it would make more than `maxSame` neighbours lie the same way.
 */
const GAP = 0.03;

/** What a direction chooser may look at: which vehicle this is, what stands already, and what is still to come. */
export interface ClassInfo { i: number; placed: Item[]; type: VType; rest: VType[] }

export interface Dropped { items: Item[]; width: number; height: number }

export function dropPack(types: VType[], classesFor: (info: ClassInfo) => number[], width: number, r: () => number, maxSame: number, tries = 60, improveRounds = 0, wTop = 0.8, wContact = 4, initial?: Item[]): Dropped | null {
  const placed: Item[] = [];
  const boxes: Obb[] = [];
  const hw = width / 2;
  const valid = (b: Obb): boolean => {
    for (const c of corners(b)) if (c.x < -hw - 1e-9 || c.x > hw + 1e-9 || c.z < -1e-9) return false;
    for (const o of boxes) {
      if (Math.abs(o.x - b.x) > 5 || Math.abs(o.z - b.z) > 5) continue;
      if (overlaps(b, o, -GAP)) return false; // a negative margin grows both boxes: a real gap of 6 cm
    }
    return true;
  };
  const move = (b: Obb, dx: number, dz: number): Obb => ({ ...b, x: b.x + dx, z: b.z + dz });
  const settle = (b0: Obb): Obb => {
    let b = b0;
    for (let round = 0; round < 40; round++) {
      let moved = false;
      for (const [dx, dz] of [[0, -1], [-1, 0]]) {
        let guard = 0;
        // big steps first, then small ones
        for (const st of [0.5, 0.1, 0.02]) while (guard++ < 400 && valid(move(b, dx * st, dz * st))) {
          b = move(b, dx * st, dz * st);
          moved = true;
        }
      }
      if (!moved) break;
    }
    return b;
  };
  const top = (b: Obb): number => Math.max(...corners(b).map((c) => c.z));
  /** Drops one vehicle (all directions, many tries) and returns the best resting place, or null. */
  const dropOne = (type: VType, classes: number[], nTries: number, others: Item[], bounds: { maxZ: number }): { it: Item; score: number } | null => {
    let best: { it: Item; score: number } | null = null;
    for (const cls of classes) {
      for (let k = 0; k < nTries; k++) {
        const startZ = bounds.maxZ + 4 + SIZES[type].len;
        let b = itemBox({ type, cls, x: (r() * 2 - 1) * (hw - 1.2), z: startZ });
        let g = 0;
        while (!valid(b) && g++ < 40) b = move(b, 0, 0.5);
        if (!valid(b)) continue;
        b = settle(b);
        const it: Item = { type, cls, x: b.x, z: b.z };
        const trial = [...others, it];
        const groups = sameDirectionClusters(trial, 0.17);
        if (groups.some((gr) => gr.length > maxSame && gr.includes(trial.length - 1))) continue;
        const score = top(b) * wTop + (Math.min(...corners(b).map((c) => c.x)) + hw) * 0.12 - wContact * contact(b) + r() * 0.02;
        if (!best || score < best.score) best = { it, score };
      }
    }
    return best;
  };
  /** Share of points just outside the vehicle that touch a wall, the floor or another vehicle. */
  const contact = (b: Obb): number => {
    const probes = 28;
    let hit = 0;
    const cs = corners({ ...b, hl: b.hl + 0.1, hw: b.hw + 0.1 });
    for (let k = 0; k < probes; k++) {
      const t = (k / probes) * 4;
      const e = Math.floor(t);
      const f = t - e;
      const p0 = cs[e % 4];
      const p1 = cs[(e + 1) % 4];
      const x = p0.x + (p1.x - p0.x) * f;
      const z = p0.z + (p1.z - p0.z) * f;
      if (x < -hw || x > hw || z < 0) {
        hit++;
        continue;
      }
      for (const o of boxes) {
        if (Math.abs(o.x - x) > 5 || Math.abs(o.z - z) > 5) continue;
        if (overlaps({ x, z, hl: 0.01, hw: 0.01, heading: 0 }, o, 0)) {
          hit++;
          break;
        }
      }
    }
    return hit / probes;
  };
  const heightOf = (): number => boxes.reduce((m, b) => Math.max(m, top(b)), 0);
  if (initial) {
    // a packing that is already made: only improve it
    for (const it of initial) {
      placed.push({ ...it });
      boxes.push(itemBox(it));
    }
  }
  for (let i = initial ? types.length : 0; i < types.length; i++) {
    const best = dropOne(types[i], classesFor({ i, placed, type: types[i], rest: types.slice(i) }), tries, placed, { maxZ: heightOf() });
    if (!best) return null;
    placed.push(best.it);
    boxes.push(itemBox(best.it));
  }
  // improve: take out one of the highest vehicles and drop it again; keep the new place if the pile is not higher
  for (let round = 0; round < improveRounds; round++) {
    const order = boxes.map((b, i) => ({ i, t: top(b) })).sort((a, c) => c.t - a.t);
    const pick = order[Math.floor(r() * Math.min(order.length, Math.max(4, Math.floor(order.length * 0.35))))].i;
    const old = placed[pick];
    const oldBox = boxes[pick];
    const h0 = heightOf();
    placed.splice(pick, 1);
    boxes.splice(pick, 1);
    const best = dropOne(old.type, classesFor({ i: types.length - 1, placed, type: old.type, rest: [old.type] }), 40, placed, { maxZ: h0 });
    let keep = false;
    if (best) {
      placed.push(best.it);
      boxes.push(itemBox(best.it));
      if (heightOf() <= h0 + 1e-6) keep = true;
      else {
        placed.pop();
        boxes.pop();
      }
    }
    if (!keep) {
      placed.splice(pick, 0, old);
      boxes.splice(pick, 0, oldBox);
    }
  }
  return { items: placed, width, height: heightOf() };
}

/**
 * Like `dropPack`, but the box has a fixed height too and the vehicles settle toward the four corners in turn (the first
 * one into the bottom-left, the next into the top-right, and so on). The big ones are placed first, so every corner of
 * the lot gets big vehicles, and the small ones fill what is left between them.
 */
export function cornerPack(types: VType[], classesFor: (info: ClassInfo) => number[], width: number, height: number, r: () => number, maxSame: number, tries = 60, wContact = 4): Dropped | null {
  const placed: Item[] = [];
  const boxes: Obb[] = [];
  const hw = width / 2;
  const valid = (b: Obb): boolean => {
    for (const c of corners(b)) if (c.x < -hw - 1e-9 || c.x > hw + 1e-9 || c.z < -1e-9 || c.z > height + 1e-9) return false;
    for (const o of boxes) {
      if (Math.abs(o.x - b.x) > 5 || Math.abs(o.z - b.z) > 5) continue;
      if (overlaps(b, o, -GAP)) return false;
    }
    return true;
  };
  const move = (b: Obb, dx: number, dz: number): Obb => ({ ...b, x: b.x + dx, z: b.z + dz });
  const settle = (b0: Obb, gx: number, gz: number): Obb => {
    let b = b0;
    for (let round = 0; round < 40; round++) {
      let moved = false;
      for (const [dx, dz] of [[0, gz], [gx, 0]]) {
        let guard = 0;
        for (const st of [0.5, 0.1, 0.02]) while (guard++ < 400 && valid(move(b, dx * st, dz * st))) {
          b = move(b, dx * st, dz * st);
          moved = true;
        }
      }
      if (!moved) break;
    }
    return b;
  };
  const contact = (b: Obb): number => {
    const probes = 28;
    let hit = 0;
    const cs = corners({ ...b, hl: b.hl + 0.1, hw: b.hw + 0.1 });
    for (let k = 0; k < probes; k++) {
      const t = (k / probes) * 4;
      const e = Math.floor(t);
      const f = t - e;
      const p0 = cs[e % 4];
      const p1 = cs[(e + 1) % 4];
      const x = p0.x + (p1.x - p0.x) * f;
      const z = p0.z + (p1.z - p0.z) * f;
      if (x < -hw || x > hw || z < 0 || z > height) {
        hit++;
        continue;
      }
      for (const o of boxes) {
        if (Math.abs(o.x - x) > 5 || Math.abs(o.z - z) > 5) continue;
        if (overlaps({ x, z, hl: 0.01, hw: 0.01, heading: 0 }, o, 0)) {
          hit++;
          break;
        }
      }
    }
    return hit / probes;
  };
  const CORNERS: [number, number][] = [[-1, -1], [1, 1], [1, -1], [-1, 1]];
  for (let i = 0; i < types.length; i++) {
    const type = types[i];
    const [gx, gz] = CORNERS[i % 4];
    let best: { it: Item; score: number } | null = null;
    for (const cls of classesFor({ i, placed, type, rest: types.slice(i) })) {
      for (let k = 0; k < tries * 3; k++) {
        const b0 = itemBox({ type, cls, x: (r() * 2 - 1) * hw, z: r() * height });
        if (!valid(b0)) continue;
        const b = settle(b0, gx, gz);
        const it: Item = { type, cls, x: b.x, z: b.z };
        const trial = [...placed, it];
        if (sameDirectionClusters(trial, 0.17).some((gr) => gr.length > maxSame && gr.includes(trial.length - 1))) continue;
        const cs = corners(b);
        const dx = gx < 0 ? Math.min(...cs.map((c) => c.x)) + hw : hw - Math.max(...cs.map((c) => c.x));
        const dz = gz < 0 ? Math.min(...cs.map((c) => c.z)) : height - Math.max(...cs.map((c) => c.z));
        const score = dz * 0.7 + dx * 0.5 - wContact * contact(b) + r() * 0.02;
        if (!best || score < best.score) best = { it, score };
      }
    }
    if (!best) return null;
    placed.push(best.it);
    boxes.push(itemBox(best.it));
  }
  return { items: placed, width, height };
}
