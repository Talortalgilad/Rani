import { describe, expect, it } from 'vitest';
import { ALWAYS, available, checkOrder, learnedAll, moldsOpen, ORDERS, orderById, paletteId, queue, reward, tierOpen, unlockedMolds, type Learned } from './orders';
import { makeRecipe, recipeColor, recipeIsRight, recipeKind } from './recipe';
import { PALETTE } from './paint';
import { fillColors, newSquishy, type SquishyData } from './save';
import { MAX_SPOONS } from './mix';
import { shapeInfo } from './shapes';

const rng = (s: number) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
const none: Learned = { word: () => false, color: () => false };

/** a squishy that is made for an order (the right shape, the right colours, the right decorations) */
function made(o: (typeof ORDERS)[number]): SquishyData {
  const d = newSquishy(o.shape);
  const rgb = (id: string) => PALETTE.find((p) => p.id === id)!.rgb;
  const info = shapeInfo(o.shape);
  const body = info.areas.indexOf(Math.max(...info.areas));
  d.colors = info.areas.map((_, i) => rgb(o.colors.length === 2 && i !== body ? o.colors[1] : o.colors[0]));
  if (o.decor) d.decor = Array.from({ length: o.decor.count }, (_, i) => ({ k: o.decor!.kind, x: 100 + i * 10, y: 100 }));
  return d;
}

describe('which orders are shown', () => {
  it('the tiers: 1 at the start, 2 after 5 orders, 3 after 12', () => {
    expect([0, 4, 5, 11, 12, 40].map(tierOpen)).toEqual([1, 1, 2, 2, 3, 3]);
  });
  it('with nothing learned there are still three orders: a pink cat, a yellow star, a green apple', () => {
    const a = available({ done: [], learned: none });
    expect(a.map((o) => o.id)).toEqual(ALWAYS);
    expect(a.map((o) => o.shape)).toEqual(['cat', 'star', 'apple']);
    expect(queue({ done: [], learned: none }).length).toBe(3);
  });
  it('an order appears only when its words and colours were learned, its tier is open and its mold is open', () => {
    const learned: Learned = { word: (w) => w === 'rabbit' || w === 'dog', color: (c) => c === 'purple' || c === 'green' };
    const ids = available({ done: [], learned }).map((o) => o.id);
    expect(ids).toContain('o04'); // a purple rabbit
    expect(ids).toContain('o11'); // a green dog
    expect(ids).not.toContain('o02'); // a blue fish: no words, no mold yet
    expect(ids).not.toContain('o16'); // tier 2
    const later = available({ done: Array(5).fill('o01'), learned: learnedAll }).map((o) => o.tier);
    expect(Math.max(...later)).toBe(2);
    expect(Math.max(...available({ done: Array(12).fill('o01'), learned: learnedAll }).map((o) => o.tier))).toBe(3);
  });
  it('the molds open one for each two orders, in a fixed order, and the six of the start stay', () => {
    expect(unlockedMolds(0)).toEqual([]);
    expect(unlockedMolds(1)).toEqual([]);
    expect(unlockedMolds(2)).toEqual(['fish']);
    expect(unlockedMolds(5)).toEqual(['fish', 'bird']);
    expect(unlockedMolds(99).length).toBe(12);
    expect(moldsOpen(0)).toHaveLength(6);
    expect(new Set([...moldsOpen(99)]).size).toBe(18);
  });
  it('every one of the 40 orders can be shown once everything is learned and done (nothing is locked forever)', () => {
    const ids = new Set(available({ done: Array(24).fill('o01'), learned: learnedAll }).map((o) => o.id));
    for (const o of ORDERS) expect(ids.has(o.id), o.id).toBe(true);
  });
  it('the line has up to three different orders, the ones that were not done first', () => {
    const q = queue({ done: ['o01'], learned: learnedAll });
    expect(q.length).toBe(3);
    expect(new Set(q.map((o) => o.id)).size).toBe(3);
    expect(q.every((o) => o.id !== 'o01')).toBe(true);
  });
});

describe('the check of an order', () => {
  it('a squishy that is made for an order matches it, for all 40 orders', () => {
    for (const o of ORDERS) {
      const r = checkOrder(o, made(o));
      expect(r.all, o.id).toBe(true);
      expect(r.shape && r.color, o.id).toBe(true);
      expect(r.count === null || r.count === true, o.id).toBe(true);
    }
  });
  it('a wrong shape, a wrong colour and a wrong number are each found alone', () => {
    const o = ORDERS.find((x) => x.id === 'o15')!; // a blue fish with three stars
    const ok = made(o);
    expect(checkOrder(o, { ...ok, shape: 'cat', colors: [] }).shape).toBe(false);
    const red = { ...ok, colors: ok.colors.map(() => PALETTE.find((p) => p.id === 'red')!.rgb) };
    const r = checkOrder(o, red);
    expect(r.color).toBe(false);
    expect(r.shape).toBe(true);
    expect(r.count).toBe(true);
    const two = { ...ok, decor: ok.decor.slice(0, 2) };
    expect(checkOrder(o, two).count).toBe(false);
    expect(checkOrder(o, two).color).toBe(true);
    // a flower where stars were ordered is not three stars
    expect(checkOrder(o, { ...ok, decor: ok.decor.map((x) => ({ ...x, k: 'flower' as const })) }).count).toBe(false);
  });
  it('tier 3: the body is the first colour and a small part is the second; both colours the same is not enough', () => {
    const o = ORDERS.find((x) => x.id === 'o29')!; // a pink and blue cat
    const ok = made(o);
    expect(checkOrder(o, ok).color).toBe(true);
    expect(checkOrder(o, { ...ok, colors: ok.colors.map(() => PALETTE[0].rgb) }).color).toBe(false);
    const third = ok.colors.slice();
    third[third.length - 1] = PALETTE.find((p) => p.id === 'green')!.rgb;
    third[0] = PALETTE[0].rgb;
    expect(checkOrder(o, { ...ok, colors: ok.colors.map((c, i) => (i === 1 ? PALETTE.find((p) => p.id === 'green')!.rgb : c)) }).color).toBe(false);
    expect(fillColors(ok).length).toBe(shapeInfo('cat').parts);
  });
  it('pale colours still count: pink with white is pink', () => {
    expect(paletteId([255, 200, 225])).toBe('pink');
    expect(paletteId([180, 210, 255])).toBe('blue');
  });
  it('the reward: 2 hearts and a star in tier 1, 3 hearts and 2 stars after, one heart for an order that is given as it is', () => {
    expect(reward(ORDERS[0], true)).toEqual({ hearts: 2, stars: 1 });
    expect(reward(ORDERS.find((o) => o.tier === 2)!, true)).toEqual({ hearts: 3, stars: 2 });
    expect(reward(ORDERS.find((o) => o.tier === 3)!, true)).toEqual({ hearts: 3, stars: 2 });
    expect(reward(ORDERS[0], false)).toEqual({ hearts: 1, stars: 0 });
  });
});

describe('the recipes', () => {
  it('the kind of the recipe follows the level of the maths: spoons, the cup, half and half', () => {
    expect([1, 2, 3, 4, 5].map(recipeKind)).toEqual(['spoons', 'spoons', 'cup', 'half', 'half']);
  });
  it('every recipe, at every level, for every colour, is in the range of its level and comes out as the colour that was ordered, with one right answer', () => {
    const r = rng(5);
    for (let level = 1; level <= 5; level++) for (const c of PALETTE) for (let k = 0; k < 40; k++) {
      const rec = makeRecipe(level, c.id, r);
      expect(rec.color).toBe(c.id);
      expect(recipeIsRight(rec), `${level} ${c.id} ${JSON.stringify(rec)}`).toBe(true);
      const col = recipeColor(rec);
      expect(col.every((v) => v >= 0 && v <= 255)).toBe(true);
      if (rec.kind === 'spoons') {
        expect(rec.n).toBeGreaterThanOrEqual(1);
        expect(rec.total).toBe(rec.n + rec.white);
        expect(rec.total).toBeLessThanOrEqual(MAX_SPOONS);
        expect(level <= 1 ? rec.white === 0 && rec.n <= 3 : rec.white <= rec.n / 2).toBe(true);
        expect(rec.choices).toHaveLength(3);
        expect(new Set(rec.choices).size).toBe(3);
        expect(rec.choices.filter((x) => x === rec.total)).toHaveLength(1);
        expect(rec.choices.every((x) => x >= 1 && x <= 10)).toBe(true);
      }
      if (rec.kind === 'cup') expect(rec.line >= 2 && rec.line <= 9).toBe(true);
    }
  });
});

describe('the tier of an order is the "tier" field of squishy-orders.json', () => {
  const all = { word: () => true, color: () => true };
  it('tier 1 is a colour and a shape, tier 2 has a number of decorations, tier 3 has two colours', () => {
    for (const o of ORDERS) {
      if (o.tier === 1) expect(!o.decor && o.colors.length === 1, o.id).toBe(true);
      if (o.tier === 2) expect(!!o.decor && o.colors.length === 1, o.id).toBe(true);
      if (o.tier === 3) expect(!o.decor && o.colors.length === 2, o.id).toBe(true);
    }
  });
  it('the line shows the orders of the tier that is open (by the field), and tiers open after 5 and 12 orders', () => {
    const at = (n: number) => queue({ done: Array(n).fill('o01'), learned: all });
    expect(at(0).every((o) => o.tier === 1)).toBe(true);
    expect(at(5).map((o) => o.tier)).toEqual([2, 2, 2]);
    expect(at(12).map((o) => o.tier)).toEqual([3, 3, 3]);
    expect(at(4).every((o) => o.tier === 1)).toBe(true);
  });
  it('the reward follows the field too', () => {
    expect(reward(orderById('o15')!, true)).toEqual({ hearts: 3, stars: 2 });
    expect(reward(orderById('o01')!, true)).toEqual({ hearts: 2, stars: 1 });
  });
});
