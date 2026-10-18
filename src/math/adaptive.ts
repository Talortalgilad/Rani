import { getState, update, type QuestionType } from '../storage';

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 5;
const WINDOW = 10;
const LOG_DAYS = 60;

/** Pure rule: new level given the last answers and how many were answered at this level. */
export function evaluateLevel(level: number, recent: boolean[], answeredAtLevel: number): number {
  if (answeredAtLevel < WINDOW || recent.length < WINDOW) return level;
  const right = recent.slice(-WINDOW).filter(Boolean).length;
  if (right >= 9) return Math.min(level + 1, MAX_LEVEL);
  if (right <= 5) return Math.max(level - 1, MIN_LEVEL);
  return level;
}

export function activeLevel(): number {
  const { settings, math } = getState();
  return settings.mathLevel === 'auto' ? math.currentLevel : settings.mathLevel;
}

export function today(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Record one solved question; `attempts` counts every tap, correct on first try = attempts 1. */
export function recordAnswer(type: QuestionType, attempts: number): void {
  update((s) => {
    const m = s.math;
    m.recent = [...m.recent, attempts === 1].slice(-WINDOW);
    m.answeredAtLevel = (m.answeredAtLevel ?? 0) + 1;
    m.log.push({ date: today(), type, correct: attempts === 1, attempts });
    const cutoff = today(new Date(Date.now() - LOG_DAYS * 86400000));
    m.log = m.log.filter((e) => e.date >= cutoff);
    if (s.settings.mathLevel === 'auto') {
      const next = evaluateLevel(m.currentLevel, m.recent, m.answeredAtLevel);
      if (next !== m.currentLevel) {
        m.currentLevel = next;
        m.recent = [];
        m.answeredAtLevel = 0;
      }
    }
  });
}
