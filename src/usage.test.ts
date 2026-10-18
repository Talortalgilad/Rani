import { describe, expect, it } from 'vitest';
import { computeStats } from './math/stats';

const d = (iso: string) => new Date(`${iso}T12:00:00`);
const e = (date: string, type: 'add' | 'sub', correct: boolean) => ({ date, type, correct, attempts: correct ? 1 : 2 });

describe('parent statistics', () => {
  const log = [
    e('2026-10-18', 'add', true), e('2026-10-18', 'add', false), e('2026-10-18', 'sub', true),
    e('2026-10-15', 'add', true), e('2026-10-12', 'sub', true), e('2026-10-01', 'add', false),
  ];
  const s = computeStats(log, d('2026-10-18'));
  it('counts today and the last 7 days', () => {
    expect(s.today).toBe(3);
    expect(s.week).toBe(5); // 12th is 6 days back (inside), 1st is outside
  });
  it('first-try success per type', () => {
    const add = s.byType.find((t) => t.type === 'add')!;
    expect([add.total, add.firstTry]).toEqual([4, 2]);
    const sub = s.byType.find((t) => t.type === 'sub')!;
    expect([sub.total, sub.firstTry]).toEqual([2, 2]);
    expect(s.byType.find((t) => t.type === 'count')!.total).toBe(0);
  });
});
