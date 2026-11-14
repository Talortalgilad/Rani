/**
 * The frames of the curve: at every point, the direction of travel, "up" (in the plane of travel: upside down in the loop) and "right".
 * Pure numbers (arrays), so that the 3D code and the tests use the same ones.
 */
import { DS, type Curve } from './track';

export interface Frames { t: Float64Array; u: Float64Array; r: Float64Array }

export function framesOf(c: Curve): Frames {
  const n = c.n;
  const t = new Float64Array(n * 3), u = new Float64Array(n * 3), r = new Float64Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 2), b = Math.min(n - 1, i + 2);
    let tx = c.X[b] - c.X[a], ty = c.Y[b] - c.Y[a], tz = c.Z[b] - c.Z[a];
    const l = Math.hypot(tx, ty, tz) || 1;
    tx /= l;
    ty /= l;
    tz /= l;
    // up: the tangent turned a quarter in the plane of the forward direction and the vertical
    const tf = tx * c.fx[i] + tz * c.fz[i];
    let ux = -ty * c.fx[i], uy = tf, uz = -ty * c.fz[i];
    const ul = Math.hypot(ux, uy, uz) || 1;
    ux /= ul;
    uy /= ul;
    uz /= ul;
    // right = forward x up
    const rx = ty * uz - tz * uy, ry = tz * ux - tx * uz, rz = tx * uy - ty * ux;
    t.set([tx, ty, tz], i * 3);
    u.set([ux, uy, uz], i * 3);
    r.set([rx, ry, rz], i * 3);
  }
  return { t, u, r };
}

/** The distance on a closed circuit (the train goes round and round: the distance wraps). */
export const wrap = (s: number, length: number): number => ((s % length) + length) % length;

export interface Pose { p: [number, number, number]; t: [number, number, number]; u: [number, number, number]; r: [number, number, number] }
/** The place and the frame at distance s of the circuit (it wraps round the station). */
export function poseAt(c: Curve, f: Frames, s: number, closed = true): Pose {
  const d = closed ? wrap(s, c.length) : Math.min(Math.max(0, s), c.s[c.n - 1]);
  const x = Math.min(c.n - 1.001, d / DS);
  const i = Math.floor(x), k = x - i;
  const l = (a: Float64Array | number[], o: number): number => a[i * 3 + o] + (a[(i + 1) * 3 + o] - a[i * 3 + o]) * k;
  const norm = (v: [number, number, number]): [number, number, number] => {
    const m = Math.hypot(...v) || 1;
    return [v[0] / m, v[1] / m, v[2] / m];
  };
  return {
    p: [c.X[i] + (c.X[i + 1] - c.X[i]) * k, c.Y[i] + (c.Y[i + 1] - c.Y[i]) * k, c.Z[i] + (c.Z[i + 1] - c.Z[i]) * k],
    t: norm([l(f.t, 0), l(f.t, 1), l(f.t, 2)]),
    u: norm([l(f.u, 0), l(f.u, 1), l(f.u, 2)]),
    r: norm([l(f.r, 0), l(f.r, 1), l(f.r, 2)]),
  };
}
