/** The tutor's card of the parents' area (SPEC-tutor.md section 9): what was learned (the lessons that are done and the sentence of the day of each, to practise at home), a button that opens all the lessons (for testing) and a reset of Lolly's progress. */
import { gameStore } from '../../../storage';
import { TUTOR_CLIPS } from '../content/tutorClips';
import { sentenceOf } from './album';
import { LESSONS } from './lessons';
import { emptyTutor, isDone, loadTutor } from './state';

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const store = gameStore('english');
const stepCounts = (): Record<string, number> => Object.fromEntries(LESSONS.map((l) => [l.id, l.steps.length]));
const readState = () => loadTutor(store.load<unknown>('tutor', null), stepCounts());
let confirmReset = false;

export function tutorParentHtml(): string {
  const st = readState();
  const openAll = store.load<boolean>('tutorOpenAll', false);
  const done = LESSONS.filter((l) => isDone(st, l.id));
  const rows = done
    .map((l) => {
      const sd = sentenceOf(l);
      const text = sd ? (TUTOR_CLIPS[sd.clip]?.text ?? sd.en) : '';
      return `<li><b>${esc(l.titleHe)}</b> <span class="p-sub">יחידה ${l.unit}${st.sparkle[l.id] ? ' ✨' : ''}</span>${text ? `<div dir="ltr" class="p-sentence">${esc(text)}</div>` : ''}</li>`;
    })
    .join('');
  return `
    <section class="p-card" id="tutor-parent">
      <h2>המורה לולי</h2>
      <div class="p-kpis">
        <div><b class="p-count">${done.length} מתוך ${LESSONS.length}</b><span>שיעורים שהושלמו</span></div>
        <div><b>${st.sparkle ? Object.values(st.sparkle).filter(Boolean).length : 0}</b><span>אתגרים בלי טעות</span></div>
      </div>
      <div class="p-sub">מה נלמד: השיעורים שהושלמו ו"משפט היום" של כל אחד, כדי לתרגל בבית</div>
      ${rows ? `<ul class="p-lessons">${rows}</ul>` : '<div class="p-sub">עוד לא הושלם שיעור</div>'}
      <div class="p-sub">פתח את כל השיעורים (לבדיקה: ברירת המחדל כבויה, ושיעור חדש נפתח רק למחרת, אחד ביום)</div>
      <div class="p-chips"><button class="chip-btn ${openAll ? 'on' : ''}" data-tutoropen="1">כן</button><button class="chip-btn ${openAll ? '' : 'on'}" data-tutoropen="0">לא</button></div>
      ${
        confirmReset
          ? `<div class="p-sub">למחוק את כל ההתקדמות של לולי: שיעורים, מדבקות ומה שהיא זוכרת?</div><div class="p-row"><button class="btn danger-btn" id="tutor-reset-yes">כן, לאפס</button><button class="btn alt" id="tutor-reset-no">ביטול</button></div>`
          : '<button class="btn alt" id="tutor-reset">🗑 איפוס ההתקדמות של לולי</button>'
      }
    </section>`;
}

export function bindTutorParent(root: HTMLElement, redraw: () => void): void {
  const card = root.querySelector('#tutor-parent');
  if (!card) return;
  card.querySelectorAll<HTMLElement>('[data-tutoropen]').forEach((b) =>
    b.addEventListener('click', () => {
      store.save('tutorOpenAll', b.dataset.tutoropen === '1');
      redraw();
    }),
  );
  card.querySelector('#tutor-reset')?.addEventListener('click', () => {
    confirmReset = true;
    redraw();
  });
  card.querySelector('#tutor-reset-no')?.addEventListener('click', () => {
    confirmReset = false;
    redraw();
  });
  card.querySelector('#tutor-reset-yes')?.addEventListener('click', () => {
    store.save('tutor', emptyTutor());
    confirmReset = false;
    redraw();
  });
}
