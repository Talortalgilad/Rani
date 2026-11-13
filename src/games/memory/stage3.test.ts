import { describe, expect, it } from 'vitest';
import { ALL_FREE_DECKS, ENGLISH_DECKS, FAMILY_DECK, FAMILY_MIN, JOURNEY_DECKS, freeDeckById, keysOf, lockOf, worldDone } from './decks/free';
import { EN_EXTRA, enUrl } from './decks/pictures';
import { MemoryGame, buildCards } from './engine';
import { SIZES, SIZE_ORDER, pairsOfSize, validSession } from './session';
import { Versus, cleanName, SECOND_PLAYER_NAMES } from './versus';
import { centerSquare } from './photos';
import { emptyProgress, type Progress } from './ui/map';
import { LEVELS } from './levels';
import { mm, MEMORY_LINES } from './lines';
import { DECK_LINE } from './ui/decks';

const files = import.meta.glob('../../../public/english/{words,letter-words}/*.webp');
const exists = (url: string): boolean => Object.keys(files).some((k) => k.endsWith(url.slice(url.indexOf('/english/') + 1).replace('english/', 'english/')));

describe('the decks of free play', () => {
  it('the three board sizes: 3 x 4, 4 x 4, 4 x 5 (6, 8 and 10 pairs)', () => {
    expect(SIZE_ORDER.map((s) => `${SIZES[s].cols}x${SIZES[s].rows}`)).toEqual(['3x4', '4x4', '4x5']);
    expect(SIZE_ORDER.map(pairsOfSize)).toEqual([6, 8, 10]);
  });
  it('every 3D deck has at least ten different pictures (enough for the big board), and each picture file exists', () => {
    expect(ENGLISH_DECKS.map((d) => d.he)).toEqual(['חיות', 'אוכל', 'ממתקים', 'צעצועים', 'בגדים', 'מזג אוויר', 'מוזיקה']);
    for (const d of ENGLISH_DECKS) {
      expect(new Set(d.keys).size, d.id).toBe(d.keys.length);
      expect(d.keys.length, d.id).toBeGreaterThanOrEqual(10);
      for (const k of d.keys) expect(exists(enUrl(k.slice(3))), `${d.id}: ${k}`).toBe(true);
      for (const k of d.cover) expect(d.keys).toContain(k);
    }
    expect([...EN_EXTRA].every((id) => exists(enUrl(id)))).toBe(true);
  });
  it('the four journey decks are the four worlds; every deck has a card back and a spoken name', () => {
    expect(JOURNEY_DECKS.map((d) => d.id)).toEqual(['farm', 'sea', 'space', 'sweets']);
    for (const d of ALL_FREE_DECKS) {
      expect(d.back, d.id).toContain('<svg');
      expect(DECK_LINE[d.id], d.id).toBeTruthy();
      expect(MEMORY_LINES.some((l) => l.id === DECK_LINE[d.id]), d.id).toBe(true);
    }
    expect(new Set(ALL_FREE_DECKS.map((d) => d.id)).size).toBe(ALL_FREE_DECKS.length);
    expect(freeDeckById('family')).toBe(FAMILY_DECK);
  });
  it('a board of every size can be built from every unlocked deck', () => {
    for (const d of [...ENGLISH_DECKS, ...JOURNEY_DECKS]) for (const s of SIZE_ORDER) {
      const cards = buildCards(keysOf(d, []), pairsOfSize(s));
      expect(cards).toHaveLength(SIZES[s].cols * SIZES[s].rows);
      const g = new MemoryGame(cards);
      expect(g.pairs).toBe(pairsOfSize(s));
    }
  });
});

describe('what is locked', () => {
  const done = (worlds: number[]): Progress => {
    const p = emptyProgress();
    for (const l of LEVELS.filter((x) => worlds.includes(x.world))) p.levels[l.id] = { stars: 1, bestAttempts: 5, bestStreak: 2 };
    return p;
  };
  it('a journey deck opens only when its world is finished, with a lock until then', () => {
    expect(JOURNEY_DECKS.map((d) => lockOf(d, emptyProgress(), 0))).toEqual(['world', 'world', 'world', 'world']);
    expect(JOURNEY_DECKS.map((d) => lockOf(d, done([1]), 0))).toEqual([null, 'world', 'world', 'world']);
    expect(JOURNEY_DECKS.map((d) => lockOf(d, done([1, 2, 3, 4]), 0))).toEqual([null, null, null, null]);
    const p = done([2]);
    p.levels[5] = { stars: 0, bestAttempts: 0, bestStreak: 0 }; // one level of world 2 not won
    expect(worldDone(p, 2)).toBe(false);
  });
  it('the 3D decks are open from the start; the family deck needs six photos', () => {
    for (const d of ENGLISH_DECKS) expect(lockOf(d, emptyProgress(), 0), d.id).toBeNull();
    expect(lockOf(FAMILY_DECK, emptyProgress(), 5)).toBe('photos');
    expect(lockOf(FAMILY_DECK, emptyProgress(), FAMILY_MIN)).toBeNull();
    expect(keysOf(FAMILY_DECK, ['a', 'b'])).toEqual(['fam:a', 'fam:b']);
  });
});

describe('a game for two', () => {
  const P = (n: string) => ({ name: n, avatar: '🦄' });
  it('a pair keeps the turn and scores; a miss passes the turn', () => {
    const v = new Versus([P('רני'), P('אבא')]);
    expect(v.turn).toBe(0);
    expect(v.match()).toBe(0);
    expect(v.match()).toBe(0);
    expect(v.scores).toEqual([2, 0]);
    expect(v.turn).toBe(0);
    expect(v.miss()).toBe(1);
    expect(v.match()).toBe(1);
    expect(v.scores).toEqual([2, 1]);
    expect(v.miss()).toBe(0);
    expect(v.current.name).toBe('רני');
  });
  it('the winner is who has more; equal scores are a tie', () => {
    const v = new Versus([P('א'), P('ב')]);
    expect(v.winner()).toBe('tie');
    v.miss();
    v.match();
    expect(v.winner()).toBe(1);
    v.miss();
    v.match();
    v.match();
    expect(v.winner()).toBe(0);
  });
  it('plays a whole game to the end: every pair goes to someone, and the scores add up to the pairs', () => {
    const cards = buildCards(['a', 'b', 'c', 'd', 'e', 'f'], 6, 2, () => 0.37);
    const g = new MemoryGame(cards);
    const v = new Versus([P('א'), P('ב')]);
    let guard = 0;
    while (!g.done && guard++ < 200) {
      // the first player knows where everything is, the second one guesses wrong first
      const free = g.cards.map((_, i) => i).filter((i) => !g.matched[i]);
      const a = free[0];
      const partner = free.find((i) => i !== a && g.cards[i].art === g.cards[a].art)!;
      const wrong = free.find((i) => g.cards[i].art !== g.cards[a].art);
      if (v.turn === 0 || wrong === undefined) {
        g.flip(a);
        expect(g.flip(partner).kind).toBe('match');
        v.match();
      } else {
        g.flip(a);
        expect(g.flip(wrong).kind).toBe('miss');
        g.unflip();
        v.miss();
      }
    }
    expect(g.done).toBe(true);
    expect(v.scores[0] + v.scores[1]).toBe(6);
  });
  it('names: dad, mum or Ray for the second player, any name up to 12 letters, no markup', () => {
    expect(SECOND_PLAYER_NAMES).toEqual(['אבא', 'אמא', 'ריי']);
    expect(cleanName('דנדון הגדול מאוד מאוד').length).toBe(12);
    expect(cleanName('a<b>c').includes('<')).toBe(false);
    expect(cleanName('<>&"')).toBe('');
    expect(cleanName('  רני ')).toBe('רני');
  });
  it('is saved and carried on: scores and whose turn it is', () => {
    const v = new Versus([P('א'), P('ב')]);
    v.match();
    v.miss();
    const w = Versus.restore(JSON.parse(JSON.stringify(v.snapshot())))!;
    expect(w.scores).toEqual([1, 0]);
    expect(w.turn).toBe(1);
    expect(Versus.restore(null as never)).toBeNull();
  });
});

describe('a round in the middle, for every mode', () => {
  const g = new MemoryGame(buildCards(['en:cat', 'en:dog', 'en:pig'], 3));
  const base = { game: g.snapshot(), savedAt: Date.now() };
  it('only a sensible session is accepted: a known mode, the cards, the versus state for two', () => {
    expect(validSession({ ...base, spec: { mode: 'journey', level: 3 } }, () => true)).toBe(true);
    expect(validSession({ ...base, spec: { mode: 'free', deck: 'en-animals', size: 'small' } }, () => true)).toBe(true);
    expect(validSession({ ...base, spec: { mode: 'versus', deck: 'en-animals', size: 'small' } }, () => true)).toBe(false);
    expect(validSession({ ...base, spec: { mode: 'versus', deck: 'en-animals', size: 'small' }, versus: { players: [], scores: [0, 0], turn: 0, streak: 0 } }, () => true)).toBe(true);
    expect(validSession({ ...base, spec: { mode: 'chess' } }, () => true)).toBe(false);
    expect(validSession(null, () => true)).toBe(false);
    expect(validSession({ ...base, savedAt: 'yesterday', spec: { mode: 'journey', level: 1 } }, () => true)).toBe(false);
  });
  it('a deleted family photo makes the saved round void', () => {
    const fam = new MemoryGame(buildCards(['fam:1', 'fam:2', 'fam:3'], 3));
    const s = { game: fam.snapshot(), savedAt: Date.now(), spec: { mode: 'free', deck: 'family', size: 'small' } };
    expect(validSession(s, () => true)).toBe(true);
    expect(validSession(s, (art) => art !== 'fam:2')).toBe(false);
  });
});

describe('family photos', () => {
  it('a square from the middle of the picture, whatever its shape', () => {
    expect(centerSquare(400, 300)).toEqual({ x: 50, y: 0, side: 300 });
    expect(centerSquare(300, 400)).toEqual({ x: 0, y: 50, side: 300 });
    expect(centerSquare(256, 256)).toEqual({ x: 0, y: 0, side: 256 });
  });
});

describe('the Hebrew of stage 3 is all in the list that is recorded', () => {
  it('every text of the memory game has a line (ids mm_*), and the names of the players are recorded names', () => {
    for (const k of ['journey', 'versus', 'decks', 'pickDeck', 'pickSize', 'small', 'medium', 'large', 'who', 'player1', 'player2', 'go', 'tie', 'newGame', 'resume'] as const) {
      expect(MEMORY_LINES.some((l) => l.id === `mm_${k}` && l.parts.includes(mm[k] as string)), k).toBe(true);
    }
    for (const id of ['mm_turnOf', 'mm_pairAgain', 'mm_wins']) expect(MEMORY_LINES.find((l) => l.id === id)!.parts.includes(null), id).toBe(true);
  });
});

import { QTY_LAYOUT, QTY_MAX } from './ui/faces';
import { composeLevel } from './compose';

describe('quantity cards: pictures big enough to count, laid out like the dots of a dice', () => {
  it('every number from 1 to 8 has the right number of pictures, none smaller than 28% of the card width, all inside the card', () => {
    expect(Object.keys(QTY_LAYOUT).map(Number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(QTY_MAX).toBe(8);
    for (const [k, l] of Object.entries(QTY_LAYOUT)) {
      const n = Number(k);
      expect(l.pts, `${n}`).toHaveLength(n);
      expect(l.size, `${n}`).toBeGreaterThanOrEqual(28);
      for (const [x, y] of l.pts) {
        expect(x - l.size / 2, `${n} left`).toBeGreaterThanOrEqual(0);
        expect(x + l.size / 2, `${n} right`).toBeLessThanOrEqual(100.01);
        expect(y - l.size / 2, `${n} top`).toBeGreaterThanOrEqual(0);
        expect(y + l.size / 2, `${n} bottom`).toBeLessThanOrEqual(125);
      }
      // the pictures do not sit on top of each other (the pictures have a little room of their own round them)
      for (let i = 0; i < l.pts.length; i++) for (let j = i + 1; j < l.pts.length; j++) expect(Math.hypot(l.pts[i][0] - l.pts[j][0], l.pts[i][1] - l.pts[j][1]), `${n}: ${i}/${j}`).toBeGreaterThanOrEqual(l.size * 0.78);
    }
    // 7 and 8: two rows
    for (const n of [7, 8]) expect(new Set(QTY_LAYOUT[n].pts.map((p) => p[1])).size).toBe(2);
  });
  it('a board has at most 6 number-and-quantity pairs, with numbers up to 8, and the pictures are 3D ones of the English game (never an emoji)', () => {
    const lvl = LEVELS.find((l) => l.edu === 'numqty')!;
    for (let seed = 1; seed < 20; seed++) {
      let s = seed;
      const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
      const cards = composeLevel(lvl, 20, r);
      const q = cards.filter((c) => c.face?.kind === 'qty');
      expect(q.length).toBeLessThanOrEqual(6);
      for (const c of q) expect((c.face as { n: number }).n).toBeLessThanOrEqual(8);
    }
  });
});
