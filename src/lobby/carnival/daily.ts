/**
 * Reasons to come back tomorrow (SPEC-carnival.md 4.7): an egg that sleeps one night, the guest of the day, the mailbox, the gift of the day, "we collected for you", morning and night,
 * the parade of Friday. Pure: everything is by the DAY (a date, from the clock that the world is given: a fake one in the tests and in the parents' area), never by a timer.
 * The rules that are never broken: no streak that can break, no countdown, no sad squishy, no push notifications; one who did not come for a week lost nothing, everything waits for her.
 */
import type { CarnivalSave } from './talk/state';
import { NEW_RESIDENTS } from './residents';
import { WORDS } from '../../games/english/content/words';

/** the new residents that come from the levels are the first six; the eggs and the guests bring the other twelve, in the order of the list */
export const FROM_EGGS = NEW_RESIDENTS.slice(6);
export const COLLECT_PER_DAY = 2;
/** "we collected for you": at most this many hearts, however long she was away */
export const COLLECT_CAP = 10;
export const MAX_LETTERS = 80;
export const EGG_EVERY = 2;

export interface Letter { day: string; from: string; pic: string; line: 0 | 1 | 2 }
export interface Egg { id: string; found: string }
export interface Guest { day: string; id: string; talked: boolean; stayed: boolean }
export interface DailySave {
  /** the day of the last visit ('' before the first) */
  lastDay: string;
  /** the eggs that sleep (the squishy inside is chosen when the egg is found) */
  eggs: Egg[];
  /** the levels that already gave an egg */
  eggLevels: number[];
  /** the ones who hatched (they grow with the friendship) */
  baby: string[];
  guest: Guest | null;
  /** the album of letters (all that she opened) */
  letters: Letter[];
  mailDay: string;
  giftDay: string;
  collectedDay: string;
  paradeDay: string;
  /** counters for the quests */
  hatched: number;
  gifts: number;
  stayed: number;
  parades: number;
  /** a decoration from the gift of the day that is built for free: the ids */
  freeDecor: string[];
  /** the places where a free decoration stands (taking it back gives no stars: it was free) */
  freeBuilt: string[];
  /** for the parents' area (testing): days skipped forward on the clock of the carnival */
  skip: number;
}
export const emptyDaily = (): DailySave => ({ lastDay: '', eggs: [], eggLevels: [], baby: [], guest: null, letters: [], mailDay: '', giftDay: '', collectedDay: '', paradeDay: '', hatched: 0, gifts: 0, stayed: 0, parades: 0, freeDecor: [], freeBuilt: [], skip: 0 });

const str = (x: unknown): string => (typeof x === 'string' ? x : '');
const cnt = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? Math.floor(x) : 0);
const strs = (x: unknown): string[] => (Array.isArray(x) ? x.filter((a): a is string => typeof a === 'string') : []);
/** reads what is saved (anything: a damaged value becomes empty) and keeps it in `save.extra.daily` */
export function dailyOf(save: CarnivalSave): DailySave {
  const x = (save.extra as Record<string, unknown>).daily as Partial<DailySave> | undefined;
  if (x && (x as { _ok?: boolean })._ok) return x as DailySave;
  const g = x?.guest;
  const d: DailySave = {
    lastDay: str(x?.lastDay),
    eggs: (Array.isArray(x?.eggs) ? x!.eggs : []).filter((e) => e && typeof e.id === 'string' && typeof e.found === 'string').map((e) => ({ id: e.id, found: e.found })).slice(0, 4),
    eggLevels: (Array.isArray(x?.eggLevels) ? x!.eggLevels : []).filter((n): n is number => typeof n === 'number'),
    baby: strs(x?.baby),
    guest: g && typeof g.id === 'string' && typeof g.day === 'string' ? { day: g.day, id: g.id, talked: g.talked === true, stayed: g.stayed === true } : null,
    letters: (Array.isArray(x?.letters) ? x!.letters : []).filter((l) => l && typeof l.day === 'string' && typeof l.from === 'string' && typeof l.pic === 'string' && [0, 1, 2].includes(l.line)).map((l) => ({ day: l.day, from: l.from, pic: l.pic, line: l.line })).slice(-MAX_LETTERS),
    mailDay: str(x?.mailDay), giftDay: str(x?.giftDay), collectedDay: str(x?.collectedDay), paradeDay: str(x?.paradeDay),
    hatched: cnt(x?.hatched), gifts: cnt(x?.gifts), stayed: cnt(x?.stayed), parades: cnt(x?.parades),
    freeDecor: strs(x?.freeDecor), freeBuilt: strs(x?.freeBuilt), skip: Math.min(3650, cnt(x?.skip)),
  };
  Object.defineProperty(d, '_ok', { value: true, enumerable: false });
  (save.extra as Record<string, unknown>).daily = d;
  return d;
}

// ---------------------------------------------------------------- the day
const p2 = (n: number): string => String(n).padStart(2, '0');
export const dayKey = (d: Date): string => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const dayIndex = (key: string): number => { const [y, m, d] = key.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); };
/** whole days from one day to another (0 on the same day; never negative: a clock that went back is the same day) */
export const daysBetween = (from: string, to: string): number => (from ? Math.max(0, dayIndex(to) - dayIndex(from)) : 0);
/** the clock of the carnival: the real one, and the days that the parents' area skipped */
export const clockOf = (base: Date, skip: number): Date => new Date(base.getFullYear(), base.getMonth(), base.getDate() + skip, base.getHours(), base.getMinutes(), base.getSeconds());
export const isFriday = (d: Date): boolean => d.getDay() === 5;
export type Greeting = 'morning' | 'night' | null;
/** "good morning" in the morning (5:00-12:00), "good night" after 19:00 */
export const greetingAt = (d: Date): Greeting => (d.getHours() >= 19 || d.getHours() < 5 ? 'night' : d.getHours() < 12 ? 'morning' : null);
export const isNightAt = (d: Date): boolean => greetingAt(d) === 'night';

const hash = (s: string): number => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 11);

// ---------------------------------------------------------------- the egg
/** every second level (4, 6, 8 ...) brings an egg, once for each level */
export const eggAtLevel = (level: number): boolean => level >= 4 && level % EGG_EVERY === 0;
/** the next squishy that can come from an egg or as a guest: not here yet, not in an egg, not the guest now */
export function nextNewcomer(arrived: string[], d: DailySave, day: string): string | null {
  const taken = new Set([...arrived, ...d.eggs.map((e) => e.id), ...(d.guest && d.guest.day === day && !d.guest.stayed ? [d.guest.id] : [])]);
  return FROM_EGGS.find((id) => !taken.has(id)) ?? null;
}
/** the egg that hatches on this visit: the oldest one that was found before today (an egg sleeps one night; one hatches for each day she comes) */
export const hatchable = (d: DailySave, day: string): Egg | null => d.eggs.find((e) => e.found !== day) ?? null;
/** the size of a baby by the friendship: 60 %, 80 % at level 2, 100 % at level 3 */
export const growthOf = (friendLevel: number): number => (friendLevel >= 3 ? 1 : friendLevel === 2 ? 0.8 : 0.6);

// ---------------------------------------------------------------- the guest of the day
/** the guest of this day: the same one all day; when it is a new day the next one (one that did not stay may come again) */
export function guestFor(arrived: string[], d: DailySave, day: string): string | null {
  if (d.guest && d.guest.day === day) return d.guest.id;
  const pool = FROM_EGGS.filter((id) => !arrived.includes(id) && !d.eggs.some((e) => e.id === id));
  return pool.length ? pool[(dayIndex(day) + (d.guest ? 1 : 0)) % pool.length] : null;
}

// ---------------------------------------------------------------- the mailbox
const WORD_IDS = WORDS.map((w) => w.id);
/** the letter of the day: from one of the residents, a picture of the game in a frame, and one of the three recorded sentences (cs_letter.0-2) */
export function letterFor(day: string, residentIds: string[]): Letter {
  const h = hash(day);
  return { day, from: residentIds[h % residentIds.length], pic: WORD_IDS[(h >>> 3) % WORD_IDS.length], line: ((h >>> 9) % 3) as 0 | 1 | 2 };
}

// ---------------------------------------------------------------- the gift of the day
export type Gift = { kind: 'hearts'; n: number } | { kind: 'decor'; id: string } | { kind: 'accessory'; id: string };
export const GIFT_ACCESSORIES = ['partyhat', 'flowercrown', 'bow', 'glasses', 'sunglasses', 'scarf', 'cape'];
/** hearts, a decoration (built for free) or an accessory (to the stock): by the day */
export function giftFor(day: string, decorIds: string[]): Gift {
  const h = dayIndex(day);
  const k = h % 3;
  if (k === 1 && decorIds.length) return { kind: 'decor', id: decorIds[(h >> 1) % decorIds.length] };
  if (k === 2) return { kind: 'accessory', id: GIFT_ACCESSORIES[(h >> 1) % GIFT_ACCESSORIES.length] };
  return { kind: 'hearts', n: 3 };
}

// ---------------------------------------------------------------- "we collected for you"
/** the hearts that the squishies collected while she was away: a few for each day, with a ceiling; nothing when she was not away */
export const collectedFor = (daysAway: number): number => Math.min(COLLECT_CAP, Math.max(0, daysAway) * COLLECT_PER_DAY);
