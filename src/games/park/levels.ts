/**
 * The 40 challenges: four zones of ten (SPEC-park.md 3.4). Each challenge is built from a reference solution: a track that finishes, made in
 * code and checked by the physics. The goals are taken from the solution: the stars on its path, obstacles away from it (and in the way of a
 * lazy straight track), the speed gate at the speed it really has, the height of a hill. So every challenge has a solution by construction;
 * scripts/park-sim.ts and the tests check it. Numbers that are counted or taken away follow the child's maths level (`max`).
 * Pure: no DOM.
 */
import { simulate, type Ride } from './coaster/physics';
import { CREST, END, MAX_SLOPE, addLoop, addPart, at, buildPath, cloneTrack, newTrack, type Path, type PartKind, type Pt, type Track } from './coaster/track';
import { noGoals, type Goals, type Obstacle, type ObstacleKind, type PartGoal } from './goals';

export type Bg = 'candy' | 'beach' | 'snow' | 'space';
export interface Zone { id: 1 | 2 | 3 | 4; bg: Bg; icon: string; from: string; to: string; path: string; loops: number; parts: PartKind[]; first: number }
export const ZONES: Zone[] = [
  { id: 1, bg: 'candy', icon: '🍭', from: '#ffd6ec', to: '#ffb3d6', path: '#ff5d8f', loops: 0, parts: [], first: 1 },
  { id: 2, bg: 'beach', icon: '🏖️', from: '#fff1b8', to: '#8fe3f0', path: '#1fa3c4', loops: 1, parts: ['splash'], first: 11 },
  { id: 3, bg: 'snow', icon: '🏔️', from: '#e8f4ff', to: '#b3d4ff', path: '#5a82d6', loops: 1, parts: ['splash', 'chain', 'tunnel'], first: 21 },
  { id: 4, bg: 'space', icon: '🚀', from: '#8f86e8', to: '#3a2f8f', path: '#ffd23f', loops: 2, parts: ['splash', 'chain', 'tunnel'], first: 31 },
];
export const FREE_ALLOW = { loops: 2, parts: ['chain', 'tunnel', 'splash'] as PartKind[] };

interface Spec {
  hills: number;
  stars?: number;
  ob?: ObstacleKind[];
  gate?: 'fast' | 'slow';
  height?: 'peak' | 'lower';
  need?: PartGoal[];
}
const L = (n = 1): PartGoal => ({ kind: 'loop', n });
const P = (kind: PartKind): PartGoal => ({ kind, n: 1 });
const SPECS: Spec[][] = [
  [
    { hills: 1 },
    { hills: 1, stars: 3 },
    { hills: 1, ob: ['rock'], stars: 1 },
    { hills: 2 },
    { hills: 2, stars: 4 },
    { hills: 2, height: 'peak' },
    { hills: 2, ob: ['rock', 'rock'], stars: 2 },
    { hills: 2, gate: 'slow' },
    { hills: 3, ob: ['rock'], height: 'lower' },
    { hills: 3, stars: 5, ob: ['rock', 'rock'], gate: 'fast' },
  ],
  [
    { hills: 2, need: [L()] },
    { hills: 2, stars: 4 },
    { hills: 2, ob: ['palm'], stars: 2 },
    { hills: 2, need: [P('splash')] },
    { hills: 3, stars: 5, ob: ['rock'] },
    { hills: 2, height: 'peak', need: [L()] },
    { hills: 3, ob: ['palm', 'rock'], gate: 'fast' },
    { hills: 2, gate: 'slow', stars: 3, need: [P('splash')] },
    { hills: 3, height: 'lower', ob: ['palm'] },
    { hills: 3, stars: 5, ob: ['palm', 'rock'], need: [L(), P('splash')], gate: 'fast' },
  ],
  [
    { hills: 2, need: [P('chain')] },
    { hills: 2, stars: 4, ob: ['pine'] },
    { hills: 2, need: [P('tunnel')] },
    { hills: 3, ob: ['bridge'], stars: 3 },
    { hills: 2, height: 'peak', need: [P('chain')] },
    { hills: 3, ob: ['pine', 'pine'], gate: 'slow' },
    { hills: 3, stars: 5, need: [P('tunnel')], ob: ['bridge'] },
    { hills: 2, height: 'lower', ob: ['pine'], need: [P('chain')] },
    { hills: 3, gate: 'fast', ob: ['bridge', 'rock'], stars: 3 },
    { hills: 3, stars: 6, ob: ['pine', 'bridge'], need: [P('chain'), P('tunnel')], gate: 'fast' },
  ],
  [
    { hills: 2, need: [L(2)] },
    { hills: 3, stars: 5, need: [L()] },
    { hills: 3, ob: ['rock', 'palm'], need: [L()], gate: 'fast' },
    { hills: 3, need: [L(), P('tunnel')], stars: 3 },
    { hills: 3, height: 'peak', ob: ['pine', 'bridge'] },
    { hills: 3, stars: 6, need: [P('splash'), L()], gate: 'slow' },
    { hills: 3, height: 'lower', need: [L(2)], ob: ['rock'] },
    { hills: 3, ob: ['palm', 'pine', 'rock'], stars: 4, need: [P('chain')] },
    { hills: 3, stars: 6, need: [L(2), P('tunnel')], gate: 'fast' },
    { hills: 3, stars: 6, ob: ['bridge', 'rock', 'pine'], need: [L(2), P('splash'), P('tunnel'), P('chain')], gate: 'fast', height: 'peak' },
  ],
];

export interface Level {
  id: number;
  zone: 1 | 2 | 3 | 4;
  n: number;
  boss: boolean;
  /** 1..3: the first levels show a hand that draws the way */
  tutorial: 0 | 1 | 2 | 3;
  goals: Goals;
  /** the reference solution */
  solution: Track;
  allow: { loops: number; parts: PartKind[] };
}
export const LEVEL_COUNT = 40;
export const zoneOf = (id: number): Zone => ZONES[Math.floor((id - 1) / 10)];

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

const X0 = 8.4;
const XL = 18.2;

/** The route: valleys and hills, between the crest and the station. */
function route(hills: number[], valley: number[]): Track {
  const t = newTrack();
  const N = hills.length;
  const w = (XL - X0) / N;
  for (let i = 0; i <= N; i++) {
    t.pts.push({ x: X0 + i * w, y: valley[i] });
    if (i < N) {
      const lim = Math.min(valley[i], valley[i + 1]) + MAX_SLOPE * (w / 2) * 0.92;
      t.pts.push({ x: X0 + (i + 0.5) * w, y: Math.min(hills[i], lim, 9.4) });
    }
  }
  t.pts.push({ ...END });
  t.complete = true;
  return t;
}

const ground = (o: Obstacle, x: number, y: number): number => Math.hypot(Math.max(o.x0 - x, 0, x - o.x1), Math.max(o.y0 - y, 0, y - o.y1));
const SIZE: Record<ObstacleKind, { w: number; y0: number; y1: number }> = {
  rock: { w: 1.5, y0: 0, y1: 1.3 },
  palm: { w: 1.1, y0: 0, y1: 3.1 },
  pine: { w: 1.4, y0: 0, y1: 3.3 },
  bridge: { w: 3, y0: 2.3, y1: 2.9 },
};

const cache = new Map<string, Level>();

/** The level `id` (1..40) with the numbers that go with the child's maths level `max` (5, 10 or 20). */
export function makeLevel(id: number, max = 10): Level {
  const key = `${id}/${max}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const zone = zoneOf(id);
  const n = ((id - 1) % 10) + 1;
  const spec = SPECS[zone.id - 1][n - 1];
  const rand = rng(zone.id * 1000 + n * 17 + 5);
  const need = spec.need ?? [];
  const wantLoops = need.find((q) => q.kind === 'loop')?.n ?? 0;
  const wantChain = need.some((q) => q.kind === 'chain');
  const N = wantLoops ? Math.min(spec.hills, 2) : spec.hills;
  const cap = Math.min(max, 9);

  // the height asked for (a counting or a taking away), inside the maths level
  let height: Goals['height'] = null;
  let fixedTop = 0;
  if (spec.height) {
    if (spec.height === 'peak') {
      const opts = zone.id === 1 ? [3, 4] : zone.id === 2 ? [3, 4, 5] : zone.id === 3 ? [4, 5, 7] : [2, 3, 5, 7];
      let h = opts[Math.floor(rand() * opts.length)];
      // above the crest only with a chain lift, and only as far as the maths level counts
      if (h > 5 && (!wantChain || cap < 7)) h = Math.min(5, cap);
      h = Math.max(2, Math.min(h, cap));
      height = { kind: 'peak', h, d: 0 };
    } else {
      const d = Math.min(3, 1 + Math.floor(rand() * 3), Math.max(1, cap - 1));
      height = { kind: 'lower', h: CREST.y - d, d };
    }
    fixedTop = height.h;
  }

  // the hills and valleys, made lower until the ride finishes
  const base = [4.6, 3.5, 2.6].map((h) => h + (rand() - 0.5) * 0.5);
  const hills = Array.from({ length: N }, (_, i) => base[i]);
  if (wantChain) hills[0] = 7.2;
  if (height) hills[0] = fixedTop;
  const valley = Array.from({ length: N + 1 }, (_, i) => (i === N ? 1.2 : 0.8));
  let track = newTrack();
  let ride: Ride | null = null;
  let path: Path | null = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    track = route(hills, valley);
    const firstValleyX = X0;
    for (let k = 0; k < wantLoops; k++) addLoop(track, firstValleyX + k * ((XL - X0) / N), 2);
    // the parts: the chain over the first hill, the tunnel over another, the splash in a valley
    const peaksX = Array.from({ length: N }, (_, i) => X0 + (i + 0.5) * ((XL - X0) / N));
    const valleysX = Array.from({ length: N + 1 }, (_, i) => X0 + i * ((XL - X0) / N));
    const tryAdd = (kind: PartKind, xs: number[]): void => {
      for (const x of [...xs, ...[9.5, 11, 12.5, 14, 15.5, 17, 17.5, 18, 18.5]]) if (addPart(track, kind, x)) return;
    };
    for (const q of need) {
      if (q.kind === 'chain') tryAdd('chain', peaksX);
      if (q.kind === 'tunnel') tryAdd('tunnel', peaksX.slice().reverse());
      if (q.kind === 'splash') tryAdd('splash', valleysX.slice(1));
    }
    path = buildPath(track);
    ride = simulate(path);
    if (ride.outcome === 'finished') break;
    for (let i = hills[0] === fixedTop && (height || wantChain) ? 1 : 0; i < N; i++) hills[i] = Math.max(1.4, hills[i] - 0.25);
    if (attempt > 20) for (let i = 0; i < N; i++) valley[i] = Math.max(0.55, valley[i] - 0.02);
  }
  if (!path || !ride) throw new Error(`level ${id}: no route`);

  const goals: Goals = noGoals();
  goals.height = height;
  goals.parts = need.map((q) => ({ ...q }));
  const tunnels = path.tunnels;
  const free = (i: number): boolean => !path!.inLoop[i] && path!.s[i] > path!.crestS + 1 && path!.s[i] < path!.endS - 2.6 && !tunnels.some(([a, b]) => path!.s[i] >= a - 0.4 && path!.s[i] <= b + 0.4);

  // the stars: on the path of the solution, evenly spread
  const k = spec.stars ?? 0;
  if (k) {
    const idx: number[] = [];
    for (let i = 0; i < path.n; i++) if (free(i)) idx.push(i);
    for (let j = 0; j < k; j++) {
      const target = idx[0] + ((j + 0.5) * (idx[idx.length - 1] - idx[0])) / k;
      let best = idx[0];
      for (const i of idx) if (Math.abs(i - target) < Math.abs(best - target)) best = i;
      goals.stars.push({ x: Math.round(path.x[best] * 10) / 10, y: Math.round(path.y[best] * 10) / 10 });
    }
  }

  // the speed gate: where the solution is the fastest (fast) or the slowest (slow), with room for the child's own track
  if (spec.gate) {
    let bestI = -1;
    let bestV = spec.gate === 'fast' ? -1 : Infinity;
    for (let j = 0; j < ride.s.length; j++) {
      const s = ride.s[j];
      const i = Math.round(s / 0.05);
      if (i < 1 || i >= path.n - 1 || !free(i) || path.y[i] < 0.6 || path.x[i] > END.x - 3.2) continue;
      if (spec.gate === 'slow' && (path.y[i] < 2.2)) continue;
      const v = Math.abs(ride.v[j]);
      if (spec.gate === 'fast' ? v > bestV : v < bestV) {
        bestV = v;
        bestI = i;
      }
    }
    if (bestI >= 0) {
      const gx = Math.round(path.x[bestI] * 10) / 10, gy = Math.round(path.y[bestI] * 10) / 10;
      goals.speed = { x: gx, y: gy, mode: spec.gate, limit: Math.round((spec.gate === 'fast' ? bestV * 0.82 : bestV * 1.3 + 0.8) * 10) / 10 };
      goals.stars = goals.stars.filter((st) => Math.hypot(st.x - gx, st.y - gy) > 1.3);
    }
  }

  // the obstacles: away from the solution, in the way of a lazy track (a straight line down, or a flat run on the ground)
  const placed: Obstacle[] = [];
  const blocks = (o: Obstacle): boolean => {
    for (let x = o.x0; x <= o.x1; x += 0.1) {
      const naive = CREST.y - ((CREST.y - END.y) / (END.x - CREST.x)) * (x - CREST.x);
      if (naive >= o.y0 - 0.2 && naive <= o.y1 + 0.2) return true;
      if (x > 10 && o.y0 <= 1.1 && o.y1 >= 1.1) return true;
    }
    return false;
  };
  for (const kind of spec.ob ?? []) {
    const sz = SIZE[kind];
    const xs: number[] = [];
    for (let x = 9.2; x <= END.x - 1.2; x += 0.3) xs.push(x);
    for (let i = xs.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [xs[i], xs[j]] = [xs[j], xs[i]];
    }
    let done = false;
    // big first; when nothing that big fits between the hills, a smaller one (a young palm, a small rock)
    for (const [clear, sc] of [[0.62, 1], [0.55, 0.85], [0.5, 0.7], [0.45, 0.6], [0.4, 0.5]]) {
      for (const cx of xs) {
        const w = sz.w * (kind === 'bridge' ? Math.max(sc, 0.8) : sc);
        const o: Obstacle = { kind, x0: cx - w / 2, x1: cx + w / 2, y0: sz.y0, y1: kind === 'bridge' ? sz.y1 : sz.y1 * sc };
        if (!blocks(o)) continue;
        let ok = true;
        for (let i = 0; i < path.n && ok; i++) if (ground(o, path.x[i], path.y[i]) < clear) ok = false;
        for (const q of placed) if (o.x0 < q.x1 + 0.5 && o.x1 > q.x0 - 0.5) ok = false;
        for (const st of goals.stars) if (ground(o, st.x, st.y) < 0.8) ok = false;
        if (goals.speed && ground(o, goals.speed.x, goals.speed.y) < 1.6) ok = false;
        for (const q of track.parts) if (q.kind !== 'chain' && o.x0 < q.x1 + 0.3 && o.x1 > q.x0 - 0.3) ok = false;
        if (ok) {
          placed.push(o);
          done = true;
          break;
        }
      }
      if (done) break;
    }
  }
  goals.obstacles = placed;

  const level: Level = {
    id,
    zone: zone.id,
    n,
    boss: n === 10,
    tutorial: zone.id === 1 && n <= 3 ? (n as 1 | 2 | 3) : 0,
    goals,
    solution: cloneTrack(track),
    allow: { loops: zone.loops, parts: [...zone.parts] },
  };
  cache.set(key, level);
  return level;
}

export const allLevels = (max = 10): Level[] => Array.from({ length: LEVEL_COUNT }, (_, i) => makeLevel(i + 1, max));
export type { Pt };
export { at };
