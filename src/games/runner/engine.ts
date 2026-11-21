/**
 * The chase of the balloons: the rules, with no screen. A run is built once (the road: obstacles, stars, gates, the finish line), then `step(run, dt)` moves it.
 * Nothing here can take anything from Rani: a hit only slows her, a wrong gate only gives no bonus, and every run reaches the finish line.
 */
import type { Question } from '../../math/generator';
import type { Tuning } from './tuning';

export type Rng = () => number;
export const LANES = [-1, 0, 1] as const;
/** how far ahead things are drawn and prepared (units) */
export const VIEW = 46;
/** a low obstacle is this high; a jump must be above CLEAR to pass it */
export const LOW_H = 0.55;
export const CLEAR = 0.45;
/** seconds (at the clear speed) of the slowing zone in front of a gate, and of the road without obstacles before it */
export const SLOW_T = 1.6;
export const CLEAR_T = 3;
const HIT_SLOW = 0.45;
const HIT_TIME = 1.0;
const SQUISH_TIME = 0.45;
const BOOST_TIME = 2;
const BOOST = 1.6;
const POWER_TIME = 8;
/** correct gates that are enough to catch Shovi */
export const NEEDED = 3;

export type Kind = 'low' | 'high';
export interface Obstacle { z: number; lane: number; kind: Kind; done: boolean }
export interface Star { z: number; lane: number; air: boolean; got: boolean }
export interface Gate {
  z: number;
  /** the number on each lane (null: a closed sign, no answer there) */
  nums: (number | null)[];
  correct: number;
  prepared: boolean;
  /** the correct lane shines from far (two mistakes on this exercise) */
  help: boolean;
  resolved: boolean;
  /** which lane she went through, and the seconds that the right sign stays lit after a mistake */
  choice: number;
  reveal: number;
  ok: boolean;
}
export interface Exercise { q: Question; attempts: number }
export type RunEvent =
  | { t: 'jump' } | { t: 'land' } | { t: 'lane' } | { t: 'star' } | { t: 'hit'; shielded: boolean }
  | { t: 'gate'; ok: boolean; bonus: 'magnet' | 'shield' | null } | { t: 'finish'; caught: boolean };

export interface RunOpts {
  tuning: Tuning;
  rng: Rng;
  /** a new exercise from the adaptive engine (the same level as the gate of the lobby) */
  next(): Question;
  /** an exercise was solved (or the run ended with it unsolved: attempts then counts the mistakes + 1): the answer goes back to the engine of the gate */
  solved(q: Question, attempts: number): void;
}

export interface Run {
  o: RunOpts;
  tune: Tuning;
  t: number;
  z: number;
  /** where the lane is now (-1..1, between lanes while moving) and the lane that she goes to */
  x: number;
  target: number;
  /** the height above the ground, the time in the jump (-1: on the ground), and a jump asked a moment too early */
  h: number;
  jt: number;
  jumpBuffer: number;
  slowT: number;
  squishT: number;
  boostT: number;
  magnetT: number;
  shieldT: number;
  speedNow: number;
  stars: number;
  hits: number;
  correct: number;
  wrong: number;
  gatesDone: number;
  obstacles: Obstacle[];
  starsList: Star[];
  gates: Gate[];
  finishZ: number;
  /** 'run' until the line, then 'finish' while she celebrates, then 'done' */
  phase: 'run' | 'finish' | 'done';
  finishT: number;
  caught: boolean;
  ex: Exercise | null;
  /** events of this step (the screen reads them for sounds and effects, then clears) */
  events: RunEvent[];
  /** the nearest gate that is not yet crossed */
  nextGate: Gate | null;
}

const pick = <T>(rng: Rng, a: T[]): T => a[Math.floor(rng() * a.length)];

/** the number of gates of a run: 4 for a gap of 13 s or more, else 5 */
export const gateCount = (gap: number): number => (gap >= 13 ? 4 : 5);

interface Row { z: number; blocks: { lane: number; kind: Kind }[] }

/** does a row leave a way through, from the free lanes of the row before? (only a high obstacle closes a lane) */
function connected(prev: number[], row: Row): boolean {
  const free = [-1, 0, 1].filter((l) => !row.blocks.some((b) => b.lane === l && b.kind === 'high'));
  return free.length > 0 && prev.some((a) => free.some((b) => Math.abs(a - b) <= 1));
}

export function createRun(o: RunOpts): Run {
  // the panel moves these live (the gap between the gates is read here, once)
  const tune = o.tuning;
  const v = tune.speed;
  const n = gateCount(tune.gateGap);
  const gates: Gate[] = [];
  for (let k = 0; k < n; k++) gates.push({ z: v * tune.gateGap * (k + 0.8), nums: [null, null, null], correct: 1, prepared: false, help: false, resolved: false, choice: 1, reveal: 0, ok: false });
  const finishZ = gates[n - 1].z + v * 2.5;
  const obstacles: Obstacle[] = [];
  const starsList: Star[] = [];
  // the road between the gates: rows of obstacles, never all three lanes, always a way through; none for 3 s in front of a gate
  let prevFree = [-1, 0, 1];
  let z = v * 3.2;
  let sinceStars = 0;
  while (z < finishZ - v * 1.5) {
    const gate = gates.find((g) => z > g.z - v * CLEAR_T && z < g.z + v * 1);
    if (gate) {
      z = gate.z + v * 1;
      prevFree = [-1, 0, 1]; // after a gate she can be on any lane
      continue;
    }
    const r = o.rng();
    let row: Row = { z, blocks: [] };
    for (let tries = 0; tries < 8; tries++) {
      row = { z, blocks: [] };
      const lanes = [-1, 0, 1].sort(() => o.rng() - 0.5);
      if (r < 0.55) row.blocks.push({ lane: lanes[0], kind: 'low' });
      else if (r < 0.75) row.blocks.push({ lane: lanes[0], kind: 'high' });
      else if (r < 0.9) {
        row.blocks.push({ lane: lanes[0], kind: pick(o.rng, ['low', 'high'] as Kind[]) });
        row.blocks.push({ lane: lanes[1], kind: pick(o.rng, ['low', 'high'] as Kind[]) });
      }
      if (connected(prevFree, row)) break;
      row = { z, blocks: [] };
    }
    for (const b of row.blocks) {
      obstacles.push({ z, lane: b.lane, kind: b.kind, done: false });
      // an arc of stars over a low obstacle
      if (b.kind === 'low' && o.rng() < 0.6) for (let i = -1; i <= 1; i++) starsList.push({ z: z + i * 0.9, lane: b.lane, air: true, got: false });
    }
    prevFree = [-1, 0, 1].filter((l) => !row.blocks.some((b) => b.lane === l && b.kind === 'high'));
    sinceStars++;
    if (sinceStars >= 3 && o.rng() < 0.5) {
      // a line of stars on the ground in a free lane
      const free = [-1, 0, 1].filter((l) => !row.blocks.some((b) => b.lane === l));
      if (free.length) {
        const lane = pick(o.rng, free);
        for (let i = 0; i < 5; i++) starsList.push({ z: z + 2 + i * 1.1, lane, air: false, got: false });
        sinceStars = 0;
      }
    }
    z += v * (1.3 + o.rng() * 0.9);
  }
  obstacles.sort((a, b) => a.z - b.z);
  starsList.sort((a, b) => a.z - b.z);
  return {
    o, tune, t: 0, z: 0, x: 0, target: 0, h: 0, jt: -1, jumpBuffer: 0, slowT: 0, squishT: 0, boostT: 0, magnetT: 0, shieldT: 0, speedNow: 0,
    stars: 0, hits: 0, correct: 0, wrong: 0, gatesDone: 0, obstacles, starsList, gates, finishZ, phase: 'run', finishT: 0, caught: false, ex: null, events: [], nextGate: gates[0],
  };
}

export function move(r: Run, dir: -1 | 1): void {
  if (r.phase !== 'run') return;
  const t = Math.max(-1, Math.min(1, r.target + dir));
  if (t !== r.target) {
    r.target = t;
    r.events.push({ t: 'lane' });
  }
}

export function jump(r: Run): void {
  if (r.phase !== 'run') return;
  if (r.jt < 0) {
    r.jt = 0;
    r.events.push({ t: 'jump' });
  } else r.jumpBuffer = 0.12;
}

/** the numbers on the three lanes: the answer and its close wrong answers in a new order (two choices: the third lane is closed) */
function prepare(r: Run, g: Gate): void {
  g.prepared = true;
  if (!r.ex) r.ex = { q: r.o.next(), attempts: 0 };
  const q = r.ex.q;
  const nums: (number | null)[] = [...q.choices.slice(0, 3)];
  while (nums.length < 3) nums.push(null);
  // a new order each time (the same exercise comes back after a mistake, but not on the same lane)
  for (let i = 2; i > 0; i--) {
    const j = Math.floor(r.o.rng() * (i + 1));
    [nums[i], nums[j]] = [nums[j], nums[i]];
  }
  g.nums = nums;
  g.correct = nums.indexOf(q.answer);
  g.help = r.ex.attempts >= 2;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export function step(r: Run, dt: number): void {
  if (r.phase === 'done') return;
  r.t += dt;
  const T = r.tune;
  // the lane: a steady slide to the target
  const dx = r.target - r.x;
  const stepX = dt / T.laneTime;
  r.x = Math.abs(dx) <= stepX ? r.target : r.x + Math.sign(dx) * stepX;
  // the jump: a parabola
  if (r.jt >= 0) {
    r.jt += dt;
    const u = r.jt / T.jumpTime;
    if (u >= 1) {
      r.jt = -1;
      r.h = 0;
      r.events.push({ t: 'land' });
      if (r.jumpBuffer > 0) {
        r.jumpBuffer = 0;
        jump(r);
      }
    } else r.h = T.jumpHeight * 4 * u * (1 - u);
  }
  r.jumpBuffer = Math.max(0, r.jumpBuffer - dt);
  r.slowT = Math.max(0, r.slowT - dt);
  r.squishT = Math.max(0, r.squishT - dt);
  r.boostT = Math.max(0, r.boostT - dt);
  r.magnetT = Math.max(0, r.magnetT - dt);
  r.shieldT = Math.max(0, r.shieldT - dt);

  // the speed: slower in front of a gate, after a hit; faster after a right gate
  const g = r.nextGate;
  let f = 1;
  if (r.phase === 'run' && g) {
    const zone = T.speed * SLOW_T;
    const into = (r.z - (g.z - zone)) / zone;
    if (into > 0 && into < 1.15) f = lerp(1, T.gateSlow, Math.min(1, into * 2));
  }
  if (r.slowT > 0) f *= HIT_SLOW;
  if (r.boostT > 0) f *= BOOST;
  if (r.phase === 'finish') f = Math.max(0, 1 - r.finishT / 2.6) * 0.8;
  r.speedNow = T.speed * f;
  r.z += r.speedNow * dt;

  if (r.phase === 'finish') {
    r.finishT += dt;
    if (r.finishT >= 3.6) r.phase = 'done';
    return;
  }

  // a gate comes into view: its numbers are set
  if (g && !g.prepared && g.z - r.z < VIEW) prepare(r, g);
  if (g && g.prepared && !g.resolved && r.z >= g.z) cross(r, g);
  if (g) g.reveal = Math.max(0, g.reveal - dt);
  for (const gg of r.gates) if (gg.resolved) gg.reveal = Math.max(0, gg.reveal - dt);

  // obstacles and stars at her feet
  const lane = Math.round(r.x);
  for (const ob of r.obstacles) {
    if (ob.z > r.z + 1) break;
    if (ob.done || ob.z < r.z - 0.35) continue;
    if (Math.abs(ob.lane - r.x) < 0.55 && Math.abs(ob.z - r.z) < 0.35) {
      if (ob.kind === 'low' && r.h > CLEAR) continue;
      ob.done = true;
      if (r.shieldT > 0) {
        r.shieldT = 0;
        r.events.push({ t: 'hit', shielded: true });
      } else {
        r.hits++;
        r.squishT = SQUISH_TIME;
        r.slowT = HIT_TIME;
        r.z -= 1.0;
        r.events.push({ t: 'hit', shielded: false });
      }
    }
  }
  for (const s of r.starsList) {
    if (s.z > r.z + 3) break;
    if (s.got || s.z < r.z - 0.6) continue;
    const near = Math.abs(s.z - r.z) < 0.5 && Math.abs(s.lane - r.x) < 0.6 && (s.air ? r.h > 0.3 : r.h < 0.7);
    const pulled = r.magnetT > 0 && Math.abs(s.z - r.z) < 2.2 && Math.abs(s.lane - lane) <= 1;
    if (near || pulled) {
      s.got = true;
      r.stars++;
      r.events.push({ t: 'star' });
    }
  }
  if (r.z >= r.finishZ) {
    r.phase = 'finish';
    r.finishT = 0;
    r.caught = r.correct >= NEEDED;
    // an exercise that was never solved still tells the engine what happened
    if (r.ex) {
      r.o.solved(r.ex.q, Math.max(2, r.ex.attempts + 1));
      r.ex = null;
    }
    r.events.push({ t: 'finish', caught: r.caught });
  }
}

function cross(r: Run, g: Gate): void {
  g.resolved = true;
  r.gatesDone++;
  g.choice = Math.max(-1, Math.min(1, Math.round(r.x))) + 1;
  g.ok = g.choice === g.correct;
  const ex = r.ex!;
  let bonus: 'magnet' | 'shield' | null = null;
  if (g.ok) {
    r.correct++;
    ex.attempts++;
    r.o.solved(ex.q, ex.attempts);
    r.ex = null;
    r.boostT = BOOST_TIME;
    if (r.o.rng() < 0.4) {
      bonus = r.o.rng() < 0.5 ? 'magnet' : 'shield';
      if (bonus === 'magnet') r.magnetT = POWER_TIME;
      else r.shieldT = POWER_TIME;
    }
  } else {
    r.wrong++;
    ex.attempts++;
    g.reveal = 1.4;
  }
  r.events.push({ t: 'gate', ok: g.ok, bonus });
  r.nextGate = r.gates.find((x) => !x.resolved) ?? null;
}

/** the seconds of a clear run (no hits), for the tests: the same steps as the screen */
export function simulate(r: Run, brain: (r: Run, dt: number) => void, dt = 1 / 60, limit = 200): number {
  while (r.phase !== 'done' && r.t < limit) {
    brain(r, dt);
    step(r, dt);
    r.events.length = 0;
  }
  return r.t;
}
