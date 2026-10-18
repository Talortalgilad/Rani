import type { AppState, QuestionType } from '../storage';
import { today } from './adaptive';

export interface TypeStat { type: QuestionType; total: number; firstTry: number }
export interface Stats { today: number; week: number; byType: TypeStat[] }

const TYPES: QuestionType[] = ['count', 'add', 'sub', 'missing', 'compare', 'sequence', 'bonds10'];

export function computeStats(log: AppState['math']['log'], now = new Date()): Stats {
  const t = today(now);
  const weekStart = today(new Date(now.getTime() - 6 * 86400000));
  const byType = TYPES.map((type) => {
    const rows = log.filter((e) => e.type === type);
    return { type, total: rows.length, firstTry: rows.filter((e) => e.correct).length };
  });
  return {
    today: log.filter((e) => e.date === t).length,
    week: log.filter((e) => e.date >= weekStart && e.date <= t).length,
    byType,
  };
}

export const TYPE_LABEL: Record<QuestionType, string> = {
  count: 'ספירה',
  add: 'חיבור',
  sub: 'חיסור',
  missing: 'מספר חסר',
  compare: 'גדול / קטן',
  sequence: 'המשך סדרה',
  bonds10: 'השלמה ל-10',
};
