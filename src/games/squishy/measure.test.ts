import { describe, expect, it } from 'vitest';
import { ANSWER_HELP, CUP, POUR_HELP, answerAuto, answerGlows, drain, newCup, pourAuto, pourShows, release, riseRate, rise, showsHand, snap, stopsByItself } from './measure';
import { makeRecipe } from './recipe';

/** the player who is wrong every time: he lets go at a level far from the line (over, then under, then over ...), or presses and never lets go */
function wrongPlayer(goal: number, step = 1, maxActions = 60): { actions: number; mistakes: number; done: boolean } {
  const c = newCup(goal);
  let actions = 0;
  let over = true;
  while (actions < maxActions) {
    actions++;
    // he presses for a time that is wrong on purpose
    const want = over ? Math.min(CUP.MAX, goal + 2.2) : Math.max(0, goal - 2.2);
    const stoppedBy = c.lvl <= want;
    if (stoppedBy) {
      for (let t = 0; t < 200 && c.lvl < want; t++) if (rise(c, 0.05)) return { actions, mistakes: c.mistakes, done: true };
    } else {
      // he drains (a tap for each unit) until he is under what he wants
      while (c.lvl > want) { drain(c); actions++; }
    }
    if (release(c, step) === 'ok') return { actions, mistakes: c.mistakes, done: true };
    over = !over;
  }
  return { actions, mistakes: c.mistakes, done: false };
}

describe('the measuring cup', () => {
  it('the water rises slowly: at least 0.6 s for a unit, and slower in the last units before the line', () => {
    const c = newCup(5);
    expect(CUP.MIN_SEC_PER_UNIT).toBeGreaterThanOrEqual(0.6);
    expect(riseRate(c)).toBeCloseTo(1 / 0.6, 5);
    c.lvl = 4.9;
    expect(riseRate(c)).toBeLessThan(0.5 * (1 / 0.6));
    c.lvl = 3.5;
    expect(riseRate(c)).toBeCloseTo(1 / 0.6, 5);
    // a whole second of pressing from empty never gets more than 1.7 units
    const d = newCup(10);
    for (let i = 0; i < 20; i++) rise(d, 0.05);
    expect(d.lvl).toBeLessThanOrEqual(1.7);
  });
  it('every release within half a unit of the line is right, and the level snaps onto the line', () => {
    for (const goal of [2, 3, 4, 5, 9]) {
      for (const off of [-0.5, -0.31, -0.1, 0, 0.2, 0.49, 0.5]) {
        const c = newCup(goal);
        c.lvl = goal + off;
        expect(release(c), `${goal}+${off}`).toBe('ok');
        expect(c.lvl).toBe(goal);
        expect(c.mistakes).toBe(0);
      }
    }
  });
  it('too little: the water stays where it is and goes on from there (it does not start from zero); too much: a button drains one unit at a time, never all of it', () => {
    const c = newCup(4);
    c.lvl = 2.3;
    expect(release(c)).toBe('almost');
    expect(c.lvl).toBe(2);
    rise(c, 0.3);
    expect(c.lvl).toBeGreaterThan(2);
    const o = newCup(3);
    o.lvl = 6.2;
    expect(release(o)).toBe('toomuch');
    expect(o.lvl).toBe(6);
    drain(o);
    expect(o.lvl).toBe(5);
    drain(o);
    expect(o.lvl).toBe(4);
    for (let i = 0; i < 10; i++) drain(o);
    expect(o.lvl).toBe(0);
    expect(snap(4.6, 0.5)).toBe(4.5);
    expect(snap(4.6, 1)).toBe(5);
  });
  it('the half-and-half recipe snaps to the halves; the same half a unit of room', () => {
    const c = newCup(5);
    c.lvl = 3.74;
    expect(release(c, 0.5)).toBe('almost');
    expect(c.lvl).toBe(3.5);
    const d = newCup(5);
    d.lvl = 5.4;
    expect(release(d, 0.5)).toBe('ok');
  });
  it('after one mistake a hand shows the line; after two the water stops by itself on the line even if she goes on pressing', () => {
    const c = newCup(3);
    expect(showsHand(c)).toBe(false);
    c.lvl = 1;
    release(c);
    expect(c.mistakes).toBe(1);
    expect(showsHand(c)).toBe(true);
    expect(stopsByItself(c)).toBe(false);
    c.lvl = 5.6;
    release(c);
    expect(stopsByItself(c)).toBe(true);
    drain(c); drain(c); drain(c);
    let stopped = false;
    for (let i = 0; i < 200 && !stopped; i++) stopped = rise(c, 0.05);
    expect(stopped).toBe(true);
    expect(c.lvl).toBe(3);
  });
  it('a player who is wrong in every try still gets through, in a limited number of steps, in every recipe and every line', () => {
    for (const goal of [2, 3, 4, 5, 6, 7, 8, 9]) for (const step of [1, 0.5]) {
      const r = wrongPlayer(goal, step);
      expect(r.done, `goal ${goal}`).toBe(true);
      expect(r.mistakes).toBeLessThanOrEqual(3);
      expect(r.actions).toBeLessThanOrEqual(40);
    }
    // and one who only presses and never lets go: the water stops by itself after two mistakes; before that every release is a try
    const c = newCup(7);
    c.mistakes = 2;
    let stopped = false;
    for (let i = 0; i < 400 && !stopped; i++) stopped = rise(c, 0.05);
    expect(stopped).toBe(true);
  });
  it('the half-and-half recipe is two cups of five, the cup recipe has a line from 2 to 9', () => {
    for (let n = 0; n < 200; n++) {
      const r = makeRecipe(3, 'pink', () => Math.random());
      if (r.kind === 'cup') expect(r.line >= 2 && r.line <= 9).toBe(true);
    }
  });
});

describe('every step that asks for the right thing helps and never locks', () => {
  it('the answer of the spoons: after two mistakes the right one glows, after three it is chosen; the pouring: after two drops that missed the mold shows, after three pours by itself', () => {
    expect([0, 1, 2, 3].map(answerGlows)).toEqual([false, false, true, true]);
    expect([0, 1, 2, 3].map(answerAuto)).toEqual([false, false, false, true]);
    expect(ANSWER_HELP.AUTO_AFTER).toBe(3);
    expect([0, 1, 2, 3].map(pourShows)).toEqual([false, false, true, true]);
    expect([0, 1, 2, 3].map(pourAuto)).toEqual([false, false, false, true]);
    expect(POUR_HELP.AUTO_AFTER).toBe(3);
  });
  it('a player who is wrong in every try reaches the end of the spoons question and of the pouring in at most four tries', () => {
    // the spoons: three choices, he always picks a wrong one while he can; at the third mistake it is chosen for him
    let wrong = 0, tries = 0, finished = false;
    while (!finished && tries < 20) {
      tries++;
      wrong++;
      if (answerAuto(wrong)) finished = true;
    }
    expect(finished).toBe(true);
    expect(tries).toBeLessThanOrEqual(4);
    let misses = 0, drops = 0, poured = false;
    while (!poured && drops < 20) {
      drops++;
      misses++;
      if (pourAuto(misses)) poured = true;
    }
    expect(poured).toBe(true);
    expect(drops).toBeLessThanOrEqual(4);
  });
});
