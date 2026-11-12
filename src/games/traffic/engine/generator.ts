import { cornerFail, cornerPack, type ClassInfo, type Piece } from './dropPack';
import { FAR, corners, firstContact, largestHole, overlaps, swept, type Obb } from './geometry';
import type { LevelData, World } from './level';
import { CLASS_THETA, itemBox, sameDirectionClusters, shrinkLoop, type Item } from './packing';
import { BELT_PITCH, BELT_WIDTH, SIZES, TURNTABLE, type BeltDef, type ColorId, type VType, type VehicleDef } from './state';
import { boxOf } from './solver-types';

/**
 * Builds a level in four steps, always from a seed (the same seed always gives the same level).
 *  1. Packing: the vehicles settle toward the four corners of a box in turn (big ones first), in directions that are mixed everywhere;
 *     then the box is shrunk around them. Belts of cars and vehicles on a turntable are pieces of their own.
 *  2. Headings: every vehicle can point either way along its axis (the footprint is the same). A search picks the directions so that
 *     nobody blocks somebody who blocks them (a deadlock) and only a few vehicles are free at the start.
 *  3. Order: taking vehicles out in the order they become free always clears the lot. The vehicles are numbered backwards along that
 *     order, like a lot that was built one vehicle at a time, each new one blocking an earlier one.
 *  4. Passengers: the queue is made from the passengers of the vehicles in that order, shuffled inside windows.
 */

/** The biggest empty circle allowed between the vehicles, as a radius (about half the length of a car). */
export const MAX_HOLE = 1.0;

export const COLORS_BY_LEVEL: ColorId[] = ['red', 'cyan', 'yellow', 'green', 'orange', 'blue', 'purple', 'pink', 'brown'];

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

/** The world of a level (SPEC-traffic 2.7): the city to 25, then the beach, the snow and the carnival. */
export const worldOf = (level: number): World => (level <= 25 ? 'city' : level <= 50 ? 'beach' : level <= 75 ? 'snow' : 'carnival');

/** Height over width of the lot: from level 15 the lot is tall and narrow, so that it fills at least 55% of the height of a phone. */
export const lotAspect = (level: number): number => (level >= 15 ? 1.85 : 1.0);

/** What is new, and where (SPEC-traffic 3.2): conveyor belts from 30, vehicles that turn from 45, fire trucks from 60. */
export const FIRST_BELT = 30;
export const FIRST_ROTATOR = 45;
export const FIRST_FIRE = 60;

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
  /** how many "?" vehicles (from level 8) */
  hidden: number;
  /** conveyor belts of three cars (from level 30), vehicles that turn (from 45) and fire trucks (from 60) */
  belts: number;
  rotators: number;
  fires: number;
}

/** 65% (70% in the very hard levels); 66% in every level that has a special vehicle (from level 30 there always is one). */
export function minDensityFor(level: number): number {
  if (level >= FIRST_BELT) return 0.66;
  return isHard(level) ? 0.7 : 0.65;
}

export function paramsFor(level: number): GenParams {
  const hard = isHard(level);
  const t = (level - 1) / 29;
  const base = level <= 30 ? Math.round(8 + 34 * Math.pow(t, 0.92)) : 43 + Math.round((level - 30) * 0.2);
  const vehicles = base + (hard && level < 30 ? 2 : 0);
  return {
    level,
    hard,
    vehicles,
    colors: Math.min(level >= 40 ? 9 : 8, 3 + Math.floor(level / 5) + (level >= 3 ? 1 : 0)),
    angled: level < 10 ? 0 : 0.32 + 0.06 * Math.min(1, t),
    window: hard ? 4 : level < 4 ? 1 : level < 15 ? 2 : 3,
    maxFree: level < 3 ? Math.ceil(vehicles * 0.5) : level < 4 ? Math.ceil(vehicles * 0.3) : Math.max(2, Math.round(vehicles * (hard ? 0.2 : 0.12))),
    minDensity: minDensityFor(level),
    hidden: level < 8 ? 0 : Math.min(8, Math.round(1 + ((level - 8) * 4) / 22) + (hard ? 1 : 0)),
    belts: level < FIRST_BELT ? 0 : 1 + (level >= 55 ? 1 : 0) + (level >= 85 ? 1 : 0),
    rotators: level < FIRST_ROTATOR ? 0 : Math.min(5, 1 + Math.floor((level - FIRST_ROTATOR) / 12)) + (hard && level > FIRST_ROTATOR ? 1 : 0),
    fires: level < FIRST_FIRE ? 0 : Math.min(3, 1 + Math.floor((level - FIRST_FIRE) / 15)),
  };
}

const step = (x: number, s = 0.05): number => Math.round(x / s) * s;

/** The introductions shown the first time something new appears. */
export const INTRO: Record<number, string> = {
  [FIRST_BELT]: 'חדש: מסוע! כשהרכב הראשון על הפס יוצא, כל השאר זזים קדימה',
  [FIRST_ROTATOR]: 'חדש: רכב מסתובב! הקשה קצרה מסובבת אותו, הקשה ארוכה שולחת אותו',
  [FIRST_FIRE]: 'חדש: כבאית! היא לוקחת רק כבאים',
};

export interface Slot {
  type: VType;
  x: number;
  z: number;
  /** the axis the vehicle lies along, in degrees */
  theta: number;
  rot?: boolean;
  /** a car on a belt: the belt (a number of the belt pieces) and its place along the axis */
  belt?: number;
}

/** How many of every kind: ordinary vehicles by size, and the special ones. */
export function compose(p: GenParams): { buses: number; vans: number; cars: number; fires: number; belts: number; rotators: number } {
  const n = p.vehicles;
  const t = (p.level - 1) / 29;
  const bigShare = p.level >= 6 ? 0.44 + 0.12 * Math.min(1, t) : 0.3;
  const fires = p.fires;
  const specialCars = p.belts * 3 + p.rotators;
  const ordinary = n - fires - specialCars;
  let buses = Math.round(n * (p.level >= 6 ? 0.12 + 0.1 * Math.min(1, t) : 0.08));
  if (p.hard) buses = Math.max(3, buses);
  if (p.level >= 4) buses = Math.max(1, buses);
  const bigWanted = Math.max(buses, Math.ceil(n * bigShare) - fires);
  const big = Math.min(ordinary, bigWanted);
  buses = Math.min(buses, big);
  return { buses, vans: big - buses, cars: ordinary - big, fires, belts: p.belts, rotators: p.rotators };
}

/** The vehicle types of a level (a belt is three cars, a vehicle that turns is a car). */
export function typesFor(p: GenParams, r: () => number): VType[] {
  void r;
  const c = compose(p);
  return [...Array<VType>(c.fires).fill('fire'), ...Array<VType>(c.buses).fill('bus'), ...Array<VType>(c.vans).fill('van'), ...Array<VType>(c.cars + c.belts * 3 + c.rotators).fill('car')];
}

/** The pieces to pack, biggest first. */
export function piecesFor(p: GenParams): Piece[] {
  const c = compose(p);
  const beltLen = 2 * BELT_PITCH + SIZES.car.len;
  const out: Piece[] = [
    ...Array.from({ length: c.fires }, (): Piece => ({ type: 'fire' })),
    ...Array.from({ length: c.belts }, (): Piece => ({ type: 'car', dims: { len: beltLen, wid: BELT_WIDTH }, weight: 3, classes: [0, 1] })),
    ...Array.from({ length: c.buses }, (): Piece => ({ type: 'bus' })),
    ...Array.from({ length: c.rotators }, (): Piece => ({ type: 'car', dims: { len: TURNTABLE, wid: TURNTABLE }, rot: true })),
    ...Array.from({ length: c.vans }, (): Piece => ({ type: 'van' })),
    ...Array.from({ length: c.cars }, (): Piece => ({ type: 'car' })),
  ];
  return out;
}

const pieceArea = (q: Piece): number => (q.dims ? q.dims.len * q.dims.wid : SIZES[q.type].len * SIZES[q.type].wid);

/** Packed pieces become vehicle places: a belt is three cars in a row. */
export function expand(items: Item[]): Slot[] {
  const out: Slot[] = [];
  let belt = 0;
  for (const q of items) {
    if (q.w === 3) {
      const th = CLASS_THETA[q.cls];
      const ux = Math.cos((th * Math.PI) / 180);
      const uz = Math.sin((th * Math.PI) / 180);
      for (let k = -1; k <= 1; k++) out.push({ type: 'car', x: q.x + ux * k * BELT_PITCH, z: q.z + uz * k * BELT_PITCH, theta: th, belt });
      belt++;
    } else out.push({ type: q.type, x: q.x, z: q.z, theta: q.rot ? 0 : CLASS_THETA[q.cls], rot: q.rot });
  }
  return out;
}

const slotBox = (s: Slot): Obb => (s.rot ? { x: s.x, z: s.z, hl: TURNTABLE / 2, hw: TURNTABLE / 2, heading: 0 } : { x: s.x, z: s.z, hl: SIZES[s.type].len / 2, hw: SIZES[s.type].wid / 2, heading: s.theta });

interface Node { kind: 'one' | 'rot' | 'belt'; ids: number[] }

/**
 * Picks a direction for every vehicle (a belt: for all its cars at once; a vehicle that turns: any) so that the lot can be cleared
 * and few vehicles are free at the start. Returns the headings, the order in which the vehicles leave, and the direction of the belts.
 */
export function chooseHeadings(slots: Slot[], r: () => number, maxFree: number): { heading: number[]; order: number[]; beltDir: number[] } | null {
  // the nodes: a vehicle, a vehicle that turns, or a belt (its cars in order along the axis)
  const nodes: Node[] = [];
  const beltNode = new Map<number, number>();
  slots.forEach((s, i) => {
    if (s.belt !== undefined) {
      if (!beltNode.has(s.belt)) {
        beltNode.set(s.belt, nodes.length);
        nodes.push({ kind: 'belt', ids: [] });
      }
      nodes[beltNode.get(s.belt)!].ids.push(i);
    } else nodes.push({ kind: s.rot ? 'rot' : 'one', ids: [i] });
  });
  const axisCoord = (i: number) => slots[i].x * Math.cos((slots[i].theta * Math.PI) / 180) + slots[i].z * Math.sin((slots[i].theta * Math.PI) / 180);
  nodes.forEach((nd) => {
    if (nd.kind === 'belt') nd.ids.sort((a, b) => axisCoord(a) - axisCoord(b));
  });
  const m = nodes.length;
  // what the others see of a node: the footprint of the vehicle, the turntable, or the whole strip of the belt
  const collide: Obb[] = nodes.map((nd) => {
    if (nd.kind !== 'belt') return slotBox(slots[nd.ids[0]]);
    const a = slots[nd.ids[0]];
    const b = slots[nd.ids[nd.ids.length - 1]];
    return { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, hl: ((nd.ids.length - 1) * BELT_PITCH + SIZES.car.len) / 2, hw: BELT_WIDTH / 2, heading: a.theta };
  });
  const optionsOf = (nd: Node): number => (nd.kind === 'rot' ? 4 : 2);
  const block: number[][][] = nodes.map((nd, i) =>
    Array.from({ length: optionsOf(nd) }, (_, o) => {
      let own: Obb;
      if (nd.kind === 'belt') {
        // the cars drive out of the front place
        const front = slots[nd.ids[o === 0 ? nd.ids.length - 1 : 0]];
        own = { x: front.x, z: front.z, hl: SIZES.car.len / 2, hw: SIZES.car.wid / 2, heading: (front.theta + o * 180) % 360 };
      } else if (nd.kind === 'rot') own = { x: slots[nd.ids[0]].x, z: slots[nd.ids[0]].z, hl: SIZES.car.len / 2, hw: SIZES.car.wid / 2, heading: o * 90 };
      else {
        const s = slots[nd.ids[0]];
        own = { x: s.x, z: s.z, hl: SIZES[s.type].len / 2, hw: SIZES[s.type].wid / 2, heading: (s.theta + o * 180) % 360 };
      }
      const sw = swept(own, FAR);
      const out: number[] = [];
      collide.forEach((c, j) => {
        if (j !== i && overlaps(sw, c)) out.push(j);
      });
      return out;
    }),
  );
  const opt = nodes.map((nd) => (nd.kind === 'rot' ? 0 : r() < 0.5 ? 0 : 1));
  const ready = (i: number, removed: boolean[]): boolean => (nodes[i].kind === 'rot' ? block[i].some((b) => b.every((j) => removed[j])) : block[i][opt[i]].every((j) => removed[j]));

  /** Kahn: peel off nodes with nothing in the way. Returns the exit order and the nodes stuck in a cycle. */
  const peel = (): { order: number[]; left: number[]; freeAtStart: number } => {
    const removed = new Array<boolean>(m).fill(false);
    const order: number[] = [];
    let freeAtStart = 0;
    for (let round = 0; ; round++) {
      const now: number[] = [];
      for (let i = 0; i < m; i++) if (!removed[i] && ready(i, removed)) now.push(i);
      if (!now.length) break;
      if (round === 0) freeAtStart = now.length;
      for (const i of now) {
        removed[i] = true;
        order.push(i);
      }
    }
    return { order, left: removed.map((x, i) => (x ? -1 : i)).filter((i) => i >= 0), freeAtStart };
  };
  const cost = () => {
    const k = peel();
    return { c: k.left.length * 10 + Math.max(0, k.freeAtStart - maxFree) * 2 + k.freeAtStart * 0.1, left: k.left, order: k.order, free: k.freeAtStart };
  };
  let cur = cost();
  const flippable = nodes.map((nd, i) => (nd.kind === 'rot' ? -1 : i)).filter((i) => i >= 0);
  for (let it = 0; it < 6000; it++) {
    if (cur.left.length === 0 && cur.free <= maxFree) break;
    const pool = (cur.left.length && r() < 0.8 ? cur.left : flippable).filter((i) => nodes[i].kind !== 'rot');
    if (!pool.length) break;
    const i = pool[Math.floor(r() * pool.length)];
    opt[i] ^= 1;
    const next = cost();
    if (next.c <= cur.c || r() < 0.02) cur = next;
    else opt[i] ^= 1;
  }
  if (cur.left.length || cur.free > maxFree) return null;
  const heading = new Array<number>(slots.length).fill(0);
  const beltDir: number[] = [];
  nodes.forEach((nd, i) => {
    if (nd.kind === 'rot') heading[nd.ids[0]] = 90 * Math.floor(r() * 4);
    else if (nd.kind === 'belt') {
      const h = (slots[nd.ids[0]].theta + opt[i] * 180) % 360;
      nd.ids.forEach((id) => (heading[id] = h));
      beltDir[slots[nd.ids[0]].belt!] = opt[i];
    } else heading[nd.ids[0]] = (slots[nd.ids[0]].theta + opt[i] * 180) % 360;
  });
  // the vehicles in the order they leave (a belt: the front car first)
  const order: number[] = [];
  for (const i of cur.order) {
    const nd = nodes[i];
    if (nd.kind === 'belt') order.push(...(opt[i] === 0 ? [...nd.ids].reverse() : nd.ids));
    else order.push(nd.ids[0]);
  }
  return { heading, order, beltDir };
}

export let lastFail = '';
/** Time spent in the steps of building a level (milliseconds, for the level builder's report). */
export const prof: Record<string, number> = { pack: 0, squeeze: 0, headings: 0 };
/** Why packings were thrown away (for the level builder's report). */
export const packFails: Record<string, number> = {};

export interface Built { data: LevelData; density: number }

/** Builds the level for `seed`, or null when this seed does not meet the rules. */
export function generate(p0: GenParams, seed: number): Built | null {
  const r = mulberry(seed);
  // a few vehicles more or fewer than the plan: a different count packs a hard lot better. The plan still sets the trend.
  const p: GenParams = p0.hard && p0.belts + p0.rotators + p0.fires === 0 ? { ...p0, vehicles: p0.vehicles + [0, 1, -1, 2][seed % 4] } : p0;
  // 1. packing (see above): a packing that misses a quarter of the lot (big and small, straight and diagonal) is thrown away at once
  const tp0 = Date.now();
  let pieces: Piece[] = [];
  let total = 0;
  let packed: ReturnType<typeof cornerPack> = null;
  for (let attempt = 0; attempt < 30 && !packed; attempt++) {
    pieces = piecesFor(p);
    total = pieces.reduce((sum, q) => sum + pieceArea(q), 0);
    const nVeh = pieces.reduce((s, q) => s + (q.weight ?? 1), 0);
    // belts and vehicles on a turntable cannot stand at 45 degrees: the diagonal ones are counted among the others
    const capable = (q: Piece) => !q.classes && !q.rot;
    const nCapable = pieces.filter(capable).length;
    const needDiag = Math.min(Math.ceil(p.angled * nVeh), Math.floor(nCapable * 0.85));
    const bigCount = pieces.filter((q) => q.type !== 'car').length;
    // from level 10, at least 25% of the vans and buses stand at 45 degrees too
    const needBigDiag = p.level >= 10 ? Math.ceil(bigCount * 0.26) : 0;
    const chooser = ({ placed, type, rest }: ClassInfo): number[] => {
      if (p.angled <= 0) return [0, 1];
      const diagPlaced = placed.filter((q) => q.cls >= 2).length;
      const bigDiagPlaced = placed.filter((q) => q.cls >= 2 && q.type !== 'car').length;
      const bigRest = rest.filter((t) => t !== 'car').length;
      const restCap = pieces.slice(placed.length).filter(capable).length;
      // the diagonal ones are spread over the whole packing, not saved for the end: a diagonal share is due at every step
      const placedCap = pieces.slice(0, placed.length).filter(capable).length;
      const due = Math.round(((placedCap + 1) * needDiag) / Math.max(1, nCapable));
      const bigDone = placed.filter((q) => q.type !== 'car').length;
      const bigDue = Math.round(((bigDone + (type !== 'car' ? 1 : 0)) * needBigDiag) / Math.max(1, bigCount));
      const force = diagPlaced < due || needDiag - diagPlaced >= restCap || (type !== 'car' && (bigDiagPlaced < bigDue || needBigDiag - bigDiagPlaced >= bigRest));
      return force ? [2, 3] : [0, 1, 2, 3];
    };
    const aspect = lotAspect(p.level);
    // with belts and turntables in the lot there is less room to spare for the small vehicles that fill the holes
    const slack = p.belts + p.rotators > 0 ? 0.02 : 0;
    const side = Math.sqrt(total / ((p.hard ? 0.67 : 0.64) - slack) / aspect);
    const first = cornerPack(pieces, chooser, side, side * aspect, r, 3, 40);
    if (!first) {
      const k = `null@${cornerFail?.i}/${pieces.length}${cornerFail?.rot ? ' rot' : ''}${cornerFail?.belt ? ' belt' : ''}${cornerFail?.type === 'fire' ? ' fire' : ''}${cornerFail?.fill ? ' fill' : ''}`;
      packFails[k] = (packFails[k] ?? 0) + 1;
      continue;
    }
    const c0 = bounds(first.items);
    const early = expand(first.items.map((q) => ({ ...q, x: q.x - c0.cx, z: q.z - c0.cz })));
    if (!quartersOk(early, p.level)) {
      packFails[quarterReason] = (packFails[quarterReason] ?? 0) + 1;
      continue;
    }
    packed = first;
  }
  prof.pack += Date.now() - tp0;
  if (!packed) {
    lastFail = 'pack';
    return null;
  }
  const ts0 = Date.now();
  // squeeze: shrink the box a little at a time, pushing overlaps apart, as long as no group of same-direction neighbours gets bigger than 3
  const bb0 = bounds(packed.items);
  const start = packed.items.map((q) => ({ ...q, x: q.x - bb0.cx, z: q.z - bb0.cz }));
  const accept = (items: Item[]) => sameDirectionClusters(items, 0.17).every((c) => c.length <= 3);
  // a packing far from the density asked for is not worth squeezing (squeezing adds about 0.07)
  if (total / (bb0.w * bb0.h) < p.minDensity - 0.09) {
    lastFail = 'packlow';
    return null;
  }
  const squeezed = shrinkLoop(start, bb0.w / 2 + 0.05, bb0.h / 2 + 0.05, lotAspect(p.level) * 1.05, 0.03, r, 25, 600, accept);
  prof.squeeze += Date.now() - ts0;
  const slots0 = expand(squeezed.items);
  const bb = boundsOf(slots0);
  const cx = (bb.minX + bb.maxX) / 2;
  const cz = (bb.minZ + bb.maxZ) / 2;
  const centred = slots0.map((s) => ({ ...s, x: step(s.x - cx, 0.001), z: step(s.z - cz, 0.001) }));
  let hw = (bb.maxX - bb.minX) / 2 + 0.06;
  let hh = (bb.maxZ - bb.minZ) / 2 + 0.06;
  const asp = lotAspect(p.level);
  if (hh / hw < asp * 0.88) hh = hw * asp * 0.88;
  if (hh / hw > asp * 1.15) hw = hh / (asp * 1.15);
  hw = Math.ceil(hw * 100) / 100; // the lot as it is saved (to the centimetre): the density is measured on that
  hh = Math.ceil(hh * 100) / 100;
  const density = total / (4 * hw * hh);
  if (density < p.minDensity) {
    lastFail = `density ${density.toFixed(2)}`;
    return null;
  }
  // no big empty space inside (a ring of vehicles around a hole)
  if (p.level >= 4 && largestHole(centred.map(slotBox), hw, hh) > MAX_HOLE) {
    lastFail = 'hole';
    return null;
  }
  const angledShare = centred.filter((s) => s.theta % 90 !== 0).length / centred.length;
  if (angledShare + 1e-9 < p.angled) {
    lastFail = `angled ${angledShare.toFixed(2)}`;
    return null;
  }

  // 2. headings, 3. order
  const th0 = Date.now();
  const ch = chooseHeadings(centred, r, p.maxFree);
  prof.headings += Date.now() - th0;
  if (!ch) {
    lastFail = 'headings';
    return null;
  }
  // the vehicles are numbered backwards along the exit order: the last to leave is number 0
  const rank = new Map<number, number>();
  ch.order.forEach((slotIdx, k) => rank.set(slotIdx, ch.order.length - 1 - k));
  const palette = COLORS_BY_LEVEL.slice(0, p.colors);
  const colorOrder = centred.map((_, i) => ({ i, k: r() })).sort((a, b) => a.k - b.k);
  const colorOf = new Map<number, ColorId>();
  let ci = 0;
  for (const c of colorOrder) colorOf.set(c.i, centred[c.i].type === 'fire' ? 'fire' : palette[ci++ % palette.length]);
  // belts: the places of the cars, the front one first
  const beltIds = [...new Set(centred.filter((s) => s.belt !== undefined).map((s) => s.belt!))].sort((a, b) => a - b);
  const belts: BeltDef[] = beltIds.map((bid, k) => {
    const members = ch.order.filter((i) => centred[i].belt === bid); // front car first
    return { id: k, heading: ch.heading[members[0]], slots: members.map((i) => [centred[i].x, centred[i].z] as [number, number]) };
  });
  const defs: VehicleDef[] = centred
    .map((s, i): VehicleDef => {
      const d: VehicleDef = { id: rank.get(i)!, type: s.type, color: colorOf.get(i)!, x: s.x, z: s.z, heading: ch.heading[i] };
      if (s.rot) d.rotator = true;
      if (s.belt !== undefined) {
        const members = ch.order.filter((j) => centred[j].belt === s.belt);
        d.belt = { id: beltIds.indexOf(s.belt), slot: members.indexOf(i) };
      }
      return d;
    })
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
    world: worldOf(p.level),
    hard: p.hard,
    lot: { halfW: hw, halfH: hh },
    vehicles: defs,
    queue,
  };
  if (belts.length) data.belts = belts;
  if (INTRO[p.level]) data.intro = INTRO[p.level];
  return { data, density };
}

/** The class (0 horizontal, 1 vertical, 2 and 3 diagonal) of a direction. */

/** Big and small vehicles spread evenly through the order of dropping (kept for tests and experiments). */
export function interleave(list: VType[]): VType[] {
  return [...list];
}

/** Chooses `count` vehicles to hide: each has a vehicle right in front of it, which is not hidden itself. Belts and turntables are left alone. */
export function pickHidden(defs: VehicleDef[], count: number, r: () => number): Set<number> {
  const out = new Set<number>();
  if (count <= 0) return out;
  const boxes = defs.map((d) => ({ id: d.id, box: boxOf(d) }));
  const front = new Map<number, number>();
  for (const d of defs) {
    if (d.belt || d.rotator) continue;
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
    if (level >= 10 && !inQ.some((s) => s.theta % 90 !== 0)) { quarterReason = `Q${q} no diagonal`; return false; }
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
  for (const s of slots) for (const c of corners(slotBox(s))) {
    minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x);
    minZ = Math.min(minZ, c.z); maxZ = Math.max(maxZ, c.z);
  }
  return { minX, maxX, minZ, maxZ };
}

export { boxOf };
