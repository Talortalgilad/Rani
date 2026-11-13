import { mulberry32 } from '../engine/planner';
import type { Step } from '../engine/steps';
import { buildableWords, exampleHasPicture, hasPicture } from './art';
import { ISLANDS, islandInfo, letterById, lettersUpTo, wordsUpTo } from './journey';

/** Pictures that are not the example word of a letter in island 1: for "what starts with /s/?" (a word with that first letter is never among them). */
export const LETTER_PICTURES = ['ball', 'bed', 'book', 'cat', 'dog', 'fish', 'hat', 'lion', 'monkey', 'rabbit', 'egg', 'cake', 'cookie', 'milk', 'doll', 'kite', 'bike', 'flower', 'giraffe', 'elephant', 'umbrella', 'banana', 'phone', 'lamp'];
const DISTRACTORS = LETTER_PICTURES; // ['ball', 'bed', 'book', 'cat', 'dog', 'fish', 'hat', 'lion', 'monkey', 'rabbit', 'egg', 'cake', 'cookie', 'milk', 'doll', 'kite', 'bike', 'flower', 'giraffe', 'elephant', 'umbrella', 'banana', 'phone', 'lamp'];

export interface LetterPlan { island: number; station: number; /** the letters of the stations before this one (and earlier islands) */ learned: string[]; seed: number }

function sample<T>(r: () => number, a: T[], n: number): T[] {
  const c = [...a];
  const out: T[] = [];
  while (out.length < n && c.length) out.push(c.splice(Math.floor(r() * c.length), 1)[0]);
  return out;
}

/** The letters that a station may use: the ones met so far; at the very start (too few) the letters of the island, so that three can always be offered. */
export function knownFor(island: number, station: number, learned: string[]): string[] {
  const here = islandInfo(island).letters.slice(0, station + 1);
  const known = [...new Set([...learned, ...here])];
  return known.length >= 3 ? known : [...new Set([...known, ...islandInfo(island).letters])];
}

/**
 * Builds a station of the letters journey. Stations 0-3 are one letter each (meet, write, which letter says this sound, what starts with
 * the sound, big and small, find them); station 4 is the words station: build (one letter missing, then all of the word) and read.
 */
export function planLetterStation(o: LetterPlan): Step[] {
  const r = mulberry32(o.seed * 7919 + o.island * 131 + o.station);
  const isl = islandInfo(o.island);
  if (o.station >= 4) return planWordsStation(o, r);
  const id = isl.letters[o.station];
  const L = letterById(id);
  const known = knownFor(o.island, o.station, o.learned);
  const others = known.filter((l) => l !== id);
  const score = [`l:${id}`];
  const firstOthers = sample(r, DISTRACTORS.filter((w) => w[0] !== id && w !== L.word), 2);
  const steps: Step[] = [
    { kind: 'lmeet', letter: id, score: [] },
    { kind: 'ltrace', letter: id, score },
    { kind: 'lsound', letter: id, options: [id, ...sample(r, others, 2)], score },
    { kind: 'lfirst', letter: id, ids: [L.word, ...firstOthers], score },
    { kind: 'lcase', letters: [id, ...sample(r, others, 2)], score },
    { kind: 'lhunt', letter: id, pool: known, score },
  ];
  // "what starts with /x/?" needs the picture of the example word: until it is cut, the task is left out
  return exampleHasPicture(id) ? steps : steps.filter((s) => s.kind !== 'lfirst');
}

function planWordsStation(o: LetterPlan, r: () => number): Step[] {
  const words = buildableWords(o.island);
  const pool = lettersUpTo(o.island);
  const w = (i: number): string => words[i % words.length];
  const options = (word: string): string[] => [word, ...sample(r, [...new Set([...wordsUpTo(o.island).filter(hasPicture), ...words])].filter((x) => x !== word), 2)];
  const lw = (word: string): string[] => [`lw:${word}`];
  return [
    { kind: 'lbuild', word: w(0), missing: 0, pool, score: lw(w(0)) },
    { kind: 'lbuild', word: w(1), missing: 2, pool, score: lw(w(1)) },
    { kind: 'lbuild', word: w(2), missing: null, pool, score: lw(w(2)) },
    { kind: 'lbuild', word: w(0), missing: null, pool, score: lw(w(0)) },
    { kind: 'lread', word: w(1), options: options(w(1)), score: lw(w(1)) },
    { kind: 'lread', word: w(2), options: options(w(2)), score: lw(w(2)) },
  ];
}

/** The letters met before a station: the stations that are done (4 letters per island) and the islands before. */
export function learnedBefore(island: number, done: number): string[] {
  const before = ISLANDS.filter((i) => i.n < island).flatMap((i) => i.letters);
  return [...before, ...islandInfo(island).letters.slice(0, Math.min(done, 4))];
}


