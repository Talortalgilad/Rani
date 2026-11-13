/**
 * TEMPORARY review page of the recordings cut by scripts/import-takes.ts (parents area): every line with its text and a play button, to
 * go through them by ear. It reads english/voice/he/_review.json, which the script writes; delete both when the review is done.
 */
const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
interface Row { id: string; text: string; take: number; dur: number; flag: string }

export const voiceReviewCardHtml = (): string => `<section class="p-card"><h2>🎧 בדיקת הקלטות (זמני)</h2><p class="p-note">כל שורה עם הטקסט שלה וכפתור השמעה.</p><button class="btn alt" id="vr-open" type="button">פתחי את הרשימה</button><div id="vr-list"></div></section>`;

export function bindVoiceReview(root: HTMLElement): void {
  const open = root.querySelector<HTMLButtonElement>('#vr-open');
  const list = root.querySelector<HTMLElement>('#vr-list');
  if (!open || !list) return;
  const base = `${import.meta.env.BASE_URL}english/voice/he/`;
  let audio: HTMLAudioElement | null = null;
  open.addEventListener('click', async () => {
    open.disabled = true;
    try {
      const rows = (await (await fetch(`${base}_review.json`, { cache: 'no-store' })).json()) as Row[];
      list.innerHTML = `<div class="vr">${rows
        .map((r, i) => `<div class="vr-row ${r.flag ? 'flag' : ''}"><button class="vr-play" data-i="${i}" type="button" aria-label="השמעה">▶</button><div class="vr-t"><b>${esc(r.text)}</b><small>${esc(r.id)} · הקלטה ${r.take} · ${r.dur.toFixed(2)} שנ׳${r.flag ? ` · ⚠ ${r.flag === 'long' ? 'ארוכה מהצפוי' : 'קצרה'}` : ''}</small></div></div>`)
        .join('')}</div>`;
      list.querySelectorAll<HTMLButtonElement>('.vr-play').forEach((b) =>
        b.addEventListener('click', () => {
          audio?.pause();
          audio = new Audio(`${base}${encodeURIComponent(rows[Number(b.dataset.i)].id)}.mp3`);
          void audio.play();
        }),
      );
    } catch {
      list.textContent = 'לא נמצאה רשימת הקלטות (english/voice/he/_review.json).';
    }
    open.disabled = false;
  });
}
