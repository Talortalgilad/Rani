/** One step of a station: a card or a task. `score` lists the words that the result counts for (Leitner). */
export type Step =
  | { kind: 'card'; word: string; score: string[] }
  | { kind: 'colorcard'; color: string; score: string[] }
  | { kind: 'circle'; right: string; ids: string[]; score: string[] }
  | { kind: 'tap'; right: string; ids: string[]; score: string[] }
  | { kind: 'put'; right: string; others: string[]; score: string[] }
  | { kind: 'listen'; right: string; ids: string[]; score: string[] }
  /** join pictures with words: 'audio' = a speaker for each word (hear it), 'written' = the word is written (every tap says it) */
  | { kind: 'match'; ids: string[]; mode: 'audio' | 'written'; score: string[] }
  | { kind: 'find'; right: string; others: string[]; count: number; score: string[] }
  | { kind: 'color'; object: string; color: string; score: string[] }
  | { kind: 'count'; right: string; n: number; score: string[] }
  | { kind: 'bigsmall'; right: string; which: 'big' | 'small'; score: string[] }
  | { kind: 'where'; item: string; ref: string; prep: 'on' | 'in' | 'under' | 'over'; score: string[] }
  | { kind: 'sentence'; words: string[]; picture: string; missing: number; score: string[] }
  /** "Say it!" (only when a parent turned it on): she says the word, the phone listens */
  | { kind: 'say'; right: string; score: string[] }
  // the letters journey (SPEC-letters.md): the keys of the scores are `l:<letter>` and `lw:<word>`
  | { kind: 'lmeet'; letter: string; score: string[] }
  | { kind: 'ltrace'; letter: string; score: string[] }
  | { kind: 'lsound'; letter: string; options: string[]; score: string[] }
  | { kind: 'lfirst'; letter: string; ids: string[]; score: string[] }
  | { kind: 'lcase'; letters: string[]; score: string[] }
  | { kind: 'lhunt'; letter: string; pool: string[]; score: string[] }
  | { kind: 'lbuild'; word: string; /** the place of the one letter that is missing (the others are there); null: all of them */ missing: number | null; pool: string[]; score: string[] }
  | { kind: 'lread'; word: string; options: string[]; score: string[] }
  | { kind: 'song'; world: number; score: string[] };

export type Kind = Step['kind'];

export const songTaskStep = (world: number): Step => ({ kind: 'song', world, score: [] });
