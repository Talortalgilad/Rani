/**
 * The measuring cup of the recipes (SPEC-squishy.md 2.3) and the help that every step gives, as rules without a screen (so that a test can play a player who is wrong every time).
 * The rules: the water rises slowly (at least 0.6 s for a unit, slower near the line), the level that she lets go at is accepted within half a unit of the line, too little keeps the water where it is
 * (she presses again and it goes on), too much is drained one unit for each tap of a button (never all of it), and there is no "wrong": after one mistake a hand shows the line, after two
 * the water stops by itself on the line. No step can be locked.
 */
export const CUP = {
  /** the water rises at most one unit in this many seconds */
  MIN_SEC_PER_UNIT: 0.6,
  /** a level that is let go within this many units of the line is right */
  TOL: 0.5,
  /** the last units before the line, where the water rises more slowly (down to SLOW_FACTOR of the speed) */
  SLOW_ZONE: 1.5,
  SLOW_FACTOR: 0.4,
  MAX: 10,
  /** after this many mistakes a hand shows the line; after this many the water stops on the line by itself */
  HAND_AFTER: 1,
  AUTO_AFTER: 2,
} as const;

export type CupResult = 'ok' | 'almost' | 'toomuch';
export interface Cup { goal: number; lvl: number; mistakes: number }
export const newCup = (goal: number): Cup => ({ goal, lvl: 0, mistakes: 0 });
export const snap = (v: number, step: number): number => Math.round(v / step) * step;

/** the speed in units a second at this level: at most 1 / 0.6, slower in the last SLOW_ZONE units before the line */
export function riseRate(c: Cup): number {
  const gap = c.goal - c.lvl;
  const base = 1 / CUP.MIN_SEC_PER_UNIT;
  return gap > 0 && gap < CUP.SLOW_ZONE ? base * (CUP.SLOW_FACTOR + (1 - CUP.SLOW_FACTOR) * (gap / CUP.SLOW_ZONE)) : base;
}
/** the tap is held for `dt` seconds. Returns true when the water has stopped by itself on the line (after two mistakes). */
export function rise(c: Cup, dt: number): boolean {
  const next = Math.min(CUP.MAX, c.lvl + riseRate(c) * dt);
  if (c.mistakes >= CUP.AUTO_AFTER && c.lvl <= c.goal && next >= c.goal) {
    c.lvl = c.goal;
    return true;
  }
  c.lvl = next;
  return false;
}
/** she lets go: right within half a unit of the line (the level then sits on the line); else the level snaps to the nearest mark (whole units, halves in the half-and-half recipe) and the water stays there */
export function release(c: Cup, step = 1): CupResult {
  if (Math.abs(c.lvl - c.goal) <= CUP.TOL) {
    c.lvl = c.goal;
    return 'ok';
  }
  c.lvl = Math.min(CUP.MAX, Math.max(0, snap(c.lvl, step)));
  c.mistakes++;
  return c.lvl > c.goal ? 'toomuch' : 'almost';
}
/** the drain button: one unit down for each tap (never all of it, never under zero) */
export function drain(c: Cup): void {
  c.lvl = Math.max(0, c.lvl - 1);
}
export const showsHand = (c: Cup): boolean => c.mistakes >= CUP.HAND_AFTER;
export const stopsByItself = (c: Cup): boolean => c.mistakes >= CUP.AUTO_AFTER;

/** the answer of the spoons ("how many spoons are in the bowl?"): after two mistakes the right one glows, after three it is chosen for her (the spoons are counted aloud) */
export const ANSWER_HELP = { GLOW_AFTER: 2, AUTO_AFTER: 3 } as const;
export const answerGlows = (mistakes: number): boolean => mistakes >= ANSWER_HELP.GLOW_AFTER;
export const answerAuto = (mistakes: number): boolean => mistakes >= ANSWER_HELP.AUTO_AFTER;

/** pouring: after two drops that missed the mold it glows and shows where; after three the bowl pours by itself */
export const POUR_HELP = { SHOW_AFTER: 2, AUTO_AFTER: 3 } as const;
export const pourShows = (misses: number): boolean => misses >= POUR_HELP.SHOW_AFTER;
export const pourAuto = (misses: number): boolean => misses >= POUR_HELP.AUTO_AFTER;
