/**
 * Friendship (SPEC-carnival.md 4.6), pure. Every resident has a friendship meter that is filled by the hearts that HE gave (a talk that Rani answered, a wish that was fulfilled, a round of
 * his game that she played while he waited). The meter only goes up: nothing lowers it, and nothing is lost when she is away (nothing here reads the clock, except the day of the party,
 * which only ever gives something). Five levels open: 1 the name, 2 the first details and a trick, 3 a job in a stall (the chef's hat), 4 a gift, 5 a crown and he follows the camera.
 * Everything is kept in `save.extra.friends`, so an older save is read as it is and a later stage can add to it.
 */
import RES from './residents.json';
import type { ResidentInfo } from './residents';
import type { CarnivalSave } from './talk/state';

/** the hearts that a resident must give for each level (level 1 is where everybody starts) */
export const LEVEL_AT = [0, 5, 12, 22, 35];
export const MAX_FRIEND = 5;
export const friendLevel = (hearts: number): number => LEVEL_AT.filter((n) => hearts >= n).length;
/** the share of the way to the next level (1 at the last level) */
export function friendProgress(hearts: number): number {
  const l = friendLevel(hearts);
  return l >= MAX_FRIEND ? 1 : (hearts - LEVEL_AT[l - 1]) / (LEVEL_AT[l] - LEVEL_AT[l - 1]);
}

export type Detail = 'food' | 'game' | 'color' | 'number' | 'hobby' | 'friend';
/** the six details, in the order in which they are found out, and the level at which each shows (SPEC 4.6: at level 2 the food and the game) */
export const DETAILS: { key: Detail; level: number }[] = [
  { key: 'food', level: 2 }, { key: 'game', level: 2 }, { key: 'color', level: 3 }, { key: 'number', level: 4 }, { key: 'hobby', level: 4 }, { key: 'friend', level: 5 },
];
export const detailShown = (d: Detail, level: number): boolean => level >= DETAILS.find((x) => x.key === d)!.level;
export const shownDetails = (level: number): Detail[] => DETAILS.filter((d) => level >= d.level).map((d) => d.key);

export type Trick = 'spin' | 'jump2' | 'dance';
export const TRICKS: Trick[] = ['spin', 'jump2', 'dance'];
const row = (id: string): ResidentInfo | undefined => (RES.residents as ResidentInfo[]).find((r) => r.id === (id === 'companion' ? 'cheesy' : id));
export const trickOf = (id: string): Trick => TRICKS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % 3];
/** the friend of a resident (the ids of the residents of the carnival; the companion is Cheesy) */
export const friendOf = (id: string): string | null => {
  const f = row(id)?.friend;
  return f ? (f === 'cheesy' ? 'companion' : f) : null;
};
export const partyDayOf = (id: string): number => row(id)?.partyDay ?? 0;
/** is it the party day of this resident? (the day of the month; it only ever gives something) */
export const isPartyDay = (id: string, now: Date): boolean => partyDayOf(id) === now.getDate();
export const partyKey = (now: Date): string => `${now.getFullYear()}-${now.getMonth() + 1}`;

/** the stalls and what is eaten there: a resident goes first to the stall of his favourite food */
export const FOOD_OF_ITEM: Record<string, string> = { pizzastand: 'pizza', cheesestand: 'cheese', pastastand: 'pasta', grillstand: 'meat', icecreamstand: 'icecream', popcorncart: 'popcorn', cottoncandycart: 'candy' };

/** the accessories: the picture of each (in public/park/items) and where it sits on a resident. The ones whose picture is not in the repo are on the list of what is missing (ACCESSORY_MISSING). */
export interface Accessory { id: string; img: string; dy: number; size: number; he: string }
export const ACCESSORIES: Accessory[] = [
  { id: 'chefhat', img: 'chefhat', dy: 0.62, size: 0.62, he: 'כובע טבח' },
  { id: 'balloons', img: 'balloons', dy: 0.9, size: 0.8, he: 'בלון' },
  { id: 'medal', img: 'medal', dy: 0.1, size: 0.45, he: 'מדליה' },
  // no picture yet (see docs/carnival-missing.md): drawn as soon as public/park/items/<img>.webp exists
  { id: 'partyhat', img: 'partyhat', dy: 0.66, size: 0.6, he: 'כובע מסיבה' },
  { id: 'crown', img: 'crown', dy: 0.68, size: 0.6, he: 'כתר' },
  { id: 'glasses', img: 'glasses', dy: 0.28, size: 0.6, he: 'משקפיים' },
  { id: 'scarf', img: 'scarf', dy: 0.05, size: 0.7, he: 'צעיף' },
  { id: 'bow', img: 'bow', dy: 0.55, size: 0.5, he: 'פפיון' },
];
export const ACCESSORY_MISSING = ['partyhat', 'crown', 'glasses', 'scarf', 'bow'];
export const accessoryById = (id: string): Accessory | undefined => ACCESSORIES.find((a) => a.id === id);
/** the gift that a resident brings at level 4: one of the accessories that only he gives (a different one for each resident, by his name) */
export const GIFTS = ['balloons', 'medal', 'glasses', 'scarf', 'bow'];
export const giftOf = (id: string): string => GIFTS[[...id].reduce((a, c) => a + c.charCodeAt(0) * 7, 0) % GIFTS.length];

export interface FriendsSave {
  /** the hearts that each resident gave (the meter) */
  hearts: Record<string, number>;
  /** what each one wears */
  worn: Record<string, string[]>;
  /** the stall where each one works (a slot id) */
  job: Record<string, string>;
  /** the gifts that were already brought (resident id) */
  gifted: string[];
  /** the parties that were celebrated, by resident id: the month */
  party: Record<string, string>;
  /** counters for the quests: tricks seen, questions remembered, jobs given, parties */
  tricks: number;
  remembered: number;
  jobs: number;
  parties: number;
  /** the level that was last celebrated for each (so that "friends!" is said once) */
  seen: Record<string, number>;
}
export const emptyFriends = (): FriendsSave => ({ hearts: {}, worn: {}, job: {}, gifted: [], party: {}, tricks: 0, remembered: 0, jobs: 0, parties: 0, seen: {} });
const num = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? Math.floor(x) : 0);
const rec = <T>(x: unknown, f: (v: unknown) => T | null): Record<string, T> => {
  const out: Record<string, T> = {};
  if (x && typeof x === 'object') for (const [k, v] of Object.entries(x as Record<string, unknown>)) { const r = f(v); if (r !== null) out[k] = r; }
  return out;
};
/** reads what is saved (anything: a damaged value becomes empty) and puts it in `save.extra.friends` */
export function friendsOf(save: CarnivalSave): FriendsSave {
  const x = (save.extra as Record<string, unknown>).friends as Partial<FriendsSave> | undefined;
  if (x && (x as { _ok?: boolean })._ok) return x as FriendsSave;
  const f: FriendsSave = {
    hearts: rec(x?.hearts, (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null)),
    worn: rec(x?.worn, (v) => (Array.isArray(v) ? v.filter((a): a is string => typeof a === 'string').slice(0, 4) : null)),
    job: rec(x?.job, (v) => (typeof v === 'string' ? v : null)),
    gifted: Array.isArray(x?.gifted) ? x!.gifted.filter((a): a is string => typeof a === 'string') : [],
    party: rec(x?.party, (v) => (typeof v === 'string' ? v : null)),
    tricks: num(x?.tricks), remembered: num(x?.remembered), jobs: num(x?.jobs), parties: num(x?.parties),
    seen: rec(x?.seen, (v) => num(v)),
  };
  Object.defineProperty(f, '_ok', { value: true, enumerable: false });
  (save.extra as Record<string, unknown>).friends = f;
  return f;
}
/** a resident gave hearts: the meter goes up (never down). Returns the new level if it rose, else 0. */
export function addFriendship(save: CarnivalSave, id: string, hearts: number): number {
  const f = friendsOf(save);
  const before = friendLevel(f.hearts[id] ?? 0);
  f.hearts[id] = (f.hearts[id] ?? 0) + Math.max(0, Math.floor(hearts));
  const after = friendLevel(f.hearts[id]);
  return after > before ? after : 0;
}
export const levelOfResident = (save: CarnivalSave, id: string): number => friendLevel(friendsOf(save).hearts[id] ?? 0);
export const maxFriendLevel = (save: CarnivalSave): number => Math.max(1, ...Object.values(friendsOf(save).hearts).map(friendLevel));
/** what a resident wears (the chef's hat while he works at a stall is not saved: it shows by the job) */
export function wearing(save: CarnivalSave, id: string): string[] {
  const f = friendsOf(save);
  const out = [...(f.worn[id] ?? [])];
  if (f.job[id]) out.push('chefhat');
  if (levelOfResident(save, id) >= 5) out.push('crown');
  return [...new Set(out)];
}
