import { dropPack } from './dropPack';
import { FAR, corners, overlaps, swept, type Obb } from './geometry';
import { CLASS_THETA, itemBox, sameDirectionClusters, shrinkLoop, type Item } from './packing';
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
    minDensity: hard ? 0.7 : 0.65,
    mix: [0.5 - 0.12 * t, 0.4, 0.1 + 0.12 * t],
    zones: level < 3 ? 2 : level < 4 ? 1 : 3,
  };
}

const step = (x: number, s = 0.05): number => Math.round(x / s) * s;
const area = (t: VType): number => SIZES[t].len * SIZES[t].wid;

export interface Slot { type: VType; x: number; z: number; theta: number }

/** Picks a direction for every slot so that the lot can be cleared and few vehicles are free at the start. */
export function chooseHeadings(slots: Slot[], r: () => number, maxFree: number): { heading: number[]; order: number[] } | null {
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

/** The vehicle types of a level: vans and buses are at least 35% from level 6, and a very hard level has three buses or more. */
export function typesFor(p: GenParams, r: () => number): VType[] {
  const n = p.vehicles;
  const t = (p.level - 1) / 29;
  const bigShare = p.level >= 6 ? 0.44 + 0.12 * t : 0.3;
  let buses = Math.round(n * (p.level >= 6 ? 0.12 + 0.1 * t : 0.08));
  if (p.hard) buses = Math.max(3, buses);
  if (p.level >= 4) buses = Math.max(1, buses);
  const big = Math.min(n, Math.max(buses, Math.ceil(n * bigShare)));
  const vans = big - buses;
  const out: VType[] = [...Array<VType>(buses).fill('bus'), ...Array<VType>(vans).fill('van'), ...Array<VType>(n - big).fill('car')];
  void r;
  return out;
}

/** Builds the level for `seed`, or null when this seed does not meet the rules. */
export function generate(p0: GenParams, seed: number): Built | null {
  const r = mulberry(seed);
  // a few vehicles more or fewer than the plan: a different count packs a hard lot better. The plan still sets the trend.
  const p: GenParams = p0.hard ? { ...p0, vehicles: p0.vehicles + [0, 1, -1, 2][seed % 4] } : p0;
  const types = typesFor(p, r).sort((a, b) => area(b) - area(a));
  const total = types.reduce((s, q) => s + area(q), 0);
  const needDiag = Math.ceil(p.angled * types.length);

  // 1. packing: dropped one at a time into a box; the directions are mixed everywhere and no more than 3 neighbours lie the same way
  const width = Math.sqrt(total / (p.hard ? 0.8 : 0.74));
  const packed = dropPack(
    types,
    (i, placed) => {
      if (p.angled <= 0) return [0, 1];
      const diagPlaced = placed.filter((q) => q.cls >= 2).length;
      return needDiag - diagPlaced >= types.length - i ? [2, 3] : [0, 1, 2, 3];
    },
    width,
    r,
    3,
    p.hard ? 70 : 45,
    p.hard ? 200 : 50,
  );
  if (!packed) {
    lastFail = 'pack';
    return null;
  }
  // squeeze: shrink the box a little at a time, pushing overlaps apart, as long as no group of same-direction neighbours gets bigger than 3
  const bb0 = bounds(packed.items);
  // a packing that is far from the density asked for is not worth squeezing (squeezing adds about 0.05)
  if (total / (bb0.w * bb0.h) < p.minDensity - 0.09) {
    lastFail = 'packlow';
    return null;
  }
  const start = packed.items.map((q) => ({ ...q, x: q.x - bb0.cx, z: q.z - bb0.cz }));
  const squeezed = shrinkLoop(start, bb0.w / 2 + 0.05, bb0.h / 2 + 0.05, 1.05, 0.03, r, 25, 600, (items) => sameDirectionClusters(items, 0.17).every((c) => c.length <= 3));
  const slots: Slot[] = squeezed.items.map((q) => ({ type: q.type, x: q.x, z: q.z, theta: CLASS_THETA[q.cls] }));
  const bb = boundsOf(slots);
  const cx = (bb.minX + bb.maxX) / 2;
  const cz = (bb.minZ + bb.maxZ) / 2;
  const centred = slots.map((s) => ({ ...s, x: step(s.x - cx, 0.001), z: step(s.z - cz, 0.001) }));
  let hw = (bb.maxX - bb.minX) / 2 + 0.06;
  let hh = (bb.maxZ - bb.minZ) / 2 + 0.06;
  if (hh / hw < 0.75) hh = hw * 0.75;
  if (hh / hw > 1.35) hw = hh / 1.35;
  const density = total / (4 * hw * hh);
  if (density < p.minDensity) {
    lastFail = `density ${density.toFixed(2)}`;
    return null;
  }
  const angledShare = centred.filter((s) => s.theta % 90 !== 0).length / centred.length;
  if (angledShare + 1e-9 < p.angled) {
    lastFail = `angled ${angledShare.toFixed(2)}`;
    return null;
  }

  // 2. headings, 3. order
  const ch = chooseHeadings(centred, r, p.maxFree);
  if (!ch) {
    lastFail = 'headings';
    return null;
  }
  const rank = new Map<number, number>();
  ch.order.forEach((slotIdx, k) => rank.set(slotIdx, ch.order.length - 1 - k));
  const palette = COLORS_BY_LEVEL.slice(0, p.colors);
  const colorOrder = centred.map((_, i) => ({ i, k: r() })).sort((a, b) => a.k - b.k);
  const colorOf = new Map<number, ColorId>();
  colorOrder.forEach((c, j) => colorOf.set(c.i, palette[j % palette.length]));
  const defs: VehicleDef[] = centred
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

function bounds(items: Item[]): { w: number; h: number; cx: number; cz: number } {
  let a = 1e9, b = -1e9, c = 1e9, e = -1e9;
  for (const q of items) for (const k of corners(itemBox(q))) {
    a = Math.min(a, k.x); b = Math.max(b, k.x);
    c = Math.min(c, k.z); e = Math.max(e, k.z);
  }
  return { w: b - a, h: e - c, cx: (a + b) / 2, cz: (c + e) / 2 };
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
