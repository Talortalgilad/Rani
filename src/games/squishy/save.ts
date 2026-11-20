/** What the workshop remembers (SPEC-squishy.md 3): the squishy that is being made (a draft: the X keeps it as it is) and the shelf. A squishy is DATA only (the shape, a colour for each part, the decorations, the finish, the face, the name), drawn again from it: no picture is saved. */
import { DEFAULT_FACE, CHEEKS, EYES, MOUTHS, type FaceParts } from './faces';
import { MAX_SPOONS, WHITE, type Spoons } from './mix';
import type { RGB } from './paint';
import { SHAPES, shapeInfo } from './shapes';
import type { Recipe } from './recipe';

export type Finish = 'gloss' | 'glitter' | 'matte';
export const FINISHES: Finish[] = ['gloss', 'glitter', 'matte'];
export type DecorKind = 'star' | 'flower' | 'heart';
export const DECORS: DecorKind[] = ['star', 'flower', 'heart'];
export interface Decor { k: DecorKind; x: number; y: number }
export type StepId = 'mold' | 'spoons' | 'mix' | 'pour' | 'paint' | 'face' | 'squeeze' | 'finish';
/** the seven points of the progress bar: the mold, the recipe (spoons and stirring), the pouring, the colours and decorations, the face, the squeeze test, the end */
export const DOT_OF: Record<StepId, number> = { mold: 1, spoons: 2, mix: 2, pour: 3, paint: 4, face: 5, squeeze: 6, finish: 7 };
export const STEP_ORDER: StepId[] = ['mold', 'spoons', 'mix', 'pour', 'paint', 'face', 'squeeze', 'finish'];

export interface SquishyData {
  id: string;
  shape: string;
  spoons: Spoons[];
  /** the colour that came out of the bowl */
  base: RGB;
  /** the colour of each part of the shape */
  colors: RGB[];
  decor: Decor[];
  finish: Finish;
  face: FaceParts;
  name: string;
  /** what he likes best to eat: the id of one of the six sweets */
  food: string;
  /** the colour that he likes best: the colour of his biggest part (an id of the palette, or "mix") */
  fav: string;
  created: number;
}
export interface Draft { step: StepId; data: SquishyData; poured: boolean; squeezes: number; /** the order that is being made (order mode) */ orderId?: string; recipe?: Recipe }
/** what the orders remember: the orders that were done (in order, an id can be there again), and the hearts that were given for them (they go to the carnival in stage 3) */
export interface OrdersSave { done: string[]; hearts: number; given: number }
export const emptyOrders = (): OrdersSave => ({ done: [], hearts: 0, given: 0 });
export interface Store { draft: Draft | null; shelf: SquishyData[]; orders: OrdersSave }

/** the molds that are open from the start (the others open with the orders, in stage 2) */
export const OPEN_MOLDS = ['cat', 'dog', 'rabbit', 'cupcake', 'star', 'flower'];
export const isOpen = (shape: string, unlocked: string[] = []): boolean => OPEN_MOLDS.includes(shape) || unlocked.includes(shape);
/** the six sweets to choose from at the end */
export const FOODS = ['cupcake', 'donut', 'icecream', 'cookie', 'apple', 'lollipop'];
export const MAX_DECOR = 12;
export const MAX_SHELF = 60;
export const MAX_NAME = 12;
export const cleanName = (s: string): string => s.replace(/[<>&"]/g, '').trim().slice(0, MAX_NAME);

let seq = 0;
export const newId = (): string => `s${Date.now().toString(36)}${(seq++).toString(36)}`;
export function newSquishy(shape: string, now = Date.now()): SquishyData {
  return { id: newId(), shape, spoons: [], base: WHITE, colors: [], decor: [], finish: 'gloss', face: { ...DEFAULT_FACE }, name: '', food: '', fav: 'mix', created: now };
}

const num = (x: unknown, lo: number, hi: number, d: number): number => (typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d);
const rgb = (x: unknown): RGB | null => (Array.isArray(x) && x.length === 3 && x.every((v) => typeof v === 'number' && Number.isFinite(v)) ? [0, 1, 2].map((i) => Math.round(num(x[i], 0, 255, 0))) as RGB : null);
export function cleanSquishy(x: unknown): SquishyData | null {
  const s = x as Partial<SquishyData> | null;
  if (!s || typeof s !== 'object' || typeof s.shape !== 'string' || !SHAPES.includes(s.shape)) return null;
  const parts = shapeInfo(s.shape).parts;
  const colors = (Array.isArray(s.colors) ? s.colors : []).map(rgb).filter((c): c is RGB => !!c).slice(0, parts);
  const f = (s.face ?? {}) as Partial<FaceParts>;
  return {
    id: typeof s.id === 'string' ? s.id : newId(),
    shape: s.shape,
    spoons: (Array.isArray(s.spoons) ? s.spoons : []).filter((p) => p && typeof p.id === 'string' && typeof p.n === 'number').map((p) => ({ id: p.id, n: Math.round(num(p.n, 0, MAX_SPOONS, 0)) })).slice(0, 8),
    base: rgb(s.base) ?? WHITE,
    colors,
    decor: (Array.isArray(s.decor) ? s.decor : []).filter((d) => d && DECORS.includes(d.k) && Number.isFinite(d.x) && Number.isFinite(d.y)).map((d) => ({ k: d.k, x: num(d.x, 0, 512, 256), y: num(d.y, 0, 512, 256) })).slice(0, MAX_DECOR),
    finish: FINISHES.includes(s.finish as Finish) ? (s.finish as Finish) : 'gloss',
    face: { eyes: Math.round(num(f.eyes, 0, EYES - 1, 0)), mouth: Math.round(num(f.mouth, 0, MOUTHS - 1, 0)), cheeks: Math.round(num(f.cheeks, 0, CHEEKS - 1, 1)) },
    name: typeof s.name === 'string' ? cleanName(s.name) : '',
    food: typeof s.food === 'string' && FOODS.includes(s.food) ? s.food : '',
    fav: typeof s.fav === 'string' ? s.fav : 'mix',
    created: num(s.created, 0, 4e12, 0),
  };
}
/** the part colours of a squishy that has none yet: all parts the colour of the bowl */
export const fillColors = (d: SquishyData): RGB[] => Array.from({ length: shapeInfo(d.shape).parts }, (_, i) => d.colors[i] ?? d.base);

const cleanRecipe = (x: unknown): Recipe | undefined => {
  const r = x as Partial<Recipe> | null;
  if (!r || typeof r !== 'object' || typeof r.color !== 'string') return undefined;
  if (r.kind === 'half') return { kind: 'half', color: r.color };
  if (r.kind === 'cup' && typeof r.line === 'number') return { kind: 'cup', color: r.color, line: Math.round(num(r.line, 1, 10, 5)) };
  if (r.kind === 'spoons' && typeof r.n === 'number' && typeof r.white === 'number' && Array.isArray(r.choices)) {
    const n = Math.round(num(r.n, 1, 10, 1)), white = Math.round(num(r.white, 0, 10, 0));
    return { kind: 'spoons', color: r.color, n, white, total: n + white, choices: r.choices.filter((c): c is number => typeof c === 'number').slice(0, 3) };
  }
  return undefined;
};
export function loadStore(raw: { draft: unknown; shelf: unknown; orders?: unknown }): Store {
  const d = raw.draft as Partial<Draft> | null;
  const data = d ? cleanSquishy(d.data) : null;
  const draft: Draft | null = data && d && STEP_ORDER.includes(d.step as StepId) ? { step: d.step as StepId, data, poured: d.poured === true, squeezes: Math.round(num(d.squeezes, 0, 99, 0)), ...(typeof d.orderId === 'string' ? { orderId: d.orderId } : {}), ...(cleanRecipe(d.recipe) ? { recipe: cleanRecipe(d.recipe) } : {}) } : null;
  const o = (raw.orders ?? {}) as Partial<OrdersSave>;
  const orders: OrdersSave = { done: (Array.isArray(o.done) ? o.done : []).filter((x): x is string => typeof x === 'string').slice(-400), hearts: Math.round(num(o.hearts, 0, 1e6, 0)), given: Math.round(num(o.given, 0, 1e6, 0)) };
  const shelf = (Array.isArray(raw.shelf) ? raw.shelf : []).map(cleanSquishy).filter((s): s is SquishyData => !!s).slice(0, MAX_SHELF);
  return { draft, shelf, orders };
}
