/**
 * The first five residents (SPEC-carnival.md 4.1): the companion that Rani chose, and the other names that a companion can have (Cheesy, Mozzi,
 * Horiko, Pop Cheese), each with a picture from the English game. Pure data.
 */
import { SQUISHIES, squishyUrl } from '../../games/english/art/squishies';

export interface Resident { id: string; /** the name, as it is written and said */ name: string; img: string; /** the name is one of the four recorded ones (Cheesy, Mozzi, Horiko, Pop Cheese) */ fixed: boolean }
/** a name for a resident whose own name is taken by the friend that Rani named (the same, fixed list, in this order) */
export const ALT_NAMES = ['פיצי', 'בובי', 'נוני', 'לולי', 'טופי'];

const base = (): string => import.meta.env?.BASE_URL ?? '/';
/** the four names of the companion, and the picture each has when it is not the companion */
const NAMES: { id: string; name: string; img: (b: string) => string }[] = [
  { id: 'cheesy', name: 'צ׳יזי', img: (b) => `${b}english/cheesy/wave.webp` },
  { id: 'mozzi', name: 'מוצי', img: () => squishyUrl('pizza') },
  { id: 'horiko', name: 'חוריקו', img: () => squishyUrl('panda') },
  { id: 'popcheese', name: 'פופצ׳יז', img: () => squishyUrl('cookie') },
];

/** The companion (the name she gave, and the squishy she chose) first, then Cheesy, Mozzi, Horiko and Pop Cheese: 5 in all. */
export function residents(companionName: string | null, buddy: string | null): Resident[] {
  const b = base();
  const mine = companionName && companionName.trim() ? companionName.trim() : NAMES[0].name;
  const first: Resident = {
    id: 'companion',
    fixed: false,
    name: mine,
    img: buddy && SQUISHIES.some((s) => s.id === buddy) ? squishyUrl(buddy) : `${b}english/cheesy/happy.webp`,
  };
  // two residents never have the same name: the one with a fixed name that the friend took gets another, from the list
  const used = new Set([mine]);
  const others = NAMES.map((n) => {
    if (n.name !== mine) {
      used.add(n.name);
      return { id: n.id, name: n.name, img: n.img(b), fixed: true };
    }
    return { id: n.id, name: '', img: n.img(b), fixed: false };
  });
  for (const o of others) if (!o.name) o.name = ALT_NAMES.find((a) => !used.has(a) && !NAMES.some((n) => n.name === a)) ?? 'חבר', used.add(o.name);
  return [first, ...others];
}

/** How a resident says his name in English ("I'm Mozzi"): the four names of the companion have an English way; another name is said as it is. */
export const EN_NAME: Record<string, string> = { 'צ׳יזי': 'Cheesy', 'מוצי': 'Mozzi', 'חוריקו': 'Horiko', 'פופצ׳יז': 'Pop Cheese' };
export const englishName = (he: string): string => EN_NAME[he] ?? he;
