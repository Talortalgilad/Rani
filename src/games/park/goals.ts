/**
 * The goals of a challenge (SPEC-park.md 3.4), and the check of a ride against them. Pure: no DOM.
 * Reach the end (always), collect stars (the track goes through them), go round obstacles (the track does not touch them), a speed gate
 * (the car goes through the ring fast or slowly), the height of a hill (counting, taking away) and a part that has to be on the track.
 */
import type { Ride } from './coaster/physics';
import { CREST, END, type Path, type PartKind, type Track } from './coaster/track';

export type ObstacleKind = 'rock' | 'palm' | 'pine' | 'bridge';
export interface Obstacle { kind: ObstacleKind; x0: number; x1: number; y0: number; y1: number }
export interface StarGoal { x: number; y: number }
export interface SpeedGoal { x: number; y: number; mode: 'fast' | 'slow'; limit: number }
/** A hill with a given top: "N high" (peak) or "d lower than the crest" (lower: the answer is the same, the words are not) */
export interface HeightGoal { kind: 'peak' | 'lower'; h: number; d: number }
export interface PartGoal { kind: 'loop' | PartKind; n: number }
export interface Goals {
  stars: StarGoal[];
  obstacles: Obstacle[];
  speed: SpeedGoal | null;
  height: HeightGoal | null;
  parts: PartGoal[];
}
export const noGoals = (): Goals => ({ stars: [], obstacles: [], speed: null, height: null, parts: [] });

export const STAR_REACH = 0.7;
export const PEAK_TOL = 0.5;
const OB_MARGIN = 0.1;
export const GATE_RY = 1.15;
export const GATE_RX = 0.55;

/** The tops of the hills of the track after the crest (not in a loop, not the station): the heights. */
export function peaks(path: Path): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const K = 24;
  for (let i = K; i < path.n - K; i++) {
    if (path.s[i] < path.crestS + 0.5 || path.x[i] > END.x - 0.3 || path.inLoop[i]) continue;
    let top = true;
    let lo = path.y[i];
    for (let k = -K; k <= K; k++) {
      if (path.inLoop[i + k]) continue; // the circle of a loop is not a hill
      if (path.y[i + k] > path.y[i] + 1e-9 || (k < 0 && path.y[i + k] === path.y[i])) top = false;
      lo = Math.min(lo, path.y[i + k]);
    }
    if (top && path.y[i] - lo > 0.2) out.push({ x: path.x[i], y: path.y[i] });
  }
  return out;
}

/** 1 where a point of the track is inside an obstacle (the track is painted red there). */
export function hitMask(goals: Goals, path: Path): Uint8Array {
  const m = new Uint8Array(path.n);
  if (!goals.obstacles.length) return m;
  for (let i = 0; i < path.n; i++) {
    for (const o of goals.obstacles) {
      if (path.x[i] >= o.x0 - OB_MARGIN && path.x[i] <= o.x1 + OB_MARGIN && path.y[i] >= o.y0 - OB_MARGIN && path.y[i] <= o.y1 + OB_MARGIN) {
        m[i] = 1;
        break;
      }
    }
  }
  return m;
}

export function obstacleHit(goals: Goals, path: Path): number {
  let k = 0;
  const m = hitMask(goals, path);
  for (let i = 0; i < m.length; i++) k += m[i];
  return k;
}

/** The furthest distance the car got to. */
const travelled = (ride: Ride): number => ride.s[ride.s.length - 1];

/** Which stars the car went through (the track passes within STAR_REACH of the star, in the part of the track that the car did). */
export function starsGot(goals: Goals, path: Path, ride: Ride | null): boolean[] {
  const lim = ride ? travelled(ride) : Infinity;
  return goals.stars.map((st) => {
    for (let i = 0; i < path.n && path.s[i] <= lim; i++) if (Math.hypot(path.x[i] - st.x, path.y[i] - st.y) <= STAR_REACH) return true;
    return false;
  });
}

/** The speed of the car where it goes through the gate: the first moment the car is near the gate, or null when the track misses it. */
export function gateSpeed(goal: SpeedGoal, path: Path, ride: Ride): number | null {
  let best = Infinity;
  let sBest = -1;
  for (let i = 0; i < path.n; i++) {
    if (path.s[i] > travelled(ride)) break;
    const dx = (path.x[i] - goal.x) / GATE_RX, dy = (path.y[i] - goal.y) / GATE_RY;
    const d = Math.hypot(dx * 0.55, dy);
    if (d < best) {
      best = d;
      sBest = path.s[i];
    }
  }
  if (best > 1) return null;
  // the speed of the ride at that distance
  const n = ride.s.length;
  let lo = 0, hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (ride.s[mid] <= sBest) lo = mid;
    else hi = mid;
  }
  return Math.abs(ride.v[lo]);
}

export type Fail =
  | { kind: 'stars'; got: number; need: number }
  | { kind: 'obstacle' }
  | { kind: 'gate'; why: 'miss' | 'slow' | 'fast' }
  | { kind: 'height' }
  | { kind: 'part'; part: 'loop' | PartKind };
export interface Evaluation { ok: boolean; fails: Fail[]; stars: boolean[] }

/** A finished ride against the goals: all of them have to be done. */
export function evaluate(goals: Goals, track: Track, path: Path, ride: Ride): Evaluation {
  const fails: Fail[] = [];
  const stars = starsGot(goals, path, ride);
  const got = stars.filter(Boolean).length;
  if (got < goals.stars.length) fails.push({ kind: 'stars', got, need: goals.stars.length });
  if (obstacleHit(goals, path) > 0) fails.push({ kind: 'obstacle' });
  if (goals.speed) {
    const v = gateSpeed(goals.speed, path, ride);
    if (v === null) fails.push({ kind: 'gate', why: 'miss' });
    else if (goals.speed.mode === 'fast' && v < goals.speed.limit) fails.push({ kind: 'gate', why: 'slow' });
    else if (goals.speed.mode === 'slow' && v > goals.speed.limit) fails.push({ kind: 'gate', why: 'fast' });
  }
  if (goals.height && !peaks(path).some((p) => Math.abs(p.y - goals.height!.h) <= PEAK_TOL)) fails.push({ kind: 'height' });
  for (const pg of goals.parts) {
    const have = pg.kind === 'loop' ? track.loops.length : track.parts.filter((p) => p.kind === pg.kind).length;
    if (have < pg.n) fails.push({ kind: 'part', part: pg.kind });
  }
  return { ok: fails.length === 0, fails, stars };
}

export const CREST_Y = CREST.y;
