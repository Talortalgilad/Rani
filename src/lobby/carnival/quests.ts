/** The quests (SPEC-carnival.md 7): one is active at a time, from the resident of Rani, shown in a small strip at the top; each gives hearts, now and then a star. Pure. */
import { itemById } from './catalog';

export interface QuestCtx {
  built: Record<string, string>;
  level: number;
  /** residents tapped, rounds of games played, right answers in talks */
  taps: number;
  rounds: number;
  answers: number;
}
export interface Quest { id: string; he: string; hearts: number; stars?: number; done(c: QuestCtx): boolean }

const items = (c: QuestCtx): string[] => Object.values(c.built);
const kinds = (c: QuestCtx, kind: string): number => items(c).filter((i) => itemById(i)?.kind === kind).length;
const slotOf = (c: QuestCtx, slot: string): number => items(c).filter((i) => itemById(i)?.slot === slot).length;

/** the first ten, in this order (the guide leads her through them) */
export const QUESTS: Quest[] = [
  { id: 'pizza', he: 'פתחי דוכן פיצה', hearts: 3, done: (c) => items(c).includes('pizzastand') },
  { id: 'name', he: 'הקישי על סקווישי ושמעי איך קוראים לו', hearts: 2, done: (c) => c.taps >= 1 },
  { id: 'drink', he: 'פתחי דוכן שתייה', hearts: 3, done: (c) => kinds(c, 'drink') >= 1 },
  { id: 'play', he: 'שחקי באחד המשחקים', hearts: 3, stars: 1, done: (c) => c.rounds >= 1 },
  { id: 'lvl2', he: 'הגיעי לרמה 2', hearts: 3, done: (c) => c.level >= 2 },
  { id: 'talk', he: 'עני על שיחה של סקווישי', hearts: 3, done: (c) => c.answers >= 1 },
  { id: 'ride', he: 'פתחי מתקן', hearts: 4, stars: 1, done: (c) => slotOf(c, 'ride') >= 1 },
  { id: 'three', he: 'פתחי שלושה דוכנים', hearts: 4, done: (c) => slotOf(c, 'stall') >= 3 },
  { id: 'lvl3', he: 'הגיעי לרמה 3', hearts: 4, done: (c) => c.level >= 3 },
  { id: 'five', he: 'פתחי חמישה דברים בקרנבל', hearts: 5, stars: 2, done: (c) => items(c).length >= 5 },
];
export const questById = (id: string): Quest | undefined => QUESTS.find((q) => q.id === id);
/** the quest that is active: the first that is not done (null when all ten are done) */
export const activeQuest = (done: string[]): Quest | null => QUESTS.find((q) => !done.includes(q.id)) ?? null;
/** the quests that became done now: they are all given (a quest can be done before it is active; it counts when its turn comes) */
export function finishedNow(done: string[], c: QuestCtx): Quest[] {
  const out: Quest[] = [];
  const have = [...done];
  for (let a = activeQuest(have); a && a.done(c); a = activeQuest(have)) {
    out.push(a);
    have.push(a.id);
  }
  return out;
}
export const questLine = (q: Quest): string => `qs_${q.id}`;
