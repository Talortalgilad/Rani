/**
 * The ride (SPEC-park.md 3.2): energy along the curve with a little friction. Pure and deterministic: the same track always gives the same ride.
 * Nothing crashes. A hill that is too high slows the car down, stops it, and it rolls back gently into the valley. A loop without enough
 * speed makes the car climb and roll back too.
 */
import { G, type Path, at } from './track';

export const V_CHAIN = 2.6;
export const V_MAX = 13;
const FRICTION = 0.16;
const DT = 1 / 120;
export const MAX_TIME = 80;

export type Outcome = 'finished' | 'stalled' | 'loop' | 'short';
export interface Ride {
  outcome: Outcome;
  /** the ride, every 1/60 s: distance and speed */
  t: Float32Array;
  s: Float32Array;
  v: Float32Array;
  /** where the car turned back (distance), or the end of the track; null when it finished */
  stopS: number | null;
  /** the highest speed, the biggest drop (units), the longest weightless moment (s): for the fun meter later */
  vMax: number;
  /** the car lets the platform brake it (finished): the distance where it stops */
  brakeS: number | null;
}

/** Runs the car on the path from the platform. */
export function simulate(p: Path): Ride {
  const t: number[] = [];
  const sArr: number[] = [];
  const vArr: number[] = [];
  const endOfTrack = p.s[p.n - 1];
  let s = p.startS;
  let v = 0;
  let time = 0;
  let step = 0;
  let outcome: Outcome | null = null;
  let stopS: number | null = null;
  let loopBroke = false;
  let detached = false;
  let vTop = 0;
  let restFor = 0;
  let turnT = -1;
  // the station slows the car down over the last stretch (it ends in the middle of the station, where it started)
  const brake = p.complete && p.endS < Infinity ? p.endS + 2.6 : null;
  while (time < MAX_TIME && outcome === null) {
    const pt = at(p, s);
    if (s < p.crestS) {
      // the chain lift: a steady speed (and from the platform a gentle start)
      v = Math.min(V_CHAIN, v + 3 * DT);
      s += v * DT;
    } else if (v >= 0 && p.chains.some(([c0, c1]) => s >= c0 && s <= c1)) {
      // a chain lift pulls the car up by itself, whatever its speed
      v = Math.max(v, V_CHAIN);
      s += v * DT;
    } else {
      let a = -G * Math.sin(pt.th);
      const fr = FRICTION;
      if (v > 0) a -= fr;
      else if (v < 0) a += fr - (stopS !== null ? 2.2 * v : 0); // rolling back is gentle: the car settles in the valley
      else if (Math.abs(a) <= fr) a = 0;
      else a -= Math.sign(a) * fr;
      const vOld = v;
      v += a * DT;
      // friction does not turn the car around: it stops it
      if (vOld !== 0 && Math.sign(v) !== Math.sign(vOld) && Math.abs(G * Math.sin(pt.th)) <= fr) v = 0;
      if (v > V_MAX) v = V_MAX;
      if (v < -V_MAX) v = -V_MAX;
      // in the loop the car stays on the track only while the track pushes it: v^2 / R + g * (up component of the direction to the centre) >= 0
      if (pt.inLoop && !loopBroke && v > 0) {
        const i = pt.i;
        const dx = p.cx[i] - pt.x, dy = p.cy[i] - pt.y;
        const r = Math.hypot(dx, dy) || 1;
        if ((v * v) / r + (G * dy) / r < 0) {
          loopBroke = true;
          detached = true;
          v = 0;
        }
      }
      s += v * DT;
      // the car turned back
      if (vOld > 0 && v <= 0 && stopS === null && s > p.crestS + 0.2) stopS = s;
    }
    vTop = Math.max(vTop, v);
    if (s >= endOfTrack - 1e-6) {
      s = endOfTrack;
      outcome = p.complete ? 'finished' : 'short';
      break;
    }
    // rolled back to the chain: it is held there by the catch of the lift
    if (s < p.crestS && time > 1 && v < 0) {
      s = p.crestS;
      v = 0;
      outcome = detached ? 'loop' : 'stalled';
      break;
    }
    // at rest in a valley
    if (stopS !== null && turnT < 0) turnT = time;
    if (s >= p.crestS && Math.abs(v) < 0.08 && stopS !== null) {
      restFor += DT;
      if (restFor > 0.4) outcome = detached ? 'loop' : 'stalled';
    } else restFor = 0;
    // a long settling is cut: after seven seconds the car is at rest for the eye
    if (stopS !== null && turnT >= 0 && time - turnT > 7) outcome = detached ? 'loop' : 'stalled';
    if (step % 2 === 0) {
      t.push(time);
      sArr.push(s);
      vArr.push(v);
    }
    step++;
    time += DT;
  }
  if (outcome === null) outcome = detached ? 'loop' : 'stalled';
  // a stop in the middle of the loop is the loop's: not enough speed
  if (outcome === 'stalled' && stopS !== null && at(p, stopS).inLoop) outcome = 'loop';
  t.push(time);
  sArr.push(s);
  vArr.push(v);
  // the end station slows the car down (a short scripted brake, so that it never overshoots)
  if (outcome === 'finished' && brake !== null) {
    const v0 = Math.max(v, 1);
    const L = brake - s;
    const T = (2 * L) / v0;
    const n = Math.ceil(T * 60);
    for (let k = 1; k <= n; k++) {
      const u = (k / n) * T;
      const sk = s + v0 * u - (v0 * u * u) / (2 * T);
      t.push(time + u);
      sArr.push(Math.min(sk, brake));
      vArr.push(Math.max(0, v0 - (v0 * u) / T));
    }
  }
  if (stopS === null && outcome !== 'finished') stopS = s;
  return { outcome, t: Float32Array.from(t), s: Float32Array.from(sArr), v: Float32Array.from(vArr), stopS: outcome === 'finished' ? null : stopS, vMax: vTop, brakeS: outcome === 'finished' ? brake : null };
}

/** The distance and the speed at a time of the ride (clamped at the end). */
export function sample(r: Ride, time: number): { s: number; v: number } {
  const n = r.t.length;
  if (time <= 0) return { s: r.s[0], v: r.v[0] };
  if (time >= r.t[n - 1]) return { s: r.s[n - 1], v: r.v[n - 1] };
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (r.t[mid] <= time) lo = mid;
    else hi = mid;
  }
  const f = (time - r.t[lo]) / (r.t[hi] - r.t[lo] || 1);
  return { s: r.s[lo] + (r.s[hi] - r.s[lo]) * f, v: r.v[lo] + (r.v[hi] - r.v[lo]) * f };
}
export const duration = (r: Ride): number => r.t[r.t.length - 1];
