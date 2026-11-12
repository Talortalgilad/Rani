import type { LevelData } from '../engine/level';
import { TUTORIAL } from './tutorial';
import numbered from './levels.json';

/** Five tutorial levels, then the 30 numbered levels of the city world (computed by scripts/pick-levels.ts, not on the phone). */
export const NUMBERED_LEVELS = numbered as unknown as LevelData[];
export const ALL_LEVELS: LevelData[] = [...TUTORIAL, ...NUMBERED_LEVELS];

export const levelByKey = (key: string): LevelData | undefined => ALL_LEVELS.find((l) => l.key === key);

/** The level after this one, or null at the end of the game. */
export function nextLevel(key: string): LevelData | null {
  const i = ALL_LEVELS.findIndex((l) => l.key === key);
  return i >= 0 && i + 1 < ALL_LEVELS.length ? ALL_LEVELS[i + 1] : null;
}
