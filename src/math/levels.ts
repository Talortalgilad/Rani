import type { QuestionType } from '../storage';

export interface LevelConfig {
  level: number;
  max: number;
  types: QuestionType[];
  /** When true, sums/differences must not cross a ten (level 4). */
  noTenCrossing: boolean;
}

export const LEVELS: LevelConfig[] = [
  { level: 1, max: 5, types: ['count', 'add', 'compare'], noTenCrossing: false },
  { level: 2, max: 10, types: ['count', 'add', 'compare', 'sub'], noTenCrossing: false },
  { level: 3, max: 10, types: ['count', 'add', 'compare', 'sub', 'missing', 'bonds10'], noTenCrossing: false },
  { level: 4, max: 20, types: ['count', 'add', 'compare', 'sub', 'missing', 'bonds10'], noTenCrossing: true },
  { level: 5, max: 20, types: ['count', 'add', 'compare', 'sub', 'missing', 'bonds10', 'sequence'], noTenCrossing: false },
];

export function levelConfig(level: number): LevelConfig {
  return LEVELS[Math.min(Math.max(Math.round(level), 1), LEVELS.length) - 1];
}
