/**
 * The helpers and what they cost (SPEC-traffic 3.4). Paid with the stars from the jar, never with money.
 *  - undo: three free in every level, then 2 stars
 *  - shuffle the passengers: 5 stars
 *  - extra place: 5 stars
 *  - VIP: 8 stars
 * The first helper offered when you are stuck is free once a day.
 */
export type Helper = 'undo' | 'shuffle' | 'slot' | 'vip';

export const HELPER_COST: Record<Helper, number> = { undo: 2, shuffle: 5, slot: 5, vip: 8 };
export const FREE_UNDOS = 3;

/** What was used in this level. */
export interface HelperBook {
  undosUsed: number;
  /** helpers that count against the stars: everything except the three free undos */
  helpersUsed: number;
}

export const newBook = (): HelperBook => ({ undosUsed: 0, helpersUsed: 0 });

export interface Price {
  stars: number;
  free: boolean;
}

/** What using a helper costs now. `freeToday` is the daily free helper (only offered when you are stuck). */
export function priceOf(h: Helper, book: HelperBook, freeToday = false): Price {
  if (h === 'undo' && book.undosUsed < FREE_UNDOS) return { stars: 0, free: true };
  if (freeToday) return { stars: 0, free: true };
  return { stars: HELPER_COST[h], free: false };
}

/** Records the use of a helper (after it was paid for). */
export function recordUse(h: Helper, book: HelperBook): HelperBook {
  const freeUndo = h === 'undo' && book.undosUsed < FREE_UNDOS;
  return {
    undosUsed: book.undosUsed + (h === 'undo' ? 1 : 0),
    helpersUsed: book.helpersUsed + (freeUndo ? 0 : 1),
  };
}

/** Three stars with no helper, two with one, one with more (SPEC 3.5). The three free undos do not count. */
export const starsFor = (helpersUsed: number): 1 | 2 | 3 => (helpersUsed <= 0 ? 3 : helpersUsed === 1 ? 2 : 1);

export const canAfford = (price: Price, stars: number): boolean => price.free || stars >= price.stars;

/** The day as "2026-11-12" in the child's own time zone. */
export function dayKey(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Is the daily free helper still there? */
export const dailyFreeAvailable = (lastUsedDay: string | null, today: string): boolean => lastUsedDay !== today;
