/** What Rani knows of each word (Leitner boxes), and where she is on the map. Pure: no DOM, no clock (the day is passed in). */

export interface WordState {
  /** 0 = new, 1..5 = how well she knows it */
  level: number;
  /** the day number (days since 1970) when it comes back */
  due: number;
  /** she has seen its card */
  seen: boolean;
  /** a parent marked it as already known: it comes back as a light review, not as a new word */
  known?: boolean;
}
export type Words = Record<string, WordState>;

/** Days until the word returns after reaching level 1..5 (SPEC-english.md section 6: 1, 2, 4, 7 and 14 days). */
export const INTERVALS = [1, 2, 4, 7, 14];
export const KNOWN_LEVEL = 4;

export const dayNumber = (d: Date = new Date()): number => Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);

const fresh = (): WordState => ({ level: 0, due: 0, seen: false });

/** A right answer at the first try: one level up and later return. A mistake: back to level 1, tomorrow. */
export function review(words: Words, id: string, firstTry: boolean, today: number): Words {
  const cur = words[id] ?? fresh();
  const level = firstTry ? Math.min(5, cur.level + 1) : 1;
  const next: WordState = { ...cur, seen: true, level, due: today + INTERVALS[level - 1] };
  return { ...words, [id]: next };
}

export const isKnown = (w: WordState | undefined): boolean => !!w && (w.known === true || w.level >= KNOWN_LEVEL);

/** Words whose time has come, the longest overdue first (words never seen are not "due": they are new). */
export function dueWords(words: Words, today: number): string[] {
  return Object.entries(words)
    .filter(([, w]) => w.seen && w.due <= today)
    .sort((a, b) => a[1].due - b[1].due)
    .map(([id]) => id);
}

/** Marks a word as seen (its card was shown) without scoring it. */
export function markSeen(words: Words, id: string, today: number): Words {
  const cur = words[id] ?? fresh();
  if (cur.seen) return words;
  return { ...words, [id]: { ...cur, seen: true, due: today } };
}

export function knownCount(words: Words): number {
  return Object.values(words).filter((w) => isKnown(w)).length;
}

// ---- the map ----

export const STATIONS_PER_WORLD = 5;
export interface MapProgress {
  /** stations finished in each world (0..5; the fifth is the rescue) */
  done: Record<number, number>;
  /** the stars of each station, e.g. "1-3" -> 2 */
  stars: Record<string, number>;
  rescued: string[];
}
export const emptyMap = (): MapProgress => ({ done: {}, stars: {}, rescued: [] });

/** World 1 is open; a world opens when the one before it is finished (its rescue station done). */
export function worldOpen(map: MapProgress, world: number): boolean {
  return world === 1 || (map.done[world - 1] ?? 0) >= STATIONS_PER_WORLD;
}
/** A station is open when the ones before it in its world are done. */
export function stationOpen(map: MapProgress, world: number, station: number): boolean {
  return worldOpen(map, world) && station <= (map.done[world] ?? 0);
}
export function finishStation(map: MapProgress, world: number, station: number, stars: number): MapProgress {
  const key = `${world}-${station}`;
  const done = { ...map.done, [world]: Math.max(map.done[world] ?? 0, station + 1) };
  return { ...map, done, stars: { ...map.stars, [key]: Math.max(map.stars[key] ?? 0, stars) } };
}
