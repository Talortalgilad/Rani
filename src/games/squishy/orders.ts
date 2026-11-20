/**
 * The orders of the workshop (SPEC-squishy.md 2.1, 2.8): pure. The 40 orders are read from squishy-orders.json as they are (a new order is only data and a recording).
 * Which orders can be shown (the tier that is open, the words that Rani learned, the molds that are open), what is "the same" (the check of an order against a squishy),
 * and how the molds open with the orders that were done. No DOM here.
 */
import DATA from './squishy-orders.json';
import { PALETTE, type RGB } from './paint';
import { fillColors, type DecorKind, type SquishyData } from './save';
import { OPEN_MOLDS } from './save';
import { shapeInfo } from './shapes';

export interface Order {
  id: string;
  tier: 1 | 2 | 3;
  shape: string;
  colors: string[];
  decor?: { kind: DecorKind; count: number };
  text: string;
  clip: string;
}
export const ORDERS = DATA.orders as unknown as Order[];
export const orderById = (id: string): Order | undefined => ORDERS.find((o) => o.id === id);

/** tier 2 opens after 5 orders, tier 3 after 12 */
export const TIER_AFTER: Record<2 | 3, number> = { 2: 5, 3: 12 };
export const tierOpen = (done: number): 1 | 2 | 3 => (done >= TIER_AFTER[3] ? 3 : done >= TIER_AFTER[2] ? 2 : 1);

/** the molds after the six that are open at the start: one more for every two orders that were done (the order in which they open) */
export const MOLD_ORDER = ['fish', 'bird', 'lion', 'apple', 'donut', 'icecream', 'lollipop', 'cookie', 'crown', 'elephant', 'monkey', 'giraffe'];
export const unlockedMolds = (done: number): string[] => MOLD_ORDER.slice(0, Math.min(MOLD_ORDER.length, Math.floor(done / 2)));
/** the three orders that are always there (cat, star, apple, with their colours): there are never fewer than three */
export const ALWAYS = ['o01', 'o03', 'o05'];

/** what she learned in the word journey (the words of the shapes and the colours) */
export interface Learned {
  word(id: string): boolean;
  color(id: string): boolean;
}
/** every word and colour is learned (the parent opened everything, or a test) */
export const learnedAll: Learned = { word: () => true, color: () => true };

export interface OrderCtx {
  /** the ids of the orders that were done, in order (the same id can be there twice) */
  done: string[];
  learned: Learned;
}
/** the molds that can be used in an order: the six, the ones that opened with the orders, and the shape of the order itself when it is one of the three that are always there */
export const moldsOpen = (done: number): string[] => [...OPEN_MOLDS, ...unlockedMolds(done)];

const canShow = (o: Order, c: OrderCtx): boolean => {
  if (ALWAYS.includes(o.id)) return true;
  if (o.tier > tierOpen(c.done.length)) return false;
  if (!c.learned.word(o.shape)) return false;
  if (!o.colors.every((x) => c.learned.color(x))) return false;
  return moldsOpen(c.done.length).includes(o.shape);
};
/** the orders that can be shown now; the ones that were not done yet come first */
export function available(c: OrderCtx): Order[] {
  const ok = ORDERS.filter((o) => canShow(o, c));
  const fresh = ok.filter((o) => !c.done.includes(o.id));
  return [...fresh, ...ok.filter((o) => c.done.includes(o.id))];
}
/** the next three that wait in the line (a different mix each time: it moves with the number of orders that were done) */
export function queue(c: OrderCtx, n = 3): Order[] {
  const a = available(c);
  const open = tierOpen(c.done.length);
  // the orders of the tier that is open now come first (by the "tier" field of the file), then the lower tiers; fresh orders before ones that were done
  const rank = (o: Order): number => (open - o.tier) * 2 + (c.done.includes(o.id) ? 1 : 0);
  const sorted = a.map((o, i) => ({ o, i })).sort((x, y) => rank(x.o) - rank(y.o) || x.i - y.i).map((x) => x.o);
  const top = sorted.filter((o) => rank(o) === rank(sorted[0]));
  const out: Order[] = [];
  // a rotation inside the best group so that the line is not always the same orders
  for (let i = 0; i < top.length && out.length < n; i++) out.push(top[(i + c.done.length) % top.length]);
  for (const o of sorted) if (out.length < n && !out.includes(o)) out.push(o);
  return out;
}

const hueOf = ([r, g, b]: RGB): { h: number; s: number } => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return { h: 0, s: 0 };
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: d / 255 };
};
/** the colour of the palette that a colour belongs to, by its hue (a pale pink is still pink, a pale blue still blue); white and grey are none ('') */
export function paletteId(c: RGB): string {
  const { h, s } = hueOf(c);
  if (s < 0.04) return '';
  let best = '', bd = Infinity;
  for (const p of PALETTE) {
    const ph = hueOf(p.rgb).h;
    const d = Math.min(Math.abs(ph - h), 360 - Math.abs(ph - h));
    if (d < bd) (bd = d), (best = p.id);
  }
  return best;
}
export interface CheckResult { shape: boolean; color: boolean; count: boolean | null; all: boolean }
/**
 * Is this squishy what was ordered? The shape; the colour (the biggest part, the body, is the first colour; in tier 3 at least one of the other parts is the second colour and none is a
 * third); and, when the order has decorations, exactly that many of that kind and none of another kind.
 */
export function checkOrder(o: Order, d: SquishyData): CheckResult {
  const shape = d.shape === o.shape;
  const colors = fillColors(d).map(paletteId);
  const areas = shapeInfo(d.shape).areas;
  const body = areas.indexOf(Math.max(...areas));
  const others = colors.filter((_, i) => i !== body);
  let color = colors[body] === o.colors[0];
  if (color && o.colors.length === 2) color = others.some((c) => c === o.colors[1]) && others.every((c) => c === o.colors[0] || c === o.colors[1]);
  let count: boolean | null = null;
  if (o.decor) count = d.decor.filter((x) => x.k === o.decor!.kind).length === o.decor.count && d.decor.every((x) => x.k === o.decor!.kind);
  return { shape, color, count, all: shape && color && count !== false };
}
/** what is given for an order that was done: hearts and stars (SPEC-squishy.md 2.8); an order that is given as it is gives one heart */
export const reward = (o: Order, matched: boolean): { hearts: number; stars: number } => (!matched ? { hearts: 1, stars: 0 } : o.tier === 1 ? { hearts: 2, stars: 1 } : { hearts: 3, stars: 2 });
