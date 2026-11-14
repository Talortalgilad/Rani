/**
 * Help when the car does not get to the end (SPEC-park.md 3.3): where it stopped, what to say, and "fix it for me" which lowers the problem
 * by exactly what it needs. Pure.
 */
import { CREST, END, LOOP_R, MAX_SLOPE, MAX_Y, MIN_Y, buildPath, at, finish, reach, type Path, type Pt, type Track } from './track';
import type { Ride } from './physics';

export type HintKind = 'high' | 'first' | 'loop' | 'short';
export interface Diagnosis {
  kind: HintKind;
  /** the point where the car stopped (or where the track ends) */
  x: number;
  y: number;
  /** the place to mark: the top of the hill that is too high (the stop for the loop, the end of the track when it is short) */
  mx: number;
  my: number;
  /** the highest the car could get at that point: the dashed line */
  capY: number;
  /** the control point at the top of the hill that is too high (for high and first) */
  peak: number | null;
  /** the loop that the car could not do (an index in the loops of the track) */
  loop: number | null;
}

/** What went wrong with a ride that did not finish (null when it finished). */
export function diagnose(t: Track, path: Path, ride: Ride): Diagnosis | null {
  if (ride.outcome === 'finished') return null;
  const stopS = ride.stopS ?? ride.s[ride.s.length - 1];
  const stop = at(path, stopS);
  if (ride.outcome === 'short') {
    const last = t.pts[t.pts.length - 1];
    return { kind: 'short', x: last.x, y: last.y, mx: last.x, my: last.y, capY: last.y, peak: null, loop: null };
  }
  if (ride.outcome === 'loop') {
    let loop = path.loops.findIndex(([a, b]) => stopS >= a - 0.5 && stopS <= b + 0.5);
    if (loop < 0) loop = Math.max(0, path.loops.findIndex(([a]) => a > stopS) - 1);
    return { kind: 'loop', x: stop.x, y: stop.y, mx: stop.x, my: stop.y, capY: stop.y, peak: null, loop };
  }
  // the hill that the car could not climb: the next top ahead of the stop
  let k = path.ctrlS.findIndex((s) => s > stopS - 0.05);
  if (k < 0) k = t.pts.length - 1;
  while (k + 1 < t.pts.length && t.pts[k + 1].y >= t.pts[k].y) k++;
  const peak = k;
  // "the first hill must be the highest" only when the car already stops on the second hill (the first one that was drawn) and it is higher than the first
  // hill (the crest of the lift); on any other hill the hint is just "this hill is too high"
  let hills = 0;
  for (let i = 1; i <= peak; i++) if (t.pts[i].y >= t.pts[i - 1].y && (i + 1 >= t.pts.length || t.pts[i + 1].y < t.pts[i].y)) hills++;
  const second = hills <= 1;
  const top = t.pts[peak];
  return { kind: second && top.y > CREST.y + 0.05 ? 'first' : 'high', x: stop.x, y: stop.y, mx: top.x, my: top.y, capY: stop.y, peak, loop: null };
}

/** Slopes that are too steep after a change are brought back, from the left to the right (the end station stays). */
function relax(t: Track): void {
  for (let i = 1; i < t.pts.length; i++) {
    if (t.complete && i === t.pts.length - 1) break;
    const r = reach(t.pts[i - 1], t.pts[i].x);
    t.pts[i].y = Math.min(r.hi, Math.max(r.lo, t.pts[i].y));
  }
}

/** Scales a hill down so that its top is at `top`: from the valley on its left to its peak. */
function lowerHill(t: Track, peak: number, top: number): void {
  let v = peak;
  while (v - 1 > 0 && t.pts[v - 1].y <= t.pts[v].y) v--;
  const vy = t.pts[v].y;
  const py = t.pts[peak].y;
  const k = py > vy + 0.05 ? (Math.max(top, vy) - vy) / (py - vy) : 0;
  for (let i = v + 1; i <= peak; i++) t.pts[i].y = vy + (t.pts[i].y - vy) * k;
}

/** "Fix it for me": changes the track by what the problem needs. Returns false when there is nothing it can do. */
export function fix(t: Track, d: Diagnosis): boolean {
  if (d.kind === 'high' || d.kind === 'first') {
    if (d.peak === null || d.peak < 1) return false;
    const top = Math.max(MIN_Y + 0.3, Math.min(d.capY - 0.6, CREST.y - 0.2));
    lowerHill(t, d.peak, top);
    relax(t);
    return true;
  }
  if (d.kind === 'loop') {
    const a = t.loops[d.loop ?? 0];
    if (a === undefined) return false;
    // a deeper drop before the loop: the speed at the bottom grows with the height that it fell
    const target = Math.max(MIN_Y + 0.1, Math.min(t.pts[a].y - 0.8, CREST.y - 5.2 + LOOP_R * 0.1));
    if (t.pts[a].y <= MIN_Y + 0.15) return false;
    const drop = t.pts[a].y - target;
    // the points before the loop go down with it, so that the way in stays smooth
    for (let i = Math.max(1, a - 2); i <= a; i++) t.pts[i].y = Math.max(MIN_Y, t.pts[i].y - drop * (i === a ? 1 : 0.7));
    relax(t);
    const next = t.pts[a + 1];
    if (next) {
      const r = reach(t.pts[a], next.x);
      next.y = Math.min(r.hi, Math.max(r.lo, next.y));
    }
    return true;
  }
  // short: a gentle way down to the station
  const last = t.pts[t.pts.length - 1];
  if (last.x >= END.x - 0.2) return finish(t);
  const stepX = 1.8;
  let prev: Pt = last;
  while (prev.x + stepX < END.x - 0.8) {
    const f = (prev.x + stepX - last.x) / (END.x - last.x);
    const y = Math.min(MAX_Y, Math.max(MIN_Y, last.y + (END.y - last.y) * f));
    const r = reach(prev, prev.x + stepX);
    const p = { x: prev.x + stepX, y: Math.min(r.hi, Math.max(r.lo, y)) };
    t.pts.push(p);
    prev = p;
  }
  return finish(t);
}

/** After a fix the track is built again (for the caller). */
export const rebuild = (t: Track): Path => buildPath(t);
export { MAX_SLOPE };
