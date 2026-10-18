/** Simulated players, used by the tests to check that levels can be finished and how stars are spread. */
import { MemoryGame, type Card, type FlipResult } from './engine';

export type Strategy = 'memory' | 'random' | 'limited';

/**
 * - memory: never forgets a card it has seen (a perfect player)
 * - random: guesses blindly
 * - limited: remembers only the last `span` cards it saw (closer to a child)
 * Handles the shuffle card like the UI does: what was remembered becomes stale.
 */
export function playLevel(cards: Card[], group: 2 | 3, strategy: Strategy, rand: () => number, span = 8): MemoryGame {
  const g = new MemoryGame(cards, group);
  let seen: number[] = [];
  const see = (i: number) => {
    seen = seen.filter((x) => x !== i);
    seen.push(i);
    if (strategy === 'limited' && seen.length > span) seen.shift();
  };
  const after = (r: FlipResult) => {
    if (r.kind === 'match' && r.special === 'shuffle') {
      g.shuffleRemaining(rand);
      seen = [];
    }
  };
  for (let moves = 0; !g.done; moves++) {
    if (moves > 20000) throw new Error(`bot stuck: open=${g.open} seen=${seen} matched=${g.matched.filter(Boolean).length}`);
    if (strategy === 'random') {
      const free = g.cards.map((_, i) => i).filter((i) => !g.matched[i]);
      after(g.flip(free[Math.floor(rand() * free.length)]));
      if (g.resolving) g.unflip();
      continue;
    }
    const byArt = new Map<string, number[]>();
    seen.forEach((i) => {
      if (!g.matched[i]) byArt.set(g.cards[i].art, [...(byArt.get(g.cards[i].art) ?? []), i]);
    });
    const full = [...byArt.values()].find((v) => v.length === group);
    if (full) {
      let last!: FlipResult;
      for (const i of full) last = g.flip(i);
      after(last);
      continue;
    }
    const unseen = g.cards.map((_, i) => i).filter((i) => !seen.includes(i) && !g.matched[i]);
    const first = unseen[Math.floor(rand() * unseen.length)];
    let r = g.flip(first);
    see(first);
    const twins = seen.filter((i) => i !== first && g.cards[i].art === g.cards[first].art && !g.matched[i]);
    if (twins.length >= group - 1) {
      for (const i of twins.slice(0, group - 1)) r = g.flip(i);
    } else {
      while (g.open.length > 0 && g.open.length < group) {
        const pool = g.cards.map((_, i) => i).filter((i) => !g.matched[i] && !g.open.includes(i) && !seen.includes(i));
        const pick = pool.length ? pool[Math.floor(rand() * pool.length)] : g.cards.findIndex((_, i) => !g.matched[i] && !g.open.includes(i));
        see(pick);
        r = g.flip(pick);
      }
    }
    after(r);
    if (g.resolving) g.unflip();
  }
  return g;
}
