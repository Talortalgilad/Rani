/** The jar gives at most this many stars a day for the free game, so that it does not replace the journey (SPEC-blocks.md 3.4). */
export const DAILY_STAR_CAP = 3;
export const STAR_SCORE = 500;

/** Stars for a finished board of the free game: one for 500 points, one more for a new best score, within what is left of today's three. */
export function boardStars(score: number, brokeBest: boolean, givenToday: number): number {
  const raw = (score >= STAR_SCORE ? 1 : 0) + (brokeBest ? 1 : 0);
  return Math.max(0, Math.min(raw, DAILY_STAR_CAP - givenToday));
}
