import { DECK_IDS, LETTERS, deckKeys } from './decks';
import { shuffle, type Card, type Face, type Rand, type Special } from './engine';
import { groupsOf, type Level } from './levels';

const SPECIAL_KEY: Record<Special, string> = { star: 'special:star', peek: 'special:peek', shuffle: 'special:shuffle' };
const MAX_EDU = 6;

/** Highest number used on number ↔ quantity cards, from the child's maths level. */
export function maxNumberFor(mathMax: number): number {
  return Math.max(5, Math.min(20, mathMax));
}

/** "deck:picture" keys for `n` picture groups: the world's deck first, topped up from the others for big boards. */
function pictureKeys(deck: Level['deck'], n: number, rand: Rand, exclude: Set<string>): string[] {
  const own = shuffle(deckKeys(deck), rand);
  const others = shuffle(DECK_IDS.filter((d) => d !== deck).flatMap(deckKeys), rand);
  return [...own, ...others].filter((k) => !exclude.has(k)).slice(0, n);
}

/** Builds the shuffled cards of one level: special groups, learning pairs, then pictures. */
export function composeLevel(level: Level, mathMax: number, rand: Rand = Math.random): Card[] {
  const groups = groupsOf(level);
  const specials = level.specials ?? [];
  const specialGroups = specials.length;
  const parts: { art: string; face?: Face }[][] = [];

  for (const sp of specials) {
    parts.push(Array.from({ length: level.group }, () => ({ art: SPECIAL_KEY[sp], face: { kind: 'special' as const, special: sp } })));
  }

  const used = new Set<string>();
  let edu = 0;
  if (level.edu === 'numqty') {
    const top = maxNumberFor(mathMax);
    const nums = shuffle(Array.from({ length: top }, (_, i) => i + 1), rand).slice(0, Math.min(MAX_EDU, top));
    edu = nums.length;
    for (const n of nums) parts.push([{ art: `edu:num:${n}`, face: { kind: 'num', n } }, { art: `edu:num:${n}`, face: { kind: 'qty', n } }]);
  } else if (level.edu === 'letters') {
    const picked = shuffle(LETTERS, rand).slice(0, MAX_EDU);
    edu = picked.length;
    for (const l of picked) {
      used.add(l.art);
      parts.push([
        { art: `edu:letter:${l.letter}`, face: { kind: 'letter', letter: l.letter } },
        { art: `edu:letter:${l.letter}`, face: { kind: 'word', letter: l.letter, word: l.word, art: l.art } },
      ]);
    }
  }

  const pictures = groups - specialGroups - edu;
  // pictures already shown on a word card are not reused as plain pictures
  for (const key of pictureKeys(level.deck, pictures, rand, used)) {
    parts.push(Array.from({ length: level.group }, () => ({ art: key })));
  }
  if (parts.length !== groups) throw new Error(`level ${level.id}: ${parts.length} groups, expected ${groups}`);

  return shuffle(parts.flat(), rand).map((c, id) => ({ id, art: c.art, ...(c.face ? { face: c.face } : {}) }));
}

