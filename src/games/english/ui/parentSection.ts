import { likeIds } from '../content/likes';
import { WORDS, labelOf } from '../content/words';
import { dayNumber, isKnown, markKnown, minutesInWeek, unmarkKnown, STATIONS_PER_WORLD, type MapProgress, type PlayLog, type Words } from '../engine/progress';
import { SQUISHIES } from '../art/squishies';
import { WORLDS } from '../content/worlds';
import { hasHebrewVoice, pickVoice, speakEn, speakHe } from '../voice';
import { gameStore } from '../../../storage';

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const store = gameStore('english');
/** (the same rule as the name screen, copied so that the parents' page does not load the game) */
const cleanName = (s: string): string => s.replace(/[<>&"]/g, '').trim().slice(0, 12);

/** The English card of the parents' area (SPEC-english.md section 9): what she knows, what she likes, the friend's name, the voice. */
export function englishParentHtml(): string {
  const words = store.load<Words>('words', {});
  const map = store.load<MapProgress>('map', { done: {}, stars: {}, rescued: [] });
  const verbs = store.load<Record<string, number>>('verbs', {});
  const name = store.load<{ name: string } | null>('companion', null)?.name ?? '';
  const liked = store.load<string[]>('likes', likeIds);
  const known = WORDS.filter((w) => isKnown(words[w.id])).length;
  const learning = WORDS.filter((w) => words[w.id]?.seen && !isKnown(words[w.id])).length;
  const worldsDone = WORLDS.filter((w) => (map.done[w.n] ?? 0) >= STATIONS_PER_WORLD).length;
  const week = Math.round(minutesInWeek(store.load<PlayLog>('playlog', {}), dayNumber()));
  const rescued = store.load<string[]>('rescued', []).length;
  const voiceEn = pickVoice('en')?.name ?? 'לא נמצא קול באנגלית';
  const voiceHe = hasHebrewVoice() ? pickVoice('he')!.name : 'אין קול עברי (הטקסט מופיע בבועה)';
  const chip = (id: string, on: boolean, attr: string): string => `<button class="chip-btn ${on ? 'on' : ''}" ${attr}="${id}" dir="ltr">${esc(labelOf(id))}</button>`;
  return `
    <section class="p-card" id="en-parent">
      <h2>אנגלית עם צ׳יזי</h2>
      <div class="p-kpis">
        <div><b>${known}</b><span>מילים שהיא יודעת</span></div>
        <div><b>${learning}</b><span>מילים בלמידה</span></div>
        <div><b>${Object.values(verbs).filter((n) => n > 0).length}</b><span>פעלים שנלמדו</span></div>
      </div>
      <div class="p-kpis">
        <div><b>${worldsDone}/${WORLDS.length}</b><span>עולמות שהושלמו</span></div>
        <div><b>${rescued}/${SQUISHIES.length}</b><span>סקווישים שניצלו</span></div>
        <div><b>${week}</b><span>דקות השבוע</span></div>
      </div>
      <div class="p-sub">שם החבר (הדמות המלווה)</div>
      <input id="en-name" class="p-input" maxlength="12" value="${esc(name)}" aria-label="שם החבר" ${name ? '' : 'placeholder="עוד לא נבחר"'} />
      <div class="p-sub">דברים שרני אוהבת (המילים האלה מופיעות ראשונות בעולם שלהן)</div>
      <div class="p-chips">${WORDS.filter((w) => likeIds.includes(w.id) || liked.includes(w.id)).map((w) => chip(w.id, liked.includes(w.id), 'data-like')).join('')}</div>
      <div class="p-sub">מילים שהיא כבר יודעת (נכנסות כחזרה קלה ולא כמילה חדשה)</div>
      <details class="p-details"><summary>בחירת מילים</summary>
        ${WORLDS.map((w) => `<div class="p-sub">${w.emoji} ${w.he}</div><div class="p-chips">${WORDS.filter((x) => x.world === w.n).map((x) => chip(x.id, words[x.id]?.known === true, 'data-known')).join('')}</div>`).join('')}
      </details>
      <div class="p-sub">בדיקת קול</div>
      <button class="btn alt" id="en-voice">🔊 בדוק קול</button>
      <div class="p-sub" id="en-voice-out">אנגלית: <span dir="ltr">${esc(voiceEn)}</span><br>עברית: ${esc(voiceHe)}</div>
    </section>`;
}

/** Wires the card; `redraw` draws the parents' page again after a change. */
export function bindEnglishParent(root: HTMLElement, redraw: () => void): void {
  const card = root.querySelector('#en-parent');
  if (!card) return;
  card.querySelector<HTMLInputElement>('#en-name')?.addEventListener('change', (e) => {
    const v = cleanName((e.target as HTMLInputElement).value);
    if (v) store.save('companion', { name: v });
  });
  card.querySelectorAll<HTMLElement>('[data-like]').forEach((b) =>
    b.addEventListener('click', () => {
      const id = b.dataset.like!;
      const cur = store.load<string[]>('likes', likeIds);
      store.save('likes', cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
      redraw();
    }),
  );
  card.querySelectorAll<HTMLElement>('[data-known]').forEach((b) =>
    b.addEventListener('click', () => {
      const id = b.dataset.known!;
      const words = store.load<Words>('words', {});
      store.save('words', words[id]?.known ? unmarkKnown(words, id) : markKnown(words, id, dayNumber()));
      redraw();
    }),
  );
  card.querySelector('#en-voice')?.addEventListener('click', () => void speakEn("Hello! I'm your friend. Let's play!", 0.85).then(() => speakHe('שלום! בואי נשחק באנגלית.')));
}
