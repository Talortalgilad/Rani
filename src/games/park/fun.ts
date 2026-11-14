/**
 * The fun meter (SPEC-park.md 3.6): how much fun a ride is. Four things make it: the biggest drop, the time of floating (the car lifts a little
 * over the top of a hill), loops, and the top speed; a tunnel and a splash add a little. Pure.
 */
import { V_MAX, type Ride } from './coaster/physics';
import { G, type Path, type Track } from './coaster/track';

export interface Fun {
  /** the biggest drop (units), the time of floating (s), the loops, the top speed */
  drop: number;
  float: number;
  loops: number;
  speed: number;
  /** each of the four from 0 to 1 */
  bars: { drop: number; float: number; loops: number; speed: number };
  /** 0..100 */
  score: number;
}

export const FUN_DROP = 6;
export const FUN_FLOAT = 1.5;
export const FUN_LOOPS = 2;

export function funOf(track: Track, path: Path, ride: Ride): Fun {
  let hi = -Infinity;
  let drop = 0;
  let float = 0;
  let prevT = 0;
  const n = ride.s.length;
  for (let k = 0; k < n; k++) {
    const s = ride.s[k];
    const i = Math.min(path.n - 2, Math.max(1, Math.round(s / 0.05)));
    const y = path.y[i];
    hi = Math.max(hi, y);
    if (s > path.crestS) drop = Math.max(drop, hi - y);
    const dt = k ? ride.t[k] - prevT : 0;
    prevT = ride.t[k];
    // floating: the track bends down over a hill so fast that the car wants to leave it (the seat lifts)
    if (!path.inLoop[i] && s > path.crestS && ride.v[k] > 1) {
      const ds = path.s[i + 1] - path.s[i - 1];
      const kappa = (path.th[i + 1] - path.th[i - 1]) / ds; // < 0 over a hill
      if (kappa < 0 && ride.v[k] * ride.v[k] * -kappa > G * Math.cos(path.th[i]) * 0.55) float += dt;
    }
  }
  const finished = ride.outcome === 'finished';
  const loops = finished ? path.loops.length : 0;
  const speed = ride.vMax;
  const bars = {
    drop: Math.min(1, drop / FUN_DROP),
    float: Math.min(1, float / FUN_FLOAT),
    loops: Math.min(1, loops / FUN_LOOPS),
    speed: Math.min(1, speed / V_MAX),
  };
  const extra = finished ? 5 * Math.min(1, track.parts.filter((p) => p.kind === 'tunnel').length) + 5 * Math.min(1, track.parts.filter((p) => p.kind === 'splash').length) : 0;
  const score = Math.min(100, Math.round(30 * bars.drop + 25 * bars.float + 25 * bars.loops + 20 * bars.speed + extra));
  return { drop, float, loops, speed, bars, score };
}

/** The stars of the fun: 1 for a ride that is done, 2 and 3 for the fun targets of the level. */
export function starsFor(score: number, targets: [number, number] | undefined): 1 | 2 | 3 {
  if (!targets) return 1;
  return score >= targets[1] ? 3 : score >= targets[0] ? 2 : 1;
}
