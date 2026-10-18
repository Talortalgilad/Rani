import type { DeckId } from './decks';

export interface Level {
  id: number;
  world: 1 | 2 | 3 | 4;
  deck: DeckId;
  /** board size, columns × rows (portrait) */
  cols: number;
  rows: number;
  /** 2 = pairs, 3 = triples */
  group: 2 | 3;
  boss?: boolean;
}

export const WORLDS = [{ id: 1, name: 'החווה', icon: '🐄' }] as const;

/** Stage 1: world 1 only. Worlds 2-4 arrive in stage 2. */
export const LEVELS: Level[] = [
  { id: 1, world: 1, deck: 'farm', cols: 2, rows: 3, group: 2 },
  { id: 2, world: 1, deck: 'farm', cols: 3, rows: 4, group: 2 },
  { id: 3, world: 1, deck: 'farm', cols: 3, rows: 4, group: 2 },
  { id: 4, world: 1, deck: 'farm', cols: 4, rows: 4, group: 2, boss: true },
];

export const pairsOf = (l: Level): number => (l.cols * l.rows) / l.group;
