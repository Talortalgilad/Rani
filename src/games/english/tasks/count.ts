import { itemImg } from '../art/images';
import { en } from '../content/lines';
import { pluralOf } from '../content/words';
import { el, pictureButton, showSolution, type TaskEnv, type TaskHandle } from './common';

const SPOTS: [number, number][] = [[0.22, 0.2], [0.5, 0.14], [0.78, 0.2], [0.34, 0.42], [0.66, 0.42]];

/** "How many balls? Tap the number!": count the pictures and tap the number. */
export function countTask(env: TaskEnv, right: string, n: number): TaskHandle {
  const items: HTMLElement[] = [];
  for (let i = 0; i < n; i++) {
    const b = el('div', 'pic small floaty', env.stage);
    b.innerHTML = itemImg(right);
    b.style.left = `${SPOTS[i][0] * 100}%`;
    b.style.top = `${SPOTS[i][1] * 100}%`;
    items.push(b);
    // each picture that is touched is counted out loud
    b.addEventListener('click', () => {
      b.classList.add('counted');
      env.say(String(items.filter((x) => x.classList.contains('counted')).length), true);
    });
  }
  const row = el('div', 'number-row', env.stage);
  const nums = new Map<number, HTMLButtonElement>();
  let locked = false;
  for (let k = 1; k <= 6; k++) {
    const b = el('button', 'number-btn', row);
    b.type = 'button';
    b.textContent = String(k);
    nums.set(k, b);
    b.addEventListener('click', async () => {
      if (locked) return;
      env.say(String(k), true);
      if (k === n) {
        locked = true;
        b.classList.add('win');
        env.sound('correct');
        env.face('dance');
        window.setTimeout(() => env.done(), 1200);
      } else {
        b.classList.remove('shake');
        void b.offsetWidth;
        b.classList.add('shake');
        const m = env.mistake();
        env.sound('oops');
        env.face('cheer', 'Hmm, try again!');
        env.say(en.tryAgain);
        if (m >= 3) {
          locked = true;
          nums.get(n)!.classList.add('pulse');
          await showSolution(env.stage, nums.get(n)!);
          env.done();
        }
      }
    });
  }
  void pictureButton;
  return { repeat: () => env.say(`How many ${pluralOf(right)}? Tap the number!`), destroy: () => (row.remove(), items.forEach((x) => x.remove())) };
}
