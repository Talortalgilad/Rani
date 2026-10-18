/** Pure memory-game logic: no DOM, no timers. The UI decides when a miss is turned back. */

export type Rand = () => number;

export interface Card { id: number; art: string }

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
  | { kind: 'match'; indices: number[] }
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

  constructor(readonly cards: Card[], readonly group: 2 | 3 = 2) {
    if (cards.length % group !== 0) throw new Error('board size must be divisible by the group size');
    this.matched = cards.map(() => false);
  }

  get pairs(): number { return this.cards.length / this.group; }
  get found(): number { return this.matched.filter(Boolean).length / this.group; }
  get done(): boolean { return this.found === this.pairs; }

  flip(i: number): FlipResult {
    if (this.resolving || !Number.isInteger(i) || i < 0 || i >= this.cards.length) return { kind: 'ignored' };
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
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      return { kind: 'match', indices };
    }
    this.streak = 0;
    this.resolving = true;
    return { kind: 'miss', indices };
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
