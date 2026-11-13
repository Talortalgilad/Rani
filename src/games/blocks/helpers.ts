/** The helpers (SPEC-blocks.md 3.5): paid with the stars of the jar, never with money. One of each kind is free on every board. Pure. */
import { Board, EMPTY, N, idx } from './board';
import type { Piece } from './pieces';

export type Helper = 'swap' | 'rotate' | 'hammer';
export const HELPERS: Helper[] = ['swap', 'rotate', 'hammer'];
export const HELPER_COST: Record<Helper, number> = { swap: 1, rotate: 1, hammer: 2 };
export type FreeUsed = Record<Helper, boolean>;
export const freshFree = (): FreeUsed => ({ swap: false, rotate: false, hammer: false });

export interface Price { stars: number; free: boolean }
/** What a helper costs now: the first of each kind on a board is free. */
export const priceOf = (h: Helper, used: FreeUsed): Price => (used[h] ? { stars: HELPER_COST[h], free: false } : { stars: 0, free: true });
export const canAfford = (p: Price, stars: number): boolean => p.free || stars >= p.stars;

/** Why a helper cannot be used now (the id of the line that explains it), or null when it can. */
export function whyNot(h: Helper, o: { stars: number; used: FreeUsed; board: Board; tray: (Piece | null)[] }): 'blk_noStars' | 'blk_nothingHere' | 'blk_nothingToTurn' | null {
  if (!canAfford(priceOf(h, o.used), o.stars)) return 'blk_noStars';
  if (h === 'hammer' && o.board.isEmpty) return 'blk_nothingHere';
  if (h === 'rotate' && !o.tray.some((p) => p && p.name !== 'dot' && p.name !== 'square2')) return 'blk_nothingToTurn';
  return null;
}

/** The hammer breaks one block: returns the board index freed, or -1 when the cell is empty. */
export function hammer(board: Board, r: number, c: number): number {
  if (r < 0 || c < 0 || r >= N || c >= N || board.cells[idx(r, c)] === EMPTY) return -1;
  board.cells[idx(r, c)] = EMPTY;
  return idx(r, c);
}
