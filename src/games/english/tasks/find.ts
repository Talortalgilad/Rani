import { itemImg } from '../art/images';
import { en } from '../content/lines';
import { labelOf, pluralOf } from '../content/words';
import { el, pictureButton, shuffled, showSolution, type TaskEnv, type TaskHandle } from './common';

const SPOTS: [number, number][] = [[0.2, 0.2], [0.5, 0.16], [0.8, 0.2], [0.2, 0.5], [0.8, 0.5], [0.35, 0.78], [0.65, 0.78]];

/** "Find all the fish!": a scene full of pictures; tap every one of the right kind. */
export function findTask(env: TaskEnv, right: string, others: string[], count: number, seed = 5): TaskHandle {
  const items = shuffled([...Array(count).fill(right), ...Array(Math.min(SPOTS.length - count, 4)).fill(0).map((_, i) => others[i % others.length])], seed);
  const btns: { b: HTMLButtonElement; id: string }[] = [];
  let found = 0;
  let locked = false;
  items.forEach((id, i) => {
    const b = pictureButton(env.stage, itemImg(id), id, 'pic small floaty');
    b.style.left = `${SPOTS[i][0] * 100}%`;
    b.style.top = `${SPOTS[i][1] * 100}%`;
    btns.push({ b, id });
    b.addEventListener('click', async () => {
      if (locked || b.classList.contains('win')) return;
      const r = b.getBoundingClientRect();
      const s = env.stage.getBoundingClientRect();
      if (id === right) {
        b.classList.add('win');
        env.sound('correct');
        env.say(labelOf(right), true);
        env.sparkle(r.left - s.left + r.width / 2, r.top - s.top + r.height / 2);
        found++;
        if (found === count) {
          locked = true;
          env.face('dance');
          window.setTimeout(() => env.done(), 1100);
        } else env.face('happy', `${found}/${count}`);
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
          for (const x of btns.filter((t) => t.id === right && !t.b.classList.contains('win'))) await showSolution(env.stage, x.b);
          env.done();
        }
      }
    });
  });
  const hint = el('div', 'find-count', env.stage);
  hint.textContent = '';
  return { repeat: () => env.say(`Find all the ${pluralOf(right)}!`), destroy: () => (hint.remove(), btns.forEach((x) => x.b.remove())) };
}
