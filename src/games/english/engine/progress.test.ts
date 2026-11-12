import { describe, expect, it } from 'vitest';
import { INTERVALS, addPlay, markKnown, minutesInWeek, unmarkKnown, dayNumber, dueWords, emptyMap, finishStation, isKnown, markSeen, review, stationOpen, worldOpen, type Words } from './progress';

const T = 20000;

describe('Leitner review of a word', () => {
  it('a right answer at the first try goes up one level and returns after 1, 2, 4, 7 and 14 days', () => {
    let w: Words = {};
    const due: number[] = [];
    for (let k = 0; k < 5; k++) {
      w = review(w, 'ball', true, T);
      expect(w.ball.level).toBe(k + 1);
      due.push(w.ball.due - T);
    }
    expect(due).toEqual(INTERVALS);
    w = review(w, 'ball', true, T); // already at the top
    expect(w.ball.level).toBe(5);
  });
  it('a mistake sends it back to level 1, to return tomorrow', () => {
    let w: Words = {};
    for (let k = 0; k < 4; k++) w = review(w, 'ball', true, T);
    w = review(w, 'ball', false, T + 3);
    expect(w.ball.level).toBe(1);
    expect(w.ball.due).toBe(T + 4);
  });
  it('a word is known from level 4, or when a parent marked it', () => {
    let w: Words = {};
    for (let k = 0; k < 3; k++) w = review(w, 'ball', true, T);
    expect(isKnown(w.ball)).toBe(false);
    w = review(w, 'ball', true, T);
    expect(isKnown(w.ball)).toBe(true);
    expect(isKnown({ level: 0, due: 0, seen: false, known: true })).toBe(true);
    expect(isKnown(undefined)).toBe(false);
  });
  it('a word that went wrong comes back the next day, one that went right later', () => {
    let w: Words = {};
    w = review(w, 'ball', false, T);
    w = review(w, 'book', true, T);
    w = review(w, 'bed', true, T);
    w = review(w, 'bed', true, T + 1);
    expect(dueWords(w, T)).toEqual([]);
    expect(dueWords(w, T + 1)).toEqual(['ball', 'book']);
    expect(dueWords(w, T + 30)).toEqual(['ball', 'book', 'bed']);
  });
  it('a word she has not met is not due', () => {
    expect(dueWords({ cat: { level: 0, due: 0, seen: false } }, T)).toEqual([]);
    expect(dueWords(markSeen({}, 'cat', T), T)).toEqual(['cat']);
  });
  it('days are counted in local time', () => {
    expect(dayNumber(new Date(2026, 0, 1, 0, 5))).toBe(dayNumber(new Date(2026, 0, 1, 23, 50)));
    expect(dayNumber(new Date(2026, 0, 2, 0, 5))).toBe(dayNumber(new Date(2026, 0, 1, 23, 50)) + 1);
  });
});

describe('the map', () => {
  it('only world 1 is open at the start, and its first station', () => {
    const m = emptyMap();
    expect(worldOpen(m, 1)).toBe(true);
    expect(worldOpen(m, 2)).toBe(false);
    expect(stationOpen(m, 1, 0)).toBe(true);
    expect(stationOpen(m, 1, 1)).toBe(false);
  });
  it('finishing a station opens the next, and finishing all five opens the next world', () => {
    let m = emptyMap();
    for (let s = 0; s < 5; s++) m = finishStation(m, 1, s, 3);
    expect(worldOpen(m, 2)).toBe(true);
    expect(stationOpen(m, 2, 0)).toBe(true);
    expect(stationOpen(m, 2, 1)).toBe(false);
  });
  it('keeps the best stars of a station', () => {
    let m = finishStation(emptyMap(), 1, 0, 3);
    m = finishStation(m, 1, 0, 1);
    expect(m.stars['1-0']).toBe(3);
    expect(m.done[1]).toBe(1);
  });
});

describe('what a parent can set, and the play log', () => {
  it('a word marked as known is known, seen (no card) and comes back later; unmarked it is new again', () => {
    const w = markKnown({}, 'ball', 100);
    expect(isKnown(w.ball)).toBe(true);
    expect(w.ball.seen).toBe(true);
    expect(w.ball.due).toBe(107);
    expect(unmarkKnown(w, 'ball').ball).toBeUndefined();
  });
  it('the log adds the minutes of a day, sums a week and forgets what is older than a month', () => {
    let l = addPlay({}, 100, 4);
    l = addPlay(l, 100, 3);
    l = addPlay(l, 95, 10);
    expect(l[100]).toBe(7);
    expect(minutesInWeek(l, 100)).toBe(17);
    expect(minutesInWeek(l, 110)).toBe(0);
    expect(addPlay(l, 140, 1)[100]).toBeUndefined();
  });
});

describe('opening of worlds', () => {
  it('a world opens only when the one before it is finished; the parents switch opens all', () => {
    const m = finishStation(emptyMap(), 1, 4, 3);
    expect(worldOpen(emptyMap(), 2)).toBe(false);
    expect(worldOpen(m, 2)).toBe(true); // finishing the fifth station (the rescue) opens the next world
    let all = emptyMap();
    for (let s = 0; s < 5; s++) all = finishStation(all, 1, s, 3);
    expect(worldOpen(all, 2)).toBe(true);
    expect(worldOpen(all, 3)).toBe(false);
    expect(worldOpen(emptyMap(), 12, true)).toBe(true);
    expect(stationOpen(emptyMap(), 5, 3, true)).toBe(true);
    expect(stationOpen(emptyMap(), 5, 3)).toBe(false);
  });
});
