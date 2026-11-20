/** The album of stickers (SPEC-tutor.md section 8): a sticker for each lesson that is done, a golden crown for each unit that is done, a sparkling sticker for a challenge with no mistake. A tap on a sticker says the sentence of the day of its lesson. */
import type { SoundApi } from '../../../sound';
import { imageUrl } from '../art/images';
import { esc } from '../ui/text';
import { playTutor, stopTutor } from './audio';
import { LESSONS, units, type Lesson } from './lessons';
import { isDone, type TutorState } from './state';
import { stickerOf } from './steps/basic';

/** the sentence of the day of a lesson: its clip and its text (null: the lesson has none) */
export function sentenceOf(l: Lesson): { clip: string; en: string } | null {
  const s = l.steps.find((x) => x.type === 'sentenceOfDay');
  return s && typeof s.clip === 'string' ? { clip: s.clip, en: typeof s.en === 'string' ? s.en : s.clip } : null;
}
export const unitDoneIn = (s: TutorState, unit: number): boolean => LESSONS.filter((l) => l.unit === unit).every((l) => isDone(s, l.id));

export function showAlbum(root: HTMLElement, o: { state: TutorState; sound: SoundApi; onBack(): void }): () => void {
  const s = o.state;
  root.innerHTML = `
    <div class="en-screen tutor-screen tutor-album-screen">
      <div class="en-sky"></div>
      <header class="tutor-top"><button class="q-home" id="aback" type="button" aria-label="חזרה">←</button><h1 class="map-title">אלבום המדבקות</h1><span style="width:44px"></span></header>
      <div class="tutor-album-page">${units()
        .map((u) => {
          const full = unitDoneIn(s, u);
          return `<section class="album-unit ${full ? 'full' : ''}"><h2><span class="album-crown ${full ? 'on' : ''}" aria-hidden="true">👑</span>יחידה ${u}</h2><div class="album-row">${LESSONS.filter((l) => l.unit === u)
            .map((l, i) => {
              const done = isDone(s, l.id);
              if (!done) return `<div class="album-slot empty"><span>${i + 1}</span></div>`;
              const pic = s.stickers[l.id] ?? stickerOf(l.id);
              return `<button type="button" class="album-slot sticker ${s.sparkle[l.id] ? 'sparkle' : ''}" data-id="${l.id}" aria-label="${esc(l.titleHe)}"><img src="${imageUrl(pic)}" alt="" draggable="false"></button>`;
            })
            .join('')}</div></section>`;
        })
        .join('')}</div>
      <div class="album-say" id="asay" dir="ltr"></div>
    </div>`;
  let token = 0;
  root.querySelectorAll<HTMLButtonElement>('.album-slot.sticker').forEach((b) =>
    b.addEventListener('click', () => {
      const l = LESSONS.find((x) => x.id === b.dataset.id)!;
      const sd = sentenceOf(l);
      b.classList.remove('hop');
      void b.offsetWidth;
      b.classList.add('hop');
      o.sound.play('pop', 700);
      if (!sd) return;
      const mine = ++token;
      root.querySelector('#asay')!.textContent = sd.en;
      void playTutor(sd.clip).then(() => void mine);
    }),
  );
  root.querySelector('#aback')!.addEventListener('click', () => {
    stopTutor();
    o.onBack();
  });
  return () => stopTutor();
}
