import { FAMILY_MAX, FAMILY_MIN } from '../decks/free';
import { addPhotos, deletePhoto, listPhotos, squareBlob, type Photo } from '../photos';
import { counter } from '../../../ui/counter';

/**
 * The family photos in the parents' area (SPEC-memory.md section 4): add (with a preview of the squares before anything is saved) and delete.
 * Only here: so that Rani cannot delete them by mistake. The photos stay on this phone (IndexedDB); nothing is uploaded.
 */
export const photosCardHtml = (): string => `
  <section class="p-card" id="mem-photos">
    <h2>זיכרון: המשפחה שלי</h2>
    <div class="p-sub">תמונות של המשפחה לערכת הקלפים. הערכה נפתחת במשחק כשיש לפחות ${FAMILY_MIN} תמונות (עד ${FAMILY_MAX}). התמונות נשמרות רק בטלפון הזה ולא יוצאות ממנו.</div>
    <div id="mem-photos-body"></div>
  </section>`;

export async function bindPhotosCard(root: HTMLElement): Promise<void> {
  const body = root.querySelector<HTMLElement>('#mem-photos-body');
  if (!body) return;
  let urls: string[] = [];
  const release = (): void => {
    urls.forEach((u) => URL.revokeObjectURL(u));
    urls = [];
  };
  let pending: { file: File; blob: Blob; url: string }[] | null = null;
  let flash = '';

  async function paint(): Promise<void> {
    release();
    const photos: Photo[] = await listPhotos();
    const shown = photos.map((p) => {
      const u = URL.createObjectURL(p.blob);
      urls.push(u);
      return { p, u };
    });
    const room = FAMILY_MAX - photos.length;
    body!.innerHTML = `
      <div class="p-kpis"><div><b style="font-size:20px">${counter(`${photos.length} מתוך ${FAMILY_MAX}`)}</b><span>תמונות בערכה</span></div>
      <div><b>${photos.length >= FAMILY_MIN ? '✓' : '🔒'}</b><span>${photos.length >= FAMILY_MIN ? 'הערכה פתוחה' : `חסרות ${FAMILY_MIN - photos.length} לפתיחה`}</span></div><div></div></div>
      ${flash ? `<div class="p-flash">${flash}</div>` : ''}
      ${
        pending
          ? `<div class="p-sub">תצוגה מקדימה: ככה ייראו הקלפים (חיתוך לריבוע מהמרכז). לשמור?</div>
             <div class="mem-grid">${pending.map((x) => `<div class="mem-ph"><img src="${x.url}" alt=""></div>`).join('')}</div>
             <div class="p-row"><button class="btn" id="mem-save">✔ שמירה (${pending.length})</button><button class="btn alt" id="mem-cancel">ביטול</button></div>`
          : `<div class="mem-grid" id="mem-grid">${shown.map(({ p, u }) => `<div class="mem-ph"><img src="${u}" alt=""><button class="mem-del" data-id="${p.id}" type="button" aria-label="מחיקה">🗑</button></div>`).join('') || '<div class="p-sub">עוד אין תמונות</div>'}</div>
             <input type="file" id="mem-file" accept="image/*" multiple hidden>
             <button class="btn alt" id="mem-add" ${room <= 0 ? 'disabled' : ''}>➕ הוסף תמונות${room > 0 ? ` (עוד ${room})` : ' (הערכה מלאה)'}</button>`
      }`;
    flash = '';
    body!.querySelectorAll<HTMLButtonElement>('.mem-del').forEach((b) =>
      b.addEventListener('click', () => {
        if (b.dataset.sure) {
          void deletePhoto(b.dataset.id!).then(paint);
        } else {
          // a second tap confirms (so that one tap is never enough to lose a photo)
          b.dataset.sure = '1';
          b.textContent = 'למחוק?';
          b.classList.add('sure');
          window.setTimeout(() => (delete b.dataset.sure, (b.textContent = '🗑'), b.classList.remove('sure')), 2500);
        }
      }),
    );
    const input = body!.querySelector<HTMLInputElement>('#mem-file');
    body!.querySelector('#mem-add')?.addEventListener('click', () => input?.click());
    input?.addEventListener('change', async () => {
      const files = [...(input.files ?? [])].slice(0, room);
      const made: { file: File; blob: Blob; url: string }[] = [];
      for (const f of files) {
        const blob = await squareBlob(f);
        if (blob) made.push({ file: f, blob, url: URL.createObjectURL(blob) });
      }
      if (!made.length) {
        flash = 'לא הצלחתי לקרוא את התמונות שנבחרו.';
        return void paint();
      }
      pending = made;
      void paint();
    });
    body!.querySelector('#mem-save')?.addEventListener('click', async () => {
      const files = pending!.map((x) => x.file);
      pending!.forEach((x) => URL.revokeObjectURL(x.url));
      pending = null;
      const r = await addPhotos(files);
      flash = `נוספו ${r.added} תמונות ✓${r.skipped ? ` (${r.skipped} לא נוספו)` : ''}`;
      void paint();
    });
    body!.querySelector('#mem-cancel')?.addEventListener('click', () => {
      pending!.forEach((x) => URL.revokeObjectURL(x.url));
      pending = null;
      void paint();
    });
  }
  await paint();
}
