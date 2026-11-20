/** The quests (SPEC-carnival.md 7): one is active at a time, from the resident of Rani, shown in a small strip at the top; each gives hearts, now and then a star. Pure. */
import { itemById } from './catalog';
import QUESTS_LATER from './quests-later.json';

export interface QuestCtx {
  built: Record<string, string>;
  level: number;
  /** residents tapped, rounds of games played, right answers in talks */
  taps: number;
  rounds: number;
  answers: number;
  /** stage 3: the best level of friendship, the tricks seen, the jobs given, the questions remembered, the parties, and Lolly's lessons and the squishies of the workshop (a count each) */
  friend?: number;
  tricks?: number;
  jobs?: number;
  /** hats that were dressed on a squishy from the shop */
  hats?: number;
  remembered?: number;
  parties?: number;
  lolly?: number;
  workshop?: number;
  /** stage 4: eggs hatched, letters opened, gifts of the day opened, guests who stayed, parades joined */
  hatched?: number;
  letters?: number;
  gifts?: number;
  stayed?: number;
  parades?: number;
}
export interface Quest { id: string; he: string; hearts: number; stars?: number; done(c: QuestCtx): boolean }

const items = (c: QuestCtx): string[] => Object.values(c.built);
const kinds = (c: QuestCtx, kind: string): number => items(c).filter((i) => itemById(i)?.kind === kind).length;
const slotOf = (c: QuestCtx, slot: string): number => items(c).filter((i) => itemById(i)?.slot === slot).length;

/** the first ten, in this order (the guide leads her through them); stage 3 adds seven after them */
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
/** the quests of stage 3 (their sentences are in quests-later.json, recorded in advance) */
const LATER = Object.fromEntries((QUESTS_LATER as { id: string; text: string }[]).map((q) => [q.id, q.text]));
QUESTS.push(
  { id: 'friend', he: LATER.qs_friend, hearts: 5, done: (c) => (c.friend ?? 1) >= 2 },
  { id: 'trick', he: LATER.qs_trick, hearts: 4, done: (c) => (c.tricks ?? 0) >= 1 },
  { id: 'job', he: LATER.qs_job, hearts: 5, stars: 1, done: (c) => (c.jobs ?? 0) >= 1 },
  { id: 'hat', he: LATER.qs_hat, hearts: 4, done: (c) => (c.hats ?? 0) >= 1 },
  { id: 'remember', he: LATER.qs_remember, hearts: 5, stars: 1, done: (c) => (c.remembered ?? 0) >= 1 },
  { id: 'party', he: LATER.qs_party, hearts: 6, stars: 1, done: (c) => (c.parties ?? 0) >= 1 },
  { id: 'lolly', he: LATER.qs_lolly, hearts: 5, stars: 1, done: (c) => (c.lolly ?? 0) >= 1 },
  { id: 'workshop', he: LATER.qs_workshop, hearts: 5, stars: 1, done: (c) => (c.workshop ?? 0) >= 1 },
  { id: 'egg', he: LATER.qs_egg, hearts: 5, stars: 1, done: (c) => (c.hatched ?? 0) >= 1 },
  { id: 'mail', he: LATER.qs_mail, hearts: 4, done: (c) => (c.letters ?? 0) >= 1 },
  { id: 'gift', he: LATER.qs_gift, hearts: 4, done: (c) => (c.gifts ?? 0) >= 1 },
  { id: 'visitor', he: LATER.qs_visitor, hearts: 5, stars: 1, done: (c) => (c.stayed ?? 0) >= 1 },
  { id: 'parade', he: LATER.qs_parade, hearts: 5, stars: 1, done: (c) => (c.parades ?? 0) >= 1 },
);
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
