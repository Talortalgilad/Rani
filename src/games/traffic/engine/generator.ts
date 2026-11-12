import { cornerPack, type ClassInfo } from './dropPack';
import { FAR, corners, firstContact, overlaps, swept, type Obb } from './geometry';
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
  /** how many "?" vehicles (from level 8) */
  hidden: number;
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
    hidden: level < 8 ? 0 : Math.round(1 + ((level - 8) * 4) / 22) + (hard ? 1 : 0),
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
  // 1. packing: the vehicles settle toward the four corners of a box in turn, biggest first, so every corner gets big ones and the small
  // ones fill the middle; the directions are mixed everywhere, no more than 3 neighbours lie the same way, and every quarter of the lot has
  // big and small vehicles and (from level 10) straight and diagonal ones. A packing that misses a quarter is thrown away at once (cheap).
  let types: VType[] = [];
  let total = 0;
  let packed: ReturnType<typeof cornerPack> = null;
  for (let attempt = 0; attempt < 30 && !packed; attempt++) {
    types = typesFor(p, r).sort((a, b) => area(b) - area(a));
    total = types.reduce((sum, q) => sum + area(q), 0);
    const needDiag = Math.ceil(p.angled * types.length);
    const bigCount = types.filter((t) => t !== 'car').length;
    // from level 10, at least 25% of the vans and buses stand at 45 degrees too
    const needBigDiag = p.level >= 10 ? Math.ceil(bigCount * 0.26) : 0;
    const chooser = ({ placed, type, rest }: ClassInfo): number[] => {
      if (p.angled <= 0) return [0, 1];
      const diagPlaced = placed.filter((q) => q.cls >= 2).length;
      const bigDiagPlaced = placed.filter((q) => q.cls >= 2 && q.type !== 'car').length;
      const bigRest = rest.filter((t) => t !== 'car').length;
      // the diagonal ones are spread over the whole packing, not saved for the end: a diagonal share is due at every step
      const due = Math.round(((placed.length + 1) * needDiag) / types.length);
      const bigDone = placed.filter((q) => q.type !== 'car').length;
      const bigDue = Math.round(((bigDone + (type !== 'car' ? 1 : 0)) * needBigDiag) / Math.max(1, bigCount));
      const force = diagPlaced < due || needDiag - diagPlaced >= rest.length || (type !== 'car' && (bigDiagPlaced < bigDue || needBigDiag - bigDiagPlaced >= bigRest));
      return force ? [2, 3] : [0, 1, 2, 3];
    };
    const side = Math.sqrt(total / (p.hard ? 0.67 : 0.64));
    const first = cornerPack(types, chooser, side, side, r, 3, 40);
    if (!first) continue;
    const c0 = bounds(first.items);
    if (!quartersOk(first.items.map((q) => ({ type: q.type, x: q.x - c0.cx, z: q.z - c0.cz, theta: CLASS_THETA[q.cls] })), p.level)) continue;
    packed = first;
  }
  if (!packed) {
    lastFail = 'pack';
    return null;
  }
  // squeeze: shrink the box a little at a time, pushing overlaps apart, as long as no group of same-direction neighbours gets bigger than 3
  const bb0 = bounds(packed.items);
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
  hw = Math.ceil(hw * 100) / 100; // the lot as it is saved (to the centimetre): the density is measured on that
  hh = Math.ceil(hh * 100) / 100;
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

  // every quarter of the lot has big and small vehicles, and (from level 10) straight and diagonal ones
  const quad = quartersOk(centred, p.level);
  if (!quad) {
    lastFail = 'quarters';
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

  // the "?" vehicles: blocked ones, spread over the lot; the vehicle in front of one is never "?" itself
  const hiddenIds = pickHidden(defs, p.hidden, r);
  for (const d of defs) if (hiddenIds.has(d.id)) d.hidden = true;

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
    lot: { halfW: hw, halfH: hh },
    vehicles: defs,
    queue,
  };
  return { data, density };
}

/**
 * The order of dropping: bigger first (that packs best), but a few big ones are kept for the end and a few small ones
 * are dropped at the start, so that big and small vehicles are found at the bottom and at the top of the lot alike.
 */
export function interleave(list: VType[], r: () => number): VType[] {
  const sorted = [...list].sort((a, b) => SIZES[b].len * SIZES[b].wid - SIZES[a].len * SIZES[a].wid);
  const n = sorted.length;
  const bigs = sorted.filter((t) => t !== 'car').length;
  const move = Math.max(1, Math.round(bigs * 0.3));
  // some big ones to the last third, some small ones to the first third
  for (let k = 0; k < move && bigs > k + 1; k++) {
    const from = Math.floor(r() * Math.max(1, bigs - 1 - k));
    const t = sorted.splice(from, 1)[0];
    sorted.splice(Math.floor(n * (0.66 + r() * 0.3)), 0, t);
  }
  for (let k = 0; k < move; k++) {
    const idx = sorted.findIndex((t, i) => t === 'car' && i > n * 0.4);
    if (idx < 0) break;
    const t = sorted.splice(idx, 1)[0];
    sorted.splice(Math.floor(n * 0.05 + r() * n * 0.25), 0, t);
  }
  return sorted;
}

/** Chooses `count` vehicles to hide: each has a vehicle right in front of it, which is not hidden itself. */
export function pickHidden(defs: VehicleDef[], count: number, r: () => number): Set<number> {
  const out = new Set<number>();
  if (count <= 0) return out;
  const boxes = defs.map((d) => ({ id: d.id, box: boxOf(d) }));
  const front = new Map<number, number>();
  for (const d of defs) {
    const hit = firstContact(boxOf(d), boxes.filter((b) => b.id !== d.id));
    if (hit) front.set(d.id, hit.id);
  }
  const cands = [...front.keys()].map((id) => ({ id, k: r() })).sort((a, b) => a.k - b.k).map((x) => x.id);
  for (const id of cands) {
    if (out.size >= count) break;
    const f = front.get(id)!;
    if (out.has(f)) continue;
    if ([...out].some((h) => front.get(h) === id)) continue; // the one in front of a hidden vehicle stays visible
    out.add(id);
  }
  return out;
}

/** Which quarter (0..3) of the lot a vehicle is in, by its centre. */
export const quarterOf = (x: number, z: number): number => (x < 0 ? 0 : 1) + (z < 0 ? 0 : 2);

/** Every quarter holds big and small vehicles (from level 6) and straight and diagonal ones (from level 10). */
export let quarterReason = '';
export function quartersOk(slots: { type: VType; x: number; z: number; theta: number }[], level: number): boolean {
  if (level < 6) return true;
  for (let q = 0; q < 4; q++) {
    const inQ = slots.filter((s) => quarterOf(s.x, s.z) === q);
    if (!inQ.some((s) => s.type === 'car')) { quarterReason = `Q${q} no small`; return false; }
    if (!inQ.some((s) => s.type !== 'car')) { quarterReason = `Q${q} no big`; return false; }
    if (level >= 10 && !inQ.some((s) => s.theta % 90 === 0)) { quarterReason = `Q${q} no straight`; return false; }
    if (level >= 10 && !inQ.some((s) => s.theta % 90 !== 0)) { quarterReason = `Q${q} no diag`; return false; }
  }
  return true;
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
