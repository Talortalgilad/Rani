/** Scoring (SPEC-blocks.md 3.3). Pure. */
export const CLEAN_BOARD_BONUS = 300;
export const MAX_STREAK = 5;

/** Points for the rows, columns and squares cleared by one move: 10 for one, 30 for two, 60 for three, 100 each for four or more. */
export function clearPoints(units: number): number {
  if (units <= 0) return 0;
  if (units === 1) return 10;
  if (units === 2) return 30;
  if (units === 3) return 60;
  return 100 * units;
}

/** What to say for a clear of this size ("יופי!", "מדהים!", "וואו!", "קסם!"): the id of the line. */
export function comboLine(units: number): string | null {
  if (units < 2) return null;
  return units === 2 ? 'blk_nice' : units === 3 ? 'blk_amazing' : units === 4 ? 'blk_wow' : 'blk_magic';
}

export interface MoveScore { placed: number; cleared: number; mult: number; bonus: number; total: number }

/**
 * The score of a game: every cell put down is a point; clears are multiplied by the streak (clears in consecutive trays: x2 in the second,
 * x3 in the third, up to x5); a clean board is a bonus of 300.
 */
export class Score {
  total = 0;
  /** trays in a row in which something was cleared (including the one being played, once it has a clear) */
  streak = 0;
  clearedThisTray = false;

  get multiplier(): number {
    return Math.min(MAX_STREAK, Math.max(1, this.streak));
  }

  /** One shape put down: `placed` cells, `units` rows/columns/squares cleared by it, `boardEmpty` when nothing is left. */
  move(placed: number, units: number, boardEmpty: boolean): MoveScore {
    if (units > 0 && !this.clearedThisTray) {
      this.clearedThisTray = true;
      this.streak += 1;
    }
    const mult = this.multiplier;
    const cleared = clearPoints(units) * (units > 0 ? mult : 1);
    const bonus = units > 0 && boardEmpty ? CLEAN_BOARD_BONUS : 0;
    const total = placed + cleared + bonus;
    this.total += total;
    return { placed, cleared, mult: units > 0 ? mult : 1, bonus, total };
  }

  /** The three shapes of a tray are all down: a tray without a clear ends the streak. */
  endTray(): void {
    if (!this.clearedThisTray) this.streak = 0;
    this.clearedThisTray = false;
  }
}
