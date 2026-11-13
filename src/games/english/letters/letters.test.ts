import { describe, expect, it } from 'vitest';
import { buildTiles, blendTimeline } from './blend';
import { ISLANDS, LETTERS, WORD_EMOJI, islandInfo, lettersUpTo, soundsOf } from './journey';
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
        const letters = w === 'quiz' ? ['q', 'u', 'i', 'z'] : soundsOf(w);
        for (const l of letters) expect(known.has(l), `${w}: ${l} on island ${isl.n}`).toBe(true);
        expect(WORD_EMOJI[w], w).toBeTruthy();
      }
    }
    expect(islandInfo(1).words.slice(0, 3)).toEqual(['sat', 'tap', 'pat']);
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
