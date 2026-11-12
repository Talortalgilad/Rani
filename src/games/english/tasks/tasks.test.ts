import { describe, expect, it } from 'vitest';
import { SONGS } from '../content/songs';
import { pluralOf } from '../content/words';
import { beatMs, timeline } from './song';
import { placeOf } from './where';

describe('on / in / under', () => {
  const box = { left: 100, top: 100, right: 200, bottom: 200 };
  it('above the box is on, inside it is in, below it is under, far away is nothing', () => {
    expect(placeOf({ x: 150, y: 80 }, box)).toBe('on');
    expect(placeOf({ x: 150, y: 150 }, box)).toBe('in');
    expect(placeOf({ x: 150, y: 230 }, box)).toBe('under');
    expect(placeOf({ x: 400, y: 150 }, box)).toBeNull();
    expect(placeOf({ x: 150, y: 400 }, box)).toBeNull();
  });
});

describe('plurals for "Find all the ___" and "How many ___"', () => {
  it('regular, irregular and words that are already plural', () => {
    expect(pluralOf('ball')).toBe('balls');
    expect(pluralOf('dress')).toBe('dresses');
    expect(pluralOf('box')).toBe('boxes');
    expect(pluralOf('baby')).toBe('babies');
    expect(pluralOf('family')).toBe('families');
    expect(pluralOf('fish')).toBe('fish');
    expect(pluralOf('glasses')).toBe('glasses');
    expect(pluralOf('tv')).toBe('TVs');
    expect(pluralOf('icecream')).toBe('ice creams');
  });
});

describe('the songs', () => {
  it('every song of worlds 1-4 has a beat, lines of words, and pictures that exist', () => {
    for (const w of [1, 2, 3, 4]) {
      const s = SONGS[w];
      expect(s.bpm).toBeGreaterThan(60);
      expect(s.lines.length).toBeGreaterThanOrEqual(4);
      expect(s.lines.length).toBeLessThanOrEqual(6);
    }
  });
  it('one word per beat, in order, with a rest between lines', () => {
    const s = SONGS[1];
    const tl = timeline(s);
    const beat = beatMs(s.bpm);
    expect(tl).toHaveLength(s.lines.reduce((n, l) => n + l.length, 0));
    for (let i = 1; i < tl.length; i++) {
      const gap = tl[i].at - tl[i - 1].at;
      expect(gap).toBe(tl[i].line === tl[i - 1].line ? beat : 2 * beat);
    }
  });
});
