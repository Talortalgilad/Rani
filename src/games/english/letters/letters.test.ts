import { describe, expect, it } from 'vitest';
import { buildTiles, blendTimeline } from './blend';
import { ISLANDS, LETTERS, islandInfo, lettersUpTo, soundsOf } from './journey';
import { buildableWords, hasPicture } from './art';
import { STROKES, hasStrokes, type Stroke } from './strokes';
import { TOLERANCE, evaluateStroke, lengthOf, resample } from './trace';
import { WORDS } from '../content/words';

const jitter = (s: Stroke, amp: number, seed = 1): Stroke => {
  let x = seed;
  const r = (): number => ((x = (x * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff - 0.5) * 2 * amp;
  return s.map((p) => ({ x: p.x + r(), y: p.y + r() }));
};

describe('the journey', () => {
  it('26 letters, each once, six islands that together teach every letter', () => {
    expect(LETTERS).toHaveLength(26);
    expect(new Set(LETTERS.map((l) => l.id)).size).toBe(26);
    expect(ISLANDS.flatMap((i) => i.letters).sort().join('')).toBe('abcdefghijklmnopqrstuvwxyz');
  });
  it('every word of an island can be built from its letters and the earlier ones (SPEC-letters.md section 2)', () => {
    for (const isl of ISLANDS) {
      const known = new Set(lettersUpTo(isl.n));
      for (const w of isl.words) {
        const letters = soundsOf(w);
        for (const l of letters) expect(known.has(l), `${w}: ${l} on island ${isl.n}`).toBe(true);
      }
    }
    expect(islandInfo(1).words).toEqual(['tap', 'sat', 'pat']);
    expect(islandInfo(2).words).toEqual(['pan', 'pin', 'map', 'mat', 'man', 'tin', 'nap']);
  });
  it('the example word of every letter starts with it (qu for q), and island 1 uses pictures that exist', () => {
    for (const l of LETTERS) expect(l.id === 'x' ? l.word.includes('x') : l.word[0], l.id).toBe(l.id === 'x' ? true : l.id); // x is at the end of fox
    const have = new Set(WORDS.map((w) => w.id));
    for (const id of ['s', 'a', 't', 'p']) expect(have.has(LETTERS.find((l) => l.id === id)!.word), id).toBe(true);
  });
});

describe('writing a letter with the finger', () => {
  const s = STROKES.s.lower[0];
  it('a perfect line works, for every stroke of the letters that are ready', () => {
    for (const id of ['s', 'a', 't', 'p']) for (const g of [STROKES[id].lower, STROKES[id].upper]) for (const st of g) expect(evaluateStroke(st, st).ok, id).toBe(true);
  });
  it('a shaky line (a few units off, and fewer points) still works', () => {
    for (let seed = 1; seed < 20; seed++) expect(evaluateStroke(s, jitter(resample(s, 30), 4, seed)).ok, `seed ${seed}`).toBe(true);
    expect(evaluateStroke(s, jitter(resample(s, 12), 6, 3)).ok).toBe(true);
  });
  it('the wrong direction fails', () => {
    for (const id of ['s', 'a', 't', 'p']) {
      const st = STROKES[id].lower[0];
      expect(evaluateStroke(st, [...st].reverse()).ok, id).toBe(false);
    }
  });
  it('another stroke instead of the one that is asked for (skipping a stroke) fails', () => {
    const [bowl, stem] = STROKES.a.lower;
    expect(evaluateStroke(bowl, stem).ok).toBe(false);
    expect(evaluateStroke(stem, bowl).ok).toBe(false);
    const [stemT, bar] = STROKES.t.lower;
    expect(evaluateStroke(stemT, bar).ok).toBe(false);
  });
  it('a line that covers only part of the stroke, one far away, and a scribble fail', () => {
    expect(evaluateStroke(s, resample(s, 40).slice(0, 20)).ok).toBe(false);
    expect(evaluateStroke(s, jitter(resample(s, 30), 0).map((p) => ({ x: p.x + 40, y: p.y }))).ok).toBe(false);
    const scribble: Stroke = Array.from({ length: 200 }, (_, i) => ({ x: 20 + (i % 2) * 60, y: 10 + (i * 0.45) }));
    expect(evaluateStroke(s, scribble).ok).toBe(false);
    expect(evaluateStroke(s, [{ x: 1, y: 1 }]).ok).toBe(false);
  });
  it('every ready letter has strokes, in the box, and a tolerance of 12', () => {
    expect(TOLERANCE).toBe(12);
    for (const id of ['s', 'a', 't', 'p']) {
      expect(hasStrokes(id)).toBe(true);
      for (const g of [...STROKES[id].lower, ...STROKES[id].upper]) {
        expect(lengthOf(g)).toBeGreaterThan(20);
        for (const p of g) (expect(p.x).toBeGreaterThanOrEqual(0), expect(p.x).toBeLessThanOrEqual(100), expect(p.y).toBeGreaterThanOrEqual(0), expect(p.y).toBeLessThanOrEqual(100));
      }
    }
  });
  it('resampling gives evenly spread points, ends included', () => {
    const r = resample([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], 5);
    expect(r[0]).toEqual({ x: 0, y: 0 });
    expect(r[4].x).toBeCloseTo(10);
    expect(r[4].y).toBeCloseTo(10);
    expect(r[2].x).toBeCloseTo(10, 0);
  });
});

describe('building words', () => {
  it('the sounds come one after the other, then the word', () => {
    const t = blendTimeline('sat');
    expect(t.map((x) => x.kind)).toEqual(['sound', 'sound', 'sound', 'word']);
    expect(t.filter((x) => x.kind === 'sound').map((x) => x.letter)).toEqual(['s', 'a', 't']);
    expect(t[1].at).toBeGreaterThan(t[0].at);
  });
  it('the tiles have the letters of the word and two more from the pool, never in the word order', () => {
    let n = 7;
    const pick = (m: number): number => ((n = (n * 31 + 11) % 1000), n % m);
    for (let i = 0; i < 30; i++) {
      const tiles = buildTiles('sat', ['s', 'a', 't', 'p', 'i', 'n'], pick);
      expect(tiles).toHaveLength(5);
      for (const l of 'sat') expect(tiles).toContain(l);
      expect(tiles.filter((x) => 'pin'.includes(x))).toHaveLength(2);
      expect(tiles.slice(0, 3).join('')).not.toBe('sat');
    }
  });
});

import { WORDS as ALLWORDS } from '../content/words';
import { LETTER_PICTURES, knownFor, learnedBefore, planLetterStation } from './plan';
import { soundClips } from '../content/heLines';

describe('planning a station of letters', () => {
  const ids = new Set(ALLWORDS.map((w) => w.id));
  it('every letter station has the six tasks, in order, about its letter', () => {
    for (let station = 0; station < 4; station++) {
      for (const seed of [1, 2, 3]) {
        const L = ISLANDS[0].letters[station];
        const steps = planLetterStation({ island: 1, station, learned: learnedBefore(1, station), seed });
        expect(steps.map((s) => s.kind)).toEqual(['lmeet', 'ltrace', 'lsound', 'lfirst', 'lcase', 'lhunt']);
        const sound = steps[2] as { options: string[]; letter: string };
        expect(sound.letter).toBe(L);
        expect(sound.options).toContain(L);
        expect(new Set(sound.options).size).toBe(3);
        const first = steps[3] as { ids: string[]; letter: string };
        expect(first.ids[0]).toBe(LETTERS.find((l) => l.id === L)!.word);
        for (const w of first.ids) expect(ids.has(w), w).toBe(true);
        // no other picture of a word that starts with the sound
        for (const w of first.ids.slice(1)) expect(w[0], w).not.toBe(L);
        const cs = steps[4] as { letters: string[] };
        expect(cs.letters).toContain(L);
        expect(new Set(cs.letters).size).toBe(cs.letters.length);
        const hunt = steps[5] as { pool: string[] };
        for (const l of hunt.pool) expect(knownFor(1, station, learnedBefore(1, station)), l).toContain(l);
      }
    }
  });
  it('the words station builds sat, tap and pat (one letter missing first, then whole) and reads them', () => {
    const steps = planLetterStation({ island: 1, station: 4, learned: learnedBefore(1, 4), seed: 3 });
    expect(steps.map((s) => s.kind)).toEqual(['lbuild', 'lbuild', 'lbuild', 'lbuild', 'lread', 'lread']);
    const built = steps.filter((s) => s.kind === 'lbuild') as { word: string; missing: number | null }[];
    expect(built[0].missing).not.toBeNull();
    expect(built[2].missing).toBeNull();
    for (const b of built) expect(ISLANDS[0].words).toContain(b.word);
    for (const r of steps.filter((s) => s.kind === 'lread') as { word: string; options: string[] }[]) {
      expect(r.options).toContain(r.word);
      expect(new Set(r.options).size).toBe(3);
    }
  });
  it('the pictures it may show exist, and the sounds of the studio are the 26 letters and qu', () => {
    for (const w of LETTER_PICTURES) expect(ids.has(w), w).toBe(true);
    const s = soundClips();
    expect(s).toHaveLength(27);
    expect(s[s.length - 1].id).toBe('sound_qu');
    expect(new Set(s.map((c) => c.id)).size).toBe(27);
  });
});

import { huntSpots } from './tasks/hunt';
describe('the hunt for letters', () => {
  it('twelve tap areas never touch each other (a tile is 86 x 96 px on a stage of 380 x 520 or more)', () => {
    for (let seed = 1; seed < 60; seed++) {
      const sp = huntSpots(12, 3, seed);
      for (let i = 0; i < sp.length; i++)
        for (let j = i + 1; j < sp.length; j++) {
          const dx = Math.abs(sp[i][0] - sp[j][0]) * 380;
          const dy = Math.abs(sp[i][1] - sp[j][1]) * 520;
          expect(dx >= 90 || dy >= 100, `seed ${seed}: ${i}/${j}`).toBe(true);
        }
    }
  });
});

describe('words to build have a picture', () => {
  it('only words with a picture are offered for building, and a words station always has three', () => {
    for (const isl of ISLANDS) {
      const ws = buildableWords(isl.n);
      expect(ws.length, `island ${isl.n}`).toBeGreaterThanOrEqual(2);
      for (const w of ws) expect(hasPicture(w), w).toBe(true);
    }
    const steps = planLetterStation({ island: 3, station: 4, learned: [], seed: 2 });
    for (const s of steps) if (s.kind === 'lbuild' || s.kind === 'lread') expect(hasPicture(s.word), s.word).toBe(true);
  });
  it('the pictures of the sheets are all there: every island has its words, and every letter has its example word', () => {
    for (const isl of ISLANDS) for (const w of isl.words) expect(hasPicture(w), `${isl.n}: ${w}`).toBe(true);
    for (const l of LETTERS) expect(hasPicture(l.word), l.word).toBe(true);
    expect(hasPicture('sap')).toBe(false); // not a word of the journey
    expect(buildableWords(1)).toEqual(['tap', 'sat', 'pat']);
    expect(buildableWords(2)).toEqual(['pan', 'pin', 'map', 'mat', 'man', 'tin', 'nap']);
  });
});

import { BD_ISLAND, SQUISHY_LETTER, islandDone, islandOpen, stationKind, stationOpenL, stationsOf } from './progress';
import { emptyMap, finishStation } from '../engine/progress';

describe('all six islands', () => {
  it('every letter can be written: both shapes, strokes in the box, a perfect line works, the wrong way round does not', () => {
    for (const l of LETTERS) {
      expect(hasStrokes(l.id), l.id).toBe(true);
      for (const g of [STROKES[l.id].lower, STROKES[l.id].upper]) {
        expect(g.length, l.id).toBeGreaterThan(0);
        for (const st of g) {
          for (const p of st) (expect(p.x).toBeGreaterThanOrEqual(0), expect(p.x).toBeLessThanOrEqual(100), expect(p.y).toBeGreaterThanOrEqual(0), expect(p.y).toBeLessThanOrEqual(100));
          expect(evaluateStroke(st, st).ok, `${l.id} perfect`).toBe(true);
          if (lengthOf(st) > 20) expect(evaluateStroke(st, [...st].reverse()).ok, `${l.id} reversed`).toBe(false);
        }
      }
    }
  });
  it('the dot of i and j is written with a tap, and a tap far from it is not', () => {
    const dot = STROKES.i.lower[1];
    expect(evaluateStroke(dot, [dot[0]]).ok).toBe(true);
    expect(evaluateStroke(dot, [{ x: dot[0].x + 5, y: dot[0].y + 4 }]).ok).toBe(true);
    expect(evaluateStroke(dot, [{ x: 80, y: 80 }]).ok).toBe(false);
  });
  it('islands: stations of letters, b and d review only on island 4, then the words station; they open one after the other', () => {
    expect(ISLANDS.map((i) => stationsOf(i.n))).toEqual([5, 5, 5, 7, 6, 5]);
    expect(stationKind(4, 5)).toBe('bd');
    expect(stationKind(4, 6)).toBe('words');
    expect(stationKind(1, 4)).toBe('words');
    expect(BD_ISLAND).toBe(4);
    expect(islandOpen(emptyMap(), 1)).toBe(true);
    expect(islandOpen(emptyMap(), 2)).toBe(false);
    let m = emptyMap();
    for (let s = 0; s < 5; s++) m = finishStation(m, 1, s, 3);
    expect(islandDone(m, 1)).toBe(true);
    expect(islandOpen(m, 2)).toBe(true);
    expect(stationOpenL(m, 2, 1)).toBe(false);
    expect(stationOpenL(emptyMap(), 6, 0, true)).toBe(true);
    expect(Object.values(SQUISHY_LETTER).join('')).toBe('smgrfz');
  });
  it('every station of every island plans: letter stations with their letter, the b and d station, the words station', () => {
    for (const isl of ISLANDS) {
      for (let station = 0; station < stationsOf(isl.n); station++) {
        for (const seed of [1, 2]) {
          const steps = planLetterStation({ island: isl.n, station, learned: learnedBefore(isl.n, station), seed });
          expect(steps.length, `${isl.n}-${station}`).toBeGreaterThanOrEqual(5);
          const k = stationKind(isl.n, station);
          if (k === 'letter') {
            expect(steps.some((s) => s.kind === 'ltrace' && s.letter === isl.letters[station])).toBe(true);
            const hunt = steps.find((s) => s.kind === 'lhunt') as { pool: string[] };
            for (const l of hunt.pool) expect(lettersUpTo(isl.n)).toContain(l);
          }
          if (k === 'bd') expect(steps[0].kind).toBe('lbd');
          if (k === 'words') expect(steps.filter((s) => s.kind === 'lbuild').length).toBeGreaterThan(0);
        }
      }
    }
  });
  it('b and d review: each of them is asked as a sound, a first sound and a hunt, and ball and dog are side by side', () => {
    const steps = planLetterStation({ island: 4, station: 5, learned: learnedBefore(4, 5), seed: 1 });
    for (const l of ['b', 'd']) {
      expect(steps.some((s) => s.kind === 'lsound' && s.letter === l)).toBe(true);
      expect(steps.some((s) => s.kind === 'lhunt' && s.letter === l)).toBe(true);
      const f = steps.find((s) => s.kind === 'lfirst' && s.letter === l) as { ids: string[] };
      expect(f.ids).toEqual(expect.arrayContaining(['ball', 'dog']));
    }
  });
});

describe('the capital M and N start from the top (SPEC: how they are taught at school)', () => {
  const top = (st: Stroke): number => st[0].y;
  it('M: the left line down, the diagonal from the top left to the middle, from there to the top right, the right line down', () => {
    const m = STROKES.m.upper;
    expect(m).toHaveLength(4);
    expect(top(m[0])).toBe(10);
    expect(m[0][m[0].length - 1].y).toBe(75);
    expect(m[1][0]).toEqual({ x: 30, y: 10 });
    expect(m[1][m[1].length - 1]).toEqual({ x: 50, y: 50 });
    expect(m[2][0]).toEqual({ x: 50, y: 50 });
    expect(m[2][m[2].length - 1]).toEqual({ x: 70, y: 10 });
    expect(top(m[3])).toBe(10);
    expect(m[3][m[3].length - 1].y).toBe(75);
    // writing it from the bottom (the old way) is no longer right
    expect(evaluateStroke(m[0], [...m[0]].reverse()).ok).toBe(false);
  });
  it('N: the left line down, the diagonal from the top left to the bottom right, the right line up', () => {
    const n = STROKES.n.upper;
    expect(n).toHaveLength(3);
    expect(top(n[0])).toBe(10);
    expect(n[0][n[0].length - 1].y).toBe(75);
    expect(n[1][0]).toEqual({ x: 34, y: 10 });
    expect(n[1][n[1].length - 1]).toEqual({ x: 66, y: 75 });
    expect(n[2][0].y).toBe(75);
    expect(n[2][n[2].length - 1].y).toBe(10);
    // the right line written downwards fails, and so does starting the left line at the bottom
    expect(evaluateStroke(n[2], [...n[2]].reverse()).ok).toBe(false);
    expect(evaluateStroke(n[0], [...n[0]].reverse()).ok).toBe(false);
  });
});
