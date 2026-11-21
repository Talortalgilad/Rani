/**
 * For the parents' area (testing, SPEC-carnival.md 4.7): skip a day forward on the clock of the carnival, so that a hatching and a letter can be seen without waiting for tomorrow, and start the
 * parade of Friday on the next entry. Both change only the clock of the carnival (the saved `skip` days); nothing that she earned is touched, and nothing is lost by the skipping.
 */
import { loadSave, writeSave } from './talk/state';
import { dailyOf } from './daily';

const PARADE_KEY = 'rani-carnival-parade-now';
/** one more day forward (up to a year); returns how many days are skipped now */
export function skipDay(): number {
  const s = loadSave();
  const d = dailyOf(s);
  d.skip = Math.min(365, d.skip + 1);
  writeSave(s);
  return d.skip;
}
export function resetSkip(): void {
  const s = loadSave();
  dailyOf(s).skip = 0;
  writeSave(s);
}
export const skippedDays = (): number => dailyOf(loadSave()).skip;
/** the parade starts when she enters the carnival next (whatever day it is) */
export function requestParade(): void {
  try {
    localStorage.setItem(PARADE_KEY, '1');
  } catch {
    /* ignore */
  }
}
/** the carnival asks once on entering: is a parade requested? (and the request is gone) */
export function takeParadeRequest(): boolean {
  try {
    const on = localStorage.getItem(PARADE_KEY) === '1';
    if (on) localStorage.removeItem(PARADE_KEY);
    return on;
  } catch {
    return false;
  }
}
export const carnivalTestHtml = (): string => `
      <section class="p-card">
        <h2>קרנבל: בדיקת הימים</h2>
        <div class="p-sub">לבדיקה בלבד: מדלגים יום קדימה בשעון של הקרנבל, כדי לראות ביצה בוקעת, מכתב ומתנת היום בלי לחכות למחר. שום דבר שרני הרוויחה לא משתנה. <span id="cv-skip-n">${skippedDays() ? `דילגנו ${skippedDays()} ימים.` : ''}</span></div>
        <div class="p-chips"><button class="btn alt" id="cv-skip">⏭️ דלגי יום קדימה</button><button class="btn alt" id="cv-skip-reset">↩ חזרה לשעון האמיתי</button><button class="btn alt" id="cv-parade">🎺 הפעלת המצעד בכניסה הבאה</button></div>
        <div class="p-sub" id="cv-test-flash"></div>
      </section>`;
export function bindCarnivalTest(root: HTMLElement): void {
  const flash = (t: string): void => void (root.querySelector('#cv-test-flash')!.textContent = t);
  root.querySelector('#cv-skip')?.addEventListener('click', () => {
    const n = skipDay();
    (root.querySelector('#cv-skip-n') as HTMLElement).textContent = `דילגנו ${n} ימים.`;
    flash('הקרנבל יראה את היום הבא בכניסה הבאה ✓');
  });
  root.querySelector('#cv-skip-reset')?.addEventListener('click', () => {
    resetSkip();
    (root.querySelector('#cv-skip-n') as HTMLElement).textContent = '';
    flash('השעון חזר לשעון האמיתי ✓');
  });
  root.querySelector('#cv-parade')?.addEventListener('click', () => {
    requestParade();
    flash('המצעד יתחיל כשתיכנסי לקרנבל ✓');
  });
}
