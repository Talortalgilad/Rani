import { PIECES, type Piece } from './pieces';
import type { Goal, ItemId, Level } from './journey';

/** The four worlds, 15 levels each (SPEC-blocks.md 4.1). */
export const WORLDS = [
  { id: 1, name: 'גן הממתקים', icon: '🍬', from: '#ffd6e8', to: '#ff9ec7', path: '#fff', bg: 'candy', item: 'candy' as ItemId },
  { id: 2, name: 'הגינה הקסומה', icon: '🐞', from: '#c8f2dc', to: '#6fd4a0', path: '#fff', bg: 'garden', item: 'ladybug' as ItemId },
  { id: 3, name: 'סטודיו הציור', icon: '🎨', from: '#fbfbf6', to: '#d9d9cf', path: '#8e7cc3', bg: 'art', item: 'paintdrop' as ItemId },
  { id: 4, name: 'החלל', icon: '⭐', from: '#4a4fb8', to: '#1b1f5e', path: '#ffe48a', bg: 'space', item: 'star' as ItemId },
] as const;
export type World = (typeof WORLDS)[number];
export const worldOf = (id: number): World => WORLDS[id - 1];

const E = '.........';
const hand = (rows: string[]): string[] => [...rows, ...Array(9 - rows.length).fill(E)];

// the start boards drawn by hand: the three lessons and the four bosses (a picture that bursts when it is cleared)
const TUT_ROW = hand(['.........', '.........', '.........', '.........', '0000000..']);
const TUT_COL = Array.from({ length: 9 }, (_, r) => (r < 7 ? '....2....' : E));
const TUT_SQUARE = hand(['.........', '.........', '.........', '...666...', '...6.....', '...6.....']);
const BOSS: Record<number, string[]> = {
  1: hand(['.........', '.000.000.', '.0g000g0.', '.0000000.', '..00g00..', '...0.0...', '....0....']),
  2: hand(['...1.1...', '..11g11..', '...111...', '....3....', '..g.3.g..', '...333...', '..i.3.i..', '...i3i...']),
  3: hand(['....5....', '...555...', '..55555..', '.5555555.', '.5g555g5.', '.55c.c55.', '.555g555.']),
  4: hand(['....4....', '...444...', '...4g4...', '...444...', '...4c4...', '..44444..', '.g.444.g.', '...k.k...']),
};

const KINDS_W1 = ['t', 't', 't', 'score', 'clears', 'collect', 'score', 'clears', 'collect', 'score', 'clears', 'collect', 'score', 'collect', 'boss'] as const;
const KINDS = ['collect', 'clears', 'obstacles', 'score', 'collect', 'obstacles', 'clears', 'collect', 'obstacles', 'score', 'collect', 'obstacles', 'clears', 'obstacles', 'boss'] as const;
/** The curve (4.3): 1-5 very easy, three medium, one hard (purple), one easy to recover, three medium, one hard, the boss. */
const HARD: (1 | 2 | 3)[] = [1, 1, 1, 1, 1, 2, 2, 2, 3, 1, 2, 2, 2, 3, 3];

function item(world: number, n: number): ItemId {
  return worldOf(world).item === 'ladybug' ? (n % 2 ? 'ladybug' : 'butterfly') : worldOf(world).item;
}

function make(world: 1 | 2 | 3 | 4, n: number): Level {
  const id = (world - 1) * 15 + n;
  const hard = HARD[n - 1];
  const kind = world === 1 ? KINDS_W1[n - 1] : KINDS[n - 1];
  const base = { id, world, n, hard, seed: 1000 * world + n * 37 } as const;
  const k = hard - 1;
  if (kind === 't') {
    const t = n === 1 ? 'row' : n === 2 ? 'col' : 'square';
    return { ...base, hard: 1, goal: { kind: 'clears', target: 1 }, rows: n === 1 ? TUT_ROW : n === 2 ? TUT_COL : TUT_SQUARE, tutorial: t, forced: n === 1 ? [['##'], ['#'], ['#']] : n === 2 ? [['#', '#'], ['#'], ['#']] : [['##', '##'], ['#'], ['#']] };
  }
  if (kind === 'boss') return { ...base, boss: true, goal: { kind: 'collect', item: 'gem', target: 3 }, rows: BOSS[world] };
  const w = world - 1;
  const scale = 1 + 0.3 * w + n * 0.04;
  let goal: Goal;
  let items = 0;
  if (kind === 'score') goal = { kind: 'score', target: Math.round(([150, 300, 500][k] * scale) / 10) * 10 };
  else if (kind === 'clears') goal = { kind: 'clears', target: [3, 5, 8][k] + w };
  else if (kind === 'collect') {
    const target = Math.min(6, [2, 3, 5][k] + (w > 1 ? 1 : 0));
    goal = { kind: 'collect', item: item(world, n), target };
    items = target + 1;
  } else goal = { kind: 'obstacles' };
  const ob = kind === 'obstacles' ? 1 : 0.5;
  const cnt = (a: number[]): number => Math.max(world >= 2 && kind !== 'obstacles' ? 1 : 0, Math.round(a[k] * ob));
  const ice = world === 2 ? cnt([3, 5, 7]) : world === 3 ? cnt([2, 3, 4]) : world === 4 ? cnt([1, 2, 3]) : 0;
  const crates = world === 3 ? cnt([2, 3, 4]) : world === 4 ? cnt([1, 2, 3]) : 0;
  const locks = world === 4 ? cnt([2, 3, 4]) : 0;
  return { ...base, goal, gen: { density: [0.14, 0.24, 0.34][k], items, ice, crates, locks } };
}

export const LEVELS: Level[] = WORLDS.flatMap((w) => Array.from({ length: 15 }, (_, i) => make(w.id, i + 1)));
export const levelById = (id: number): Level => LEVELS.find((l) => l.id === id) ?? LEVELS[0];

const key = (cells: [number, number][]): string => cells.map((c) => c.join(',')).join(';');
/** The shape drawn with # (rows of the art) among the shapes of the game. */
export function pieceByArt(art: string[]): Piece {
  const cells: [number, number][] = art.flatMap((row, r) => [...row].flatMap((ch, c) => (ch === '#' ? ([[r, c]] as [number, number][]) : [])));
  const k = key(cells);
  return PIECES.find((p) => key(p.cells) === k) ?? PIECES[0];
}
