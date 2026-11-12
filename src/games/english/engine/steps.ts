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
  | { kind: 'song'; world: number; score: string[] };

export type Kind = Step['kind'];

export const songTaskStep = (world: number): Step => ({ kind: 'song', world, score: [] });
