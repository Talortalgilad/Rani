import { itemImg } from '../art/images';
import { en } from '../content/lines';
import { labelOf } from '../content/words';
import { pictureButton, showSolution, type TaskEnv, type TaskHandle } from './common';

/** "Tap the big bear!": the same picture twice, a big one and a small one. */
export function bigSmallTask(env: TaskEnv, right: string, which: 'big' | 'small', seed = 1): TaskHandle {
  const bigLeft = seed % 2 === 0;
  const mk = (kind: 'big' | 'small', x: number): HTMLButtonElement => {
    const b = pictureButton(env.stage, itemImg(right), `${kind} ${right}`, `pic floaty ${kind === 'big' ? 'size-big' : 'size-small'}`);
    b.style.left = `${x * 100}%`;
    b.style.top = kind === 'big' ? '46%' : '58%';
    return b;
  };
  const big = mk('big', bigLeft ? 0.3 : 0.7);
  const small = mk('small', bigLeft ? 0.74 : 0.26);
  const target = which === 'big' ? big : small;
  let locked = false;
  for (const b of [big, small]) {
    b.addEventListener('click', async () => {
      if (locked) return;
      if (b === target) {
        locked = true;
        b.classList.add('win');
        env.sound('correct');
        env.face('dance');
        env.say(`${which} ${labelOf(right)}`);
        window.setTimeout(() => env.done(), 1200);
      } else {
        b.classList.remove('shake');
        void b.offsetWidth;
        b.classList.add('shake');
        const n = env.mistake();
        env.sound('oops');
        env.face('encourage', 'Hmm, try again!');
        env.say(en.tryAgain);
        if (n >= 2) {
          locked = true;
          await showSolution(env.stage, target);
          env.done();
        }
      }
    });
  }
  return { repeat: () => env.say(`Tap the ${which} ${labelOf(right)}!`), destroy: () => (big.remove(), small.remove()) };
}
