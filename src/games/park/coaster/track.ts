/**
 * The track of the roller coaster (SPEC-park.md 3.1): the points that Rani draws, smoothed into a curve, with a loop as a special part.
 * Pure: no DOM. The world is 10 units high and WORLD_W wide, x grows to the right and y up. The track always goes to the right.
 */
export interface Pt { x: number; y: number }

export const WORLD_W = 30;
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

export interface Track {
  /** the control points; pts[0] is the crest. When `complete`, the last one is END. */
  pts: Pt[];
  /** the loop starts at this point (an index in pts), or null */
  loopAt: number | null;
  complete: boolean;
}

export const newTrack = (): Track => ({ pts: [{ ...CREST }], loopAt: null, complete: false });
export const cloneTrack = (t: Track): Track => ({ pts: t.pts.map((p) => ({ ...p })), loopAt: t.loopAt, complete: t.complete });

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
  const minX = last.x + POINT_GAP + (t.loopAt === t.pts.length - 1 ? LOOP_DRIFT + 0.3 : 0);
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
  if (t.loopAt !== null && t.loopAt >= t.pts.length) t.loopAt = null;
}

/** The loop is put at the point nearest to x. Returns false when it does not fit (too low, too high, or no room before the station). */
export function addLoop(t: Track, x: number): boolean {
  let best = 1;
  let d = Infinity;
  t.pts.forEach((p, i) => {
    if (i > 0 && Math.abs(p.x - x) < d && !(t.complete && i === t.pts.length - 1)) {
      d = Math.abs(p.x - x);
      best = i;
    }
  });
  if (t.pts.length < 2) return false;
  const p = t.pts[best];
  if (p.y < MIN_Y + 0.2 || p.y + 2 * LOOP_R > MAX_Y + 0.3) return false;
  if (p.x + LOOP_DRIFT + 0.8 > END.x) return false;
  // the points that are inside the loop (between its entry and its exit) go
  t.pts = t.pts.filter((q, i) => i <= best || q.x > p.x + LOOP_DRIFT + 0.5 || (t.complete && i === t.pts.length - 1));
  t.loopAt = best;
  const next = t.pts[best + 1];
  if (next) {
    // the track leaves the loop at the height of its entry
    const r = reach({ x: p.x + LOOP_DRIFT, y: p.y }, next.x);
    next.y = clamp(next.y, r.lo, r.hi);
  }
  return true;
}
export const removeLoop = (t: Track): void => void (t.loopAt = null);

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
  loopS: [number, number] | null;
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
  const iLoop = t.loopAt === null ? -1 : t.loopAt + n0; // index in `all`
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
  if (iLoop < 0) {
    const n = all.length;
    curve(all, phantomBefore, { x: all[n - 1].x + 1, y: all[n - 1].y }, 0, true);
  } else {
    const before = all.slice(0, iLoop + 1);
    const nb = before.length;
    const prev = before[nb - 2];
    const entry = before[nb - 1];
    const a = Math.atan2(entry.y - prev.y, entry.x - prev.x);
    const lastPhantom = { x: entry.x + Math.cos(a), y: entry.y + Math.sin(a) };
    curve(before, phantomBefore, lastPhantom, 0, true);
    // the loop: a circle, turned to the direction of the entry; the exit is a little to the right of the entry
    const ca = Math.cos(a), sa = Math.sin(a);
    const steps = Math.ceil((2 * Math.PI * LOOP_R + LOOP_DRIFT) / DS);
    for (let k = 1; k <= steps; k++) {
      const u = (2 * Math.PI * k) / steps;
      const lx = LOOP_R * Math.sin(u) + (LOOP_DRIFT * u) / (2 * Math.PI);
      const ly = LOOP_R - LOOP_R * Math.cos(u);
      const ccx = (LOOP_DRIFT * u) / (2 * Math.PI);
      const wx = entry.x + lx * ca - ly * sa;
      const wy = entry.y + lx * sa + ly * ca;
      const cwx = entry.x + ccx * ca - LOOP_R * sa;
      const cwy = entry.y + ccx * sa + LOOP_R * ca;
      push(wx, wy, k === 1 ? { kind: 'loopIn' } : k === steps ? { kind: 'loopOut' } : undefined, { cx: cwx, cy: cwy });
    }
    const exitP = poly[poly.length - 1];
    const after = all.slice(iLoop + 1);
    if (after.length) {
      const exit: Pt = { x: exitP.x, y: exitP.y };
      const firstPhantom = { x: exit.x - ca, y: exit.y - sa };
      const rest = [exit, ...after];
      const lastN = rest[rest.length - 1];
      curve(rest, firstPhantom, { x: lastN.x + 1, y: lastN.y }, iLoop, true);
    }
  }
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
  let loopIn = -1, loopOut = -1;
  raw.forEach((p, i) => {
    if (!p.mark) return;
    if (p.mark.kind === 'ctrl') {
      if (p.mark.i >= 0 && ctrlS[p.mark.i] === undefined) ctrlS[p.mark.i] = cum[i];
    }
    else if (p.mark.kind === 'loopIn') loopIn = cum[i];
    else if (p.mark.kind === 'loopOut') loopOut = cum[i];
    else if (p.mark.kind === 'end') endS = cum[i];
  });
  crestS = ctrlS[0] ?? 0;
  return { x, y, s, th, inLoop, cx, cy, n, crestS, endS, ctrlS, loopS: loopIn >= 0 ? [loopIn, loopOut] : null, complete: t.complete };
}

/** The point at distance s along the path (clamped at both ends), with the direction. */
export function at(p: Path, s: number): { x: number; y: number; th: number; inLoop: boolean; i: number } {
  const f = Math.min(p.n - 1.001, Math.max(0, s / DS));
  const i = Math.floor(f);
  const k = f - i;
  return { x: p.x[i] + (p.x[i + 1] - p.x[i]) * k, y: p.y[i] + (p.y[i + 1] - p.y[i]) * k, th: p.th[i] + (p.th[i + 1] - p.th[i]) * k, inLoop: p.inLoop[i] === 1, i };
}
export const pathLength = (p: Path): number => p.s[p.n - 1];
