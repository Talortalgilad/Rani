/** The level of the carnival (SPEC-carnival.md 5.3): hearts fill a meter; 20 levels, the first ones quick (5, 10, 15 hearts), then slower. It never goes down. Pure. */
export const MAX_LEVEL = 20;
/** the hearts (in all) at which levels 2, 3, ... 20 begin */
export const THRESHOLDS = [5, 10, 15, 25, 40, 60, 85, 115, 150, 190, 235, 285, 340, 400, 465, 535, 610, 690, 775];
/** the levels at which a new resident arrives (the first six of the 18 new ones), in the order of the list */
export const ARRIVAL_LEVELS = [2, 3, 5, 7, 9, 11];

export const levelOf = (hearts: number): number => 1 + THRESHOLDS.filter((t) => hearts >= t).length;
/** the hearts where this level began and where the next begins (null at the top) */
export const span = (hearts: number): { from: number; to: number | null; level: number } => {
  const level = levelOf(hearts);
  return { level, from: level === 1 ? 0 : THRESHOLDS[level - 2], to: level >= MAX_LEVEL ? null : THRESHOLDS[level - 1] };
};
/** 0..1 of the way to the next level (1 at the top) */
export const progress = (hearts: number): number => {
  const s = span(hearts);
  return s.to === null ? 1 : (hearts - s.from) / (s.to - s.from);
};
/** the levels reached when the hearts grow from `before` to `after` (one heart can only pass one, but a pile of hearts can pass several) */
export const levelsGained = (before: number, after: number): number[] => {
  const out: number[] = [];
  for (let l = levelOf(before) + 1; l <= levelOf(after); l++) out.push(l);
  return out;
};
/** which of the new residents (index in the list of 6) arrives at this level, or -1 */
export const arrivalAt = (level: number): number => ARRIVAL_LEVELS.indexOf(level);
