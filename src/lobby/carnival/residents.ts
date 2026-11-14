/**
 * The first five residents (SPEC-carnival.md 4.1): the companion that Rani chose, and the other names that a companion can have (Cheesy, Mozzi,
 * Horiko, Pop Cheese), each with a picture from the English game. Pure data.
 */
import { SQUISHIES, squishyUrl } from '../../games/english/art/squishies';

export interface Resident { id: string; /** the Hebrew name, as it is written and said (one of the recorded names) */ name: string; img: string }

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
  const first: Resident = {
    id: 'companion',
    name: companionName && companionName.trim() ? companionName : NAMES[0].name,
    img: buddy && SQUISHIES.some((s) => s.id === buddy) ? squishyUrl(buddy) : `${b}english/cheesy/happy.webp`,
  };
  return [first, ...NAMES.map((n) => ({ id: n.id, name: n.name, img: n.img(b) }))];
}
