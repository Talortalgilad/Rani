import { LETTERS } from './journey';
import { KNOWN_LEVEL, type Words } from '../engine/progress';

/** What the parents and the book see of the letters: a letter is learned when its card was seen, known from level 4 on (Leitner). */
export type LetterState = 'new' | 'learning' | 'known';
export function letterState(words: Words, id: string): LetterState {
  const w = words[`l:${id}`];
  if (!w?.seen) return 'new';
  return w.known || w.level >= KNOWN_LEVEL ? 'known' : 'learning';
}
export const learnedLetters = (words: Words): string[] => LETTERS.map((l) => l.id).filter((id) => letterState(words, id) !== 'new');

/** Letters that were mixed up: "b/d" counts both b for d and d for b (the pair is written in alphabetical order). */
export type Confusions = Record<string, number>;
export const pairKey = (a: string, b: string): string => [a.toLowerCase(), b.toLowerCase()].sort().join('/');
export function addConfusion(c: Confusions, target: string, picked: string): Confusions {
  if (!target || !picked || target.toLowerCase() === picked.toLowerCase()) return c;
  const k = pairKey(target, picked);
  return { ...c, [k]: (c[k] ?? 0) + 1 };
}

export interface LetterStats { learned: number; learning: number; known: number; written: number; total: number; bd: number; top: [string, number][] }
export function letterStats(words: Words, written: string[], confusions: Confusions): LetterStats {
  const states = LETTERS.map((l) => letterState(words, l.id));
  return {
    learned: states.filter((s) => s !== 'new').length,
    learning: states.filter((s) => s === 'learning').length,
    known: states.filter((s) => s === 'known').length,
    written: new Set(written).size,
    total: LETTERS.length,
    bd: confusions['b/d'] ?? 0,
    top: Object.entries(confusions).filter(([k]) => k !== 'b/d').sort((a, b) => b[1] - a[1]).slice(0, 4),
  };
}
