import { describe, expect, it } from 'vitest';
import { createGenerator } from './generator';
import { LEVELS } from './levels';
import { evaluateLevel } from './adaptive';
import { numberToHebrew } from './hebrew';

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ALL = ['count', 'add', 'sub', 'missing', 'compare', 'sequence', 'bonds10'] as const;

describe.each(LEVELS)('generator level $level', (cfg) => {
  const gen = createGenerator(mulberry32(cfg.level * 101));
  const qs = Array.from({ length: 1000 }, () => gen.next(cfg.level, [...ALL]));

  it('answers are within [0, ceiling] and numbers are integers', () => {
    for (const q of qs) {
      expect(Number.isInteger(q.answer)).toBe(true);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThanOrEqual(cfg.max);
    }
  });
  it('uses only the level types', () => {
    for (const q of qs) expect(cfg.types).toContain(q.type);
  });
  it('choices are distinct, non-negative and contain the answer', () => {
    for (const q of qs) {
      expect(new Set(q.choices).size).toBe(q.choices.length);
      expect(q.choices).toHaveLength(q.type === 'compare' ? 2 : 3);
      expect(q.choices).toContain(q.answer);
      for (const c of q.choices) expect(c).toBeGreaterThanOrEqual(0);
    }
  });
  it('no repeat within the last 10 questions', () => {
    qs.forEach((q, i) => {
      expect(qs.slice(Math.max(0, i - 10), i).map((x) => x.key)).not.toContain(q.key);
    });
  });
  it('level 4 never crosses a ten', () => {
    if (!cfg.noTenCrossing) return;
    for (const q of qs.filter((x) => x.hint.kind === 'dots')) {
      const h = q.hint as { a: number; b: number; op: string };
      if (q.type === 'sub') expect(h.a % 10).toBeGreaterThanOrEqual(h.b % 10);
      else expect((h.a % 10) + (h.b % 10)).toBeLessThan(10);
    }
  });
  it('every type appears and has speech', () => {
    expect(new Set(qs.map((q) => q.type)).size).toBe(cfg.types.length);
    for (const q of qs) expect(q.speech.length).toBeGreaterThan(0);
  });
});

describe('enabled types', () => {
  it('falls back to level types when the filter leaves nothing', () => {
    const q = createGenerator(mulberry32(1)).next(1, ['sequence']);
    expect(['count', 'add', 'compare']).toContain(q.type);
  });
});

describe('adaptive', () => {
  const t = (n: number) => Array.from({ length: 10 }, (_, i) => i < n);
  it('levels up on 9/10, down on <=5, holds otherwise', () => {
    expect(evaluateLevel(2, t(9), 10)).toBe(3);
    expect(evaluateLevel(2, t(5), 10)).toBe(1);
    expect(evaluateLevel(2, t(7), 10)).toBe(2);
  });
  it('waits for 10 questions and respects bounds', () => {
    expect(evaluateLevel(2, t(10), 9)).toBe(2);
    expect(evaluateLevel(5, t(10), 10)).toBe(5);
    expect(evaluateLevel(1, t(0), 10)).toBe(1);
  });
});

describe('hebrew numbers', () => {
  it('has a feminine word for 0..20', () => {
    for (let i = 0; i <= 20; i++) expect(numberToHebrew(i)).not.toBe(String(i));
    expect(numberToHebrew(2)).toBe('שתיים');
  });
});
