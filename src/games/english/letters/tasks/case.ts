import { el, shuffled, type TaskEnv, type TaskHandle } from '../../tasks/common';
import { toyLetter } from '../ui/glyph';

/** "Big and small": each capital letter is dragged onto its small letter (S onto s, A onto a). Dragging a letter says its sound. */
export function caseTask(env: TaskEnv, letters: string[], seed = 7): TaskHandle {
  const targets = el('div', 'case-row targets', env.stage);
  const tray = el('div', 'case-row tray', env.stage);
  const slot = new Map<string, HTMLElement>();
  const tile = new Map<string, HTMLElement>();
  const done = new Set<string>();
  let locked = false;
  let dead = false;
  shuffled(letters, seed).forEach((id) => {
    const s = el('div', 'case-slot', targets);
    s.innerHTML = toyLetter(id, 'small');
    slot.set(id, s);
  });
  shuffled(letters, seed + 3).forEach((id) => {
    const b = el('button', 'case-tile', tray);
    b.type = 'button';
    b.setAttribute('aria-label', id.toUpperCase());
    b.innerHTML = toyLetter(id.toUpperCase());
    tile.set(id, b);
    let start: { x: number; y: number } | null = null;
    b.addEventListener('pointerdown', (e) => {
      if (locked || done.has(id)) return;
      b.setPointerCapture(e.pointerId);
      start = { x: e.clientX, y: e.clientY };
      b.classList.add('dragging');
      env.sayLetter(id);
    });
    b.addEventListener('pointermove', (e) => {
      if (start) b.style.translate = `${e.clientX - start.x}px ${e.clientY - start.y}px`;
    });
    const drop = (e: PointerEvent): void => {
      if (!start) return;
      start = null;
      b.classList.remove('dragging');
      b.releasePointerCapture?.(e.pointerId);
      const r = b.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const hit = [...slot.entries()].find(([, s]) => {
        const q = s.getBoundingClientRect();
        return cx > q.left - 10 && cx < q.right + 10 && cy > q.top - 10 && cy < q.bottom + 10;
      });
      if (hit && hit[0] === id) {
        done.add(id);
        const q = hit[1].getBoundingClientRect();
        b.style.translate = `${parseFloat(b.style.translate) + (q.left + q.width / 2 - cx)}px ${parseFloat((b.style.translate || '0 0').split(' ')[1]) + (q.top + q.height / 2 - cy)}px`;
        b.classList.add('placed');
        hit[1].classList.add('joined');
        env.sound('correct');
        const s = env.stage.getBoundingClientRect();
        env.sparkle(q.left - s.left + q.width / 2, q.top - s.top + q.height / 2);
        if (done.size === letters.length) {
          locked = true;
          env.face('dance');
          window.setTimeout(() => !dead && env.done(), 1200);
        }
      } else {
        b.classList.add('slide-back');
        b.style.translate = '0 0';
        window.setTimeout(() => b.classList.remove('slide-back'), 400);
        if (hit) {
          env.mistake();
          env.sound('oops');
          env.face('cheer', 'Hmm, try again!');
        }
      }
    };
    b.addEventListener('pointerup', drop);
    b.addEventListener('pointercancel', drop);
  });
  return { repeat: () => env.say('Match big and small!'), destroy: () => ((dead = true), targets.remove(), tray.remove()) };
}
