/**
 * The track of the roller coaster (SPEC-park.md 3.1): the points that Rani draws, smoothed into a curve, with a loop as a special part.
 * Pure: no DOM. The world is 10 units high and WORLD_W wide, x grows to the right and y up. The track always goes to the right.
 */
export interface Pt { x: number; y: number }

export const WORLD_W = 24;
export const WORLD_H = 10;
export const G = 9;
/** the steepest slope of a track: 70 degrees */
export const MAX_SLOPE = Math.tan((70 * Math.PI) / 180);
export const MIN_Y = 0.5;
export const MAX_Y = 9.6;
/** the start: a platform, the chain lift that carries the car up, and the crest where the drawing begins */
export const PLATFORM_X0 = -3;
/** the start of the track, up to the crest: the car leaves the platform and the chain lift pulls it up (these points are fixed) */
export const START_PTS: Pt[] = [{ x: 0.6, y: 1.5 }, { x: 1.8, y: 1.7 }, { x: 3, y: 3.2 }, { x: 4.2, y: 4.5 }];
export const CHAIN_X0 = 1.2;
export const CREST: Pt = { x: 6, y: 6 };
/** the end station: the track has to come in here, and then runs flat to the end of the world */
export const END: Pt = { x: WORLD_W - 3.4, y: 1.5 };
/** the loop: its radius, and how far to the right its exit is from its entry (the two lanes do not touch) */
export const LOOP_R = 1.25;
export const LOOP_DRIFT = 1.7;
export const POINT_GAP = 0.7;

/** The special parts: a chain lift (pulls the car up by itself), a tunnel and a water splash (decorations); they cover x0..x1 of the track. */
export type PartKind = 'chain' | 'tunnel' | 'splash';
export interface Part { kind: PartKind; x0: number; x1: number }
export const PART_SPAN: Record<PartKind, number> = { chain: 3.2, tunnel: 3.4, splash: 1.2 };

export interface Track {
  /** the control points; pts[0] is the crest. When `complete`, the last one is END. */
  pts: Pt[];
  /** the loops: each starts at one of the points (an index in pts), in order */
  loops: number[];
  parts: Part[];
  complete: boolean;
}

export const newTrack = (): Track => ({ pts: [{ ...CREST }], loops: [], parts: [], complete: false });
export const cloneTrack = (t: Track): Track => ({ pts: t.pts.map((p) => ({ ...p })), loops: [...t.loops], parts: t.parts.map((p) => ({ ...p })), complete: t.complete });

/** The y a point can have next to a neighbour so that the slope stays under 70 degrees. */
export const reach = (from: Pt, x: number): { lo: number; hi: number } => {
  const d = Math.abs(x - from.x) * MAX_SLOPE;
  return { lo: Math.max(MIN_Y, from.y - d), hi: Math.min(MAX_Y, from.y + d) };
};
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/**
 * The finger is at (x, y): extends the track if the finger went far enough to the right of the last point (the points never go back).
 * Returns true when a point was added.
 */
export function extend(t: Track, x: number, y: number): boolean {
  if (t.complete) return false;
  const last = t.pts[t.pts.length - 1];
  // a loop needs room: its exit is to the right of its entry
  const minX = last.x + POINT_GAP + (t.loops.includes(t.pts.length - 1) ? LOOP_DRIFT + 0.3 : 0);
  if (x < minX || x > END.x + 0.001) return false;
  const r = reach(last, x);
  t.pts.push({ x, y: clamp(y, r.lo, r.hi) });
  return true;
}

/**
 * The track reaches the station when the last point is near it and the way down is not too steep: then the end point is added and the
 * track is complete. Returns true when it is complete.
 */
export function finish(t: Track): boolean {
  if (t.complete) return true;
  const last = t.pts[t.pts.length - 1];
  const dx = END.x - last.x;
  if (dx < 0.25 && Math.abs(last.y - END.y) > 0.9) return false;
  if (last.x < END.x - 4.5 || dx < 0) return false;
  if (Math.abs(END.y - last.y) > MAX_SLOPE * Math.max(dx, 0.01)) return false;
  if (dx > 0.05) t.pts.push({ ...END });
  else t.pts[t.pts.length - 1] = { ...END };
  t.complete = true;
  return true;
}

/** Moves a point up or down (never the crest or the end station): inside what its neighbours allow. Returns the y it got. */
export function moveY(t: Track, i: number, y: number): number {
  if (i <= 0 || (t.complete && i === t.pts.length - 1)) return t.pts[i].y;
  const p = t.pts[i];
  let lo = MIN_Y;
  let hi = MAX_Y;
  for (const n of [t.pts[i - 1], t.pts[i + 1]]) {
    if (!n) continue;
    const r = reach(n, p.x);
    lo = Math.max(lo, r.lo);
    hi = Math.min(hi, r.hi);
  }
  p.y = hi < lo ? p.y : clamp(y, lo, hi);
  return p.y;
}

/** Deletes from point i to the end (never the crest). */
export function deleteFrom(t: Track, i: number): void {
  const k = Math.max(1, i);
  t.pts.length = Math.min(t.pts.length, k);
  t.complete = false;
  t.loops = t.loops.filter((i) => i < t.pts.length);
  const lastX = t.pts[t.pts.length - 1].x;
  t.parts = t.parts.filter((p) => p.x0 < lastX);
}

/** A loop is put at the point nearest to x. Returns false when it does not fit (too low, too high, no room before the station, or too near another loop). */
export function addLoop(t: Track, x: number, maxLoops = 2): boolean {
  let best = 1;
  let d = Infinity;
  t.pts.forEach((p, i) => {
    if (i > 0 && Math.abs(p.x - x) < d && !(t.complete && i === t.pts.length - 1)) {
      d = Math.abs(p.x - x);
      best = i;
    }
  });
  if (t.pts.length < 2 || t.loops.length >= maxLoops) return false;
  const p = t.pts[best];
  if (p.y < MIN_Y + 0.2 || p.y + 2 * LOOP_R > MAX_Y + 0.3) return false;
  if (p.x + LOOP_DRIFT + 0.8 > END.x) return false;
  // not on a loop, and not so near another one that they would touch
  if (t.loops.some((l) => Math.abs(t.pts[l].x - p.x) < LOOP_DRIFT + 2.6)) return false;
  // the points that are inside the loop (between its entry and its exit) go; the loops that were after them shift with the points
  const keep: boolean[] = t.pts.map((q, i) => i <= best || q.x > p.x + LOOP_DRIFT + 0.5 || (t.complete && i === t.pts.length - 1));
  const remap: number[] = [];
  let k = 0;
  keep.forEach((kp, i) => (remap[i] = kp ? k++ : -1));
  t.loops = t.loops.map((l) => remap[l]).filter((l) => l >= 0);
  t.pts = t.pts.filter((_, i) => keep[i]);
  t.loops.push(remap[best]);
  t.loops.sort((a, b) => a - b);
  const bi = remap[best];
  const next = t.pts[bi + 1];
  if (next) {
    // the track leaves the loop at the height of its entry
    const r = reach({ x: p.x + LOOP_DRIFT, y: p.y }, next.x);
    next.y = clamp(next.y, r.lo, r.hi);
  }
  return true;
}
/** Takes off the loop nearest to x (or all of them without x). */
export function removeLoop(t: Track, x?: number): void {
  if (x === undefined || t.loops.length <= 1) {
    t.loops = [];
    return;
  }
  let best = 0;
  t.loops.forEach((l, i) => {
    if (Math.abs(t.pts[l].x - x) < Math.abs(t.pts[t.loops[best]].x - x)) best = i;
  });
  t.loops.splice(best, 1);
}

/** A special part is put on the track around x (it covers its span, not inside a loop or on the lift). Returns false when it does not fit. */
export function addPart(t: Track, kind: PartKind, x: number): boolean {
  const span = PART_SPAN[kind];
  const x0 = Math.max(CREST.x + 0.3, x - span / 2);
  const x1 = Math.min(t.pts[t.pts.length - 1].x, x0 + span);
  if (x1 - x0 < span * 0.6) return false;
  if (t.loops.some((l) => t.pts[l].x < x1 + 0.4 && t.pts[l].x + LOOP_DRIFT > x0 - 0.4)) return false;
  // not over another part of the same kind
  if (t.parts.some((q) => q.kind === kind && q.x0 < x1 && q.x1 > x0)) return false;
  t.parts.push({ kind, x0, x1 });
  return true;
}
export const removePart = (t: Track, kind: PartKind): void => void (t.parts = t.parts.filter((p) => p.kind !== kind));

// ---- the curve ----

export interface Path {
  /** the points of the curve, in the order of travel, one every ~0.05 units */
  x: Float64Array;
  y: Float64Array;
  /** the distance along the track at each point */
  s: Float64Array;
  /** the direction of travel */
  th: Float64Array;
  /** 1 inside the loop; the centre of the circle there */
  inLoop: Uint8Array;
  cx: Float64Array;
  cy: Float64Array;
  n: number;
  /** the distance where the chain lift ends (the crest) and where the end station begins (Infinity when the track is not complete) */
  crestS: number;
  endS: number;
  /** the distance of each control point, and of the entry and the exit of the loop */
  ctrlS: number[];
  /** the entry and the exit of each loop, by distance */
  loops: [number, number][];
  /** the special parts, by distance: chain lifts and tunnels (from, to), splashes (the place) */
  chains: [number, number][];
  tunnels: [number, number][];
  splashes: number[];
  complete: boolean;
}

const DS = 0.05;

/** Centripetal-free Catmull-Rom (Hermite with finite differences) through the points, with phantom points at both ends. */
function spline(pts: Pt[], first: Pt, last: Pt, perSeg = 28): Pt[] {
  const P = [first, ...pts, last];
  const out: Pt[] = [];
  for (let i = 1; i < P.length - 2; i++) {
    const p0 = P[i - 1], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2];
    // tangents scaled by the lengths of the segments, so that a short segment next to a long one does not loop back
    const d0 = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1e-6, d1 = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1e-6, d2 = Math.hypot(p3.x - p2.x, p3.y - p2.y) || 1e-6;
    const m1 = { x: ((p2.x - p0.x) / (d0 + d1)) * d1, y: ((p2.y - p0.y) / (d0 + d1)) * d1 };
    const m2 = { x: ((p3.x - p1.x) / (d1 + d2)) * d1, y: ((p3.y - p1.y) / (d1 + d2)) * d1 };
    for (let k = 0; k < perSeg; k++) {
      const t = k / perSeg;
      const t2 = t * t, t3 = t2 * t;
      const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
      out.push({ x: h00 * p1.x + h10 * m1.x + h01 * p2.x + h11 * m2.x, y: h00 * p1.y + h10 * m1.y + h01 * p2.y + h11 * m2.y });
    }
  }
  out.push({ ...P[P.length - 2] });
  return out;
}

/** The curve of the track: the platform, the chain lift, the smoothed points, the loop, the end station. */
export function buildPath(t: Track): Path {
  type Mark = { kind: 'ctrl'; i: number } | { kind: 'loopIn' } | { kind: 'loopOut' } | { kind: 'crest' } | { kind: 'end' };
  const poly: { x: number; y: number; loop?: { cx: number; cy: number }; mark?: Mark }[] = [];
  const push = (x: number, y: number, mark?: Mark, loop?: { cx: number; cy: number }): void => void poly.push({ x, y, mark, loop });

  // the platform: a straight line, then the curve through the fixed points of the start and the drawn points (in one or two curves, the loop in the middle)
  for (let x = PLATFORM_X0; x < START_PTS[0].x; x += DS) push(x, START_PTS[0].y);
  const n0 = START_PTS.length;
  const phantomBefore: Pt = { x: START_PTS[0].x - 1, y: START_PTS[0].y };
  const all: Pt[] = [...START_PTS, ...t.pts];
  const curve = (pts: Pt[], first: Pt, lastP: Pt, base: number, marks: boolean): void => {
    const sp = spline(pts, first, lastP);
    const per = 28;
    sp.forEach((p, k) => {
      const seg = Math.floor(k / per);
      const isCtrl = k % per === 0 || k === sp.length - 1;
      const idx = k === sp.length - 1 ? pts.length - 1 : seg;
      push(p.x, p.y, marks && isCtrl ? { kind: 'ctrl', i: base + idx - n0 } : undefined);
    });
  };
  // the curve goes through the points, one piece up to each loop, the loop (a circle turned to the direction of the entry; its exit is a little to the
  // right of its entry), and the next piece starts at the exit
  let segStart: Pt[] = [];
  let idx0 = 0;
  let phantom: Pt = phantomBefore;
  for (const L of t.loops.map((i) => i + n0)) {
    const pts = [...segStart, ...all.slice(idx0, L + 1)];
    const nb = pts.length;
    const prev = pts[nb - 2];
    const entry = pts[nb - 1];
    const a = Math.atan2(entry.y - prev.y, entry.x - prev.x);
    curve(pts, phantom, { x: entry.x + Math.cos(a), y: entry.y + Math.sin(a) }, idx0 - segStart.length, true);
    const ca = Math.cos(a), sa = Math.sin(a);
    const steps = Math.ceil((2 * Math.PI * LOOP_R + LOOP_DRIFT) / DS);
    for (let k = 1; k <= steps; k++) {
      const u = (2 * Math.PI * k) / steps;
      const lx = LOOP_R * Math.sin(u) + (LOOP_DRIFT * u) / (2 * Math.PI);
      const ly = LOOP_R - LOOP_R * Math.cos(u);
      const ccx = (LOOP_DRIFT * u) / (2 * Math.PI);
      push(entry.x + lx * ca - ly * sa, entry.y + lx * sa + ly * ca, k === 1 ? { kind: 'loopIn' } : k === steps ? { kind: 'loopOut' } : undefined, { cx: entry.x + ccx * ca - LOOP_R * sa, cy: entry.y + ccx * sa + LOOP_R * ca });
    }
    const exitP = poly[poly.length - 1];
    segStart = [{ x: exitP.x, y: exitP.y }];
    idx0 = L + 1;
    phantom = { x: exitP.x - ca, y: exitP.y - sa };
  }
  const pts = [...segStart, ...all.slice(idx0)];
  if (pts.length >= 2) curve(pts, phantom, { x: pts[pts.length - 1].x + 1, y: pts[pts.length - 1].y }, idx0 - segStart.length, true);
  if (t.complete) {
    for (let x = END.x; x <= WORLD_W + 1; x += DS) push(x, END.y, x === END.x ? { kind: 'end' } : undefined);
  }

  // by arc length: one point every DS
  const raw = poly;
  const cum: number[] = [0];
  for (let i = 1; i < raw.length; i++) cum.push(cum[i - 1] + Math.hypot(raw[i].x - raw[i - 1].x, raw[i].y - raw[i - 1].y));
  const total = cum[cum.length - 1];
  const n = Math.floor(total / DS) + 1;
  const x = new Float64Array(n), y = new Float64Array(n), s = new Float64Array(n), th = new Float64Array(n), inLoop = new Uint8Array(n), cx = new Float64Array(n), cy = new Float64Array(n);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const target = i * DS;
    while (j < raw.length - 2 && cum[j + 1] < target) j++;
    const seg = cum[j + 1] - cum[j] || 1;
    const f = Math.min(1, Math.max(0, (target - cum[j]) / seg));
    x[i] = raw[j].x + (raw[j + 1].x - raw[j].x) * f;
    y[i] = raw[j].y + (raw[j + 1].y - raw[j].y) * f;
    s[i] = target;
    const lp = raw[j].loop ?? raw[j + 1].loop;
    if (lp && raw[j].loop && raw[j + 1].loop) {
      inLoop[i] = 1;
      cx[i] = raw[j].loop!.cx + (raw[j + 1].loop!.cx - raw[j].loop!.cx) * f;
      cy[i] = raw[j].loop!.cy + (raw[j + 1].loop!.cy - raw[j].loop!.cy) * f;
    }
  }
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 2), b = Math.min(n - 1, i + 2);
    th[i] = Math.atan2(y[b] - y[a], x[b] - x[a]);
  }
  // where the marks are, by distance
  const ctrlS: number[] = [];
  let crestS = 0, endS = Infinity;
  const loopIns: number[] = [], loopOuts: number[] = [];
  raw.forEach((p, i) => {
    if (!p.mark) return;
    if (p.mark.kind === 'ctrl') {
      if (p.mark.i >= 0 && ctrlS[p.mark.i] === undefined) ctrlS[p.mark.i] = cum[i];
    }
    else if (p.mark.kind === 'loopIn') loopIns.push(cum[i]);
    else if (p.mark.kind === 'loopOut') loopOuts.push(cum[i]);
    else if (p.mark.kind === 'end') endS = cum[i];
  });
  crestS = ctrlS[0] ?? 0;
  const loops: [number, number][] = loopIns.map((a, k) => [a, loopOuts[k]]);
  // the special parts by distance: the first and the last point of the track in their span (never inside a loop)
  const range = (x0: number, x1: number): [number, number] | null => {
    let a = -1, b = -1;
    for (let i = 0; i < n; i++) {
      if (inLoop[i] || s[i] < crestS) continue;
      if (x[i] >= x0 && x[i] <= x1) {
        if (a < 0) a = i;
        b = i;
      }
    }
    return a < 0 ? null : [s[a], s[b]];
  };
  const chains = t.parts.filter((q) => q.kind === 'chain').map((q) => range(q.x0, q.x1)).filter((r): r is [number, number] => !!r);
  const tunnels = t.parts.filter((q) => q.kind === 'tunnel').map((q) => range(q.x0, q.x1)).filter((r): r is [number, number] => !!r);
  const splashes = t.parts.filter((q) => q.kind === 'splash').map((q) => range(q.x0, q.x1)).filter((r): r is [number, number] => !!r).map((r) => (r[0] + r[1]) / 2);
  return { x, y, s, th, inLoop, cx, cy, n, crestS, endS, ctrlS, loops, chains, tunnels, splashes, complete: t.complete };
}

/** The point at distance s along the path (clamped at both ends), with the direction. */
export function at(p: Path, s: number): { x: number; y: number; th: number; inLoop: boolean; i: number } {
  const f = Math.min(p.n - 1.001, Math.max(0, s / DS));
  const i = Math.floor(f);
  const k = f - i;
  return { x: p.x[i] + (p.x[i + 1] - p.x[i]) * k, y: p.y[i] + (p.y[i + 1] - p.y[i]) * k, th: p.th[i] + (p.th[i + 1] - p.th[i]) * k, inLoop: p.inLoop[i] === 1, i };
}
export const pathLength = (p: Path): number => p.s[p.n - 1];
