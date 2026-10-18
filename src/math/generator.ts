import type { QuestionType } from '../storage';
import { levelConfig, type LevelConfig } from './levels';
import { numberToHebrew as w } from './hebrew';

export type Rng = () => number;

export type Hint =
  | { kind: 'dots'; a: number; b: number; op: '+' | '-'; ghostSecond?: boolean }
  | { kind: 'numberline'; max: number; marks: number[] }
  | { kind: 'count'; n: number }
  | { kind: 'tenframe'; filled: number }
  | { kind: 'step'; delta: number };

export type Visual = { kind: 'emoji'; emoji: string; n: number } | { kind: 'tenframe'; filled: number };

export interface Question {
  type: QuestionType;
  key: string;
  /** Text shown big. Expressions are LTR; compare prompts are Hebrew. */
  text: string;
  ltr: boolean;
  visual?: Visual;
  speech: string;
  answer: number;
  choices: number[];
  hint: Hint;
}

const FRUITS: [string, string][] = [
  ['🍎', 'תפוחים'], ['⭐', 'כוכבים'], ['🎈', 'בלונים'], ['🌸', 'פרחים'], ['🐟', 'דגים'], ['🍓', 'תותים'],
];

const int = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));

function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Wrong answers close to the right one: never negative, never equal, preferring within the level ceiling. */
function distractors(answer: number, ceiling: number, rng: Rng, count: number): number[] {
  const ring = (offsets: number[], inCeiling: boolean) =>
    shuffle(offsets, rng)
      .map((o) => answer + o)
      .filter((v) => v >= 0 && v !== answer && (!inCeiling || v <= ceiling));
  const pool = [
    ...ring([-2, -1, 1, 2], true),
    ...ring([-4, -3, 3, 4], true),
    ...ring([-2, -1, 1, 2, 3, 4], false),
  ];
  return [...new Set(pool)].slice(0, count);
}

function withChoices(answer: number, ceiling: number, rng: Rng) {
  return shuffle([answer, ...distractors(answer, ceiling, rng, 2)], rng);
}

type Maker = (cfg: LevelConfig, rng: Rng) => Question;

const makers: Record<QuestionType, Maker> = {
  count(cfg, rng) {
    const n = int(rng, 1, Math.min(cfg.max, 10));
    const [emoji, name] = FRUITS[int(rng, 0, FRUITS.length - 1)];
    return {
      type: 'count', key: `count:${n}`, text: '', ltr: true,
      visual: { kind: 'emoji', emoji, n },
      speech: `כמה ${name} יש?`,
      answer: n, choices: withChoices(n, Math.min(cfg.max, 10), rng),
      hint: { kind: 'count', n },
    };
  },

  add(cfg, rng) {
    for (;;) {
      const a = int(rng, 1, cfg.max - 1);
      const b = int(rng, 1, cfg.max - a);
      if (cfg.noTenCrossing && (a % 10) + (b % 10) >= 10) continue;
      return {
        type: 'add', key: `add:${a}+${b}`, text: `${a} + ${b} = ?`, ltr: true,
        speech: `כמה זה ${w(a)} ועוד ${w(b)}?`,
        answer: a + b, choices: withChoices(a + b, cfg.max, rng),
        hint: { kind: 'dots', a, b, op: '+' },
      };
    }
  },

  sub(cfg, rng) {
    for (;;) {
      const a = int(rng, 2, cfg.max);
      const b = int(rng, 1, a);
      if (cfg.noTenCrossing && a % 10 < b % 10) continue;
      return {
        type: 'sub', key: `sub:${a}-${b}`, text: `${a} − ${b} = ?`, ltr: true,
        speech: `כמה זה ${w(a)} פחות ${w(b)}?`,
        answer: a - b, choices: withChoices(a - b, cfg.max, rng),
        hint: { kind: 'dots', a, b, op: '-' },
      };
    }
  },

  missing(cfg, rng) {
    for (;;) {
      const c = int(rng, 2, cfg.max);
      const a = int(rng, 1, c - 1);
      const b = c - a;
      if (cfg.noTenCrossing && (a % 10) + (b % 10) >= 10) continue;
      return {
        type: 'missing', key: `missing:${a}+?=${c}`, text: `${a} + ? = ${c}`, ltr: true,
        speech: `${w(a)} ועוד כמה זה ${w(c)}?`,
        answer: b, choices: withChoices(b, cfg.max, rng),
        hint: { kind: 'dots', a, b, op: '+', ghostSecond: true },
      };
    }
  },

  compare(cfg, rng) {
    const a = int(rng, 1, cfg.max);
    let b = int(rng, 1, cfg.max - 1);
    if (b >= a) b++;
    const bigger = rng() < 0.5;
    const answer = bigger ? Math.max(a, b) : Math.min(a, b);
    return {
      type: 'compare', key: `cmp:${Math.min(a, b)},${Math.max(a, b)},${bigger}`,
      text: bigger ? 'איזה גדול יותר?' : 'איזה קטן יותר?', ltr: false,
      speech: `איזה מספר ${bigger ? 'גדול' : 'קטן'} יותר, ${w(a)} או ${w(b)}?`,
      answer, choices: shuffle([a, b], rng),
      hint: { kind: 'numberline', max: cfg.max, marks: [a, b] },
    };
  },

  sequence(cfg, rng) {
    const d = [1, 2, 3, 5][int(rng, 0, 3)];
    const down = rng() < 0.3;
    const start = down ? int(rng, 3 * d, cfg.max) : int(rng, 0, cfg.max - 3 * d);
    const sign = down ? -1 : 1;
    const shown = [0, 1, 2].map((i) => start + sign * d * i);
    const answer = start + sign * d * 3;
    return {
      type: 'sequence', key: `seq:${start},${sign * d}`,
      text: `${shown.join(', ')}, ?`, ltr: true,
      speech: `מה ממשיך? ${shown.map(w).join(', ')}`,
      answer, choices: withChoices(answer, cfg.max, rng),
      hint: { kind: 'step', delta: sign * d },
    };
  },

  bonds10(_cfg, rng) {
    const x = int(rng, 1, 9);
    return {
      type: 'bonds10', key: `bonds:${x}`, text: `${x} + ? = 10`, ltr: true,
      visual: { kind: 'tenframe', filled: x },
      speech: `${w(x)} ועוד כמה זה עשר?`,
      answer: 10 - x, choices: withChoices(10 - x, 10, rng),
      hint: { kind: 'tenframe', filled: x },
    };
  },
};

const RECENT = 10;

export function createGenerator(rng: Rng = Math.random) {
  const recent: string[] = [];
  return {
    next(level: number, enabled: QuestionType[]): Question {
      const cfg = levelConfig(level);
      let types = cfg.types.filter((t) => enabled.includes(t));
      if (types.length === 0) types = cfg.types;
      let q: Question;
      // Retry to avoid repeats; with a tiny question pool (few enabled types) accept a repeat.
      for (let i = 0; ; i++) {
        q = makers[types[int(rng, 0, types.length - 1)]](cfg, rng);
        if (!recent.includes(q.key) || i >= 300) break;
      }
      recent.push(q.key);
      if (recent.length > RECENT) recent.shift();
      return q;
    },
  };
}
