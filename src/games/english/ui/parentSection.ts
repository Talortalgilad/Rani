import { likeIds } from '../content/likes';
import { WORDS, labelOf } from '../content/words';
import { counter } from '../../../ui/counter';
import { LETTERS } from '../letters/journey';
import { letterState, letterStats, type Confusions } from '../letters/stats';
import { dayNumber, isKnown, markKnown, minutesInWeek, unmarkKnown, STATIONS_PER_WORLD, type MapProgress, type PlayLog, type Words } from '../engine/progress';
import { SQUISHIES } from '../art/squishies';
import { WORLDS } from '../content/worlds';
import { hasHebrewVoice, pickVoice, speakEn } from '../voice';
import { gameStore } from '../../../storage';
import { sayLine } from '../content/heLines';

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
  const openAll = store.load<boolean>('openAll', false);
  const say = store.load<boolean>('say', false);
  const ls = letterStats(words, store.load<string[]>('lwritten', []), store.load<Confusions>('confusions', {}));
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
        <div><b style="font-size:20px">${counter(`${worldsDone} מתוך ${WORLDS.length}`)}</b><span>עולמות שהושלמו</span></div>
        <div><b style="font-size:20px">${counter(`${rescued} מתוך ${SQUISHIES.length}`)}</b><span>סקווישים שניצלו</span></div>
        <div><b>${week}</b><span>דקות השבוע</span></div>
      </div>
      <h3 class="p-letters-h">אותיות</h3>
      <div class="p-kpis">
        <div><b style="font-size:20px">${counter(`${ls.learned} מתוך ${ls.total}`)}</b><span>אותיות שנלמדו</span></div>
        <div><b>${ls.learning}</b><span>אותיות בלמידה</span></div>
        <div><b style="font-size:20px">${counter(`${ls.written} מתוך ${ls.total}`)}</b><span>אותיות שנכתבו</span></div>
      </div>
      <div class="p-sub">אותיות שמתבלבלים בהן (כשהקישה על אות אחת במקום אחרת)</div>
      <div class="p-chips"><span class="chip-btn ${ls.bd ? 'on' : ''}" dir="ltr">b / d : ${ls.bd}</span>${ls.top.map(([k, n]) => `<span class="chip-btn" dir="ltr">${esc(k)} : ${n}</span>`).join('')}</div>
      <div class="p-sub">האותיות שנלמדו (מוכרות, ברמה 4 ומעלה, מסומנות בסגול)</div>
      <div class="p-chips">${LETTERS.map((l) => ({ l, s: letterState(words, l.id) })).filter((x) => x.s !== 'new').map((x) => `<span class="chip-btn ${x.s === 'known' ? 'on' : ''}" dir="ltr">${x.l.upper}${x.l.id}</span>`).join('') || '<span class="p-sub">עוד לא נלמדו אותיות</span>'}</div>
      <div class="p-sub">שם החבר (הדמות המלווה)</div>
      <input id="en-name" class="p-input" maxlength="12" value="${esc(name)}" aria-label="שם החבר" ${name ? '' : 'placeholder="עוד לא נבחר"'} />
      <div class="p-sub">דברים שרני אוהבת (המילים האלה מופיעות ראשונות בעולם שלהן)</div>
      <div class="p-chips">${WORDS.filter((w) => likeIds.includes(w.id) || liked.includes(w.id)).map((w) => chip(w.id, liked.includes(w.id), 'data-like')).join('')}</div>
      <div class="p-sub">מילים שהיא כבר יודעת (נכנסות כחזרה קלה ולא כמילה חדשה)</div>
      <details class="p-details"><summary>בחירת מילים</summary>
        ${WORLDS.map((w) => `<div class="p-sub">${w.emoji} ${w.he}</div><div class="p-chips">${WORDS.filter((x) => x.world === w.n).map((x) => chip(x.id, words[x.id]?.known === true, 'data-known')).join('')}</div>`).join('')}
      </details>
      <div class="p-sub">פתח את כל העולמות (לבדיקה: ברירת המחדל כבויה, ועולם נפתח רק אחרי שמסיימים את הקודם)</div>
      <div class="p-chips"><button class="chip-btn ${openAll ? 'on' : ''}" data-openall="1">כן</button><button class="chip-btn ${openAll ? '' : 'on'}" data-openall="0">לא</button></div>
      <div class="p-sub">"אמור!" (המשחק מבקש מרני להגיד מילה, והטלפון מקשיב)</div>
      <div class="p-chips"><button class="chip-btn ${say ? 'on' : ''}" data-say="1">פעיל</button><button class="chip-btn ${say ? '' : 'on'}" data-say="0">כבוי</button></div>
      <div class="p-sub">זיהוי הדיבור משתמש בשירות של Google או Apple, ולכן הקול נשלח אליהם בזמן הדיבור, ונדרש אינטרנט. שום דבר לא נשמר חוץ מהמילה שזוהתה. בלי אינטרנט המשימה פשוט לא מופיעה.</div>
      <div class="p-sub">קול עברי: ההקלטות שלך במקום קול הטלפון</div>
      <button class="btn alt" id="en-studio">🎙️ אולפן הקלטה</button>
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
  card.querySelectorAll<HTMLElement>('[data-openall]').forEach((b) =>
    b.addEventListener('click', () => {
      store.save('openAll', b.dataset.openall === '1');
      redraw();
    }),
  );
  card.querySelectorAll<HTMLElement>('[data-say]').forEach((b) =>
    b.addEventListener('click', () => {
      store.save('say', b.dataset.say === '1');
      redraw();
    }),
  );
  card.querySelector('#en-studio')?.addEventListener('click', () => void import('./studio').then((m) => m.openStudio(root, redraw)));
  card.querySelector('#en-voice')?.addEventListener('click', () => void speakEn("Hello! I'm your friend. Let's play!", 0.85).then(() => sayLine('parent_test')));
}
