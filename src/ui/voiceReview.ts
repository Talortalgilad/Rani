/**
 * TEMPORARY review page of the recordings cut by scripts/import-takes.ts (parents area): every line with its text and a play button, to
 * go through them by ear. It reads english/voice/he/_review.json, which the script writes; delete both when the review is done.
 */
const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
interface Row { id: string; text: string; lang?: string; take: number; dur: number; flag: string }

export const voiceReviewCardHtml = (): string => `<section class="p-card"><h2>🎧 בדיקת הקלטות (זמני)</h2><p class="p-note">כל שורה עם הטקסט שלה וכפתור השמעה.</p><button class="btn alt" id="vr-open" type="button">פתחי את הרשימה</button><div id="vr-list"></div></section>`;

export function bindVoiceReview(root: HTMLElement): void {
  const open = root.querySelector<HTMLButtonElement>('#vr-open');
  const list = root.querySelector<HTMLElement>('#vr-list');
  if (!open || !list) return;
  const base = `${import.meta.env.BASE_URL}english/voice/`;
  let audio: HTMLAudioElement | null = null;
  let rows: Row[] = [];
  let filter: 'all' | 'he' | 'en' | 'flag' = 'all';
  const langOf = (r: Row): string => r.lang ?? 'he';
  const paint = (): void => {
    const shown = rows.map((r, i) => ({ r, i })).filter(({ r }) => (filter === 'all' ? true : filter === 'flag' ? !!r.flag : langOf(r) === filter));
    list.innerHTML = `<div class="p-chips">${(
      [['all', `הכל (${rows.length})`], ['he', 'עברית'], ['en', 'אנגלית'], ['flag', 'חשודות']] as const
    )
      .map(([k, label]) => `<button class="chip-btn ${k === filter ? 'on' : ''}" data-f="${k}" type="button">${label}</button>`)
      .join('')}</div><div class="vr">${shown
      .map(({ r, i }) => `<div class="vr-row ${r.flag ? 'flag' : ''}"><button class="vr-play" data-i="${i}" type="button" aria-label="השמעה">▶</button><div class="vr-t"><b dir="${langOf(r) === 'en' ? 'ltr' : 'rtl'}">${esc(r.text)}</b><small>${esc(r.id)} · ${langOf(r) === 'en' ? 'EN' : 'עב'} · הקלטה ${r.take} · ${r.dur.toFixed(2)} שנ׳${r.flag ? ` · ⚠ ${r.flag === 'long' ? 'ארוכה מהצפוי' : 'קצרה'}` : ''}</small></div></div>`)
      .join('')}</div>`;
    list.querySelectorAll<HTMLButtonElement>('.chip-btn').forEach((b) =>
      b.addEventListener('click', () => {
        filter = b.dataset.f as typeof filter;
        paint();
      }),
    );
    list.querySelectorAll<HTMLButtonElement>('.vr-play').forEach((b) =>
      b.addEventListener('click', () => {
        const r = rows[Number(b.dataset.i)];
        audio?.pause();
        audio = new Audio(`${base}${langOf(r)}/${encodeURIComponent(r.id)}.mp3`);
        void audio.play();
      }),
    );
  };
  open.addEventListener('click', async () => {
    open.disabled = true;
    try {
      rows = (await (await fetch(`${base}he/_review.json`, { cache: 'no-store' })).json()) as Row[];
      paint();
    } catch {
      list.textContent = 'לא נמצאה רשימת הקלטות (english/voice/he/_review.json).';
    }
    open.disabled = false;
  });
}
