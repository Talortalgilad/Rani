import { describe, expect, it } from 'vitest';
import { WORDS, wordsOfWorld } from '../content/words';
import { colorById } from '../content/colors';
import { SONGS } from '../content/songs';
import { PAINT } from '../content/paint';
import { OBSTACLES, kindsForWorld, planStation } from './planner';
import { review, type Words } from './progress';

const T = 20000;
const ids = new Set(WORDS.map((w) => w.id));
const tasksOf = (steps: ReturnType<typeof planStation>) => steps.filter((s) => s.kind !== 'card' && s.kind !== 'colorcard' && s.kind !== 'song');

function check(steps: ReturnType<typeof planStation>, world: number): void {
  for (const s of steps) {
    switch (s.kind) {
      case 'card': expect(ids.has(s.word), s.word).toBe(true); break;
      case 'colorcard': expect(colorById(s.color).id).toBe(s.color); break;
      case 'circle': case 'tap': case 'listen':
        expect(s.ids).toContain(s.right);
        expect(new Set(s.ids).size).toBe(3);
        s.ids.forEach((i) => expect(ids.has(i), i).toBe(true));
        break;
      case 'put': expect(s.others).not.toContain(s.right); expect(new Set([s.right, ...s.others]).size).toBe(3); break;
      case 'match': expect(new Set(s.ids).size).toBe(3); break;
      case 'find': expect(s.others).not.toContain(s.right); expect(s.count).toBeGreaterThanOrEqual(2); break;
      case 'color': colorById(s.color); expect(PAINT.map((x) => x.id)).toContain(s.object); break;
      case 'count': expect(s.n).toBeGreaterThanOrEqual(2); expect(s.n).toBeLessThanOrEqual(5); break;
      case 'sentence': expect(s.words.length).toBeGreaterThanOrEqual(2); expect(s.words.length).toBeLessThanOrEqual(4); expect(s.missing).toBeLessThan(s.words.length); break;
      case 'where': expect(s.item).toBe('ninja'); expect(Object.keys(OBSTACLES)).toContain(s.ref); expect(OBSTACLES[s.ref]).toContain(s.prep); break;
      default: break;
    }
  }
  const kinds = new Set(tasksOf(steps).map((s) => s.kind));
  for (const k of kinds) expect(kindsForWorld(world), `${k} in world ${world}`).toContain(k);
}

describe('planning a station', () => {
  it('every station of every world is valid: 4-6 tasks, pictures that exist, kinds that the world brings', () => {
    for (let world = 1; world <= 12; world++) {
      for (let station = 0; station < 5; station++) {
        for (const seed of [1, 2, 3]) {
          const steps = planStation({ world, station, words: {}, today: T, seed });
          const n = tasksOf(steps).length;
          expect(n, `${world}-${station}`).toBeGreaterThanOrEqual(4);
          expect(n, `${world}-${station}`).toBeLessThanOrEqual(6);
          check(steps, world);
        }
      }
    }
  });
  it('the first three stations bring three new words each, as cards; the review station none', () => {
    const w1 = wordsOfWorld(1).map((w) => w.id);
    for (let s = 0; s < 3; s++) {
      const cards = planStation({ world: 1, station: s, words: {}, today: T, seed: 1 }).filter((x) => x.kind === 'card').map((x) => (x as { word: string }).word);
      expect(cards).toEqual(w1.slice(s * 3, s * 3 + 3));
    }
    expect(planStation({ world: 1, station: 3, words: {}, today: T, seed: 1 }).some((x) => x.kind === 'card')).toBe(false);
  });
  it('a word whose card was seen does not get its card again', () => {
    let words: Words = {};
    for (const id of wordsOfWorld(1).slice(0, 3).map((w) => w.id)) words = review(words, id, true, T);
    expect(planStation({ world: 1, station: 0, words, today: T, seed: 1 }).some((x) => x.kind === 'card')).toBe(false);
  });
  it('about 60% of the tasks are about the new words and 40% about words that are due', () => {
    let words: Words = {};
    for (const id of wordsOfWorld(1).slice(0, 3).map((w) => w.id)) words = review(words, id, false, T - 5); // went wrong: due again
    const steps = tasksOf(planStation({ world: 1, station: 1, words, today: T, seed: 4 }));
    const fresh = new Set(wordsOfWorld(1).slice(3, 6).map((w) => w.id));
    const about = (s: (typeof steps)[number]): string => ('right' in s ? s.right : 'item' in s ? s.item : 'object' in s ? s.object : s.score[0]);
    const nNew = steps.filter((s) => fresh.has(about(s))).length;
    expect(nNew).toBe(3);
    expect(steps.length - nNew).toBe(2);
  });
  it('the kinds vary: three or more different ones in a station, never the same twice in a row', () => {
    for (let world = 2; world <= 12; world++) {
      const steps = tasksOf(planStation({ world, station: 3, words: {}, today: T, seed: 5 }));
      expect(new Set(steps.map((s) => s.kind)).size, `world ${world}`).toBeGreaterThanOrEqual(3);
      for (let i = 1; i < steps.length; i++) expect(steps[i].kind, `world ${world}`).not.toBe(steps[i - 1].kind);
    }
  });
  it('the worlds bring their kinds in order: find from 2, colour from 4, counting from 5, sentences from 6, on/in/under and big/small from 11', () => {
    expect(kindsForWorld(1)).not.toContain('find');
    expect(kindsForWorld(2)).toContain('find');
    expect(kindsForWorld(3)).not.toContain('color');
    expect(kindsForWorld(4)).toContain('color');
    expect(kindsForWorld(4)).not.toContain('count');
    expect(kindsForWorld(5)).toContain('count');
    expect(kindsForWorld(6)).toContain('sentence');
    expect(kindsForWorld(10)).not.toContain('where');
    expect(kindsForWorld(11)).toEqual(expect.arrayContaining(['where', 'bigsmall']));
    expect(kindsForWorld(12)).not.toContain('say');
  });
  it('colours in world 4: three cards at the second station and three at the third, and colour tasks only after they were met', () => {
    const s1 = planStation({ world: 4, station: 1, words: {}, today: T, seed: 1 }).filter((x) => x.kind === 'colorcard').map((x) => (x as { color: string }).color);
    const s2 = planStation({ world: 4, station: 2, words: {}, today: T, seed: 1 }).filter((x) => x.kind === 'colorcard').map((x) => (x as { color: string }).color);
    expect(s1).toEqual(['red', 'blue', 'yellow']);
    expect(s2).toEqual(['pink', 'purple', 'green']);
    for (let seed = 1; seed <= 6; seed++) expect(planStation({ world: 4, station: 0, words: {}, today: T, seed }).some((x) => x.kind === 'color')).toBe(false);
  });
  it('the rescue station ends with the song of the world', () => {
    for (const world of [1, 2, 3, 4]) {
      const steps = planStation({ world, station: 4, words: {}, today: T, seed: 1 });
      expect(steps[steps.length - 1]).toMatchObject({ kind: 'song', world });
      expect(SONGS[world]).toBeDefined();
    }
    expect(planStation({ world: 1, station: 3, words: {}, today: T, seed: 1 }).some((x) => x.kind === 'song')).toBe(false);
  });
  it('the same seed gives the same station', () => {
    expect(planStation({ world: 3, station: 2, words: {}, today: T, seed: 9 })).toEqual(planStation({ world: 3, station: 2, words: {}, today: T, seed: 9 }));
  });
  it('the match task is written only when all its words are known at level 2 or more (from world 3)', () => {
    const lvl = (n: number): Words => Object.fromEntries(wordsOfWorld(3).map((w) => [w.id, { level: n, due: T, seen: true }]));
    for (const level of [0, 1]) for (let seed = 1; seed < 8; seed++) for (const s of planStation({ world: 3, station: 3, words: lvl(level), today: T, seed })) if (s.kind === 'match') expect(s.mode).toBe('audio');
  });
});

describe('worlds 5-12', () => {
  it('the dance party and the weather keep to kinds that make sense for actions and weather', () => {
    expect(kindsForWorld(8)).not.toEqual(expect.arrayContaining(['put']));
    for (const k of ['put', 'find', 'count'] as const) expect(kindsForWorld(8)).not.toContain(k);
    for (const k of ['put', 'count'] as const) expect(kindsForWorld(9)).not.toContain(k);
    expect(kindsForWorld(8)).toContain('sentence');
  });
  it('every world ends with its song, which exists', () => {
    for (let world = 5; world <= 12; world++) expect(planStation({ world, station: 4, words: {}, today: T, seed: 4 }).some((s) => s.kind === 'song' && s.world === world), String(world)).toBe(true);
  });
  it('the words that Rani likes come first in their world (the same words, in a new order)', () => {
    const plain = planStation({ world: 2, station: 0, words: {}, today: T, seed: 5 }).filter((s) => s.kind === 'card').map((s) => (s as { word: string }).word);
    const liked = planStation({ world: 2, station: 0, words: {}, today: T, seed: 5, likes: ['egg', 'milk', 'cake'] }).filter((s) => s.kind === 'card').map((s) => (s as { word: string }).word);
    expect(plain).toEqual(['pizza', 'cheese', 'pasta']);
    expect([...liked].sort()).toEqual(['cake', 'egg', 'milk']);
  });
  it('the ninja course has every obstacle, with something to do', () => {
    for (const [ref, preps] of Object.entries(OBSTACLES)) {
      expect(ids.has(ref), ref).toBe(true);
      expect(preps.length).toBeGreaterThan(0);
    }
  });
});
