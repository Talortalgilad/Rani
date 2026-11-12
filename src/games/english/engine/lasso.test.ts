import { describe, expect, it } from 'vitest';
import { isClosed, judgeLasso, pointInPolygon, type Pt, type Target } from './lasso';

/** A loop of n points round (cx, cy); `wobble` bends the radius, `turn` is how much of a full turn is drawn, `squash` makes it an oval. */
function loop(cx: number, cy: number, r: number, o: { n?: number; wobble?: number; turn?: number; squash?: number; start?: number } = {}): Pt[] {
  const n = o.n ?? 48;
  const turn = o.turn ?? 1.04; // a child's circle overshoots a little
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = (o.start ?? 0) + (i / n) * turn * Math.PI * 2;
    const rr = r * (1 + (o.wobble ?? 0) * Math.sin(a * 3 + 1));
    return { x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr * (o.squash ?? 1) };
  });
}

const ball: Target = { id: 'ball', x: 200, y: 200, r: 40 };
const book: Target = { id: 'book', x: 330, y: 210, r: 40 };
const bed: Target = { id: 'bed', x: 200, y: 360, r: 40 };
const all = [ball, book, bed];

describe('circling a picture', () => {
  it('a neat circle round the right picture works', () => {
    const r = judgeLasso(loop(200, 200, 60), all, 'ball');
    expect(r).toMatchObject({ closed: true, ok: true, inside: ['ball'] });
  });
  it('a wobbly circle works', () => {
    expect(judgeLasso(loop(205, 195, 62, { wobble: 0.18 }), all, 'ball').ok).toBe(true);
  });
  it('an oval works', () => {
    expect(judgeLasso(loop(200, 200, 70, { squash: 0.7 }), all, 'ball').ok).toBe(true);
    expect(judgeLasso(loop(200, 200, 60, { squash: 1.35 }), all, 'ball').ok).toBe(true);
  });
  it('a loop that starts and ends somewhere else, and overshoots, works', () => {
    expect(judgeLasso(loop(200, 200, 60, { start: 2.4, turn: 1.12 }), all, 'ball').ok).toBe(true);
  });
  it('a circle that is off-centre but holds the middle of the picture works', () => {
    expect(judgeLasso(loop(225, 190, 55), all, 'ball').ok).toBe(true);
  });
  it('a circle round the wrong picture does not work', () => {
    const r = judgeLasso(loop(330, 210, 60), all, 'ball');
    expect(r.ok).toBe(false);
    expect(r.inside).toEqual(['book']);
  });
  it('a circle round two pictures does not work when the wrong one is wholly inside', () => {
    expect(judgeLasso(loop(265, 205, 130), all, 'ball').ok).toBe(false);
  });
  it('a circle that only cuts the edge of a wrong picture still works', () => {
    // wide enough to touch the book (its edge is at x = 290) but not to hold it
    expect(judgeLasso(loop(215, 200, 82), all, 'ball').ok).toBe(true);
  });
  it('an open shape (a "C") is not a circle', () => {
    const c = loop(200, 200, 60, { turn: 0.6 });
    expect(isClosed(c)).toBe(false);
    expect(judgeLasso(c, all, 'ball').ok).toBe(false);
  });
  it('a straight line, a dot, and too few points are not circles', () => {
    expect(isClosed(Array.from({ length: 30 }, (_, i) => ({ x: 100 + i * 5, y: 200 })))).toBe(false);
    expect(isClosed(Array.from({ length: 30 }, () => ({ x: 200, y: 200 })))).toBe(false);
    expect(isClosed(loop(200, 200, 60).slice(0, 8))).toBe(false);
  });
  it('a tiny loop is a dot', () => {
    expect(isClosed(loop(200, 200, 8))).toBe(false);
  });
  it('point in polygon', () => {
    const sq = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    expect(pointInPolygon({ x: 5, y: 5 }, sq)).toBe(true);
    expect(pointInPolygon({ x: 15, y: 5 }, sq)).toBe(false);
  });
});
