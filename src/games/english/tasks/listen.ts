import { itemImg } from '../art/images';
import { labelOf } from '../content/words';
import { el, pictureButton, shuffled, showSolution, type TaskEnv, type TaskHandle } from './common';

/** "What did you hear?": a word is said, and she picks the picture out of three. */
export function listenTask(env: TaskEnv, rightId: string, ids: string[], seed = 3): TaskHandle {
  const speaker = el('button', 'big-speaker', env.stage);
  speaker.type = 'button';
  speaker.textContent = '🔊';
  speaker.setAttribute('aria-label', 'שמעי שוב');
  const row = el('div', 'choice-row', env.stage);
  const pics = new Map<string, HTMLButtonElement>();
  let locked = false;
  shuffled(ids, seed).forEach((id) => {
    const b = pictureButton(row, itemImg(id), id, 'pic en-choice');
    pics.set(id, b);
    b.addEventListener('click', async () => {
      if (locked) return;
      if (id === rightId) {
        locked = true;
        env.sound('correct');
        env.face('dance');
        b.classList.add('win');
        env.say(labelOf(rightId), true);
        window.setTimeout(() => env.done(), 1300);
      } else {
        b.classList.remove('shake');
        void b.offsetWidth;
        b.classList.add('shake');
        const n = env.mistake();
        env.sound('oops');
        env.face('encourage', 'Hmm, try again!');
        window.setTimeout(() => env.say(labelOf(rightId), true), 500);
        if (n >= 3) {
          locked = true;
          await showSolution(env.stage, pics.get(rightId)!);
          env.done();
        } else if (n >= 2) pics.get(rightId)!.classList.add('glint');
      }
    });
  });
  speaker.addEventListener('click', () => env.say(labelOf(rightId), true));
  return { repeat: () => env.say(labelOf(rightId), true), destroy: () => (speaker.remove(), row.remove()) };
}
