/**
 * What opens what (SPEC-carnival.md 5.6): every item of the catalog has ONE condition in `Item.unlock`, here it is read. An item is open when the world of the word
 * journey that it is tied to was finished (or the unit of Miss Lolly), and it is bought with stars as well. Pure: what Rani did comes in as `Progress`.
 */
import { ITEMS, type Item, type Unlock } from './catalog';

export interface Progress {
  /** the worlds (1-12) of the word journey whose five stations are all done */
  worlds: number[];
  /** the units (1-3) of Miss Lolly whose lessons are all done */
  units: number[];
}
export const emptyProgress = (): Progress => ({ worlds: [], units: [] });

export const isOpen = (u: Unlock, p: Progress): boolean => u.kind === 'always' || (u.kind === 'world' ? p.worlds.includes(u.n) : p.units.includes(u.n));
export const isItemOpen = (i: Item, p: Progress): boolean => isOpen(i.unlock, p);
export const openItems = (p: Progress): Item[] => ITEMS.filter((i) => isItemOpen(i, p));

/** What is still needed to open an item, for the locked card ("finish world 2 of the word journey"). */
export const needed = (i: Item): { kind: 'world' | 'unit'; n: number } | null => (i.unlock.kind === 'always' ? null : { kind: i.unlock.kind, n: i.unlock.n });

/** Worlds and units that exist: no item may wait for something that cannot happen. */
export const WORLDS = 12;
export const UNITS = 3;
export const reachable = (u: Unlock): boolean => u.kind === 'always' || (u.kind === 'world' ? u.n >= 1 && u.n <= WORLDS : u.n >= 1 && u.n <= UNITS);

/** Rani's progress, read from what the English game saved (`map.done`: stations done in each world; `tutor.done`: lessons done). */
export function progressFromEnglish(en: unknown, lessonsByUnit: Record<number, string[]>): Progress {
  const e = (en ?? {}) as { map?: { done?: Record<number, number> }; tutor?: { done?: string[] } };
  const done = e.map?.done ?? {};
  const worlds = Object.entries(done).filter(([, n]) => Number(n) >= 5).map(([w]) => Number(w));
  const had = new Set(e.tutor?.done ?? []);
  const units = Object.entries(lessonsByUnit).filter(([, ls]) => ls.length > 0 && ls.every((l) => had.has(l))).map(([u]) => Number(u));
  return { worlds, units };
}
