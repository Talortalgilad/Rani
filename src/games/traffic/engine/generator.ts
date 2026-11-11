import { FAR, corners, dirOf, overlaps, swept, type Obb } from './geometry';
import type { LevelData } from './level';
import { SIZES, type ColorId, type VType, type VehicleDef } from './state';
import { boxOf } from './solver-types';

/**
 * Builds a level in four steps, always from a seed (the same seed always gives the same level).
 *  1. Packing: the lot is cut into a few zones and every zone is filled with lanes of vehicles, straight or at 45 degrees.
 *     This is what makes a lot dense, and the lot is shrunk until it only just holds everything.
 *  2. Headings: every vehicle can point either way along its lane (the footprint is the same). A search picks the
 *     directions so that nobody blocks somebody who blocks them (a deadlock) and only a few vehicles are free at the start.
 *  3. Order: taking vehicles out in the order they become free always clears the lot. The vehicles are numbered backwards
 *     along that order, like a lot that was built one vehicle at a time, each new one blocking an earlier one.
 *  4. Passengers: the queue is made from the passengers of the vehicles in that order, shuffled inside windows.
 */

export const COLORS_BY_LEVEL: ColorId[] = ['red', 'cyan', 'yellow', 'green', 'orange', 'blue', 'purple', 'pink'];

export function mulberry(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const isHard = (level: number): boolean => level % 5 === 0;

export interface GenParams {
  level: number;
  hard: boolean;
  vehicles: number;
  colors: number;
  /** share of vehicles at 45 degrees */
  angled: number;
  /** the queue is shuffled inside windows of this many vehicles (1 = in order) */
  window: number;
  /** how many vehicles may be free at the start */
  maxFree: number;
  minDensity: number;
  /** type weights: car, van, bus */
  mix: [number, number, number];
  zones: number;
}

export function paramsFor(level: number): GenParams {
  const hard = isHard(level);
  const t = (level - 1) / 29;
  const vehicles = Math.round(8 + 34 * Math.pow(t, 0.92)) + (hard && level < 30 ? 2 : 0);
  return {
    level,
    hard,
    vehicles,
    colors: Math.min(8, 3 + Math.floor(level / 5) + (level >= 3 ? 1 : 0)),
    angled: level < 10 ? 0 : 0.32 + 0.06 * t,
    window: hard ? 4 : level < 4 ? 1 : level < 15 ? 2 : 3,
    maxFree: level < 3 ? Math.ceil(vehicles * 0.5) : level < 4 ? Math.ceil(vehicles * 0.3) : Math.max(2, Math.round(vehicles * (hard ? 0.2 : 0.12))),
    minDensity: hard ? 0.75 : 0.65,
    mix: [0.5 - 0.12 * t, 0.4, 0.1 + 0.12 * t],
    zones: level < 3 ? 2 : level < 4 ? 1 : 3,
  };
}

const ASPECT = 1.07;
const step = (x: number, s = 0.05): number => Math.round(x / s) * s;
const area = (t: VType): number => SIZES[t].len * SIZES[t].wid;
const GAP = 0.03; // footprints are shrunk by this before the overlap test, so there is a real gap of 6 cm

interface Zone { x0: number; z0: number; x1: number; z1: number }
interface Slot { type: VType; x: number; z: number; theta: number }

/** Cuts the lot into `n` rectangles, alternately across and along, never into thin strips. */
function split(rect: Zone, n: number, r: () => number): Zone[] {
  if (n <= 1) return [rect];
  const w = rect.x1 - rect.x0;
  const h = rect.z1 - rect.z0;
  const vertical = w >= h * (0.8 + r() * 0.4);
  const k = Math.max(1, Math.round(n * (0.4 + r() * 0.2)));
  const f = 0.38 + r() * 0.24;
  if (vertical) {
    const m = rect.x0 + w * f;
    return [...split({ ...rect, x1: m }, k, r), ...split({ ...rect, x0: m }, n - k, r)];
  }
  const m = rect.z0 + h * f;
  return [...split({ ...rect, z1: m }, k, r), ...split({ ...rect, z0: m }, n - k, r)];
}

const insideZone = (box: Obb, z: Zone): boolean => corners(box).every((p) => p.x >= z.x0 - 1e-6 && p.x <= z.x1 + 1e-6 && p.z >= z.z0 - 1e-6 && p.z <= z.z1 + 1e-6);

const SPACING = 0.07; // space between neighbours along a lane

/** A row of vehicles that fills `len` as exactly as it can. The best of many random tries. */
function composeLane(len: number, mix: [number, number, number], r: () => number, left: number): VType[] {
  let best: VType[] = [];
  let bestLeft = Infinity;
  const types: VType[] = ['car', 'van', 'bus'];
  for (let attempt = 0; attempt < 60; attempt++) {
    const list: VType[] = [];
    let rem = len;
    while (list.length < left) {
      const fit = types.filter((t) => SIZES[t].len + SPACING <= rem + 1e-6);
      if (!fit.length) break;
      const w = fit.map((t) => mix[types.indexOf(t)] + 0.02);
      let x = r() * w.reduce((a, b) => a + b, 0);
      let pick = fit[0];
      for (let i = 0; i < fit.length; i++) {
        x -= w[i];
        if (x <= 0) {
          pick = fit[i];
          break;
        }
      }
      list.push(pick);
      rem -= SIZES[pick].len + SPACING;
    }
    if (rem < bestLeft - 1e-9 || (Math.abs(rem - bestLeft) < 1e-9 && r() < 0.5)) {
      best = list;
      bestLeft = rem;
    }
    if (bestLeft < 0.08) break;
  }
  return best;
}

/**
 * Fills a zone with lanes along the direction `theta`. Axis zones get lanes that fill their length exactly. The first
 * lane is the one nearest to `near` (what is already placed), so that if the vehicles run out, the empty part is on the
 * outside of the lot and disappears when the lot is shrunk.
 */
function fillZone(zone: Zone, theta: number, left: { n: number }, mix: [number, number, number], placed: Slot[], boxes: Obb[], r: () => number, diagZone: boolean, near: { x: number; z: number }): void {
  const U = dirOf(theta);
  const V = { x: -U.z, z: U.x };
  const cs = [
    { x: zone.x0, z: zone.z0 }, { x: zone.x1, z: zone.z0 }, { x: zone.x1, z: zone.z1 }, { x: zone.x0, z: zone.z1 },
  ];
  const us = cs.map((c) => c.x * U.x + c.z * U.z);
  const vs = cs.map((c) => c.x * V.x + c.z * V.z);
  const uMin = Math.min(...us), uMax = Math.max(...us), vMin = Math.min(...vs), vMax = Math.max(...vs);
  const vNear = near.x * V.x + near.z * V.z;
  const fromMin = Math.abs(vNear - vMin) <= Math.abs(vNear - vMax);
  const mk = (type: VType, u: number, v: number): Obb => ({ x: u * U.x + v * V.x, z: u * U.z + v * V.z, hl: SIZES[type].len / 2, hw: SIZES[type].wid / 2, heading: theta });
  const fits = (b: Obb): boolean => insideZone(b, zone) && !boxes.some((o) => overlaps(b, o, GAP));
  const put = (type: VType, u: number, v: number): void => {
    const b = mk(type, u, v);
    placed.push({ type, x: b.x, z: b.z, theta });
    boxes.push(b);
    left.n--;
  };

  // lanes are laid from `edge` toward the far side; `dir` is +1 (from vMin up) or -1 (from vMax down)
  const dir = fromMin ? 1 : -1;
  let edge = fromMin ? vMin : vMax;
  while (left.n > 0 && (dir > 0 ? edge < vMax - 0.5 : edge > vMin + 0.5)) {
    let laneW = 0;
    if (!diagZone) {
      const lane = composeLane(uMax - uMin, mix, r, left.n);
      if (!lane.length) break;
      laneW = Math.max(...lane.map((t) => SIZES[t].wid));
      const vc = edge + (dir * laneW) / 2;
      if (dir > 0 ? edge + laneW > vMax + 1e-6 : edge - laneW < vMin - 1e-6) break;
      let u = uMin;
      for (const t of lane) {
        const uc = u + SIZES[t].len / 2;
        if (fits(mk(t, uc, vc))) put(t, uc, vc);
        u += SIZES[t].len + SPACING;
      }
    } else {
      // a diagonal lane: cars (mostly), each as close to the previous as the zone and its neighbours allow
      let cursor = uMin;
      const vc = edge + dir * 0.6;
      while (left.n > 0) {
        const tries: VType[] = r() < 0.85 ? ['car'] : ['van', 'car'];
        let ok = false;
        for (const tt of tries) {
          for (let u = cursor + SIZES[tt].len / 2; u <= uMax; u += 0.05) {
            if (fits(mk(tt, u, vc))) {
              put(tt, u, vc);
              cursor = u + SIZES[tt].len / 2 + 0.02;
              laneW = Math.max(laneW, SIZES[tt].wid);
              ok = true;
              break;
            }
          }
          if (ok) break;
        }
        if (!ok) break;
      }
    }
    edge += dir * ((laneW || 1.2) + SPACING);
  }
}

const centroid = (slots: Slot[], fallback: { x: number; z: number }): { x: number; z: number } =>
  slots.length ? { x: slots.reduce((a, s) => a + s.x, 0) / slots.length, z: slots.reduce((a, s) => a + s.z, 0) / slots.length } : fallback;

function pack(p: GenParams, r: () => number, halfW: number): { slots: Slot[]; halfW: number; halfH: number } | null {
  const wantDiag = Math.ceil(p.angled * p.vehicles);
  // a diagonal block that is too small is made bigger until it holds enough angled vehicles
  for (const f of p.angled > 0 ? [1, 1.08, 1.17, 1.28, 1.4, 1.55, 1.75] : [1]) {
    const out = packOnce(p, r, halfW, f);
    if (out && out.slots.filter((s) => s.theta % 90 !== 0).length >= wantDiag) return out;
  }
  return null;
}

function packOnce(p: GenParams, r: () => number, halfW: number, dFactor: number): { slots: Slot[]; halfW: number; halfH: number } | null {
  const halfH = halfW * ASPECT;
  const slots: Slot[] = [];
  const boxes: Obb[] = [];
  const left = { n: p.vehicles };
  const W = halfW * 2;
  const H = halfH * 2;
  const along = (z: Zone): number => (z.x1 - z.x0 >= z.z1 - z.z0 ? 0 : 90);
  const fill = (z: Zone, theta: number, diagZone: boolean): void =>
    fillZone(z, theta, left, p.mix, slots, boxes, r, diagZone, centroid(slots, { x: (z.x0 + z.x1) / 2, z: (z.z0 + z.z1) / 2 }));

  if (p.angled > 0) {
    // one diagonal block in a corner (sized for the share of angled vehicles), and axis blocks for the rest
    const diagArea = ((Math.ceil(p.angled * p.vehicles) * 2.4) / 0.8) * dFactor;
    let dw = Math.min(W * 0.62, Math.max(3.4, Math.sqrt(diagArea * (0.9 + r() * 0.5))));
    let dh = diagArea / dw;
    if (dh > H * 0.85) {
      dh = H;
      dw = Math.min(W * 0.7, diagArea / H);
    }
    const sx = r() < 0.5 ? 1 : -1;
    const sz = r() < 0.5 ? 1 : -1;
    const D: Zone = { x0: sx > 0 ? halfW - dw : -halfW, x1: sx > 0 ? halfW : -halfW + dw, z0: sz > 0 ? halfH - dh : -halfH, z1: sz > 0 ? halfH : -halfH + dh };
    const A: Zone = { x0: sx > 0 ? -halfW : -halfW + dw, x1: sx > 0 ? halfW - dw : halfW, z0: -halfH, z1: halfH };
    const B: Zone | null = dh < H - 1.5 ? { x0: D.x0, x1: D.x1, z0: sz > 0 ? -halfH : -halfH + dh, z1: sz > 0 ? halfH - dh : halfH } : null;
    fill(D, [45, 135][Math.floor(r() * 2)], true);
    if (B) fill(B, along(B), false);
    fill(A, along(A), false);
  } else {
    for (const z of split({ x0: -halfW, z0: -halfH, x1: halfW, z1: halfH }, p.zones, r)) fill(z, along(z), false);
  }
  if (left.n > 0) return null;
  return { slots, halfW, halfH };
}

/** Picks a direction for every slot so that the lot can be cleared and few vehicles are free at the start. */
function chooseHeadings(slots: Slot[], r: () => number, maxFree: number): { heading: number[]; order: number[] } | null {
  const n = slots.length;
  const boxes = slots.map((s): Obb => ({ x: s.x, z: s.z, hl: SIZES[s.type].len / 2, hw: SIZES[s.type].wid / 2, heading: s.theta }));
  const block: number[][][] = [0, 1].map((o) =>
    boxes.map((b, i) => {
      const sw = swept({ ...b, heading: (b.heading + o * 180) % 360 }, FAR);
      const out: number[] = [];
      boxes.forEach((c, j) => {
        if (j !== i && overlaps(sw, c)) out.push(j);
      });
      return out;
    }),
  );
  const opt = slots.map(() => (r() < 0.5 ? 0 : 1));

  /** Kahn: peel off vehicles with no blockers. Returns the exit order and how many are stuck in a cycle. */
  const peel = (): { order: number[]; left: number[]; freeAtStart: number } => {
    const removed = new Array<boolean>(n).fill(false);
    const order: number[] = [];
    let freeAtStart = 0;
    for (let round = 0; ; round++) {
      const ready: number[] = [];
      for (let i = 0; i < n; i++) if (!removed[i] && block[opt[i]][i].every((j) => removed[j])) ready.push(i);
      if (!ready.length) break;
      if (round === 0) freeAtStart = ready.length;
      for (const i of ready) {
        removed[i] = true;
        order.push(i);
      }
    }
    return { order, left: removed.map((x, i) => (x ? -1 : i)).filter((i) => i >= 0), freeAtStart };
  };

  const cost = (): { c: number; left: number[]; order: number[]; free: number } => {
    const k = peel();
    return { c: k.left.length * 10 + Math.max(0, k.freeAtStart - maxFree) * 2 + k.freeAtStart * 0.1, left: k.left, order: k.order, free: k.freeAtStart };
  };
  let cur = cost();
  for (let it = 0; it < 6000; it++) {
    if (cur.left.length === 0 && cur.free <= maxFree) break;
    // flip one vehicle: mostly one in a deadlock, sometimes a free one
    const pool = cur.left.length && r() < 0.8 ? cur.left : slots.map((_, i) => i);
    const i = pool[Math.floor(r() * pool.length)];
    opt[i] ^= 1;
    const next = cost();
    if (next.c <= cur.c || r() < 0.02) cur = next;
    else opt[i] ^= 1;
  }
  if (cur.left.length || cur.free > maxFree) return null;
  // exit order: peel rounds; inside a round, a random order (the queue is built from it)
  return { heading: slots.map((s, i) => (s.theta + opt[i] * 180) % 360), order: cur.order };
}

export let lastFail = '';

export interface Built { data: LevelData; density: number }

/** Builds the level for `seed`, or null when this seed does not meet the rules. */
export function generate(p0: GenParams, seed: number): Built | null {
  const r = mulberry(seed);
  // a few vehicles more or fewer than the plan: a different count packs a hard lot better. The plan still sets the trend.
  const p: GenParams = p0.hard ? { ...p0, vehicles: p0.vehicles + [0, 1, -1, 2][seed % 4] } : p0;
  // 1. packing: grow the lot from a tight start until everything fits; keep the densest of a few tries
  const total0 = p.vehicles * 3.4;
  let best: { slots: Slot[]; density: number; hw: number; hh: number } | null = null;
  for (let attempt = 0; attempt < 30; attempt++) {
    let halfW = Math.sqrt(total0 / 0.95 / (4 * ASPECT));
    let found: { slots: Slot[]; halfW: number; halfH: number } | null = null;
    for (let grow = 0; grow < 90 && !found; grow++) {
      found = pack(p, r, step(halfW));
      if (!found) halfW *= 1.008;
    }
    if (!found) continue;
    const bb = boundsOf(found.slots);
    const hw = (bb.maxX - bb.minX) / 2 + 0.06;
    const hh = (bb.maxZ - bb.minZ) / 2 + 0.06;
    const total = found.slots.reduce((sum, q) => sum + area(q.type), 0);
    const density = total / (4 * Math.max(hw, 0.01) * Math.max(hh, 0.01));
    if (!best || density > best.density) best = { slots: found.slots, density, hw, hh };
  }
  if (!best) {
    lastFail = 'pack';
    return null;
  }
  // re-centre, and keep the lot from becoming a thin strip
  const bb = boundsOf(best.slots);
  const cx = (bb.minX + bb.maxX) / 2;
  const cz = (bb.minZ + bb.maxZ) / 2;
  const slots = best.slots.map((s) => ({ ...s, x: step(s.x - cx, 0.001), z: step(s.z - cz, 0.001) }));
  let hw = best.hw;
  let hh = best.hh;
  if (hh / hw < 0.75) hh = hw * 0.75;
  if (hh / hw > 1.35) hw = hh / 1.35;
  const total = slots.reduce((sum, q) => sum + area(q.type), 0);
  const density = total / (4 * hw * hh);
  if (density < p.minDensity) {
    lastFail = `density ${density.toFixed(2)}`;
    return null;
  }
  const angledShare = slots.filter((s) => s.theta % 90 !== 0).length / slots.length;
  if (angledShare + 1e-9 < p.angled) {
    lastFail = `angled ${angledShare.toFixed(2)}`;
    return null;
  }

  // 2. headings, 3. order
  const ch = chooseHeadings(slots, r, p.maxFree);
  if (!ch) {
    lastFail = 'headings';
    return null;
  }
  // the vehicles are numbered backwards along the exit order: the last to leave is number 0
  const rank = new Map<number, number>();
  ch.order.forEach((slotIdx, k) => rank.set(slotIdx, ch.order.length - 1 - k));
  const palette = COLORS_BY_LEVEL.slice(0, p.colors);
  const colorOrder = slots.map((_, i) => ({ i, k: r() })).sort((a, b) => a.k - b.k);
  const colorOf = new Map<number, ColorId>();
  colorOrder.forEach((c, j) => colorOf.set(c.i, palette[j % palette.length]));
  const defs: VehicleDef[] = slots
    .map((s, i): VehicleDef => ({ id: rank.get(i)!, type: s.type, color: colorOf.get(i)!, x: s.x, z: s.z, heading: ch.heading[i] }))
    .sort((a, b) => a.id - b.id);

  // 4. the queue, in the order the vehicles leave, shuffled inside windows
  const queue: ColorId[] = [];
  const exit = [...defs].sort((a, c) => c.id - a.id);
  for (let i = 0; i < exit.length; i += p.window) {
    const group: ColorId[] = [];
    for (const v of exit.slice(i, i + p.window)) for (let k = 0; k < SIZES[v.type].seats; k++) group.push(v.color);
    for (let k = group.length - 1; k > 0; k--) {
      const j = Math.floor(r() * (k + 1));
      [group[k], group[j]] = [group[j], group[k]];
    }
    queue.push(...group);
  }
  const data: LevelData = {
    key: String(p.level),
    kind: 'level',
    number: p.level,
    world: 'city',
    hard: p.hard,
    lot: { halfW: Math.ceil(hw * 100) / 100, halfH: Math.ceil(hh * 100) / 100 },
    vehicles: defs,
    queue,
  };
  return { data, density };
}

function boundsOf(slots: Slot[]): { minX: number; maxX: number; minZ: number; maxZ: number } {
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (const s of slots) for (const c of corners({ x: s.x, z: s.z, hl: SIZES[s.type].len / 2, hw: SIZES[s.type].wid / 2, heading: s.theta })) {
    minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x);
    minZ = Math.min(minZ, c.z); maxZ = Math.max(maxZ, c.z);
  }
  return { minX, maxX, minZ, maxZ };
}

export { boxOf };
