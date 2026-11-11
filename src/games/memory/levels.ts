import type { DeckId } from './decks';
import type { Special } from './engine';

export interface Level {
  id: number;
  world: 1 | 2 | 3 | 4;
  deck: DeckId;
  /** board size, columns × rows (portrait) */
  cols: number;
  rows: number;
  /** 2 = pairs, 3 = triples */
  group: 2 | 3;
  /** a boss level has the world's biggest board and the shuffle card */
  boss?: boolean;
  /** special pairs on this board */
  specials?: Special[];
  /** learning pairs mixed into the board */
  edu?: 'numqty' | 'letters';
}

export const WORLDS = [
  { id: 1, name: 'החווה', icon: '🐄', deck: 'farm', from: '#c9efa8', to: '#8bd45b', path: '#fff' },
  { id: 2, name: 'הים', icon: '🐠', deck: 'sea', from: '#bfe9ff', to: '#4aa3df', path: '#fff' },
  { id: 3, name: 'החלל', icon: '🚀', deck: 'space', from: '#5a4fb0', to: '#2e2a6b', path: '#ffe48a' },
  { id: 4, name: 'הממתקים', icon: '🍭', deck: 'sweets', from: '#ffd0e0', to: '#ff8fab', path: '#fff' },
] as const;

export const LEVELS: Level[] = [
  // 1. farm: the basics
  { id: 1, world: 1, deck: 'farm', cols: 2, rows: 3, group: 2 },
  { id: 2, world: 1, deck: 'farm', cols: 3, rows: 4, group: 2 },
  { id: 3, world: 1, deck: 'farm', cols: 3, rows: 4, group: 2 },
  { id: 4, world: 1, deck: 'farm', cols: 4, rows: 4, group: 2, boss: true, specials: ['shuffle'] },
  // 2. sea: the star card
  { id: 5, world: 2, deck: 'sea', cols: 4, rows: 4, group: 2, specials: ['star'] },
  { id: 6, world: 2, deck: 'sea', cols: 4, rows: 5, group: 2, specials: ['star', 'peek'] },
  { id: 7, world: 2, deck: 'sea', cols: 4, rows: 5, group: 2, specials: ['star'] },
  { id: 8, world: 2, deck: 'sea', cols: 4, rows: 5, group: 2, boss: true, specials: ['star', 'shuffle'] },
  // 3. space: number ↔ quantity
  { id: 9, world: 3, deck: 'space', cols: 4, rows: 5, group: 2, specials: ['star'] },
  { id: 10, world: 3, deck: 'space', cols: 5, rows: 4, group: 2, specials: ['star'], edu: 'numqty' },
  { id: 11, world: 3, deck: 'space', cols: 4, rows: 6, group: 2, specials: ['star', 'peek'] },
  { id: 12, world: 3, deck: 'space', cols: 4, rows: 6, group: 2, boss: true, specials: ['star', 'shuffle'] },
  // 4. sweets: letters, and triples in the final level
  { id: 13, world: 4, deck: 'sweets', cols: 4, rows: 6, group: 2, specials: ['star'] },
  { id: 14, world: 4, deck: 'sweets', cols: 5, rows: 6, group: 2, specials: ['star'], edu: 'letters' },
  { id: 15, world: 4, deck: 'sweets', cols: 5, rows: 6, group: 2, specials: ['star', 'peek'] },
  { id: 16, world: 4, deck: 'sweets', cols: 5, rows: 6, group: 3, boss: true, specials: ['star', 'shuffle'] },
];

export const groupsOf = (l: Level): number => (l.cols * l.rows) / l.group;
/** Kept from stage 1. */
export const pairsOf = groupsOf;
