import type { BeltDef, ColorId, VehicleDef } from './state';

export type World = 'city' | 'beach' | 'snow' | 'carnival';

/** What the solver and the generator know about a level (kept next to it in levels.json). */
export interface LevelStats {
  vehicles: number;
  passengers: number;
  colors: number;
  /** vehicle footprints as a share of the lot area */
  density: number;
  /** share of the vehicles that stand at 45 degrees */
  angled: number;
  /** vehicles that can leave at the start */
  free: number;
  /** of those, the ones that do not lead into a dead end */
  safeMoves: number;
  /** moves that look fine and lead to a dead end, counted along the solution */
  traps: number;
  /** how many moves ahead you need to see to notice the worst trap */
  depth: number;
  /** the fewest station places a solution needs at the same time (the fewer free places, the more pressure) */
  slotsNeeded: number;
  /** the size of the shuffle window of the queue, in vehicles */
  window: number;
  /** one number that grows with the difficulty (used by the ramp test) */
  score: number;
  /** vehicle ids in the order of the solution the solver found */
  solution: number[];
  /** false when a count hit the search limit (the number is then a lower bound) */
  exact: boolean;
}

/** One thing the tutorial says. `hand` is the vehicle the pointing hand shows. */
export interface TutorialStep {
  text: string;
  hand?: number;
  /** shown when the child taps a vehicle that cannot leave */
  blocked?: { text: string; hand?: number };
}

export interface LevelData {
  /** 't1'..'t5' for the tutorial, '1'..'30' for the numbered levels */
  key: string;
  kind: 'tutorial' | 'level';
  number: number;
  world: World;
  hard: boolean;
  lot: { halfW: number; halfH: number };
  vehicles: VehicleDef[];
  queue: ColorId[];
  /** conveyor belts (from level 30) */
  belts?: BeltDef[];
  /** a sentence that explains what is new in this level (shown at the start) */
  intro?: string;
  /** tutorial only: what to tell the child; step k is shown after k moves have been made */
  steps?: TutorialStep[];
  stats?: LevelStats;
}
