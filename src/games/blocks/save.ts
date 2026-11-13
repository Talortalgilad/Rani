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
  /** the journey's layers: ice, crates, chains, items */
  layers?: { ice: number[]; crate: number[]; lock: number[]; item: number[] };
  /** a level of the journey that is being played */
  journey?: { level: number; trays: number; clears: number; collected: number; twice: boolean };
}

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** A saved game read back: null when it is not valid (then a new board starts). */
export function validSaved(x: unknown): SavedGame | null {
  const s = x as SavedGame | null;
  if (!s || s.v !== 1 || !isNum(s.savedAt) || !Array.isArray(s.cells) || s.cells.length !== N * N || !s.cells.every((c) => Number.isInteger(c) && c >= -1 && c < 7)) return null;
  if (!Array.isArray(s.tray) || s.tray.length !== 3) return null;
  for (const t of s.tray) if (t && (typeof t.id !== 'string' || pieceById(t.id).id !== t.id || !Number.isInteger(t.color))) return null;
  if (!s.score || !isNum(s.score.total) || !isNum(s.score.streak) || !s.gen || !isNum(s.gen.a) || !Array.isArray(s.gen.history)) return null;
  if (s.layers) {
    const l = s.layers;
    if (![l.ice, l.crate, l.lock, l.item].every((a) => Array.isArray(a) && a.length === N * N && a.every((x) => Number.isInteger(x)))) return null;
  }
  if (s.journey && !(isNum(s.journey.level) && isNum(s.journey.trays) && isNum(s.journey.clears) && isNum(s.journey.collected))) return null;
  s.free = { ...freshFree(), ...(s.free ?? {}) };
  return s;
}

export const boardOf = (s: SavedGame): Board => {
  const b = new Board();
  s.cells.forEach((c, i) => (b.cells[i] = c));
  if (s.layers) {
    b.ice.set(s.layers.ice);
    b.crate.set(s.layers.crate);
    b.lock.set(s.layers.lock);
    b.item.set(s.layers.item);
  }
  return b;
};
