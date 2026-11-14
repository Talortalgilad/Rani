/** What Lolly remembers (SPEC-tutor.md section 7). Saved on the phone only, under `tutor`. Pure: the day is passed in. */
import type { Lesson } from './lessons';

export interface TutorState {
  v: 1;
  /** the lessons that were finished, in the order they were finished */
  done: string[];
  /** the day number of the last NEW lesson that was finished (one new lesson a day) */
  lastDay: number;
  /** a lesson that was left in the middle: it continues from this step next time */
  progress: { lesson: string; step: number } | null;
  /** how she felt today (only the last day is kept) */
  feeling: { day: number; feel: string } | null;
  /** what she likes (true) and does not like (false) */
  likes: Record<string, boolean>;
  /** exercises that took three tries, as "<lesson>#<step>" (for the review lessons) */
  weak: string[];
  /** the sticker of each finished lesson: lesson id -> picture id */
  stickers: Record<string, string>;
}
export const emptyTutor = (): TutorState => ({ v: 1, done: [], lastDay: -1, progress: null, feeling: null, likes: {}, weak: [], stickers: {} });

/** What of the state is safe to use: an old or damaged save becomes an empty one. */
export function loadTutor(x: unknown): TutorState {
  const s = x as Partial<TutorState> | null;
  if (!s || s.v !== 1) return emptyTutor();
  return { ...emptyTutor(), ...s, done: Array.isArray(s.done) ? s.done : [], likes: s.likes ?? {}, weak: Array.isArray(s.weak) ? s.weak : [], stickers: s.stickers ?? {} };
}

export const isDone = (s: TutorState, id: string): boolean => s.done.includes(id);
export const doneToday = (s: TutorState, today: number): boolean => s.lastDay === today;

/** A unit opens when every lesson of the unit before it is done (unit 1 is open at once). */
export function unitOpen(lessons: Lesson[], s: TutorState, unit: number, openAll = false): boolean {
  if (openAll) return true;
  const before = [...new Set(lessons.map((l) => l.unit))].filter((u) => u < unit);
  return before.every((u) => lessons.filter((l) => l.unit === u).every((l) => isDone(s, l.id)));
}

/** The new lesson of the day: the first one not done in an open unit (and one the engine can run). */
export function nextNew(lessons: Lesson[], s: TutorState, can: (l: Lesson) => boolean, openAll = false): Lesson | null {
  return lessons.find((l) => !isDone(s, l.id) && can(l) && unitOpen(lessons, s, l.unit, openAll)) ?? null;
}

/** May this lesson be started now? A new lesson once a day; a lesson that was done can be done again whenever; one that is left in the middle continues. */
export type Access = 'ok' | 'doneToday' | 'locked';
export function access(lessons: Lesson[], s: TutorState, lesson: Lesson, today: number, can: (l: Lesson) => boolean, openAll = false): Access {
  if (isDone(s, lesson.id)) return 'ok';
  if (s.progress?.lesson === lesson.id) return 'ok';
  if (!can(lesson) || !unitOpen(lessons, s, lesson.unit, openAll)) return 'locked';
  // not the first one not done: wait for the ones before it in the same unit
  const next = nextNew(lessons, s, can, openAll);
  if (next?.id !== lesson.id) return 'locked';
  return doneToday(s, today) && !openAll ? 'doneToday' : 'ok';
}

export const saveProgress = (s: TutorState, lesson: string, step: number): TutorState => ({ ...s, progress: { lesson, step } });
export const leave = (s: TutorState): TutorState => s;

/** The lesson ends with its sticker: it is done (the first time: the new lesson of today), and the place in it is forgotten. */
export function finish(s: TutorState, lesson: string, sticker: string, today: number): TutorState {
  const first = !isDone(s, lesson);
  return {
    ...s,
    done: first ? [...s.done, lesson] : s.done,
    lastDay: first ? today : s.lastDay,
    progress: s.progress?.lesson === lesson ? null : s.progress,
    stickers: first ? { ...s.stickers, [lesson]: sticker } : s.stickers,
  };
}

export const setFeeling = (s: TutorState, day: number, feel: string): TutorState => ({ ...s, feeling: { day, feel } });
export const setLike = (s: TutorState, food: string, like: boolean): TutorState => ({ ...s, likes: { ...s.likes, [food]: like } });
export const addWeak = (s: TutorState, key: string): TutorState => (s.weak.includes(key) ? s : { ...s, weak: [...s.weak, key].slice(-40) });
export const resetTutor = (): TutorState => emptyTutor();
