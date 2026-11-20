import { esc } from '../../ui/text';
import { clipText } from '../audio';
import { pictureHtml } from '../pictures';
import type { StepRun } from '../shell';

/**
 * sayFirst ("you first"): Lolly shows a picture and asks (`prompt`, if there is one) and says "Now you!"; Rani says it aloud and taps "I said it!". Only then Lolly says the
 * answer and asks "Did you say it like I did?" with two buttons: 👍 and "Again" (which says the answer again). There is no wrong answer. The first one of the lesson is
 * explained in Hebrew (t_now_you_he), after that only "Now you!". No button reads itself aloud.
 */
export const sayFirst: StepRun = async (sh, step) => {
  const c = sh.clear();
  const prompt = typeof step.prompt === 'string' ? step.prompt : '';
  const answer = String(step.answer);
  const pic = typeof step.picture === 'string' ? step.picture : '';
  // with a picture: the picture. Without: the question itself, big, with a speaker; with no question either: a big 🗣️
  if (pic) {
    c.innerHTML = `<div class="tutor-pic big">${pictureHtml(pic)}</div>`;
  } else if (prompt) {
    c.innerHTML = `<div class="tutor-card"><div class="tutor-big" dir="ltr">${esc(clipText(prompt))}</div><button class="tutor-speaker" type="button" aria-label="🔊">🔊</button></div>`;
    c.querySelector('.tutor-speaker')!.addEventListener('click', () => void sh.say(prompt).catch(() => {}));
  } else c.innerHTML = '<div class="tutor-card"><div class="tutor-mic big">🗣️</div></div>';
  // a picture with no question: "What do you see?"
  if (prompt) await sh.say(prompt, { look: 'happy' });
  else if (pic) await sh.say('t_what_do_you_see', { look: 'happy' });
  await sh.say('t_now_you', { look: 'listen', keep: true });
  if (sh.once('sayFirst')) await sh.say('t_now_you_he', { look: 'listen', keep: true });
  sh.lolly.set('listen');
  await sh.next('אמרתי!');
  // now Lolly says it, and asks
  await sh.say(answer, { look: 'happy' });
  await sh.say('t_self_check', { look: 'listen', keep: true });
  sh.lolly.set('listen');
  await new Promise<void>((res, rej) => {
    const row = document.createElement('div');
    row.className = 'tutor-yesno';
    row.innerHTML = '<button type="button" class="tutor-next" data-a="again"><span>עוד פעם</span> <b>🔁</b></button><button type="button" class="tutor-next" data-a="ok"><span>👍</span></button>';
    row.querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', () => {
        if ((b as HTMLElement).dataset.a === 'ok') {
          row.remove();
          sh.deps.sound.play('bonus');
          sh.lolly.set('happy');
          res();
        } else sh.say(answer, { look: 'happy', keep: true }).then(() => sh.lolly.set('listen')).catch(rej);
      }),
    );
    sh.stage.appendChild(row);
  });
  void esc;
  void clipText;
};
