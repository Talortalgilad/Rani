/** The steps about what Rani likes (SPEC-tutor.md section 4): likes, likeOrNot, ask, recall. Pictures: the words of the game, the faces of the game (face_love, face_yuck, face_yes, face_no). No wrong answer in `likes`, `ask`, `recall`. */
import { labelOf } from '../../content/words';
import { imageUrl } from '../../art/images';
import { playWord } from '../../voice';
import { clipText } from '../audio';
import { faceUrl } from '../lolly';
import { pictureHtml } from '../pictures';
import { setLike } from '../state';
import { pickRound, type Option, type StepRun, HIDDEN } from '../shell';
import { esc } from '../../ui/text';

const arr = <T>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
const faceBtn = (face: string, cls: string, label = ''): string => `<span class="tutor-facebtn ${cls}"><img src="${faceUrl(face)}" alt="" draggable="false">${label ? `<b dir="ltr">${esc(label)}</b>` : ''}</span>`;
const picHtml = (id: string): string => `<div class="tutor-pic big">${pictureHtml(`word:${id}`)}</div>`;
/** the English word of a picture, said by Lolly's mouth (a recording of the word, if there is one) */
async function hearWord(sh: Parameters<StepRun>[0], food: string): Promise<void> {
  sh.lolly.speaking(true);
  try {
    if (!(await playWord(food))) await sh.wait(500);
  } finally {
    sh.lolly.speaking(false);
  }
}
/** the big buttons of two choices, in a row (the faces); resolves with the index tapped */
function twoButtons(sh: Parameters<StepRun>[0], htmls: string[], cls: string): Promise<number> {
  return new Promise((res) => {
    const row = document.createElement('div');
    row.className = `tutor-twofaces ${cls}`;
    row.innerHTML = htmls.map((h, i) => `<button type="button" class="tutor-bigface" data-i="${i}">${h}</button>`).join('');
    row.querySelectorAll<HTMLButtonElement>('button').forEach((b) =>
      b.addEventListener('click', () => {
        row.querySelectorAll('button').forEach((x) => ((x as HTMLButtonElement).disabled = true));
        b.classList.add('sel');
        sh.deps.sound.play('pop', 640);
        res(Number(b.dataset.i));
      }),
    );
    sh.stage.appendChild(row);
  });
}

/**
 * likes: for each food, a picture, and two faces: a heart or "yuck". Whatever she taps is right and is saved (on the phone). A heart: Lolly says "You like pizza!".
 * A yuck: Lolly just nods. The first time in a lesson Lolly tells in Hebrew what to do.
 */
export const likes: StepRun = async (sh, step) => {
  const foods = arr<string>(step.foods);
  for (const [k, food] of foods.entries()) {
    const c = sh.clear();
    c.innerHTML = picHtml(food);
    sh.bubble(labelOf(food), 'en');
    sh.setLast('');
    if (k === 0 && sh.once('likes-intro')) await sh.say('t_like_ask', { look: 'listen' });
    // the word is heard (not a button: Lolly says it); the picture says it again when it is tapped
    await hearWord(sh, food);
    c.querySelector('.tutor-pic')?.addEventListener('click', () => void hearWord(sh, food).catch(() => {}));
    sh.lolly.set('listen');
    const i = await twoButtons(sh, [faceBtn('love', 'love'), faceBtn('yuck', 'yuck')], 'likes');
    const like = i === 0;
    sh.deps.setState(setLike(sh.deps.state(), food, like));
    if (like) {
      sh.deps.sound.play('bonus');
      await sh.say(`t_you_like_${food}`, { look: 'happy' });
    } else {
      sh.lolly.set('listen');
      await sh.wait(500);
    }
  }
};

/** likeOrNot: she hears "I like cheese." or "I don't like milk." and taps the heart or the yuck. The sentence is hidden in the bubble until she is right. */
export const likeOrNot: StepRun = async (sh, step) => {
  const items = arr<{ clip: string; food: string; like: boolean }>(step.items);
  let worst = 1;
  for (const [k, it] of items.entries()) {
    const c = sh.clear();
    c.innerHTML = picHtml(it.food);
    if (k === 0 && sh.once('likeOrNot-intro')) await sh.say('t_tap_picture', { look: 'listen' });
    const hear = (): Promise<void> => sh.say(it.clip, { look: 'listen', text: HIDDEN });
    await hear();
    const options: Option[] = [{ html: faceBtn('love', 'love') }, { html: faceBtn('yuck', 'yuck') }];
    const tries = await pickRound(sh, { options, correct: it.like ? 0 : 1, replay: hear, cls: 'tf', onRight: () => sh.bubble(clipText(it.clip), 'en') });
    worst = Math.max(worst, tries);
  }
  return { tries: worst >= 3 ? 3 : 1 };
};

/**
 * ask: Lolly asks "Do you like pasta?" (the picture of the food next to her), and Rani answers Yes or No. Lolly answers: "Me too!" or "Yummy!" for a Yes (one after the other),
 * "Yucky!" for a No. Saved. There is no wrong answer.
 */
export const ask: StepRun = async (sh, step) => {
  const items = arr<{ clip: string; food: string }>(step.items);
  for (const [k, it] of items.entries()) {
    const c = sh.clear();
    c.innerHTML = picHtml(it.food);
    await sh.say(it.clip, { look: 'listen', keep: true });
    const i = await twoButtons(sh, [faceBtn('yes', 'yes', 'Yes'), faceBtn('no', 'no', 'No')], 'ask');
    const yes = i === 0;
    sh.deps.setState(setLike(sh.deps.state(), it.food, yes));
    if (yes) {
      sh.deps.sound.play('bonus');
      await sh.say(k % 2 === 0 ? 't_me_too' : 't_yummy', { look: 'happy' });
    } else await sh.say('t_yucky', { look: 'listen' });
  }
};

/** recall: Lolly remembers: "I remember what you like!" and 2-3 "You like pizza!" from what is saved. Nothing saved that she likes: the step is skipped. */
export const recall: StepRun = async (sh) => {
  const liked = Object.entries(sh.deps.state().likes)
    .filter(([, v]) => v)
    .map(([f]) => f);
  if (!liked.length) return;
  // the last ones that were saved are the first (the object keeps the order in which they were saved)
  const pick = liked.slice(-3).reverse();
  const c = sh.clear();
  sh.listenOnly();
  c.innerHTML = `<div class="tutor-recall">${pick.map((f) => `<div class="tutor-pic big">${pictureHtml(`lolly:like:${f}`)}</div>`).join('')}</div>`;
  await sh.say('t_i_remember', { look: 'happy', keep: true });
  for (const f of pick) {
    await sh.say(`t_you_like_${f}`, { look: 'happy', keep: true });
  }
  void imageUrl;
  await sh.advance();
};
