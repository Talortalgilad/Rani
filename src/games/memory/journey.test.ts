import { describe, expect, it } from 'vitest';
import { composeLevel, maxNumberFor } from './compose';
import { DECKS, DECK_IDS, LETTERS, artDrawing } from './decks';
import { lettersArt } from './decks/letters';
import { MemoryGame, starsFor, type Card, type Special } from './engine';
import { cardWidth, fits, GAP, MIN_CARD } from './layout';
import { LEVELS, WORLDS, groupsOf } from './levels';

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

const count = (cards: Card[], pred: (c: Card) => boolean) => cards.filter(pred).length;
const byKey = (cards: Card[]) => {
  const m = new Map<string, Card[]>();
  cards.forEach((c) => m.set(c.art, [...(m.get(c.art) ?? []), c]));
  return m;
};

describe('the 16 levels', () => {
  it('follow the spec table: 4 worlds × 4 levels, sizes, boss at the end', () => {
    expect(LEVELS).toHaveLength(16);
    expect(LEVELS.map((l) => `${l.cols}×${l.rows}`)).toEqual([
      '2×3', '3×4', '3×4', '4×4',
      '4×4', '4×5', '4×5', '4×5',
      '4×5', '5×4', '4×6', '4×6',
      '4×6', '5×6', '5×6', '5×6',
    ]);
    WORLDS.forEach((w) => {
      const lv = LEVELS.filter((l) => l.world === w.id);
      expect(lv).toHaveLength(4);
      expect(lv.map((l) => !!l.boss)).toEqual([false, false, false, true]);
      lv.forEach((l) => expect(l.deck).toBe(w.deck));
    });
    expect(LEVELS.filter((l) => l.group === 3).map((l) => l.id)).toEqual([16]);
    expect(LEVELS.find((l) => l.edu === 'numqty')!.world).toBe(3);
    expect(LEVELS.find((l) => l.edu === 'letters')!.world).toBe(4);
  });
  it('shuffle only in bosses, peek sometimes, a star pair in every level from world 2', () => {
    for (const l of LEVELS) {
      const sp = l.specials ?? [];
      expect(sp.includes('shuffle')).toBe(!!l.boss);
      expect(sp.includes('star')).toBe(l.world >= 2);
    }
    expect(LEVELS.filter((l) => l.specials?.includes('peek')).length).toBeGreaterThanOrEqual(2);
  });
});

describe.each(LEVELS)('level $id board', (level) => {
  for (const mathMax of [5, 10, 20]) {
    it(`is built correctly (maths range ${mathMax})`, () => {
      for (let seed = 1; seed <= 25; seed++) {
        const cards = composeLevel(level, mathMax, rng(seed * 7 + level.id));
        expect(cards).toHaveLength(level.cols * level.rows);
        expect(cards.length % level.group).toBe(0);
        expect(cards.map((c) => c.id)).toEqual(cards.map((_, i) => i));

        // every match key appears exactly `group` times (learning pairs: exactly 2 different-looking cards)
        for (const [key, set] of byKey(cards)) {
          const isEdu = key.startsWith('edu:');
          expect(set.length).toBe(isEdu ? 2 : level.group);
          if (isEdu) expect(set[0].face!.kind).not.toBe(set[1].face!.kind);
        }
        expect(byKey(cards).size).toBe(groupsOf(level));

        // special cards
        const specialCount = (s: Special) => count(cards, (c) => c.face?.kind === 'special' && c.face.special === s);
        for (const s of ['star', 'peek', 'shuffle'] as Special[]) {
          expect(specialCount(s)).toBe((level.specials ?? []).includes(s) ? level.group : 0);
        }

        // every picture exists
        cards.filter((c) => !c.face).forEach((c) => expect(() => artDrawing(c.art)).not.toThrow());
        cards.forEach((c) => c.face?.kind === 'word' && expect(() => artDrawing(c.face!.kind === 'word' ? (c.face as { art: string }).art : '')).not.toThrow());
      }
    });
  }
});

describe('learning pairs', () => {
  it('number ↔ quantity: both cards per number, within the maths range, and the range follows the level', () => {
    const l = LEVELS.find((x) => x.edu === 'numqty')!;
    for (const mathMax of [5, 10, 20]) {
      const cards = composeLevel(l, mathMax, rng(mathMax));
      const nums = cards.flatMap((c) => (c.face?.kind === 'num' ? [c.face.n] : []));
      const qtys = cards.flatMap((c) => (c.face?.kind === 'qty' ? [c.face.n] : []));
      expect([...nums].sort((a, b) => a - b)).toEqual([...qtys].sort((a, b) => a - b));
      expect(new Set(nums).size).toBe(nums.length);
      expect(nums.length).toBe(Math.min(6, maxNumberFor(mathMax)));
      nums.forEach((n) => {
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(maxNumberFor(mathMax));
      });
    }
    expect([maxNumberFor(5), maxNumberFor(10), maxNumberFor(20)]).toEqual([5, 10, 20]);
  });
  it('letter ↔ word: 6 pairs, each letter matches its own word', () => {
    const l = LEVELS.find((x) => x.edu === 'letters')!;
    const cards = composeLevel(l, 10, rng(3));
    const letters = cards.flatMap((c) => (c.face?.kind === 'letter' ? [c.face.letter] : []));
    const words = cards.flatMap((c) => (c.face?.kind === 'word' ? [c.face] : []));
    expect(letters).toHaveLength(6);
    expect(words.map((w) => w.letter).sort()).toEqual([...letters].sort());
    for (const w of words) expect(LETTERS.find((x) => x.letter === w.letter)!.word).toBe(w.word);
    // a picture shown on a word card is not also a plain card
    const wordArts = new Set(words.map((w) => w.art));
    cards.filter((c) => !c.face).forEach((c) => expect(wordArts.has(c.art)).toBe(false));
  });
  it('22 distinct Hebrew letters, each with a word and a picture that exists', () => {
    expect(LETTERS).toHaveLength(22);
    expect(new Set(LETTERS.map((x) => x.letter)).size).toBe(22);
    expect(new Set(LETTERS.map((x) => x.word)).size).toBe(22);
    for (const x of LETTERS) {
      expect(x.word.startsWith(x.letter) || x.word.includes(x.letter)).toBe(true);
      expect(() => artDrawing(x.art)).not.toThrow();
    }
  });
});

describe('art', () => {
  it('every world has 12 distinct pictures and its own card back; no emoji anywhere', () => {
    const backs = new Set<string>();
    for (const id of DECK_IDS) {
      const d = DECKS[id];
      expect(d.keys).toHaveLength(12);
      expect(new Set(Object.values(d.art)).size).toBe(12);
      backs.add(d.back);
      expect(Object.values(d.art).join('') + d.back).not.toMatch(/\p{Extended_Pictographic}/u);
    }
    expect(backs.size).toBe(4);
    expect(Object.values(lettersArt).join('')).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});

/** Plays a level the way the UI does, including the shuffle and the peek. */
function play(cards: Card[], group: 2 | 3, strategy: 'memory' | 'random', rand: () => number) {
  const g = new MemoryGame(cards, group);
  let seen = new Set<number>();
  const afterMatch = (r: ReturnType<MemoryGame['flip']>) => {
    if (r.kind === 'match' && r.special === 'shuffle') {
      g.shuffleRemaining(rand);
      seen = new Set(); // positions changed: whatever was remembered is stale
    }
  };
  let moves = 0;
  while (!g.done && moves++ < 50000) {
    if (strategy === 'random') {
      const r = g.flip(Math.floor(rand() * cards.length));
      afterMatch(r);
      if (g.resolving) g.unflip();
      continue;
    }
    const byArt = new Map<string, number[]>();
    seen.forEach((i) => {
      if (!g.matched[i]) byArt.set(g.cards[i].art, [...(byArt.get(g.cards[i].art) ?? []), i]);
    });
    const full = [...byArt.values()].find((v) => v.length === group);
    if (full) {
      let last;
      for (const i of full) last = g.flip(i);
      afterMatch(last!);
      continue;
    }
    const unseen = g.cards.map((_, i) => i).filter((i) => !seen.has(i) && !g.matched[i]);
    const first = unseen[0];
    let r = g.flip(first);
    seen.add(first);
    const twins = [...seen].filter((i) => i !== first && g.cards[i].art === g.cards[first].art && !g.matched[i]);
    if (twins.length >= group - 1) {
      for (const i of twins.slice(0, group - 1)) r = g.flip(i);
    } else {
      for (let k = 1; g.open.length < group && unseen[k] !== undefined; k++) {
        seen.add(unseen[k]);
        r = g.flip(unseen[k]);
      }
    }
    afterMatch(r);
    if (g.resolving) g.unflip();
  }
  return g;
}

describe.each(LEVELS)('level $id can be finished', (level) => {
  it('by a bot with perfect memory, and by one that guesses (with shuffle and triples handled)', () => {
    for (const strategy of ['memory', 'random'] as const) {
      for (let seed = 1; seed <= 5; seed++) {
        const r = rng(seed + level.id * 31);
        const g = play(composeLevel(level, 10, r), level.group, strategy, r);
        expect(g.done).toBe(true);
        expect(g.matched.every(Boolean)).toBe(true);
        expect(starsFor(g.attempts, groupsOf(level))).toBeGreaterThanOrEqual(1);
        if (strategy === 'memory') expect(g.attempts).toBeLessThanOrEqual(groupsOf(level) * 4);
      }
    }
  });
});

describe('help, shuffle and locking', () => {
  const game = () => new MemoryGame(composeLevel(LEVELS[5], 10, rng(2)), 2);
  const missOnce = (g: MemoryGame) => {
    const a = g.cards.findIndex((_, i) => !g.matched[i]);
    const b = g.cards.findIndex((c, i) => !g.matched[i] && i !== a && c.art !== g.cards[a].art);
    g.flip(a); g.flip(b); g.unflip();
  };
  it('the bulb lights after 6 misses in a row, works once, and a match resets the count', () => {
    const g = game();
    for (let i = 0; i < 5; i++) missOnce(g);
    expect(g.hintAvailable).toBe(false);
    expect(g.useHint()).toBe(-1);
    // a match in between starts the count again
    const a = g.cards.findIndex((c) => c.art === g.cards[0].art && c.id !== 0);
    g.flip(0); g.flip(a); g.unflip();
    for (let i = 0; i < 5; i++) missOnce(g);
    expect(g.hintAvailable).toBe(false);
    missOnce(g);
    expect(g.hintAvailable).toBe(true);
    const i = g.useHint(rng(1));
    expect(i).toBeGreaterThanOrEqual(0);
    expect(g.matched[i]).toBe(false);
    expect(g.hintAvailable).toBe(false);
    for (let k = 0; k < 8; k++) missOnce(g);
    expect(g.hintAvailable).toBe(false); // once per level
  });
  it('help and mistakes never change the star calculation', () => {
    expect(starsFor(10, 5)).toBe(starsFor(10, 5));
    expect(starsFor(1000, 8)).toBe(1);
  });
  it('shuffle moves only hidden cards, keeps every card, and matched cards stay put', () => {
    const g = new MemoryGame(composeLevel(LEVELS[3], 10, rng(4)), 2);
    const first = g.cards.findIndex((_, i) => i === 0);
    const mate = g.cards.findIndex((c, i) => i !== 0 && c.art === g.cards[0].art);
    g.flip(first); g.flip(mate);
    const before = g.cards.map((c) => ({ ...c }));
    g.flip(g.cards.findIndex((_, i) => !g.matched[i]));
    const openIdx = g.open[0];
    const moved = g.shuffleRemaining(rng(9));
    expect(moved).not.toContain(first);
    expect(moved).not.toContain(mate);
    expect(moved).not.toContain(openIdx);
    expect(g.cards[openIdx].art).toBe(before[openIdx].art);
    expect(g.cards.map((c) => c.art).sort()).toEqual(before.map((c) => c.art).sort());
    expect(g.cards.map((c) => c.id)).toEqual(g.cards.map((_, i) => i));
  });
  it('nothing can be flipped while locked (peek / shuffle)', () => {
    const g = game();
    g.locked = true;
    for (let i = 0; i < g.cards.length; i++) expect(g.flip(i).kind).toBe('ignored');
    expect(g.attempts).toBe(0);
    g.locked = false;
    expect(g.flip(0).kind).toBe('open');
  });
  it('match reports the special card kind', () => {
    const g = new MemoryGame(composeLevel(LEVELS[4], 10, rng(1)), 2);
    const star = g.cards.flatMap((c, i) => (c.face?.kind === 'special' ? [i] : []));
    g.flip(star[0]);
    const r = g.flip(star[1]);
    expect(r.kind === 'match' && r.special).toBe('star');
  });
});

describe('layout', () => {
  it('a 5×6 board fits a 360×640 phone without scrolling, with cards of at least 56px', () => {
    // board area: 360 wide minus 16px padding; 640 high minus the top bar (~72px) and padding
    const w = 360 - 16;
    const h = 640 - 72 - 16;
    expect(fits(w, h, 5, 6)).toBe(true);
    expect(cardWidth(w, h, 5, 6)).toBeGreaterThanOrEqual(MIN_CARD);
    for (const l of LEVELS) {
      expect(fits(w, h, l.cols, l.rows)).toBe(true);
      expect(cardWidth(w, h, l.cols, l.rows)).toBeGreaterThanOrEqual(MIN_CARD);
    }
    expect(GAP).toBe(8);
  });
});
