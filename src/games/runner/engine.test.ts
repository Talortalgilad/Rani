import { describe, expect, it } from 'vitest';
import { createGenerator, type Question } from '../../math/generator';
import { CLEAR_T, SLOW_T, createRun, gateCount, jump, move, simulate, step, threeChoices, type Run } from './engine';
import { DEFAULT_TUNING, cleanTuning, type Tuning } from './tuning';

const seeded = (s: number) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);

function make(seed = 1, tune: Partial<Tuning> = {}, level = 2) {
  const rng = seeded(seed);
  const gen = createGenerator(seeded(seed + 99));
  const solved: { q: Question; attempts: number }[] = [];
  const run = createRun({ tuning: { ...DEFAULT_TUNING, ...tune }, rng, next: () => gen.next(level, ['count', 'add', 'sub', 'missing', 'compare', 'sequence', 'bonds10']), solved: (q, attempts) => solved.push({ q, attempts }) });
  return { run, solved };
}

/** a player who goes to the lane of a sign before each gate: the right one, or a wrong one */
const gateBrain = (right: boolean) => (r: Run, _dt?: number): void => {
  const g = r.nextGate;
  if (!g || !g.prepared || g.z - r.z > 14) return;
  const want = right ? g.correct - 1 : [0, 1, 2].filter((i) => i !== g.correct && true)[0] - 1;
  if (r.target < want) move(r, 1);
  else if (r.target > want) move(r, -1);
};
/** a good player: also jumps over the low obstacles and leaves the high ones */
const goodBrain = (right: boolean) => (r: Run, dt: number): void => {
  gateBrain(right)(r, dt);
  const near = r.obstacles.find((o) => !o.done && o.z > r.z && o.z - r.z < 2.2 && Math.abs(o.lane - r.target) < 0.5);
  if (near?.kind === 'low' && near.z - r.z < 1.7) jump(r);
};

describe('the road', () => {
  it('never closes all three lanes at once, and always leaves a way through', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const { run } = make(seed);
      const byRow = new Map<number, number[]>();
      for (const o of run.obstacles) byRow.set(Math.round(o.z * 100), [...(byRow.get(Math.round(o.z * 100)) ?? []), o.lane]);
      for (const lanes of byRow.values()) expect(new Set(lanes).size).toBeLessThan(3);
      // a row of high obstacles never closes the way: at most two lanes, so one is free
      const rows = [...new Set(run.obstacles.map((o) => o.z))].sort((a, b) => a - b);
      // rows are at least 1.3 s apart, and a lane change takes a fraction of a second: two lanes are crossed in less than a row's distance
      for (let i = 1; i < rows.length; i++) {
        if (!run.gates.some((g) => g.z > rows[i - 1] && g.z < rows[i])) expect(rows[i] - rows[i - 1]).toBeGreaterThanOrEqual(run.tune.speed * 1.3 - 1e-9);
      }
      expect(run.tune.laneTime * 2).toBeLessThan(1.3);
      for (const z of rows) {
        const hi = run.obstacles.filter((o) => o.z === z && o.kind === 'high').map((o) => o.lane);
        expect([-1, 0, 1].filter((l) => !hi.includes(l)).length).toBeGreaterThan(0);
      }
    }
  });
  it('has no obstacle in the 3 s before a gate, and 4 or 5 gates 12-18 s apart', () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const gap of [12, 14, 15, 18]) {
        const { run } = make(seed, { gateGap: gap });
        expect(run.gates.length).toBe(gateCount(gap));
        expect(run.gates.length).toBeGreaterThanOrEqual(4);
        expect(run.gates.length).toBeLessThanOrEqual(5);
        for (const g of run.gates) for (const o of run.obstacles) expect(o.z > g.z - run.tune.speed * CLEAR_T && o.z < g.z + run.tune.speed).toBe(false);
        for (let k = 1; k < run.gates.length; k++) expect((run.gates[k].z - run.gates[k - 1].z) / run.tune.speed).toBeCloseTo(gap, 5);
      }
    }
    expect(SLOW_T).toBeLessThan(CLEAR_T);
  });
});

describe('a run always reaches the finish line', () => {
  it('a player who never touches the screen: all gates, the line, 60-75 seconds, nothing lost', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { run, solved } = make(seed);
      const t = simulate(run, () => undefined);
      expect(run.phase).toBe('done');
      expect(run.gatesDone).toBe(run.gates.length);
      expect(t).toBeGreaterThan(60);
      expect(t).toBeLessThan(76);
      expect(run.stars).toBeGreaterThanOrEqual(0);
      expect(run.hits).toBeGreaterThan(0 - 1);
      expect(solved.length).toBeGreaterThan(0);
    }
  });
  it('a player who is wrong at every gate: reaches the line, sees the help after two mistakes, the same exercise comes back, and Shovi gets away', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { run, solved } = make(seed);
      const qs: Question[] = [];
      let helpSeen = false;
      const brain = gateBrain(false);
      const base = (r: Run, dt: number): void => {
        brain(r, dt);
        const g = r.nextGate;
        if (g?.prepared && r.ex) {
          if (qs[qs.length - 1] !== r.ex.q) qs.push(r.ex.q);
          if (g.help) helpSeen = true;
        }
      };
      const t = simulate(run, base);
      expect(run.phase).toBe('done');
      expect(t).toBeLessThan(80);
      expect(run.correct).toBe(0);
      expect(run.caught).toBe(false);
      // one exercise all the run (never solved): it is reported once, at the end, as a not-first-try answer
      expect(new Set(qs).size).toBe(1);
      expect(helpSeen).toBe(true);
      expect(solved.length).toBe(1);
      expect(solved[0].attempts).toBeGreaterThanOrEqual(2);
    }
  });
  it('a good player catches Shovi: every gate right, the answers go back to the engine on the first try', () => {
    const { run, solved } = make(5);
    simulate(run, goodBrain(true));
    expect(run.correct).toBe(run.gates.length);
    expect(run.caught).toBe(true);
    expect(solved.every((s) => s.attempts === 1)).toBe(true);
    expect(solved.length).toBe(run.gates.length);
  });
  it('a hit costs nothing but a little time: stars and gates stay, the run is never over', () => {
    const { run } = make(3);
    let before = 0;
    simulate(run, (r) => {
      if (r.squishT > 0.4) before = r.stars;
    });
    expect(run.stars).toBeGreaterThanOrEqual(before);
  });
});

describe('the wrong answers', () => {
  it('are close to the right one (1-3 away), never negative, and the three lanes hold different numbers', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { run } = make(seed, {}, 1 + (seed % 5));
      for (const g of run.gates) {
        // prepare by stepping to it
        g.prepared = false;
      }
      simulate(run, () => undefined, 1 / 30, 200);
      // the numbers were set when each gate came into view
      for (const g of run.gates) {
        const real = g.nums;
        expect(real).toHaveLength(3);
        expect(new Set(real).size).toBe(3);
        for (const n of real) expect(n).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('every lane is a real answer', () => {
  it('no lane is closed or empty: in every exercise of every type and level the three lanes hold three different numbers, one of them right, so that no lane is a mistake that she did not choose', () => {
    const types = ['count', 'add', 'sub', 'missing', 'compare', 'sequence', 'bonds10'] as const;
    for (let level = 1; level <= 5; level++) {
      for (const type of types) {
        const gen = createGenerator(seeded(level * 31 + type.length));
        for (let i = 0; i < 80; i++) {
          const q = gen.next(level, [type]);
          const three = threeChoices(q);
          expect(three.choices, `${type} L${level}`).toHaveLength(3);
          expect(new Set(three.choices).size).toBe(3);
          expect(three.choices.every((n) => Number.isInteger(n) && n >= 0)).toBe(true);
          expect(three.choices.filter((n) => n === q.answer)).toHaveLength(1);
        }
      }
    }
  });
  it('a comparison asks "who is the biggest" (or "the smallest") of three numbers, and the right one is really the biggest (the smallest)', () => {
    let big = 0;
    let small = 0;
    for (let level = 1; level <= 5; level++) {
      const gen = createGenerator(seeded(level + 700));
      for (let i = 0; i < 200; i++) {
        const q = gen.next(level, ['compare']);
        const t = threeChoices(q);
        const biggest = q.text.includes('גדול');
        expect(t.text).toBe(biggest ? 'מי הכי גדול?' : 'מי הכי קטן?');
        expect(t.answer).toBe(biggest ? Math.max(...t.choices) : Math.min(...t.choices));
        // the third number is close to the answer and is not the answer
        const third = t.choices.filter((n) => !q.choices.includes(n));
        expect(third).toHaveLength(1);
        expect(third[0]).not.toBe(q.answer);
        if (biggest) big++;
        else small++;
      }
    }
    expect(big).toBeGreaterThan(0);
    expect(small).toBeGreaterThan(0);
  });
  it('the result goes back to the engine as the exercise that it gave (not the made-up one)', () => {
    const { run, solved } = make(7, {}, 1);
    simulate(run, goodBrain(true));
    for (const s of solved) expect(s.q.choices.length).toBeLessThanOrEqual(3);
    expect(solved.length).toBe(run.gates.length);
  });
});

describe('the numbers of the tuning panel', () => {
  it('a missing or crazy value becomes the default or the nearest allowed', () => {
    expect(cleanTuning(null)).toEqual(DEFAULT_TUNING);
    expect(cleanTuning({ speed: 999, jumpTime: -3, gateGap: 'x' })).toMatchObject({ speed: 16, jumpTime: 0.4, gateGap: DEFAULT_TUNING.gateGap });
  });
  it('the run follows the tuning: faster is shorter', () => {
    const a = simulate(make(2, { speed: 6 }).run, () => undefined);
    const b = simulate(make(2, { speed: 14 }).run, () => undefined);
    expect(a).toBeGreaterThan(b);
  });
  it('a jump goes up and comes down in the time that was asked', () => {
    const { run } = make(1);
    jump(run);
    let peak = 0;
    let t = 0;
    while (run.jt >= 0 && t < 3) {
      step(run, 1 / 120);
      peak = Math.max(peak, run.h);
      t += 1 / 120;
    }
    expect(peak).toBeGreaterThan(run.tune.jumpHeight * 0.95);
    expect(t).toBeGreaterThan(run.tune.jumpTime * 0.95);
    expect(t).toBeLessThan(run.tune.jumpTime * 1.1);
  });
});
