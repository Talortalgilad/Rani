/**
 * The first four residents (SPEC-carnival.md 4.1): the companion that Rani chose, and the other names that a companion can have (Cheesy, Mozzi,
 * Horiko, Pop Cheese), each with a picture from the English game. Pure data.
 */
import { SQUISHIES, squishyUrl } from '../../games/english/art/squishies';
import INFO from './residents.json';
import { ARRIVAL_LEVELS } from './level';
import type { Personality } from './wishes';

export interface Resident {
  id: string;
  /** the name, as it is written and said */
  name: string;
  img: string;
  /** the name is one of the four recorded ones (Cheesy, Mozzi, Horiko, Pop Cheese) */
  fixed: boolean;
  /** the character (SPEC-carnival.md 4.1) and the game that he likes (a game of the registry): stage 2 uses them */
  personality?: Personality;
  game?: string;
}

/** The fixed details of the residents (residents.json). The companion that Rani named uses the row of Cheesy. */
export interface ResidentInfo { id: string; he: string; en: string; personality: Personality; food: string; game: string; color: string; number: number; hobby: string; friend: string; partyDay: number }
export const RESIDENT_INFO = INFO.residents as ResidentInfo[];
export const infoOf = (id: string): ResidentInfo | undefined => RESIDENT_INFO.find((r) => r.id === (id === 'companion' ? 'cheesy' : id));
/** the games of residents.json, as the ids of the registry */
export const GAME_ID: Record<string, string> = { bricks: 'brick-breaker', memory: 'memory', blocks: 'blocks', busjam: 'traffic', english: 'english' };
/** the 18 new residents, in the order in which they come; the first six come with the levels of ARRIVAL_LEVELS */
export const NEW_RESIDENTS = RESIDENT_INFO.slice(4).map((r) => r.id);
export const arrivalOrder = (): string[] => NEW_RESIDENTS.slice(0, ARRIVAL_LEVELS.length);
const newUrl = (id: string): string => `${import.meta.env?.BASE_URL ?? '/'}park/squishies/${id}.webp`;
/** a name for a resident whose own name is taken by the friend that Rani named (the same, fixed list, in this order) */
export const ALT_NAMES = ['פיצי', 'בובי', 'נוני', 'קוקי', 'טופי'];

const base = (): string => import.meta.env?.BASE_URL ?? '/';
/** the other three residents with fixed names, and the picture each has when it is not the companion */
const NAMES: { id: string; name: string; img: (b: string) => string }[] = [
  { id: 'mozzi', name: 'מוצי', img: () => squishyUrl('pizza') },
  { id: 'horiko', name: 'חוריקו', img: () => squishyUrl('panda') },
  { id: 'popcheese', name: 'פופצ׳יז', img: () => squishyUrl('cookie') },
];

/** The companion (the name she gave, and the squishy she chose; Cheesy is the same character) first, then Mozzi, Horiko and Pop Cheese: 4 in all. */
export function residents(companionName: string | null, buddy: string | null, arrived: string[] = []): Resident[] {
  const b = base();
  const mine = companionName && companionName.trim() ? companionName.trim() : 'צ׳יזי';
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
  // the alternative names are recorded too (name.<key>, carn_hello_im_<key>), so the resident is "fixed" again
  for (const o of others) if (!o.name) (o.name = ALT_NAMES.find((a) => !used.has(a) && !NAMES.some((n) => n.name === a)) ?? 'חבר'), (o.fixed = true), used.add(o.name);
  const four = [first, ...others].map((r) => ({ ...r, personality: infoOf(r.id)?.personality, game: GAME_ID[infoOf(r.id)?.game ?? ''] }));
  const added = arrived
    .filter((id) => NEW_RESIDENTS.includes(id))
    .map((id): Resident => {
      const i = infoOf(id)!;
      return { id, name: i.he, img: newUrl(id), fixed: false, personality: i.personality, game: GAME_ID[i.game] };
    });
  return [...four, ...added];
}

/** How a resident says his name in English ("I'm Mozzi"): the four names of the companion have an English way; another name is said as it is. */
export const EN_NAME: Record<string, string> = { 'צ׳יזי': 'Cheesy', 'מוצי': 'Mozzi', 'חוריקו': 'Horiko', 'פופצ׳יז': 'Pop Cheese', 'פיצי': 'Pitzi', 'בובי': 'Bobby', 'נוני': 'Noni', 'קוקי': 'Cookie', 'טופי': 'Toffee' };
export const englishName = (he: string): string => EN_NAME[he] ?? he;
