/** Pure memory-game logic: no DOM, no timers. The UI decides when a miss is turned back. */

export type Rand = () => number;

export type Special = 'star' | 'peek' | 'shuffle';

/** Non-picture card faces: letter ↔ word, number ↔ quantity, and special cards. */
export type Face =
  | { kind: 'letter'; letter: string }
  | { kind: 'word'; letter: string; word: string; art: string }
  | { kind: 'num'; n: number }
  | { kind: 'qty'; n: number }
  | { kind: 'special'; special: Special };

/** `art` is the match key: cards with the same key belong together (picture cards: "deck:picture"). */
export interface Card { id: number; art: string; face?: Face }

export function shuffle<T>(arr: readonly T[], rand: Rand = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** `pairs` distinct pictures, each repeated `group` times (2 = pairs, 3 = triples), shuffled. */
export function buildCards(artKeys: readonly string[], pairs: number, group: 2 | 3 = 2, rand: Rand = Math.random): Card[] {
  if (pairs > artKeys.length) throw new Error(`need ${pairs} pictures, deck has ${artKeys.length}`);
  const chosen = shuffle(artKeys, rand).slice(0, pairs);
  const cards = chosen.flatMap((art) => Array.from({ length: group }, () => art));
  return shuffle(cards, rand).map((art, id) => ({ id, art }));
}

export type FlipResult =
  | { kind: 'ignored' }
  | { kind: 'open'; index: number }
  | { kind: 'match'; indices: number[]; special?: Special }
  | { kind: 'miss'; indices: number[] };

export class MemoryGame {
  matched: boolean[];
  open: number[] = [];
  /** Completed flips of `group` cards, right or wrong. */
  attempts = 0;
  streak = 0;
  bestStreak = 0;
  /** True from a miss until unflip(): nothing else can be flipped meanwhile. */
  resolving = false;
  /** Set by the UI during a peek or a shuffle: nothing can be flipped. */
  locked = false;
  /** Misses in a row; six of them light the help bulb. */
  failStreak = 0;
  hintUsed = false;

  constructor(readonly cards: Card[], readonly group: 2 | 3 = 2) {
    if (cards.length % group !== 0) throw new Error('board size must be divisible by the group size');
    this.matched = cards.map(() => false);
  }

  get pairs(): number { return this.cards.length / this.group; }
  get found(): number { return this.matched.filter(Boolean).length / this.group; }
  get done(): boolean { return this.found === this.pairs; }

  flip(i: number): FlipResult {
    if (this.resolving || this.locked || !Number.isInteger(i) || i < 0 || i >= this.cards.length) return { kind: 'ignored' };
    if (this.matched[i] || this.open.includes(i) || this.open.length >= this.group) return { kind: 'ignored' };
    this.open.push(i);
    if (this.open.length < this.group) return { kind: 'open', index: i };

    this.attempts++;
    const indices = [...this.open];
    const art = this.cards[indices[0]].art;
    if (indices.every((j) => this.cards[j].art === art)) {
      indices.forEach((j) => (this.matched[j] = true));
      this.open = [];
      this.streak++;
      this.failStreak = 0;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      const face = this.cards[indices[0]].face;
      return { kind: 'match', indices, special: face?.kind === 'special' ? face.special : undefined };
    }
    this.streak = 0;
    this.failStreak++;
    this.resolving = true;
    return { kind: 'miss', indices };
  }

  /** The help bulb: after 6 misses in a row, once per level. Using it never costs stars. */
  get hintAvailable(): boolean { return this.failStreak >= 6 && !this.hintUsed && !this.done; }

  /** Picks a card that still has its partners hidden (for the UI to make it shake). -1 when no help is due. */
  useHint(rand: Rand = Math.random): number {
    if (!this.hintAvailable) return -1;
    const free = this.cards.map((_, i) => i).filter((i) => !this.matched[i] && !this.open.includes(i));
    this.hintUsed = true;
    return free[Math.floor(rand() * free.length)];
  }

  /** The shuffle card: hidden cards swap places. Returns the positions that were mixed. */
  shuffleRemaining(rand: Rand = Math.random): number[] {
    const idx = this.cards.map((_, i) => i).filter((i) => !this.matched[i] && !this.open.includes(i));
    const moved = shuffle(idx.map((i) => this.cards[i]), rand);
    idx.forEach((i, k) => (this.cards[i] = { ...moved[k], id: i }));
    return idx;
  }

  /** Turns a missed set back; returns the indices to flip face-down. */
  unflip(): number[] {
    const back = [...this.open];
    this.open = [];
    this.resolving = false;
    return back;
  }
}

/** Finishing is always at least one star; mistakes never cost it. `groups` = number of pairs (or triples). */
export function starsFor(attempts: number, groups: number): 1 | 2 | 3 {
  if (attempts <= groups * 1.5) return 3;
  if (attempts <= groups * 2.2) return 2;
  return 1;
}
