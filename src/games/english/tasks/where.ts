import { itemImg } from '../art/images';
import { en } from '../content/lines';
import { labelOf } from '../content/words';
import { el, pictureButton, showSolution, type TaskEnv, type TaskHandle } from './common';

/** Which of on / in / under the dropped picture is, relative to the box (its middle against the box's rectangle). */
export function placeOf(item: { x: number; y: number }, box: { left: number; top: number; right: number; bottom: number }): 'on' | 'in' | 'under' | null {
  const w = box.right - box.left;
  const h = box.bottom - box.top;
  const dx = item.x - (box.left + w / 2);
  if (Math.abs(dx) > w * 0.75) return null;
  if (item.y > box.top + h * 0.12 && item.y < box.bottom - h * 0.05 && Math.abs(dx) < w * 0.5) return 'in';
  if (item.y <= box.top + h * 0.12 && item.y > box.top - h * 1.1) return 'on';
  if (item.y >= box.bottom - h * 0.05 && item.y < box.bottom + h * 0.9) return 'under';
  return null;
}

/** "Put the cat on the box!": drag the picture to the place the word says. */
export function whereTask(env: TaskEnv, item: string, ref: string, prep: 'on' | 'in' | 'under'): TaskHandle {
  const box = el('div', 'where-box', env.stage);
  box.innerHTML = itemImg(ref);
  const b = pictureButton(env.stage, itemImg(item), item, 'pic drag where-item');
  b.style.left = '22%';
  b.style.top = '84%';
  let start: { x: number; y: number } | null = null;
  let locked = false;
  b.addEventListener('pointerdown', (e) => {
    if (locked) return;
    b.setPointerCapture(e.pointerId);
    start = { x: e.clientX, y: e.clientY };
    b.classList.add('dragging');
    env.say(labelOf(item), true);
  });
  b.addEventListener('pointermove', (e) => {
    if (start) b.style.translate = `${e.clientX - start.x}px ${e.clientY - start.y}px`;
  });
  const drop = async (): Promise<void> => {
    if (!start) return;
    start = null;
    b.classList.remove('dragging');
    const r = b.getBoundingClientRect();
    const bx = box.getBoundingClientRect();
    const got = placeOf({ x: r.left + r.width / 2, y: r.top + r.height / 2 }, bx);
    if (got === prep) {
      locked = true;
      env.sound('correct');
      env.face('dance');
      b.classList.add('win');
      env.say(`${labelOf(item)} ${prep} the ${labelOf(ref)}`);
      window.setTimeout(() => env.done(), 1400);
    } else {
      b.classList.add('slide-back');
      b.style.translate = '0 0';
      window.setTimeout(() => b.classList.remove('slide-back'), 400);
      if (got !== null) {
        const n = env.mistake();
        env.sound('oops');
        env.face('encourage', 'Hmm, try again!');
        env.say(en.tryAgain);
        if (n >= 3) {
          locked = true;
          await showSolution(env.stage, box);
          env.done();
        }
      }
    }
  };
  b.addEventListener('pointerup', drop);
  b.addEventListener('pointercancel', drop);
  return { repeat: () => env.say(`Put the ${labelOf(item)} ${prep} the ${labelOf(ref)}!`), destroy: () => (box.remove(), b.remove()) };
}
