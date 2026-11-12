import { corners, dirOf, type Obb } from './geometry';
import { SIZES, type VType } from './state';

/**
 * Packs vehicles of mixed directions into a box by compression: they start spread out, then the box is shrunk a little at
 * a time and overlaps are pushed apart (along the axis where they overlap least) until everything fits again.
 */

/** The four directions a vehicle can lie in: horizontal, vertical, and 45 degrees to either side. */
export const CLASS_THETA = [0, 90, 45, 135] as const;
export const isDiagClass = (c: number): boolean => c >= 2;

export interface Item {
  type: VType;
  cls: number;
  x: number;
  z: number;
  /** a footprint of its own: a belt of cars is one long piece, a vehicle on a turntable a square */
  dims?: { len: number; wid: number };
  /** how many vehicles the piece is (a belt is 3) */
  w?: number;
  /** turns on the spot: it has no direction, so it is not counted in groups of vehicles that lie the same way */
  rot?: boolean;
}

export const dimsOf = (it: Pick<Item, 'type' | 'dims'>): { len: number; wid: number } => it.dims ?? SIZES[it.type];

export const itemBox = (it: Item, grow = 0): Obb => ({ x: it.x, z: it.z, hl: dimsOf(it).len / 2 + grow, hw: dimsOf(it).wid / 2 + grow, heading: CLASS_THETA[it.cls] });

/** How far (in the axis where they overlap least) two boxes overlap; null when they do not. */
function mtv(a: Obb, b: Obb): { nx: number; nz: number; depth: number } | null {
  const ca = corners(a);
  const cb = corners(b);
  let best = Infinity;
  let bx = 0;
  let bz = 0;
  for (const o of [a, b]) {
    const u = dirOf(o.heading);
    for (const ax of [u, { x: -u.z, z: u.x }]) {
      let aMin = Infinity, aMax = -Infinity, bMin = Infinity, bMax = -Infinity;
      for (const p of ca) {
        const d = p.x * ax.x + p.z * ax.z;
        aMin = Math.min(aMin, d); aMax = Math.max(aMax, d);
      }
      for (const p of cb) {
        const d = p.x * ax.x + p.z * ax.z;
        bMin = Math.min(bMin, d); bMax = Math.max(bMax, d);
      }
      const ov = Math.min(aMax - bMin, bMax - aMin);
      if (ov <= 0) return null;
      if (ov < best) {
        best = ov;
        const sign = (a.x - b.x) * ax.x + (a.z - b.z) * ax.z >= 0 ? 1 : -1;
        bx = ax.x * sign;
        bz = ax.z * sign;
      }
    }
  }
  return { nx: bx, nz: bz, depth: best };
}

const reach = (it: Item): number => Math.hypot(dimsOf(it).len, dimsOf(it).wid) / 2;

/** Pushes the items apart and inside the box. True when nothing overlaps any more (with `gap` of room). */
export function relax(items: Item[], hw: number, hh: number, gap: number, iters: number): boolean {
  const n = items.length;
  for (let it = 0; it < iters; it++) {
    let worst = 0;
    // inside the box
    for (const q of items) {
      const th = (CLASS_THETA[q.cls] * Math.PI) / 180;
      const d = dimsOf(q);
      const ex = Math.abs(Math.cos(th)) * (d.len / 2 + gap) + Math.abs(Math.sin(th)) * (d.wid / 2 + gap);
      const ez = Math.abs(Math.sin(th)) * (d.len / 2 + gap) + Math.abs(Math.cos(th)) * (d.wid / 2 + gap);
      const nx = Math.max(-hw + ex, Math.min(hw - ex, q.x));
      const nz = Math.max(-hh + ez, Math.min(hh - ez, q.z));
      worst = Math.max(worst, Math.abs(nx - q.x), Math.abs(nz - q.z));
      q.x = nx;
      q.z = nz;
    }
    for (let i = 0; i < n; i++) {
      const a = items[i];
      for (let j = i + 1; j < n; j++) {
        const b = items[j];
        const r = reach(a) + reach(b) + 2 * gap;
        if (Math.abs(a.x - b.x) > r || Math.abs(a.z - b.z) > r) continue;
        const m = mtv(itemBox(a, gap), itemBox(b, gap));
        if (!m) continue;
        worst = Math.max(worst, m.depth);
        const push = (m.depth / 2) * 1.02 + 1e-4;
        a.x += m.nx * push;
        a.z += m.nz * push;
        b.x -= m.nx * push;
        b.z -= m.nz * push;
      }
    }
    if (worst < 2e-3) return true;
  }
  return false;
}

export interface Packed { items: Item[]; hw: number; hh: number }

/** Compresses `items` (random starting positions) into the smallest box (of the given width : height ratio) that it can. */
export function compress(items: Item[], aspect: number, gap: number, r: () => number): Packed | null {
  const area = items.reduce((s, q) => s + dimsOf(q).len * dimsOf(q).wid, 0);
  let hw = Math.sqrt(area / 0.5 / (4 * aspect));
  let hh = hw * aspect;
  for (const q of items) {
    q.x = (r() * 2 - 1) * hw * 0.9;
    q.z = (r() * 2 - 1) * hh * 0.9;
  }
  let ok = false;
  for (let grow = 0; grow < 25 && !ok; grow++) {
    ok = relax(items, hw, hh, gap, 300);
    if (!ok) {
      hw *= 1.03;
      hh *= 1.03;
    }
  }
  if (!ok) return null;
  return shrinkLoop(items, hw, hh, aspect, gap, r);
}

/** Shrinks a box that holds `items` (without overlaps) as far as it goes, pushing overlaps apart after every step. */
export function shrinkLoop(items: Item[], hw0: number, hh0: number, aspect: number, gap: number, r: () => number, maxFails = 25, maxSteps = 600, accept?: (items: Item[]) => boolean): Packed {
  let hw = hw0;
  let hh = hh0;
  let good = items.map((q) => ({ ...q }));
  let goodHw = hw;
  let goodHh = hh;
  let fails = 0;
  for (let step = 0; step < maxSteps && fails < maxFails; step++) {
    const f = 0.997;
    // shrink the side that is farther from the wanted ratio
    const shrinkW = hh / hw >= aspect;
    const nhw = shrinkW ? hw * f : hw;
    const nhh = shrinkW ? hh : hh * f;
    for (const q of items) {
      q.x *= nhw / hw;
      q.z *= nhh / hh;
    }
    // a little shake helps a jammed packing find room
    if (fails > 0) for (const q of items) {
      q.x += (r() - 0.5) * 0.06 * Math.min(fails, 6);
      q.z += (r() - 0.5) * 0.06 * Math.min(fails, 6);
    }
    if (relax(items, nhw, nhh, gap, 400) && (!accept || accept(items))) {
      hw = nhw;
      hh = nhh;
      good = items.map((q) => ({ ...q }));
      goodHw = hw;
      goodHh = hh;
      fails = 0;
    } else {
      fails++;
      items.forEach((q, i) => Object.assign(q, good[i]));
      hw = goodHw;
      hh = goodHh;
    }
  }
  return { items: good, hw: goodHw, hh: goodHh };
}

/** Groups of neighbouring vehicles (gap up to `near`) that lie in the same direction. */
export function sameDirectionClusters(items: Item[], near: number): number[][] {
  const n = items.length;
  const seen = new Array<boolean>(n).fill(false);
  const out: number[][] = [];
  const adj = (i: number, j: number): boolean => {
    const a = items[i];
    const b = items[j];
    if (a.cls !== b.cls) return false;
    const r = reach(a) + reach(b) + 2 * near;
    if (Math.abs(a.x - b.x) > r || Math.abs(a.z - b.z) > r) return false;
    return mtv(itemBox(a, near), itemBox(b, near)) !== null;
  };
  for (let i = 0; i < n; i++) {
    if (seen[i] || items[i].rot) continue;
    const comp = [i];
    seen[i] = true;
    for (let k = 0; k < comp.length; k++) for (let j = 0; j < n; j++) if (!seen[j] && !items[j].rot && adj(comp[k], j)) {
      seen[j] = true;
      comp.push(j);
    }
    // a belt counts as the vehicles on it: its index appears once for each
    out.push(comp.flatMap((idx) => Array<number>(items[idx].w ?? 1).fill(idx)));
  }
  return out;
}

/** How many vehicles lie the same way in the group of neighbours that item `idx` belongs to (a belt counts as its cars). */
export function groupSizeOf(items: Item[], idx: number, near: number): number {
  if (items[idx].rot) return 1;
  const seen = new Set<number>([idx]);
  const queue = [idx];
  let size = items[idx].w ?? 1;
  for (let k = 0; k < queue.length; k++) {
    const a = items[queue[k]];
    for (let j = 0; j < items.length; j++) {
      if (seen.has(j) || items[j].rot) continue;
      const b = items[j];
      if (a.cls !== b.cls) continue;
      const r = reach(a) + reach(b) + 2 * near;
      if (Math.abs(a.x - b.x) > r || Math.abs(a.z - b.z) > r) continue;
      if (mtv(itemBox(a, near), itemBox(b, near)) === null) continue;
      seen.add(j);
      queue.push(j);
      size += b.w ?? 1;
    }
  }
  return size;
}
