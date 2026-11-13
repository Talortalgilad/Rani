import { describe, expect, it } from 'vitest';
import { heardWord, levenshtein, soundKey } from './say';

describe('"Say it!" matching', () => {
  it('exact, inside a sentence, and the common mistakes of Hebrew-speaking children', () => {
    expect(heardWord(['ball'], 'ball')).toBe(true);
    expect(heardWord(['the ball'], 'ball')).toBe(true);
    expect(heardWord(['Ball!'], 'ball')).toBe(true);
    expect(heardWord(['piza'], 'pizza')).toBe(true);
    expect(heardWord(['pitsa'], 'pizza')).toBe(true);
    expect(heardWord(['bik'], 'bike')).toBe(true);
    expect(heardWord(['dens'], 'dance')).toBe(true);
    expect(heardWord(['ice cream'], 'ice cream')).toBe(true);
  });
  it('any of the alternatives counts, and a different word does not', () => {
    expect(heardWord(['bell', 'ball'], 'ball')).toBe(true);
    expect(heardWord(['apple'], 'ball')).toBe(false);
    expect(heardWord(['elephant'], 'cat')).toBe(false);
    expect(heardWord([], 'ball')).toBe(false);
    expect(heardWord([''], 'ball')).toBe(false);
  });
  it('the helpers', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(soundKey('pizza')).toBe(soundKey('pitsa'));
  });
});
