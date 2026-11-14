/**
 * The talks (SPEC-carnival.md 4.4): a short question that a resident asks Rani, maths or English. Pure: a question is made from a seed, the level of
 * the maths of the gate, and the words that Rani has learned. Every number is inside the level, and every question has exactly one right answer.
 */
import { levelConfig } from '../../../math/levels';
import { WORDS } from '../../../games/english/content/words';
import { dueWords, type Words } from '../../../games/english/engine/progress';

export type TalkKind = 'together' | 'exact' | 'more' | 'missing' | 'can' | 'what' | 'hello';
export type Subject = 'math' | 'english';
export const SUBJECT: Record<TalkKind, Subject> = { together: 'math', exact: 'math', more: 'math', missing: 'math', can: 'english', what: 'english', hello: 'english' };
export const MATH_KINDS: TalkKind[] = ['together', 'exact', 'more', 'missing'];
/** the maths type that the answer counts as, for the gate's adaptive level */
export const MATH_TYPE: Record<string, 'add' | 'count' | 'compare' | 'sub'> = { together: 'add', exact: 'count', more: 'compare', missing: 'sub' };

export interface Item { id: string; emoji: string; he: string; /** can be eaten ("what is missing": I ate...) */ food: boolean }
/** feminine plurals, so that the numbers (one, two, three...) fit them */
export const ITEMS: Item[] = [
  { id: 'candy', emoji: '🍬', he: 'סוכריות', food: true },
  { id: 'cookie', emoji: '🍪', he: 'עוגיות', food: true },
  { id: 'icecream', emoji: '🍦', he: 'גלידות', food: true },
  { id: 'pizza', emoji: '🍕', he: 'פיצות', food: true },
  { id: 'car', emoji: '🚗', he: 'מכוניות', food: false },
];

export type Talk =
  | { kind: 'together'; a: number; b: number; item: Item; answer: number; choices: number[] }
  | { kind: 'exact'; n: number; pile: number; item: Item }
  | { kind: 'more'; a: number; b: number; ask: 'more' | 'less'; item: Item; answer: 0 | 1 }
  | { kind: 'missing'; a: number; b: number; item: Item; answer: number; choices: number[] }
  | { kind: 'can'; word: string; options: string[]; answer: number }
  | { kind: 'what'; word: string; options: string[]; answer: number }
  | { kind: 'hello'; self: string; names: string[]; answer: number };

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const int = (r: () => number, lo: number, hi: number): number => lo + Math.floor(r() * (hi - lo + 1));
function shuffle<T>(a: T[], r: () => number): T[] {
  const o = a.slice();
  for (let i = o.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [o[i], o[j]] = [o[j], o[i]];
  }
  return o;
}

/** Three choices: the answer and two numbers near it, inside 0..max, all different. */
export function choices3(answer: number, max: number, r: () => number): number[] {
  const near = shuffle([-2, -1, 1, 2, -3, 3].map((d) => answer + d).filter((v) => v >= 0 && v <= max && v !== answer), r);
  const pool = [...near];
  for (let v = 0; v <= max && pool.length < 2; v++) if (v !== answer && !pool.includes(v)) pool.push(v);
  return shuffle([answer, pool[0], pool[1]], r);
}

export const WORD_NAMES = new Map(WORDS.map((w) => [w.id, w.label ?? w.id]));
/** only things that can be held or pointed at are asked (not verbs, family or weather) */
export const ASKABLE = new Set(WORDS.filter((w) => w.askable).map((w) => w.id));

/** The words to ask, the ones that are due first (the longest overdue), then the least known, then the others: only words that she has seen. */
export function learnedWords(words: Words, today: number): string[] {
  const seen = Object.entries(words).filter(([id, w]) => w.seen && ASKABLE.has(id));
  const due = dueWords(words, today).filter((id) => ASKABLE.has(id));
  const rest = seen.filter(([id]) => !due.includes(id)).sort((a, b) => a[1].level - b[1].level).map(([id]) => id);
  return [...due, ...rest];
}

export interface TalkEnv {
  /** the maths level of the gate (1..5) */
  level: number;
  words: Words;
  today: number;
  /** her name and the names that are not hers, for "Hello" */
  name: string;
  otherNames: string[];
  /** the resident who is talking (for "I'm Mozzi") */
  resident: string;
}

/** A talk of this kind from a seed (null when it cannot be made: not enough words learned). */
export function makeTalk(kind: TalkKind, seed: number, env: TalkEnv): Talk | null {
  const r = rng(seed);
  const cfg = levelConfig(env.level);
  const max = cfg.max;
  // "what is missing" is about eating: food only; cars stay in the other talks
  const pool = kind === 'missing' ? ITEMS.filter((i) => i.food) : ITEMS;
  const item = pool[int(r, 0, pool.length - 1)];
  if (kind === 'together') {
    for (let k = 0; k < 200; k++) {
      // the quantities that are said are 2 or more (a plural noun follows)
      const a = int(r, 2, max - 2), b = int(r, 2, max - a);
      if (a + b > max || b < 2) continue;
      if (cfg.noTenCrossing && (a % 10) + (b % 10) >= 10) continue;
      return { kind, a, b, item, answer: a + b, choices: choices3(a + b, max, r) };
    }
    return { kind, a: 2, b: 2, item, answer: 4, choices: choices3(4, max, r) };
  }
  if (kind === 'missing') {
    for (let k = 0; k < 200; k++) {
      const a = int(r, 2, max), b = int(r, 1, a - 1);
      if (cfg.noTenCrossing && a % 10 < b % 10) continue;
      return { kind, a, b, item, answer: a - b, choices: choices3(a - b, max, r) };
    }
    return { kind, a: 3, b: 1, item, answer: 2, choices: choices3(2, max, r) };
  }
  if (kind === 'exact') {
    // the pile is 12 things at most (each is 48 px to tap): so at most 9 are asked for
    const n = int(r, 2, Math.min(max, 9));
    return { kind, n, pile: Math.min(12, n + int(r, 3, 5)), item };
  }
  if (kind === 'more') {
    const cap = Math.min(max, 12);
    const a = int(r, 1, cap);
    let b = int(r, 1, cap);
    // from level 3 the piles differ by 1 to 3: there is something to count
    const near = env.level >= 3;
    for (let k = 0; k < 100 && (b === a || (near && Math.abs(a - b) > 3)); k++) b = int(r, 1, cap);
    if (b === a || (near && Math.abs(a - b) > 3)) b = a > 1 ? a - 1 : a + 1;
    const ask = r() < 0.7 ? 'more' : 'less';
    const answer = ask === 'more' ? (a > b ? 0 : 1) : a < b ? 0 : 1;
    return { kind, a, b, ask, item, answer };
  }
  const words = learnedWords(env.words, env.today);
  if (kind === 'can' || kind === 'what') {
    const need = kind === 'can' ? 3 : 2;
    if (words.length < need) return null;
    // the word that is most due, with a little variety among the first three
    const word = words[int(r, 0, Math.min(2, words.length - 1))];
    const others = shuffle(words.filter((w) => w !== word), r).slice(0, need - 1);
    const options = shuffle([word, ...others], r);
    return { kind, word, options, answer: options.indexOf(word) } as Talk;
  }
  // hello: her name among others
  const others = shuffle(env.otherNames.filter((n) => n !== env.name), r).slice(0, 2);
  const names = shuffle([env.name, ...others], r);
  return { kind: 'hello', self: env.resident, names, answer: names.indexOf(env.name) };
}

/** True when the talk has exactly one right answer and everything is inside the level. */
export function validTalk(t: Talk, level: number): boolean {
  const max = levelConfig(level).max;
  switch (t.kind) {
    case 'together':
      return t.a >= 2 && t.b >= 2 && t.a + t.b === t.answer && t.answer <= max && t.choices.length === 3 && new Set(t.choices).size === 3 && t.choices.filter((c) => c === t.answer).length === 1 && t.choices.every((c) => c >= 0 && c <= max);
    case 'missing':
      return t.item.food && t.b >= 1 && t.a > t.b && t.a <= max && t.a - t.b === t.answer && t.choices.length === 3 && new Set(t.choices).size === 3 && t.choices.filter((c) => c === t.answer).length === 1 && t.choices.every((c) => c >= 0 && c <= max);
    case 'exact':
      return t.n >= 2 && t.n <= max && t.pile > t.n && t.pile <= 12;
    case 'more':
      return t.a !== t.b && (level < 3 || Math.abs(t.a - t.b) <= 3) && t.a <= max && t.b <= max && (t.ask === 'more' ? (t.a > t.b ? 0 : 1) : t.a < t.b ? 0 : 1) === t.answer;
    case 'can':
    case 'what':
      return new Set(t.options).size === t.options.length && t.options.filter((o) => o === t.word).length === 1 && t.options[t.answer] === t.word && t.options.length === (t.kind === 'can' ? 3 : 2);
    case 'hello':
      return new Set(t.names).size === t.names.length && t.names[t.answer] !== undefined && t.names.filter((n) => n === t.names[t.answer]).length === 1;
  }
}

export interface Plan { last: Subject | null; retry: TalkKind[] }

/** Which kind of talk comes next: maths and English in turn; a talk that went wrong comes back (its kind); English only from learned words (none: only "Hello"). */
export function nextKind(plan: Plan, env: Pick<TalkEnv, 'words' | 'today'>, seed: number): TalkKind {
  const r = rng(seed);
  const subject: Subject = plan.last === 'math' ? 'english' : 'math';
  const learned = learnedWords(env.words, env.today).length;
  const again = plan.retry.find((k) => SUBJECT[k] === subject && (k === 'hello' || learned >= (k === 'can' ? 3 : 2) || SUBJECT[k] === 'math'));
  if (again) return again;
  if (subject === 'math') return MATH_KINDS[int(r, 0, MATH_KINDS.length - 1)];
  if (learned < 2) return 'hello';
  const pool: TalkKind[] = learned >= 3 ? ['can', 'can', 'what', 'what', 'hello'] : ['what', 'what', 'hello'];
  return pool[int(r, 0, pool.length - 1)];
}
