import { itemImg } from '../art/images';
import { el, shuffled, type TaskEnv, type TaskHandle } from './common';

/** "Make the sentence": a picture shows the meaning; word tiles go into the slots in order (all but the last are there to begin with). */
export function sentenceTask(env: TaskEnv, words: string[], picture: string, missing: number): TaskHandle {
  const pic = el('div', 'sent-pic pic', env.stage);
  pic.style.left = '50%';
  pic.style.top = '26%';
  pic.innerHTML = itemImg(picture);
  const slots = el('div', 'sent-slots', env.stage);
  const tiles = el('div', 'sent-tiles', env.stage);
  const slotEls = words.map((w, i) => {
    const s = el('button', 'sent-slot', slots);
    s.type = 'button';
    if (i < missing) {
      s.textContent = w;
      s.classList.add('given');
    }
    s.addEventListener('click', () => s.textContent && env.say(s.textContent, true));
    return s;
  });
  const need = words.slice(missing);
  let locked = false;
  const filled = (): number => slotEls.filter((s) => s.textContent).length;
  const tileEls = shuffled(need.map((w, i) => ({ w, i })), 3).map(({ w }) => {
    const t = el('button', 'sent-tile', tiles);
    t.type = 'button';
    t.textContent = w;
    t.addEventListener('click', () => {
      if (locked || t.classList.contains('used')) return;
      env.say(w, true);
      const slot = slotEls[filled()];
      if (!slot) return;
      slot.textContent = w;
      slot.dataset.tile = String(tileEls.indexOf(t));
      slot.classList.add('placed');
      t.classList.add('used');
      if (filled() === words.length) {
        const ok = slotEls.every((s, i) => s.textContent === words[i]);
        if (ok) {
          locked = true;
          env.sound('correct');
          env.face('dance');
          env.say(words.join(' '));
          window.setTimeout(() => env.done(), 1800);
        } else {
          env.mistake();
          env.sound('oops');
          env.face('encourage', 'Hmm, try again!');
          for (const s of slotEls.slice(missing)) {
            s.classList.add('shake');
            window.setTimeout(() => {
              s.classList.remove('shake', 'placed');
              s.textContent = '';
              tileEls.forEach((x) => x.classList.remove('used'));
            }, 600);
          }
        }
      }
    });
    return t;
  });
  return { repeat: () => env.say(words.join(' ')), destroy: () => (pic.remove(), slots.remove(), tiles.remove()) };
}
