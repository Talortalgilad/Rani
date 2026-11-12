import { describe, expect, it } from 'vitest';
import { imageUrl } from '../art/images';
import { BODY_REGIONS, partAt } from './body';
import { WORDS, WORLD_NAMES, artKey, wordsOfWorld } from './words';

const PICTURES = import.meta.glob('../../../../public/english/words/*.webp', { query: '?url', eager: false });
const BODY = import.meta.glob('../../../../public/english/body.webp', { query: '?url', eager: false });

describe('the words and their pictures', () => {
  it('108 words, nine in each of the 12 worlds, no word twice', () => {
    expect(WORDS).toHaveLength(108);
    for (let w = 1; w <= 12; w++) expect(wordsOfWorld(w), `world ${w}`).toHaveLength(9);
    expect(new Set(WORDS.map((w) => w.id)).size).toBe(108);
    expect(Object.keys(WORLD_NAMES)).toHaveLength(12);
  });
  it('every word has a Hebrew meaning', () => {
    for (const w of WORDS) expect(w.he.length, w.id).toBeGreaterThan(0);
  });
  it('every word has exactly one picture, and no picture is left over or used by two words', () => {
    const files = Object.keys(PICTURES).map((p) => p.split('/').pop()!).sort();
    const wanted = WORDS.map((w) => `${artKey(w.id)}.webp`).sort();
    expect(files).toEqual(wanted);
    expect(new Set(WORDS.map((w) => imageUrl(w.id))).size).toBe(108);
  });
  it('the picture of the body exists', () => {
    expect(Object.keys(BODY)).toHaveLength(1);
  });
});

describe('the body: where a finger lands', () => {
  it('every region is inside the picture', () => {
    for (const [part, boxes] of Object.entries(BODY_REGIONS)) {
      for (const [l, t, r, b] of boxes) {
        expect(l, part).toBeGreaterThanOrEqual(0);
        expect(t, part).toBeGreaterThanOrEqual(0);
        expect(r, part).toBeLessThanOrEqual(100);
        expect(b, part).toBeLessThanOrEqual(100);
        expect(r - l, part).toBeGreaterThan(5);
        expect(b - t, part).toBeGreaterThan(5);
      }
    }
  });
  it('the eyes win over the head, the hands over the arms, and a hit on nothing is nothing', () => {
    expect(partAt(50, 30)).toBe('eyes');
    expect(partAt(50, 38)).toBe('mouth');
    expect(partAt(50, 10)).toBe('head');
    expect(partAt(8, 50)).toBe('hands');
    expect(partAt(22, 50)).toBe('arms');
    expect(partAt(40, 92)).toBe('feet');
    expect(partAt(40, 83)).toBe('legs');
    expect(partAt(2, 2)).toBeNull();
  });
});
