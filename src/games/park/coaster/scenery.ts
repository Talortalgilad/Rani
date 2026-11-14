/**
 * The 3D curve of the track and what stands round it (SPEC-park.md 3.5). Pure geometry (Three.js vectors, no WebGL): the ride and the tests share it.
 * A clean corridor of CORRIDOR units is kept round the track: no tree, post or flag comes into it, so that nothing gets into the camera.
 */
import * as T from '../../../lobby3d/lib';
import type { Path } from './track';

export const CORRIDOR = 4;
/** the two lanes of a loop are this far apart sideways (the track goes through the loop like a corkscrew, so that it does not cross itself) */
export const LOOP_LANE = 5.5;
export const STRIDE = 3;

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The sideways bend of the track at distance s: gentle, zero on the lift and at the station, and the corkscrew of the loop. */
export function sway(path: Path, s: number, seed: number): number {
  const a = ((seed * 9301 + 49297) % 233280) / 233280;
  const b = ((seed * 7919 + 1013) % 4096) / 4096;
  let mask = smooth(path.crestS + 1, path.crestS + 6, s);
  if (path.loopS) mask *= 1 - smooth(path.loopS[0] - 5, path.loopS[0] - 1, s) * (1 - smooth(path.loopS[1] + 4, path.loopS[1] + 8, s));
  if (path.endS < Infinity) mask *= 1 - smooth(path.endS - 7, path.endS - 1, s);
  let z = mask * (2.6 * Math.sin(s * 0.13 + a * 6.28) + 3.4 * Math.sin(s * 0.047 + b * 6.28));
  if (path.loopS) {
    // the way in goes to one side, through the loop to the other, and out to the middle again
    const [l0, l1] = path.loopS;
    if (s < l0) z -= (LOOP_LANE / 2) * smooth(l0 - 5, l0, s);
    else if (s <= l1) z += LOOP_LANE * ((s - l0) / (l1 - l0) - 0.5);
    else z += (LOOP_LANE / 2) * (1 - smooth(l1 + 3, l1 + 10, s)); // it stays on its side until the loop is behind (the loop hangs over the first units of the way out)
  }
  return z;
}

export interface Curve3D {
  P: T.Vector3[];
  Tg: T.Vector3[];
  Up: T.Vector3[];
  Rt: T.Vector3[];
  n: number;
}

/** The points of the side view, bent sideways, with their frames: the direction, "up" (it turns upside down in the loop and comes back) and the right. */
export function buildCurve(path: Path, seed: number, calm: boolean): Curve3D {
  const n = Math.floor((path.n - 1) / STRIDE) + 1;
  const P: T.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const k = Math.min(path.n - 1, i * STRIDE);
    P.push(new T.Vector3(path.x[k], path.y[k], sway(path, path.s[k], seed)));
  }
  const Tg: T.Vector3[] = [], Up: T.Vector3[] = [], Rt: T.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const t = P[Math.min(n - 1, i + 1)].clone().sub(P[Math.max(0, i - 1)]).normalize();
    // "up" is the normal of the side view (the direction of travel turned a quarter to the left in the plane of the loop): it is world up on the flat,
    // upside down at the top of the loop, and it comes back by itself (no roll builds up through the loop)
    const plane = new T.Vector3(-t.y, t.x, 0);
    if (plane.lengthSq() < 1e-6) plane.set(0, 1, 0);
    const up = plane.sub(t.clone().multiplyScalar(plane.dot(t))).normalize();
    Tg.push(t);
    Up.push(up);
  }
  const lean = new Float32Array(n);
  for (let i = 2; i < n - 2; i++) {
    const acc = (P[i + 2].z - 2 * P[i].z + P[i - 2].z) / 0.9;
    lean[i] = Math.max(-0.5, Math.min(0.5, -acc * 0.35));
  }
  for (let i = 0; i < n; i++) {
    const q = new T.Quaternion().setFromAxisAngle(Tg[i], calm ? 0 : lean[i]);
    Up[i] = Up[i].clone().applyQuaternion(q);
    Rt.push(Tg[i].clone().cross(Up[i]).normalize());
  }
  return { P, Tg, Up, Rt, n };
}

export interface Obj { x: number; y: number; z: number; /** the radius of what it takes up */ r: number; h: number; c: string; /** the distance along the track of the point it stands under (pillars) */ s?: number }
export interface Scenery { trees: Obj[]; posts: Obj[]; pillars: Obj[] }
const PALETTE = ['#ff5d8f', '#ffb84d', '#7ad7ff', '#b58cff', '#8fe36b'];

/** The distance in the ground plane from (x, z) to the nearest point of the track. */
export function groundDistance(c: Curve3D, x: number, z: number): number {
  let d = Infinity;
  for (const p of c.P) d = Math.min(d, Math.hypot(p.x - x, p.z - z));
  return d;
}

/** Trees along both sides, posts with flags, the pillars under the track: the trees and the posts only outside the corridor. */
export function placeScenery(path: Path, c: Curve3D, seed: number, tier: 'high' | 'medium'): Scenery {
  let a = seed + 17;
  const rnd = (): number => (a = (a * 1664525 + 1013904223) >>> 0) / 4294967296;
  const { P, n } = c;
  const zAt = (x: number): number => P[Math.min(n - 1, Math.max(0, Math.round((x - P[0].x) / ((P[n - 1].x - P[0].x) / (n - 1)))))].z;
  const trees: Obj[] = [];
  const count = tier === 'high' ? 90 : 48;
  const x0 = P[0].x + 2, x1 = P[n - 1].x + 4;
  for (let i = 0; i < count; i++) {
    const x = x0 + ((i + rnd() * 0.8) / count) * (x1 - x0);
    const side = i % 2 ? 1 : -1;
    const r = 0.8 + rnd() * 0.7;
    let z = zAt(x) + side * (CORRIDOR + r + 0.5 + rnd() * 9);
    // pushed out until the whole tree is outside the corridor
    for (let k = 0; k < 20 && groundDistance(c, x, z) < CORRIDOR + r; k++) z += side * 0.7;
    const h = 1.4 + rnd() * 2.2;
    trees.push({ x, y: h + r * 0.35, z, r, h, c: PALETTE[i % PALETTE.length] });
  }
  const posts: Obj[] = [];
  for (let i = 3; i < n - 3; i += 22) {
    const k = Math.min(path.n - 1, i * STRIDE);
    if (path.inLoop[k] || P[i].y < 0.2) continue;
    for (const side of [-1, 1]) {
      const x = P[i].x;
      let z = P[i].z + side * (CORRIDOR + 0.6);
      for (let q = 0; q < 20 && groundDistance(c, x, z) < CORRIDOR + 0.5; q++) z += side * 0.5;
      posts.push({ x, y: 0, z, r: 0.5, h: 1.6 + (i % 3) * 0.3, c: PALETTE[(i + (side > 0 ? 2 : 0)) % PALETTE.length] });
    }
  }
  // the pillars: straight down from the track, not under the loop and not where they would pass through another part of the track
  const pillars: Obj[] = [];
  let lastX = -9;
  for (let i = 0; i < n; i += 4) {
    const k = Math.min(path.n - 1, i * STRIDE);
    if (path.inLoop[k] || P[i].x - lastX < 1.8 || P[i].y < 0.6) continue;
    const near = path.loopS ? k * 0.05 > path.loopS[0] - 2.5 && k * 0.05 < path.loopS[1] + 2.5 : false;
    if (near) continue;
    lastX = P[i].x;
    pillars.push({ x: P[i].x, y: P[i].y - 0.1, z: P[i].z, r: 0.09, h: P[i].y - 0.1, c: '', s: path.s[k] });
  }
  return { trees, posts, pillars };
}
