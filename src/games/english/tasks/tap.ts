import { itemImg } from '../art/images';
import { en } from '../content/lines';
import { SPOTS3, pictureButton, place, shuffled, showSolution, type TaskEnv, type TaskHandle } from './common';

/** "Tap the bed!": three pictures, one tap on the right one. */
export function tapTask(env: TaskEnv, rightId: string, ids: string[], seed = 2): TaskHandle {
  const order = shuffled(ids, seed);
  const pics = new Map<string, HTMLButtonElement>();
  let locked = false;
  order.forEach((id, i) => {
    const b = pictureButton(env.stage, itemImg(id), id, 'pic floaty');
    place(b, SPOTS3[(i + 1) % 3]);
    pics.set(id, b);
    b.addEventListener('click', async () => {
      if (locked) return;
      const r = b.getBoundingClientRect();
      const s = env.stage.getBoundingClientRect();
      if (id === rightId) {
        locked = true;
        env.sound('correct');
        env.face('dance');
        b.classList.add('win');
        env.sparkle(r.left - s.left + r.width / 2, r.top - s.top + r.height / 2);
        window.setTimeout(() => env.done(), 1100);
      } else {
        b.classList.remove('shake');
        void b.offsetWidth;
        b.classList.add('shake');
        const n = env.mistake();
        env.sound('oops');
        env.face('encourage', 'Hmm, try again!');
        env.say(en.tryAgain);
        if (n >= 3) {
          locked = true;
          await showSolution(env.stage, pics.get(rightId)!);
          env.done();
        } else if (n >= 2) pics.get(rightId)!.classList.add('glint');
      }
    });
  });
  return { repeat: () => env.say(en.tap(rightId)), destroy: () => pics.forEach((e) => e.remove()) };
}
