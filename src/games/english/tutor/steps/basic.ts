import { WORDS } from '../../content/words';
import { esc } from '../../ui/text';
import { clipText } from '../audio';
import { pictureHtml } from '../pictures';
import { setFeeling, finish } from '../state';
import { faceSvg } from '../pictures';
import { bubbleHtml, type StepRun } from '../shell';

const str = (x: unknown): string => (typeof x === 'string' ? x : '');

/** greet: Lolly waves. "Hello, Rani!", and before it one of the three Hebrew hellos (the first lesson says the welcome in its next step). */
export const greet: StepRun = async (sh) => {
  const c = sh.clear();
  c.innerHTML = '<div class="tutor-wave">👋</div>';
  sh.lolly.set('happy');
  const welcomeNext = sh.lesson.steps.some((s) => s.type === 'say' && ((s.clips as string[]) ?? []).includes('t_welcome'));
  if (!welcomeNext) await sh.say(`t_hi.${Math.floor(Math.random() * 3)}`, { look: 'happy', keep: true });
  await sh.say('t_hello_rani', { look: 'happy' });
};

/** feel: five faces; Lolly answers the one she taps, and it is remembered (only the last day). */
export const feel: StepRun = async (sh) => {
  const st = sh.deps.state();
  if (st.feeling?.day === sh.deps.today) return;
  const c = sh.clear();
  await sh.say('t_how_are_you_today', { look: 'listen', keep: true });
  if (!st.feeling) await sh.say('t_feel_ask', { look: 'listen', keep: true });
  const feelings = ['happy', 'sad', 'sleepy', 'hungry', 'great'];
  const row = document.createElement('div');
  row.className = 'tutor-faces';
  row.innerHTML = feelings.map((f) => `<button class="tutor-face" type="button" data-f="${f}">${faceSvg(f)}</button>`).join('');
  c.appendChild(row);
  const f = await new Promise<string>((res) => row.querySelectorAll<HTMLButtonElement>('.tutor-face').forEach((b) => b.addEventListener('click', () => res(b.dataset.f!))));
  row.querySelectorAll<HTMLButtonElement>('.tutor-face').forEach((b) => b.classList.toggle('sel', b.dataset.f === f));
  sh.deps.setState(setFeeling(sh.deps.state(), sh.deps.today, f));
  sh.deps.sound.play('pop', 700);
  await sh.say(`t_re_${f}`, { look: f === 'sad' ? 'listen' : 'happy' });
};

/** say: Lolly says the clips in order; the text is in her bubble. */
export const say: StepRun = async (sh, step) => {
  sh.clear();
  for (const id of (step.clips as string[]) ?? []) {
    await sh.say(id, { look: 'happy' });
    await sh.wait(250);
  }
};

/** teach: the English clip with its picture, then the Hebrew explanation. Tap the bubble to hear it again. */
export const teach: StepRun = async (sh, step) => {
  const c = sh.clear();
  const en = str(step.en);
  const he = str(step.he);
  c.innerHTML = `<div class="tutor-card">${step.picture ? `<div class="tutor-pic">${pictureHtml(str(step.picture))}</div>` : ''}<div class="tutor-big" dir="ltr">${esc(clipText(en))}</div><div class="tutor-sub">${he ? bubbleHtml(clipText(he), 'he') : ''}</div></div>`;
  c.querySelector('.tutor-big')!.addEventListener('click', () => void sh.say(en).catch(() => {}));
  await sh.say(en, { look: 'happy', keep: true });
  if (he) await sh.say(he, { look: 'listen' });
  await sh.next();
};

/** repeat: Lolly says it, "say it with me", and again; Rani is invited to say it aloud. No check: she taps "I said it!". */
export const repeat: StepRun = async (sh, step) => {
  const c = sh.clear();
  const clip = str(step.clip);
  c.innerHTML = `<div class="tutor-card"><div class="tutor-big" dir="ltr">${esc(clipText(clip))}</div><div class="tutor-mic" aria-hidden="true">🗣️</div></div>`;
  await sh.say(clip, { look: 'happy', keep: true });
  await sh.say('t_say_it_with_me', { look: 'happy', keep: true });
  await sh.say(clip, { look: 'happy' });
  await sh.say('t_say_aloud', { look: 'listen', keep: true });
  await sh.next('אמרתי!', 'next');
  sh.lolly.set('happy');
  sh.deps.sound.play('bonus');
};

/** sentenceOfDay: the sentence, big, with a speaker; "tell dad and mom". */
export const sentenceOfDay: StepRun = async (sh, step) => {
  const c = sh.clear();
  const clip = str(step.clip);
  c.innerHTML = `<div class="tutor-card day"><div class="tutor-big xl" dir="ltr">${esc(str(step.en) || clipText(clip))}</div><button class="tutor-speaker" type="button" aria-label="🔊">🔊</button></div>`;
  c.querySelector('.tutor-speaker')!.addEventListener('click', () => void sh.say(clip).catch(() => {}));
  await sh.say(clip, { look: 'happy', keep: true });
  await sh.say('t_sentence_of_day', { look: 'happy' });
  await sh.next();
};

const hash = (s: string): number => [...s].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
/** The picture of the sticker of a lesson: one of the pictures of the game, the same one every time for that lesson. */
export const stickerOf = (lesson: string): string => WORDS[hash(lesson) % WORDS.length].id;

/** sticker: a new sticker sticks into the album. The lesson is finished (and remembered) here. */
export const sticker: StepRun = async (sh) => {
  const c = sh.clear();
  const id = sh.deps.state().stickers[sh.lesson.id] ?? stickerOf(sh.lesson.id);
  c.innerHTML = `<div class="tutor-sticker-stage"><div class="tutor-sticker">${pictureHtml(`word:${id}`)}</div><div class="tutor-album" aria-hidden="true">📒</div></div>`;
  sh.deps.setState(finish(sh.deps.state(), sh.lesson.id, id, sh.deps.today));
  sh.lolly.set('clap');
  sh.deps.sound.play('win');
  await sh.say('t_sticker', { look: 'clap' });
  c.querySelector('.tutor-sticker')?.classList.add('stuck');
  await sh.wait(900);
  await sh.next();
};

/** unitDone: confetti and "a whole unit!". */
export const unitDone: StepRun = async (sh) => {
  const c = sh.clear();
  const bits = Array.from({ length: 36 }, (_, i) => `<i style="left:${(i * 29) % 100}%;animation-delay:${(i % 9) * 0.12}s;background:${['#ff6fa8', '#ffc83a', '#4fd1c5', '#7b5cff', '#ff8a3d'][i % 5]}"></i>`).join('');
  c.innerHTML = `<div class="tutor-confetti" aria-hidden="true">${bits}</div><div class="tutor-card"><div class="tutor-crown">👑</div></div>`;
  sh.lolly.set('clap');
  sh.deps.sound.play('fanfare');
  await sh.say('t_unit_done', { look: 'clap' });
  await sh.next();
};

/** bye: "See you tomorrow!" and one of the two Hebrew goodbyes. */
export const bye: StepRun = async (sh) => {
  const c = sh.clear();
  c.innerHTML = '<div class="tutor-wave">👋</div>';
  sh.lolly.set('happy');
  await sh.say('t_see_you_tomorrow', { look: 'happy', keep: true });
  await sh.say(`t_bye.${Math.floor(Math.random() * 2)}`, { look: 'happy' });
  await sh.wait(500);
};

/** note: for the developer only. Not shown. */
export const note: StepRun = async () => {};
