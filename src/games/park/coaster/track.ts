/**
 * The track of version 2 (SPEC-park.md 3): a list of pieces on the tiles of an 8x8 plot, 7 levels high. Pure: no DOM, no Three.js.
 * The track is a circuit through one station tile: it leaves the station to the east and has to come back into it from the west.
 * `walk` follows the pieces over the tiles; `buildPath` makes the curve (the same curve is drawn in 3D and ridden by the physics: the "profile" of
 * the curve is horizontal distance and height, so that the old energy physics works on it).
 */
export const N = 8;
export const MAXZ = 6;
/** a tile, a level of height, the height of the rails over the ground at level 0, the radius of a loop */
export const T = 3;
export const LH = 1.4;
export const Y0 = 0.6;
export const LOOP_R = 1.6;
export const G = 9;
export const DS = 0.05;

export type Kind = 'straight' | 'up' | 'down' | 'left' | 'right' | 'loop';
export const KINDS: Kind[] = ['straight', 'up', 'down', 'left', 'right', 'loop'];
/** 0 east, 1 south, 2 west, 3 north (south is the way the rows grow) */
export const DIR: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]];
export interface Cursor { c: number; r: number; d: number; z: number }
export const STATION = { c: 3, r: 7 };
export const START: Cursor = { c: 4, r: 7, d: 0, z: 0 };
export interface Track { pieces: Kind[] }
export const newTrack = (): Track => ({ pieces: [] });
export const cloneTrack = (t: Track): Track => ({ pieces: [...t.pieces] });

const dz = (k: Kind): number => (k === 'up' ? 1 : k === 'down' ? -1 : 0);
const inGrid = (c: number, r: number): boolean => c >= 0 && c < N && r >= 0 && r < N;
const key = (c: number, r: number): number => r * N + c;

export interface Step { next: Cursor; tiles: [number, number][]; why?: 'space' | 'high' }
/** What a piece does from a cursor: the tiles it covers and where the next one goes (why: it cannot be, not counting other pieces). */
export function step(cur: Cursor, k: Kind): Step {
  const [dx, dy] = DIR[cur.d];
  const here: [number, number] = [cur.c, cur.r];
  if (k === 'up' && cur.z >= MAXZ) return { next: cur, tiles: [here], why: 'high' };
  if (k === 'down' && cur.z <= 0) return { next: cur, tiles: [here], why: 'space' };
  // a loop is 2.1 levels tall
  if (k === 'loop' && cur.z > MAXZ - 2) return { next: cur, tiles: [here], why: 'high' };
  if (k === 'left' || k === 'right') {
    const nd = (cur.d + (k === 'right' ? 1 : 3)) % 4;
    const [nx, ny] = DIR[nd];
    return { next: { c: cur.c + nx, r: cur.r + ny, d: nd, z: cur.z }, tiles: [here] };
  }
  if (k === 'loop') return { next: { c: cur.c + 2 * dx, r: cur.r + 2 * dy, d: cur.d, z: cur.z }, tiles: [here, [cur.c + dx, cur.r + dy]] };
  return { next: { c: cur.c + dx, r: cur.r + dy, d: cur.d, z: cur.z + dz(k) }, tiles: [here] };
}

export const atStation = (c: Cursor): boolean => c.c === STATION.c && c.r === STATION.r;

export interface Walk {
  /** the cursor before each piece, and the end */
  before: Cursor[];
  end: Cursor;
  occupied: Set<number>;
  closed: boolean;
}
/** Follows the pieces from the start (the track is assumed legal). */
export function walk(t: Track): Walk {
  let cur = START;
  const before: Cursor[] = [];
  const occupied = new Set<number>();
  for (const k of t.pieces) {
    before.push(cur);
    const s = step(cur, k);
    for (const [c, r] of s.tiles) occupied.add(key(c, r));
    cur = s.next;
  }
  return { before, end: cur, occupied, closed: t.pieces.length > 0 && atStation(cur) && cur.d === 0 && cur.z === 0 };
}
export const isClosed = (t: Track): boolean => walk(t).closed;

/** Geometry only: can this piece go next (inside the plot, tiles free, the station only when coming in right). Why not: 'space' | 'high'. */
export function fits(w: Walk, k: Kind): { ok: true; next: Cursor } | { ok: false; why: 'space' | 'high' } {
  if (w.closed) return { ok: false, why: 'space' };
  const s = step(w.end, k);
  if (s.why) return { ok: false, why: s.why };
  for (const [c, r] of s.tiles) if (!inGrid(c, r) || w.occupied.has(key(c, r)) || (c === STATION.c && r === STATION.r)) return { ok: false, why: 'space' };
  const n = s.next;
  if (atStation(n)) return n.d === 0 && n.z === 0 ? { ok: true, next: n } : { ok: false, why: 'space' };
  if (!inGrid(n.c, n.r) || w.occupied.has(key(n.c, n.r))) return { ok: false, why: 'space' };
  return { ok: true, next: n };
}

// ---- the curve ----

export interface Path {
  /** the profile: horizontal distance and height, the distance along the track, the slope, 1 inside a loop and the centre of its circle there */
  x: Float64Array;
  y: Float64Array;
  s: Float64Array;
  th: Float64Array;
  inLoop: Uint8Array;
  cx: Float64Array;
  cy: Float64Array;
  n: number;
  /** where the car starts (the front of the train), where the chain lift ends and the free ride begins, where the station is (Infinity when not closed) */
  startS: number;
  crestS: number;
  endS: number;
  loops: [number, number][];
  chains: [number, number][];
  tunnels: [number, number][];
  splashes: number[];
  ctrlS: number[];
  complete: boolean;
}
export interface Curve extends Path {
  /** the world: position, the forward direction in the ground plane (for the loops and the tilt of the rails) */
  X: Float64Array;
  Y: Float64Array;
  Z: Float64Array;
  fx: Float64Array;
  fz: Float64Array;
  /** which piece each point belongs to (-1: the station and the run after the last piece) and where each piece starts (by distance) */
  piece: Int16Array;
  pieceS: number[];
  /** the length of the circuit up to the station (the distance where a closed track is back at the middle of the station) */
  length: number;
  /** the distance where the pieces end (the open end of the track, or the station) */
  piecesEnd: number;
}

type V3 = [number, number, number];
const centre = (c: number, r: number, z: number): V3 => [(c + 0.5) * T, Y0 + z * LH, (r + 0.5) * T];
export const worldOf = (cur: Cursor): V3 => centre(cur.c, cur.r, cur.z);

interface Raw { p: V3; fx: number; fz: number; u: number; piece: number }

function bezier(p0: V3, h0: V3, h1: V3, p1: V3, n: number, out: V3[]): void {
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = (1 - t) ** 3, b = 3 * (1 - t) ** 2 * t, c = 3 * (1 - t) * t * t, d = t ** 3;
    out.push([a * p0[0] + b * h0[0] + c * h1[0] + d * p1[0], a * p0[1] + b * h0[1] + c * h1[1] + d * p1[1], a * p0[2] + b * h0[2] + c * h1[2] + d * p1[2]]);
  }
}

/** The curve of the track (and the run after the last piece when it is not closed, for the energy of the next piece). */
export function buildCurve(t: Track): Curve {
  const w = walk(t);
  const raws: Raw[] = [];
  const push = (p: V3, fx: number, fz: number, u: number, piece: number): void => void raws.push({ p, fx, fz, u, piece });
  const slope = (a: Kind | null, b: Kind | null): number => {
    if (a === 'loop' || b === 'loop') return 0;
    return (((a ? dz(a) : 0) + (b ? dz(b) : 0)) / 2) * (LH / T);
  };
  // the station: from its middle to its east edge
  const sc = centre(STATION.c, STATION.r, 0);
  push(sc, 1, 0, -1, -1);
  push([sc[0] + T / 2, sc[1], sc[2]], 1, 0, -1, -1);
  t.pieces.forEach((k, i) => {
    const cur = w.before[i];
    const [vx, vz] = DIR[cur.d];
    const cen = centre(cur.c, cur.r, cur.z);
    const e: V3 = [cen[0] - (vx * T) / 2, cen[1], cen[2] - (vz * T) / 2];
    const s0 = slope(i > 0 ? t.pieces[i - 1] : null, k);
    const s1 = slope(k, i + 1 < t.pieces.length ? t.pieces[i + 1] : null);
    if (k === 'loop') {
      const D = 2 * T;
      const steps = 120;
      for (let j = i === 0 ? 0 : 1; j <= steps; j++) {
        const u = (j / steps) * Math.PI * 2;
        const f = (D * u) / (2 * Math.PI) + LOOP_R * Math.sin(u);
        const lat = 0.95 * Math.sin(u) * Math.sin(u / 2) ** 2;
        // right of the heading: (-vz, vx) turned to the ground plane
        push([e[0] + vx * f + -vz * lat, e[1] + LOOP_R * (1 - Math.cos(u)), e[2] + vz * f + vx * lat], vx, vz, u, i);
      }
      return;
    }
    const pts: V3[] = [];
    if (k === 'left' || k === 'right') {
      const nd = (cur.d + (k === 'right' ? 1 : 3)) % 4;
      const [nx, nz] = DIR[nd];
      const x1: V3 = [cen[0] + (nx * T) / 2, cen[1], cen[2] + (nz * T) / 2];
      const kh = 0.5523 * (T / 2);
      const hv = T / 3;
      bezier(e, [e[0] + vx * kh, e[1] + s0 * hv, e[2] + vz * kh], [x1[0] - nx * kh, x1[1] - s1 * hv, x1[2] - nz * kh], x1, 24, pts);
    } else {
      const x1: V3 = [cen[0] + (vx * T) / 2, cen[1] + dz(k) * LH, cen[2] + (vz * T) / 2];
      const h = T / 3;
      bezier(e, [e[0] + vx * h, e[1] + s0 * h, e[2] + vz * h], [x1[0] - vx * h, x1[1] - s1 * h, x1[2] - vz * h], x1, 16, pts);
    }
    for (let j = i === 0 ? 0 : 1; j < pts.length; j++) {
      // the forward direction follows the curve
      const a = pts[Math.max(0, j - 1)], b = pts[Math.min(pts.length - 1, j + 1)];
      let fx = b[0] - a[0], fz = b[2] - a[2];
      const l = Math.hypot(fx, fz) || 1;
      fx /= l;
      fz /= l;
      push(pts[j], fx, fz, -1, i);
    }
  });
  const last = raws[raws.length - 1];
  const piecesEndRaw = raws.length - 1;
  if (w.closed) {
    push([sc[0], sc[1], sc[2]], 1, 0, -1, -1);
  } else {
    // the run after the end (flat, straight on): so that the last piece has somewhere to go when the energy is checked
    const [vx, vz] = DIR[w.end.d];
    const lp = last.p;
    for (let m = 1; m <= 12; m++) push([lp[0] + (vx * m * T) / 8, lp[1], lp[2] + (vz * m * T) / 8], vx, vz, -1, -1);
  }
  // by arc length: one point every DS
  const cum: number[] = [0];
  for (let i = 1; i < raws.length; i++) cum.push(cum[i - 1] + Math.hypot(raws[i].p[0] - raws[i - 1].p[0], raws[i].p[1] - raws[i - 1].p[1], raws[i].p[2] - raws[i - 1].p[2]));
  const total = cum[cum.length - 1];
  const n = Math.floor(total / DS) + 1;
  const X = new Float64Array(n), Yv = new Float64Array(n), Z = new Float64Array(n), fx = new Float64Array(n), fz = new Float64Array(n);
  const x = new Float64Array(n), s = new Float64Array(n), th = new Float64Array(n), inLoop = new Uint8Array(n), cx = new Float64Array(n), cy = new Float64Array(n);
  const piece = new Int16Array(n);
  let j = 0;
  let hx = 0;
  for (let i = 0; i < n; i++) {
    const target = i * DS;
    while (j < raws.length - 2 && cum[j + 1] < target) j++;
    const seg = cum[j + 1] - cum[j] || 1;
    const f = Math.min(1, Math.max(0, (target - cum[j]) / seg));
    const a = raws[j], b = raws[j + 1];
    X[i] = a.p[0] + (b.p[0] - a.p[0]) * f;
    Yv[i] = a.p[1] + (b.p[1] - a.p[1]) * f;
    Z[i] = a.p[2] + (b.p[2] - a.p[2]) * f;
    const ffx = a.fx + (b.fx - a.fx) * f, ffz = a.fz + (b.fz - a.fz) * f;
    const fl = Math.hypot(ffx, ffz) || 1;
    fx[i] = ffx / fl;
    fz[i] = ffz / fl;
    s[i] = target;
    if (i > 0) hx += Math.hypot(X[i] - X[i - 1], Z[i] - Z[i - 1]);
    x[i] = hx;
    piece[i] = f < 0.5 ? a.piece : b.piece;
    if (a.u >= 0 && b.u >= 0) {
      const u = a.u + (b.u - a.u) * f;
      inLoop[i] = 1;
      cx[i] = hx - LOOP_R * Math.sin(u);
      // the circle starts at the height of the entry of the loop
      cy[i] = Yv[i] - LOOP_R * (1 - Math.cos(u)) + LOOP_R;
    }
  }
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 2), b = Math.min(n - 1, i + 2);
    th[i] = Math.atan2(Yv[b] - Yv[a], x[b] - x[a]);
  }
  // the loops, the chain lift (to the first descent), where the pieces start and end
  const pieceS: number[] = [];
  for (let i = 0; i < t.pieces.length; i++) {
    let k = 0;
    while (k < n - 1 && piece[k] !== i) k++;
    pieceS.push(s[k]);
  }
  const loops: [number, number][] = [];
  for (let i = 0; i < n; ) {
    if (inLoop[i]) {
      let e = i;
      while (e + 1 < n && inLoop[e + 1]) e++;
      loops.push([s[i], s[e]]);
      i = e + 1;
    } else i++;
  }
  const firstDown = t.pieces.indexOf('down');
  const piecesEnd = Math.min(total, cum[piecesEndRaw]);
  const length = w.closed ? total : piecesEnd;
  const crestS = firstDown >= 0 ? pieceS[firstDown] : w.closed ? length : piecesEnd + 100;
  const chains: [number, number][] = [[1.5, Math.min(crestS, piecesEnd)]];
  const complete = w.closed;
  return {
    x, y: Yv, s, th, inLoop, cx, cy, n, startS: 1.2, crestS, endS: complete ? total : Infinity, loops, chains: crestS > 1.5 ? chains : [], tunnels: [], splashes: [], ctrlS: pieceS, complete,
    X, Y: Yv, Z, fx, fz, piece, pieceS, length, piecesEnd,
  };
}
export const buildPath = buildCurve;

/** The point at distance s along the path (clamped at both ends), with the direction. */
export function at(p: Path, s: number): { x: number; y: number; th: number; inLoop: boolean; i: number } {
  const f = Math.min(p.n - 1.001, Math.max(0, s / DS));
  const i = Math.floor(f);
  const k = f - i;
  return { x: p.x[i] + (p.x[i + 1] - p.x[i]) * k, y: p.y[i] + (p.y[i + 1] - p.y[i]) * k, th: p.th[i] + (p.th[i + 1] - p.th[i]) * k, inLoop: p.inLoop[i] === 1, i };
}
