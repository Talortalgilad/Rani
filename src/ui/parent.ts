import { go } from '../router';
import { activeLevel } from '../math/adaptive';
import { TYPE_LABEL, computeStats } from '../math/stats';
import { addExtraMinutes, allowedMinutes, playedMinutes } from '../usage';
import { getState, resetProgress, update, type AppState, type QuestionType } from '../storage';

const AVATARS = ['🦄', '🐱', '🐶', '🐰', '🦊', '🐼'];
const ALL_TYPES = Object.keys(TYPE_LABEL) as QuestionType[];
type Settings = AppState['settings'];

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const int = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));

function chips<K extends keyof Settings>(key: K, opts: [string, Settings[K]][], cur: Settings[K]): string {
  return `<div class="p-chips">${opts
    .map(([label, v]) => `<button class="chip-btn ${v === cur ? 'on' : ''}" data-k="${key}" data-v="${esc(JSON.stringify(v))}">${label}</button>`)
    .join('')}</div>`;
}

export function renderParent(root: HTMLElement): () => void {
  let a = int(3, 9);
  let b = int(3, 9);
  let confirmReset = false;
  let flash = '';

  const shell = (inner: string) => {
    root.innerHTML = `<div class="screen parent">${inner}</div>`;
  };

  function quiz(wrong = false): void {
    shell(`
      <div class="p-quiz">
        <div class="p-emoji">👨‍👩‍👧</div>
        <h1>אזור הורים</h1>
        <div class="p-q ${wrong ? 'shake' : ''}" dir="ltr">${a} × ${b} = ?</div>
        <input id="ans" class="p-input" inputmode="numeric" pattern="[0-9]*" autocomplete="off" aria-label="תשובה" />
        <button class="btn big" id="ok">אישור</button>
        <button class="btn alt" id="back">🏠 בית</button>
      </div>`);
    const input = root.querySelector('#ans') as HTMLInputElement;
    const submit = () => {
      if (Number(input.value) === a * b) settings();
      else {
        a = int(3, 9);
        b = int(3, 9);
        quiz(true);
      }
    };
    root.querySelector('#ok')!.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => e.key === 'Enter' && submit());
    root.querySelector('#back')!.addEventListener('click', () => go({ name: 'home' }));
  }

  function statsHtml(): string {
    const st = getState();
    const s = computeStats(st.math.log);
    const lvl = activeLevel();
    const rows = s.byType
      .map((t) => {
        const pct = t.total ? Math.round((t.firstTry / t.total) * 100) : null;
        return `<div class="p-stat"><span class="p-stat-name">${TYPE_LABEL[t.type]}</span>
          <span class="p-bar"><i style="width:${pct ?? 0}%" class="${pct !== null && pct < 60 ? 'low' : ''}"></i></span>
          <span class="p-stat-pct" dir="ltr">${pct === null ? '—' : pct + '%'}</span>
          <span class="p-stat-n" dir="ltr">${t.total}</span></div>`;
      })
      .join('');
    return `
      <section class="p-card">
        <h2>סטטיסטיקה</h2>
        <div class="p-kpis">
          <div><b>${s.today}</b><span>תרגילים היום</span></div>
          <div><b>${s.week}</b><span>תרגילים בשבוע</span></div>
          <div><b>${lvl}</b><span>רמה נוכחית${st.settings.mathLevel === 'auto' ? ' (אוטומטית)' : ''}</span></div>
        </div>
        <div class="p-sub">הצלחה בניסיון ראשון לפי סוג</div>
        ${rows}
      </section>`;
  }

  function settings(): void {
    const st = getState();
    const se = st.settings;
    const allowed = allowedMinutes();
    const played = Math.floor(playedMinutes());
    const scroll = root.querySelector('.parent')?.scrollTop ?? 0;
    shell(`
      <header class="p-head"><h1>אזור הורים</h1><button class="btn alt" id="done">🏠 סיום</button></header>
      ${flash ? `<div class="p-flash">${flash}</div>` : ''}

      <section class="p-card">
        <h2>השער</h2>
        <div class="p-sub">מספר שאלות בשער</div>
        <div class="p-stepper" dir="ltr">
          <button class="chip-btn" data-step="-1" aria-label="פחות">−</button>
          <b>${se.gateQuestions}</b>
          <button class="chip-btn" data-step="1" aria-label="יותר">+</button>
        </div>
        <div class="p-sub">מתי מופיע השער</div>
        ${chips('gateFrequency', [['לפני כל סיבוב', 'every'], ['כל 2 סיבובים', 2], ['כל 3 סיבובים', 3], ['רק בכניסה למשחק', 'entry']], se.gateFrequency)}
        <div class="p-sub">רמת חשבון</div>
        ${chips('mathLevel', [['אוטומטית', 'auto'], ['1', 1], ['2', 2], ['3', 3], ['4', 4], ['5', 5]], se.mathLevel)}
        <div class="p-sub">סוגי שאלות</div>
        <div class="p-chips">${ALL_TYPES.map((t) => `<button class="chip-btn ${se.enabledTypes.includes(t) ? 'on' : ''}" data-type="${t}">${TYPE_LABEL[t]}</button>`).join('')}</div>
        <div class="p-sub">הקראה בקול</div>
        ${chips('tts', [['כן', true], ['לא', false]], se.tts)}
      </section>

      <section class="p-card">
        <h2>משחק</h2>
        <div class="p-sub">מהירות הכדור (שובר שורות)</div>
        ${chips('ballSpeed', [['איטי', 'slow'], ['רגיל', 'normal'], ['מהיר', 'fast']], se.ballSpeed)}
      </section>

      <section class="p-card">
        <h2>שם ואווטאר</h2>
        <input id="name" class="p-input" maxlength="12" value="${esc(st.profile.name)}" aria-label="שם" />
        <div class="p-chips">${AVATARS.map((e) => `<button class="chip-btn avatar ${e === st.profile.avatar ? 'on' : ''}" data-avatar="${e}">${e}</button>`).join('')}</div>
      </section>

      <section class="p-card">
        <h2>הגבלת זמן יומית</h2>
        ${chips('dailyLimitMin', [['כבוי', null], ['15 דק׳', 15], ['30 דק׳', 30], ['45 דק׳', 45], ['60 דק׳', 60]], se.dailyLimitMin)}
        ${allowed === null ? '' : `<div class="p-sub">שיחקו היום ${played} דק׳ מתוך ${allowed}</div><button class="btn alt" id="plus15">➕ הוסף 15 דקות להיום</button>`}
      </section>

      ${statsHtml()}

      <section class="p-card danger">
        <h2>איפוס התקדמות</h2>
        ${
          confirmReset
            ? `<div class="p-sub">למחוק את כל הכוכבים, השלבים והסטטיסטיקה? ההגדרות יישארו.</div>
               <div class="p-row"><button class="btn danger-btn" id="reset-yes">כן, לאפס</button><button class="btn alt" id="reset-no">ביטול</button></div>`
            : `<button class="btn alt" id="reset">🗑 איפוס התקדמות</button>`
        }
      </section>`);
    flash = '';
    (root.querySelector('.parent') as HTMLElement).scrollTop = scroll;

    root.querySelectorAll<HTMLElement>('[data-k]').forEach((el) =>
      el.addEventListener('click', () => {
        const k = el.dataset.k as keyof Settings;
        const v = JSON.parse(el.dataset.v!);
        update((s) => {
          (s.settings as Record<string, unknown>)[k] = v;
        });
        settings();
      }),
    );
    root.querySelectorAll<HTMLElement>('[data-step]').forEach((el) =>
      el.addEventListener('click', () => {
        update((s) => {
          s.settings.gateQuestions = Math.min(10, Math.max(1, s.settings.gateQuestions + Number(el.dataset.step)));
        });
        settings();
      }),
    );
    root.querySelectorAll<HTMLElement>('[data-type]').forEach((el) =>
      el.addEventListener('click', () => {
        const t = el.dataset.type as QuestionType;
        update((s) => {
          const on = s.settings.enabledTypes;
          if (on.includes(t)) {
            if (on.length > 1) s.settings.enabledTypes = on.filter((x) => x !== t); // keep at least one
          } else s.settings.enabledTypes = ALL_TYPES.filter((x) => on.includes(x) || x === t);
        });
        settings();
      }),
    );
    root.querySelectorAll<HTMLElement>('[data-avatar]').forEach((el) =>
      el.addEventListener('click', () => {
        update((s) => {
          s.profile.avatar = el.dataset.avatar!;
        });
        settings();
      }),
    );
    (root.querySelector('#name') as HTMLInputElement).addEventListener('input', (e) => {
      const v = (e.target as HTMLInputElement).value.trim();
      update((s) => {
        s.profile.name = v || 'רני';
      });
    });
    root.querySelector('#plus15')?.addEventListener('click', () => {
      addExtraMinutes(15);
      flash = 'נוספו 15 דקות ✓';
      settings();
    });
    root.querySelector('#reset')?.addEventListener('click', () => {
      confirmReset = true;
      settings();
    });
    root.querySelector('#reset-no')?.addEventListener('click', () => {
      confirmReset = false;
      settings();
    });
    root.querySelector('#reset-yes')?.addEventListener('click', () => {
      resetProgress();
      confirmReset = false;
      flash = 'ההתקדמות אופסה ✓';
      settings();
    });
    root.querySelector('#done')!.addEventListener('click', () => go({ name: 'home' }));
  }

  quiz();
  return () => {};
}
