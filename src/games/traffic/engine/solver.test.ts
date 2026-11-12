import { describe, expect, it } from 'vitest';
import { analyze, replay } from './analyze';
import type { LevelData } from './level';
import { Solver, suggestHelper } from './solver';
import { TrafficState, type ColorId, type VehicleDef } from './state';
import { TUTORIAL } from '../levels/tutorial';

const car = (id: number, x: number, z: number, heading: number, color: ColorId): VehicleDef => ({ id, type: 'car', color, x, z, heading });
const lvl = (vehicles: VehicleDef[], queue: ColorId[]): LevelData => ({ key: 'x', kind: 'level', number: 1, world: 'city', hard: false, lot: { halfW: 6, halfH: 6 }, vehicles, queue });
const rep = (c: ColorId, n: number): ColorId[] => Array<ColorId>(n).fill(c);

describe('solver', () => {
  it('solves a level where every vehicle is free', () => {
    const l = lvl([car(0, -2, 0, 270, 'red'), car(1, 2, 0, 270, 'blue')], [...rep('blue', 4), ...rep('red', 4)]);
    const s = new Solver(l).solve();
    expect(s.solvable).toBe(true);
    expect(replay(l, s.path).won).toBe(true);
  });
  it('knows a level that cannot be won (two cars face each other)', () => {
    const l = lvl([car(0, -1.5, 0, 0, 'red'), car(1, 1.5, 0, 180, 'red')], rep('red', 8));
    const s = new Solver(l);
    expect(s.solve().solvable).toBe(false);
  });
  it('knows a level that cannot be won because the station fills with the wrong colours', () => {
    // five cars, one passenger colour first: the only way is to start with red, but four others are cheaper to tap
    const colors: ColorId[] = ['purple', 'green', 'yellow', 'blue', 'red'];
    const l = lvl(colors.map((c, i) => car(i, -8 + i * 4, 0, 270, c)), colors.slice().reverse().flatMap((c) => rep(c, 4)));
    const solver = new Solver(l);
    const sol = solver.solve();
    expect(sol.solvable).toBe(true);
    const m = solver.measure(sol.path);
    expect(m.traps).toBeGreaterThan(0);
    expect(m.depth).toBeGreaterThan(0);
  });
  it('a trap is a move that looks fine and ends in a dead end', () => {
    const colors: ColorId[] = ['purple', 'green', 'yellow', 'blue', 'red'];
    const l = lvl(colors.map((c, i) => car(i, -8 + i * 4, 0, 270, c)), colors.slice().reverse().flatMap((c) => rep(c, 4)));
    const solver = new Solver(l);
    const s0 = solver.initial();
    // tapping four cars that nobody waits for leaves no room for red
    let s = s0;
    for (const i of [0, 1, 2, 3]) s = solver.apply(s, i);
    expect(solver.can(s)).toBe(false);
    expect(solver.can(s0)).toBe(true);
  });
});

describe('the tutorial levels', () => {
  for (const t of TUTORIAL) {
    it(`${t.key} can be solved without helpers`, () => {
      const st = analyze(t, 1);
      expect(st, t.key).not.toBeNull();
      expect(replay(t, st!.solution).won).toBe(true);
    });
  }
  it('the last one has a trap to think about', () => {
    expect(analyze(TUTORIAL[4], 1)!.traps).toBeGreaterThan(0);
  });
  it('the second one starts with a blocked vehicle', () => {
    const s = new Solver(TUTORIAL[1]);
    expect(s.legal(s.initial(), 4)).toHaveLength(1);
  });
});

describe('what to suggest when you are stuck', () => {
  const colors: ColorId[] = ['purple', 'green', 'yellow', 'blue', 'red'];
  const defs = colors.map((c, i) => car(i, -8 + i * 4, 0, 270, c));
  const queue = colors.slice().reverse().flatMap((c) => rep(c, 4));
  it('an extra place gets a stuck game going again', () => {
    const ts = new TrafficState(defs, queue);
    for (const id of [0, 1, 2, 3]) {
      ts.tap(id);
      ts.arrive(id);
    }
    expect(ts.status).toBe('stuck');
    const help = suggestHelper(defs, ts);
    expect(help).toEqual({ kind: 'slot' });
    ts.addSlot();
    expect(ts.status).toBe('playing');
    expect(ts.tap(4).kind).toBe('exit');
  });
  it('when all seven places are open and full, the VIP place is suggested with a vehicle that helps', () => {
    const cs: ColorId[] = ['purple', 'green', 'yellow', 'blue', 'orange', 'pink', 'cyan', 'red', 'red'];
    const ds = cs.map((c, i) => car(i, -16 + i * 4, 0, 270, c));
    const q = [...rep('red', 8), ...cs.slice(0, 7).flatMap((c) => rep(c, 4))];
    const ts = new TrafficState(ds, q);
    for (let i = 4; i < 7; i++) ts.addSlot();
    for (let id = 0; id < 7; id++) {
      ts.tap(id);
      ts.arrive(id);
    }
    expect(ts.status).toBe('stuck');
    const help = suggestHelper(ds, ts);
    expect(help?.kind).toBe('vip');
    expect([7, 8]).toContain(help!.vehicle);
    expect(ts.sendToVip(help!.vehicle!)).toBe(true);
    ts.arrive(help!.vehicle!);
    expect(ts.nextBoarding()).not.toBeNull();
  });
});
