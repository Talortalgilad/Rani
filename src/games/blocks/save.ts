/** A game in the middle, saved after every move (SPEC-blocks.md 3.4). Come back within 10 minutes: it goes on without the gate. Pure. */
import { Board, N } from './board';
import { pieceById } from './pieces';
import { freshFree, type FreeUsed } from './helpers';

export interface SavedGame {
  v: 1;
  savedAt: number;
  cells: number[];
  tray: ({ id: string; color: number } | null)[];
  score: { total: number; streak: number; clearedThisTray: boolean };
  gen: { a: number; history: string[][] };
  rescued: boolean;
  free: FreeUsed;
  seed: number;
}

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** A saved game read back: null when it is not valid (then a new board starts). */
export function validSaved(x: unknown): SavedGame | null {
  const s = x as SavedGame | null;
  if (!s || s.v !== 1 || !isNum(s.savedAt) || !Array.isArray(s.cells) || s.cells.length !== N * N || !s.cells.every((c) => Number.isInteger(c) && c >= -1 && c < 7)) return null;
  if (!Array.isArray(s.tray) || s.tray.length !== 3) return null;
  for (const t of s.tray) if (t && (typeof t.id !== 'string' || pieceById(t.id).id !== t.id || !Number.isInteger(t.color))) return null;
  if (!s.score || !isNum(s.score.total) || !isNum(s.score.streak) || !s.gen || !isNum(s.gen.a) || !Array.isArray(s.gen.history)) return null;
  s.free = { ...freshFree(), ...(s.free ?? {}) };
  return s;
}

export const boardOf = (s: SavedGame): Board => {
  const b = new Board();
  s.cells.forEach((c, i) => (b.cells[i] = c));
  return b;
};
