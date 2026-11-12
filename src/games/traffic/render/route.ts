import { corners, dirOf, type Obb } from '../engine/geometry';
import { SIZES } from '../engine/state';

/**
 * The way a vehicle takes from its place in the lot to its place in the station: out of the lot along its arrow, onto the ring
 * road that goes round the lot, along it to the station and up into the place. Pure maths (no three.js) so that a test can walk
 * every route of every level. The vehicle shrinks on the road (it is a toy road), so the ring can be narrow.
 */

export const ROAD = {
  /** distance from the edge of the lot to the middle of the road */
  off: 0.9,
  width: 0.7,
  /** the size of a vehicle on the road */
  scale: 0.4,
  /** radius of the corners */
  corner: 0.4,
  /** how much farther the vehicle drives out before it turns */
  extra: 0.5,
  /** the top road is reserved from the moment a vehicle's body comes this close to it */
  topLead: 0.45,
  /** the station's platform starts this far beyond the lot (the top road runs between them) */
  stationGap: 2.95,
} as const;

export type VType = keyof typeof SIZES;
export interface RouteIn {
  x: number;
  z: number;
  heading: number;
  type: VType;
  lot: { halfW: number; halfH: number };
  /** where the place is */
  slotX: number;
  stationZ: number;
  /** the size of the vehicle when parked in the station */
  stationScale: number;
}
export interface RoutePoint { x: number; z: number; /** degrees, the way the vehicle faces */ heading: number; scale: number; /** length travelled */ s: number }
export interface Route {
  pts: RoutePoint[];
  length: number;
  /** length travelled at which the top road begins (null when the vehicle never uses it) and the way it runs there: 1 east, -1 west */
  topFrom: number | null;
  topTo: number | null;
  topDir: 1 | -1 | 0;
  /** length travelled at which the vehicle's body first comes within 0.35 of the edge of the lot: from there the ring road has to be free for it */
  enterAt: number;
}

type P = { x: number; z: number };
const hyp = (a: P, b: P): number => Math.hypot(a.x - b.x, a.z - b.z);

/** Rounds the corners of a polyline with small curves. */
function rounded(v: P[], r: number): P[] {
  const out: P[] = [v[0]];
  for (let i = 1; i < v.length - 1; i++) {
    const a = v[i - 1];
    const b = v[i];
    const c = v[i + 1];
    const la = hyp(a, b);
    const lc = hyp(b, c);
    const k = Math.min(r, la * 0.45, lc * 0.45);
    if (k < 1e-3) { out.push(b); continue; }
    const p0 = { x: b.x + ((a.x - b.x) / la) * k, z: b.z + ((a.z - b.z) / la) * k };
    const p1 = { x: b.x + ((c.x - b.x) / lc) * k, z: b.z + ((c.z - b.z) / lc) * k };
    for (let t = 0; t <= 8; t++) {
      const u = t / 8;
      out.push({ x: (1 - u) * (1 - u) * p0.x + 2 * (1 - u) * u * b.x + u * u * p1.x, z: (1 - u) * (1 - u) * p0.z + 2 * (1 - u) * u * b.z + u * u * p1.z });
    }
  }
  out.push(v[v.length - 1]);
  return out;
}

export function buildRoute(i: RouteIn): Route {
  const { halfW, halfH } = i.lot;
  const L = -(halfW + ROAD.off);
  const R = halfW + ROAD.off;
  const T = -(halfH + ROAD.off);
  const B = halfH + ROAD.off;
  const u = dirOf(i.heading);
  const hl = SIZES[i.type].len / 2;
  const hw = SIZES[i.type].wid / 2;
  // straight out along the arrow until the (small) vehicle is clear of the lot
  const small: Obb = { x: i.x, z: i.z, hl: hl * ROAD.scale, hw: hw * ROAD.scale, heading: i.heading };
  let d = 0;
  while (d < 60 && corners({ ...small, x: i.x + u.x * d, z: i.z + u.z * d }).some((p) => Math.abs(p.x) < halfW + 0.12 && Math.abs(p.z) < halfH + 0.12)) d += 0.05;
  // which edge it leaves through
  const tx = u.x > 1e-6 ? (halfW - i.x) / u.x : u.x < -1e-6 ? (-halfW - i.x) / u.x : Infinity;
  const tz = u.z > 1e-6 ? (halfH - i.z) / u.z : u.z < -1e-6 ? (-halfH - i.z) / u.z : Infinity;
  const side: 'left' | 'right' | 'top' | 'bottom' = tx < tz ? (u.x < 0 ? 'left' : 'right') : u.z < 0 ? 'top' : 'bottom';
  d += ROAD.extra;
  const e1: P = { x: i.x + u.x * d, z: i.z + u.z * d };
  const verts: P[] = [{ x: i.x, z: i.z }, e1];
  let topFrom: P;
  let topZ = T;
  let dir: 1 | -1 | 0 = 0;
  const along = 0.9;
  if (side === 'top') {
    // it drives along the top road from where it came to it (a hair north of the middle of the road when it came out far)
    topZ = Math.min(e1.z, T);
    topFrom = { x: e1.x, z: topZ };
    if (Math.abs(i.slotX - e1.x) > 0.05) {
      dir = i.slotX > e1.x ? 1 : -1;
      verts.push({ x: e1.x + dir * Math.min(1.2, Math.abs(i.slotX - e1.x)), z: topZ });
    }
  } else if (side === 'left' || side === 'right') {
    const cx = side === 'left' ? L : R;
    verts.push({ x: cx, z: Math.max(T + 0.01, e1.z - along) }, { x: cx, z: T });
    topFrom = { x: cx, z: T };
    dir = i.slotX > cx ? 1 : -1;
  } else {
    // the bottom road: go to the nearer corner, then up its side
    const left = e1.x < 0;
    const cx = left ? L : R;
    verts.push({ x: e1.x + (left ? -along : along), z: B }, { x: cx, z: B }, { x: cx, z: T });
    topFrom = { x: cx, z: T };
    dir = i.slotX > cx ? 1 : -1;
  }
  verts.push({ x: i.slotX, z: topZ }, { x: i.slotX, z: i.stationZ });
  // remove repeated points
  const clean = verts.filter((p, k) => k === 0 || hyp(p, verts[k - 1]) > 1e-4);
  const poly = rounded(clean, ROAD.corner);
  // resample every 0.06 along the polyline
  const pts: RoutePoint[] = [];
  const cum: number[] = [0];
  for (let k = 1; k < poly.length; k++) cum.push(cum[k - 1] + hyp(poly[k], poly[k - 1]));
  const total = cum[cum.length - 1];
  const at = (s: number): { p: P; h: number } => {
    let k = 1;
    while (k < poly.length - 1 && cum[k] < s) k++;
    const a = poly[k - 1];
    const b = poly[k];
    const seg = Math.max(1e-6, cum[k] - cum[k - 1]);
    const t = Math.min(1, Math.max(0, (s - cum[k - 1]) / seg));
    return { p: { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }, h: (Math.atan2(b.z - a.z, b.x - a.x) * 180) / Math.PI };
  };
  const step = 0.06;
  const n = Math.max(1, Math.ceil(total / step));
  let topFromS: number | null = null;
  let topToS: number | null = null;
  let finalLegStart = total;
  // the last leg is the one up into the place
  for (let k = poly.length - 1; k > 0; k--) if (Math.abs(poly[k].x - i.slotX) < 1e-3 && Math.abs(poly[k - 1].x - i.slotX) < 1e-3) finalLegStart = cum[k - 1]; else break;
  const startShrink = 0;
  for (let k = 0; k <= n; k++) {
    const s = (k / n) * total;
    const { p, h } = at(s);
    let scale: number;
    if (s <= d) scale = 1 - (1 - ROAD.scale) * (d > 1e-6 ? s / d : 1) + startShrink;
    else if (s >= finalLegStart && total - finalLegStart > 1e-6) scale = ROAD.scale + (i.stationScale - ROAD.scale) * ((s - finalLegStart) / (total - finalLegStart));
    else scale = ROAD.scale;
    if (topFromS === null && Math.abs(p.z - T) < 0.05 && s > d - 1e-6 && dir !== 0 && Math.abs(p.x - topFrom.x) < 0.8 + 0.01 * 0 && s >= d) topFromS = s;
    pts.push({ x: p.x, z: p.z, heading: h, scale, s });
  }
  if (dir !== 0) {
    // the top road begins where the path first comes to the top line and ends where it turns up into the place
    topFromS = null;
    for (const q of pts) if (Math.min(...corners(boxAt(i.type, q)).map((c) => c.z)) <= T + ROAD.width / 2 + ROAD.topLead) { topFromS = q.s; break; }
    topToS = finalLegStart;
  }
  let enterAt = total;
  for (const q of pts) if (corners(boxAt(i.type, q)).some((c) => Math.abs(c.x) > halfW - 0.35 || Math.abs(c.z) > halfH - 0.35)) { enterAt = q.s; break; }
  return { pts, length: total, topFrom: topFromS, topTo: topToS, topDir: dir, enterAt };
}

/** The footprint of a vehicle at a point of its route. */
export function boxAt(type: VType, q: RoutePoint): Obb {
  return { x: q.x, z: q.z, hl: (SIZES[type].len / 2) * q.scale, hw: (SIZES[type].wid / 2) * q.scale, heading: q.heading };
}

/** The places of the station, as the scene lays them out: the x of place number `slot` (0 is the VIP place). */
export function stationSlotX(halfW: number, slot: number, pads = 0): number {
  const fitHalf = Math.max(halfW + 0.6, 3.7);
  const n = Math.max(pads, fitHalf >= 5.7 ? 8 : 5);
  const pitch = Math.min(1.42, (fitHalf * 2 * 0.95) / n);
  return (slot - (n - 1) / 2) * pitch;
}
/** The z of the middle of the station for a lot of this half height. */
export const stationZOf = (halfH: number): number => -(halfH + ROAD.stationGap);
