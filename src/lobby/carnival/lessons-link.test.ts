import { describe, expect, it } from 'vitest';
import { LESSONS } from '../../games/english/tutor/lessons';
import { lessonsByUnit, progressFromEnglish } from './unlocks';

describe('the units of Lolly in the carnival are read from her real lessons', () => {
  it('units 1-3 have their four lessons each, and a unit is done only when all of its lessons are', () => {
    const by = lessonsByUnit(LESSONS);
    expect(Object.keys(by).map(Number)).toEqual([1, 2, 3]);
    for (const u of [1, 2, 3]) expect(by[u]).toHaveLength(4);
    expect(progressFromEnglish({ tutor: { done: by[1] } }, by).units).toEqual([1]);
    expect(progressFromEnglish({ tutor: { done: by[1].slice(1) } }, by).units).toEqual([]);
  });
});
