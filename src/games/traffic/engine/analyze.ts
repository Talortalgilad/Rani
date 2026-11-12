import type { LevelData, LevelStats } from './level';
import { Solver, difficultyScore } from './solver';
import { BELT_PITCH, BELT_WIDTH, SIZES, TrafficState, placeArea } from './state';

/** Clears the level in the engine in the given order of vehicle ids. Returns whether it was won and how many places were used at most. */
export function replay(level: Pick<LevelData, 'vehicles' | 'queue' | 'belts'>, order: number[]): { won: boolean; maxStation: number; moves: number } {
  const st = new TrafficState(level.vehicles, level.queue, level.belts);
  let maxStation = 0;
  for (const id of order) {
    st.autoRotate(id); // a vehicle that turns on the spot is turned to a way that is clear
    const r = st.tap(id);
    if (r.kind !== 'exit') return { won: false, maxStation, moves: st.moves };
    st.uncovered(id);
    st.arrive(id);
    for (let guard = 0; guard < 1000; guard++) {
      const b = st.board();
      if (!b) break;
      if (b.full) st.depart(b.vehicle.id);
    }
    maxStation = Math.max(maxStation, st.slots.filter((x) => x !== null).length);
  }
  return { won: st.status === 'won', maxStation, moves: st.moves };
}

/** Footprints as a share of the lot. */
export function densityOf(level: Pick<LevelData, 'vehicles' | 'lot' | 'belts'>): number {
  // a belt is one strip (its cars and the belt under them); a vehicle that turns has its turntable
  const belts = (level as Pick<LevelData, 'belts'>).belts ?? [];
  const beltArea = belts.reduce((s, b) => s + ((b.slots.length - 1) * BELT_PITCH + SIZES.car.len) * BELT_WIDTH, 0);
  const total = level.vehicles.filter((v) => !v.belt).reduce((s, v) => s + placeArea(v), 0) + beltArea;
  return total / (4 * level.lot.halfW * level.lot.halfH);
}

export const angledShare = (vs: LevelData['vehicles']): number => vs.filter((v) => v.heading % 90 !== 0).length / Math.max(1, vs.length);

/** Solves the level without helpers and measures it. Returns null when it cannot be solved. */
export function analyze(level: LevelData, window: number): LevelStats | null {
  const solver = new Solver(level);
  let sol = solver.solve();
  if (!sol.solvable) {
    // the search ran out of budget: the order the lot was built in is a proof by itself
    const built = [...level.vehicles].sort((a, b) => b.id - a.id).map((v) => v.id);
    if (!replay(level, built).won) return null;
    sol = { solvable: true, unknown: false, path: built, nodes: sol.nodes };
  }
  if (!replay(level, sol.path).won) return null;
  const m = solver.measure(sol.path);
  const colors = new Set(level.vehicles.map((v) => v.color)).size;
  return {
    vehicles: level.vehicles.length,
    passengers: level.queue.length,
    colors,
    density: Math.round(densityOf(level) * 1000) / 1000,
    angled: Math.round(angledShare(level.vehicles) * 1000) / 1000,
    free: m.free,
    safeMoves: m.safeMoves,
    traps: m.traps,
    depth: m.depth,
    slotsNeeded: m.slotsNeeded,
    window,
    score: difficultyScore(level.vehicles.length, m),
    solution: sol.path,
    exact: m.exact,
  };
}
