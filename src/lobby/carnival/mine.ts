/**
 * The squishies that Rani made (SPEC-squishy.md 3, workshop stage 3): the ones that she sent from her shelf live in the carnival (up to 8) as residents like all the others, and the
 * squishies that she made for the orders are carried by the ones who ordered them. Everything is made from the saved data (mold, a colour for each part, decorations, finish, face): the
 * picture is drawn ONCE on a flat canvas (the same drawing as the workshop, with no squeeze mesh) and kept; the carnival never draws it again in a frame. The name that she gave has no
 * recording: it is only written, never said (no voice of the phone).
 */
import { getState } from '../../storage';
import { available, learnedFrom, paletteId, queue as orderQueue } from '../../games/squishy/orders';
import { SQUISHIES } from '../../games/english/art/squishies';
import { COLORS } from '../../games/english/content/colors';
import { loadStore, fillColors, type SquishyData, type Toy } from '../../games/squishy/save';
import { shapeInfo } from '../../games/squishy/shapes';
import { CANNOT_WEAR, SHAPE_CANNOT_WEAR } from './friends';
import { EXTRA_INFO, GAME_ID, type Resident, type ResidentInfo } from './residents';
import type { Personality } from './wishes';

const PERSONALITIES: Personality[] = ['hungry', 'playful', 'sleepy', 'curious'];
const GAMES = ['bricks', 'memory', 'blocks', 'busjam', 'english'];
const HOBBIES = ['sleep', 'eat', 'run', 'sing'];
const hash = (s: string): number => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

/** the squishy of the shelf, as a resident: his favourite food is the one that she chose for him, his favourite colour is the main colour of his body; the rest (character, game, number, hobby, the day of his party) is by his id, the same every time */
export function mineInfo(d: SquishyData): ResidentInfo {
  const h = hash(d.id);
  const areas = shapeInfo(d.shape).areas;
  const body = areas.indexOf(Math.max(...areas));
  const name = d.name || 'סקווישי';
  return { id: `sq_${d.id}`, he: name, en: name, personality: PERSONALITIES[h % 4], food: d.food || 'cupcake', game: GAMES[(h >> 3) % GAMES.length], color: paletteId(fillColors(d)[body] ?? d.base), number: 1 + ((h >> 5) % 10), hobby: HOBBIES[(h >> 7) % 4], friend: '', partyDay: 1 + ((h >> 9) % 28) };
}
export function mineResident(d: SquishyData): Resident {
  const i = mineInfo(d);
  EXTRA_INFO.set(i.id, i);
  if (SHAPE_CANNOT_WEAR[d.shape]) CANNOT_WEAR[i.id] = SHAPE_CANNOT_WEAR[d.shape];
  return { id: i.id, name: i.he, img: '', fixed: false, personality: i.personality, game: GAME_ID[i.game], food: i.food, mine: true, anchor: `shape:${d.shape}` };
}

export interface MineData { shelf: SquishyData[]; carnival: string[]; toys: Toy[] }
/** what is saved by the workshop (only data), cleaned */
export function readMine(): MineData {
  const g = (getState().games as Record<string, Record<string, unknown> | undefined>).squishy ?? {};
  const s = loadStore({ draft: null, shelf: g.shelf, orders: g.orders, carnival: g.carnival });
  return { shelf: s.shelf, carnival: s.carnival, toys: s.orders.toys };
}
/** the squishies of the shelf that live in the carnival, in the order in which they were sent */
export const mineOf = (m: MineData): SquishyData[] => m.carnival.map((id) => m.shelf.find((d) => d.id === id)).filter((d): d is SquishyData => !!d);

// ---------------------------------------------------------------- the picture, drawn once
const cache = new Map<string, Promise<string>>();
const keyOf = (d: SquishyData): string => JSON.stringify([d.id, d.shape, d.base, d.colors, d.decor, d.finish, d.face]);
/** the flat picture of a saved squishy (a 256 x 256 data URL, with its face open): made the first time it is asked, kept for all the next ones */
export function flatPicture(d: SquishyData, size = 256): Promise<string> {
  const k = keyOf(d) + size;
  let p = cache.get(k);
  if (!p) {
    p = (async () => {
      const [{ loadShape }, { drawSquishy }] = await Promise.all([import('../../games/squishy/shapes'), import('../../games/squishy/squishy')]);
      const loaded = await loadShape(d.shape);
      const big = document.createElement('canvas');
      big.width = big.height = 512;
      drawSquishy(big.getContext('2d', { willReadFrequently: true })!, loaded, d, { face: 'open' });
      const c = document.createElement('canvas');
      c.width = c.height = size;
      c.getContext('2d')!.drawImage(big, 0, 0, size, size);
      return c.toDataURL('image/webp', 0.92);
    })();
    cache.set(k, p);
  }
  return p;
}

/** who carries which toy: the squishy that ordered it is one of the 12 of the English game (`to` is the id of his picture); a resident with that picture carries it, and when there is none the toy goes to one of the residents by the id (one toy for each) */
export function toyHolders(residents: Resident[], toys: Toy[]): Map<number, Toy> {
  const out = new Map<number, Toy>();
  const keyOfImg = (img: string): string => (img.split('/').pop() ?? '').replace(/\.\w+$/, '');
  const free = residents.map((_, i) => i).filter((i) => !residents[i].mine);
  for (const t of [...toys].reverse()) {
    let i = residents.findIndex((r, k) => !r.mine && !out.has(k) && keyOfImg(r.img) === t.to);
    if (i < 0 && free.length) {
      const start = hash(t.to) % free.length;
      for (let n = 0; n < free.length && i < 0; n++) { const c = free[(start + n) % free.length]; if (!out.has(c)) i = c; }
    }
    if (i >= 0) out.set(i, t);
  }
  return out;
}

// ---------------------------------------------------------------- the building of the workshop
/** how many orders wait (the ones that were not done yet and that she can make: the words are learned), and the squishies that stand in the line in front of the building (the same ones that wait in the workshop) */
export function workshopState(): { waiting: number; line: string[] } {
  const g = getState().games as Record<string, Record<string, unknown> | undefined>;
  const en = g.english ?? {};
  const learned = learnedFrom((en.words as Record<string, { seen?: boolean }>) ?? {}, (en.map as { done: Record<number, number> }) ?? { done: {} }, en.openAll === true, COLORS.map((c) => c.id));
  const ctx = { done: (g.squishy?.orders as { done?: string[] } | undefined)?.done ?? [], learned };
  const waiting = available(ctx).filter((o) => !ctx.done.includes(o.id)).length;
  const n = orderQueue(ctx).length;
  return { waiting, line: Array.from({ length: n }, (_, k) => SQUISHIES[(k * 5 + ctx.done.length) % SQUISHIES.length].id) };
}
