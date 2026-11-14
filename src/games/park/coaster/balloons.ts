/**
 * The balloons of the ride (SPEC-park.md 4): floating next to the track, never on it. Pure: places them from the curve with a seed. Every other
 * thing in the scene stays at least 4 units from the middle of the track (the clean corridor), the balloons are the only thing that comes closer.
 */
import { framesOf, poseAt } from './frames';
import { DS, type Curve } from './track';

export interface Balloon { x: number; y: number; z: number; color: string; /** tickets for popping it */ value: number }
export const BALLOON_COLORS = ['#ff5d8f', '#5ad1ff', '#8fe36b', '#b58cff', '#ff9a3c'];
export const GOLD = '#ffd23f';
/** how near to the middle of the track a balloon may float: not so near that it is in the way of the car */
export const BALLOON_MIN = 1.8;
export const BALLOON_MAX = 3.4;

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** About one balloon for every 4 units of track, one in ten of gold. */
export function placeBalloons(c: Curve, seed: number): Balloon[] {
  const f = framesOf(c);
  const rand = rng(seed + 31);
  const out: Balloon[] = [];
  const len = c.length;
  const count = Math.max(6, Math.round(len / 4));
  for (let k = 0; k < count; k++) {
    const s = 6 + ((k + rand() * 0.8) / count) * (len - 12);
    const q = poseAt(c, f, s);
    const side = rand() < 0.5 ? -1 : 1;
    const away = BALLOON_MIN + rand() * (BALLOON_MAX - BALLOON_MIN);
    const lift = 0.5 + rand() * 1.6;
    const gold = k % 10 === 9;
    out.push({
      x: q.p[0] + q.r[0] * side * away + q.u[0] * lift,
      y: q.p[1] + q.r[1] * side * away + q.u[1] * lift + 0.3,
      z: q.p[2] + q.r[2] * side * away + q.u[2] * lift,
      color: gold ? GOLD : BALLOON_COLORS[Math.floor(rand() * BALLOON_COLORS.length)],
      value: gold ? 5 : 1,
    });
  }
  return out;
}

/** The distance from a point to the nearest point of the track. */
export function distToTrack(c: Curve, x: number, y: number, z: number, step = 4): number {
  let m = Infinity;
  for (let i = 0; i < c.n; i += step) m = Math.min(m, Math.hypot(c.X[i] - x, c.Y[i] - y, c.Z[i] - z));
  return m;
}
export { DS };
