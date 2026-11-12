import { itemImg } from '../art/images';
import { en } from '../content/lines';
import { labelOf } from '../content/words';
import { el, pictureButton, place, showSolution, type TaskEnv, type TaskHandle } from './common';

/** "Put the book in the box!": drag the right picture into the box; a wrong one slides back. */
export function dragTask(env: TaskEnv, rightId: string, otherIds: string[]): TaskHandle {
  const box = el('div', 'drop-box', env.stage);
  box.innerHTML = itemImg('box');
  box.style.left = '50%';
  box.style.top = '74%';
  const items = new Map<string, HTMLButtonElement>();
  const spots: [number, number][] = [[0.2, 0.36], [0.5, 0.16], [0.8, 0.36]];
  const ids = [otherIds[0], rightId, otherIds[1]].filter(Boolean);
  let locked = false;
  ids.forEach((id, i) => {
    const b = pictureButton(env.stage, itemImg(id), id, 'pic drag');
    place(b, spots[i]);
    items.set(id, b);
    let start: { x: number; y: number; px: number; py: number } | null = null;
    b.addEventListener('pointerdown', (e) => {
      if (locked) return;
      b.setPointerCapture(e.pointerId);
      start = { x: e.clientX, y: e.clientY, px: 0, py: 0 };
      b.classList.add('dragging');
      env.say(labelOf(id), true);
    });
    b.addEventListener('pointermove', (e) => {
      if (!start) return;
      b.style.translate = `${e.clientX - start.x}px ${e.clientY - start.y}px`;
    });
    const drop = async (e: PointerEvent): Promise<void> => {
      if (!start) return;
      start = null;
      b.classList.remove('dragging');
      const r = b.getBoundingClientRect();
      const bx = box.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const inside = cx > bx.left && cx < bx.right && cy > bx.top && cy < bx.bottom;
      void e;
      if (inside && id === rightId) {
        locked = true;
        b.style.translate = `${bx.left + bx.width / 2 - (r.left + r.width / 2) + (parseFloat(b.style.translate) || 0)}px ${bx.top + bx.height * 0.4 - (r.top + r.height / 2) + (parseFloat((b.style.translate || '0 0').split(' ')[1]) || 0)}px`;
        b.classList.add('into-box');
        env.sound('correct');
        env.face('dance');
        const s = env.stage.getBoundingClientRect();
        env.sparkle(bx.left - s.left + bx.width / 2, bx.top - s.top + bx.height / 2);
        window.setTimeout(() => env.done(), 1200);
      } else {
        b.classList.add('slide-back');
        b.style.translate = '0 0';
        window.setTimeout(() => b.classList.remove('slide-back'), 400);
        if (inside) {
          const n = env.mistake();
          env.sound('oops');
          env.face('cheer', 'Hmm, try again!');
          env.say(en.tryAgain);
          if (n >= 3) {
            locked = true;
            await showSolution(env.stage, items.get(rightId)!);
            env.done();
          } else if (n >= 2) items.get(rightId)!.classList.add('glint');
        }
      }
    };
    b.addEventListener('pointerup', drop);
    b.addEventListener('pointercancel', drop);
  });
  return { repeat: () => env.say(en.put(labelOf(rightId), 'box')), destroy: () => (box.remove(), items.forEach((e) => e.remove())) };
}
