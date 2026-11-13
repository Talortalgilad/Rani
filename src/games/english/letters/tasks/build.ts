import { el, shuffled, type TaskEnv, type TaskHandle } from '../../tasks/common';
import { blendTimeline, buildTiles } from '../blend';
import { wordPictureHtml } from '../art';
import { soundsOf } from '../journey';
import { toyLetter } from '../ui/glyph';

/** The picture of a word (the empty string when there is none: such a word is not offered). */
export const wordPic = wordPictureHtml;

/**
 * "Let's build cat!": empty places in a row (the first one on the left) and letters to drag into them; every letter that is touched says
 * its sound. With one letter missing the others are there already (_at -> cat). When the word is whole it is blended: /c/ - /a/ - /t/ -> cat!
 */
export function buildTask(env: TaskEnv, word: string, missing: number | null, pool: string[], seed = 9): TaskHandle {
  const letters = soundsOf(word);
  const pic = el('div', 'build-pic', env.stage);
  pic.innerHTML = wordPic(word);
  const row = el('div', 'build-row', env.stage);
  row.setAttribute('dir', 'ltr');
  const tray = el('div', 'build-tray', env.stage);
  tray.setAttribute('dir', 'ltr');
  const slots: HTMLElement[] = [];
  const filled = new Set<number>();
  let dead = false;
  let locked = false;
  const timers: number[] = [];
  const later = (f: () => void, ms: number): void => void timers.push(window.setTimeout(() => !dead && f(), ms));

  letters.forEach((l, i) => {
    const s = el('div', 'build-slot', row);
    if (missing !== null && i !== missing) {
      s.innerHTML = toyLetter(l);
      s.classList.add('given');
      filled.add(i);
    }
    slots.push(s);
  });
  const need = missing === null ? letters : [letters[missing]];
  let n = seed;
  const pick = (m: number): number => ((n = (n * 1103515245 + 12345) & 0x7fffffff), n % m);
  const tiles = missing === null ? buildTiles(word, pool, pick) : shuffled([...need, ...pool.filter((p) => p !== letters[missing]).slice(0, 2)], seed);

  const blend = (): void => {
    locked = true;
    for (const step of blendTimeline(word)) {
      later(() => {
        if (step.kind === 'sound') {
          slots[step.index!].classList.add('lit');
          env.sayLetter(step.letter!);
        } else {
          slots.forEach((s) => s.classList.add('whole'));
          pic.classList.add('hop');
          env.sound('correct');
          env.face('dance');
          env.say(word, true);
        }
      }, step.at);
    }
    later(() => env.done(), 300 + letters.length * 700 + 2300);
  };

  tiles.forEach((l) => {
    const b = el('button', 'build-tile', tray);
    b.type = 'button';
    b.setAttribute('aria-label', l);
    b.innerHTML = toyLetter(l);
    let start: { x: number; y: number } | null = null;
    b.addEventListener('pointerdown', (e) => {
      if (locked || b.classList.contains('used')) return;
      b.setPointerCapture(e.pointerId);
      start = { x: e.clientX, y: e.clientY };
      b.classList.add('dragging');
      env.sayLetter(l);
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
      const at = slots.findIndex((s) => {
        const q = s.getBoundingClientRect();
        return cx > q.left - 14 && cx < q.right + 14 && cy > q.top - 14 && cy < q.bottom + 14;
      });
      if (at >= 0 && !filled.has(at) && letters[at] === l) {
        filled.add(at);
        slots[at].innerHTML = toyLetter(l);
        slots[at].classList.add('given', 'pop');
        b.classList.add('used');
        b.style.translate = '0 0';
        env.sound('pop', 520 + at * 70);
        if (filled.size === letters.length) later(blend, 500);
      } else {
        b.classList.add('slide-back');
        b.style.translate = '0 0';
        window.setTimeout(() => b.classList.remove('slide-back'), 400);
        if (at >= 0 && !filled.has(at)) {
          env.mistake();
          env.sound('oops');
          env.face('cheer', 'Hmm, try again!');
        }
      }
    };
    b.addEventListener('pointerup', drop);
    b.addEventListener('pointercancel', drop);
  });
  if (filled.size === letters.length) later(blend, 500);
  return { repeat: () => env.say(missing === null ? `Let's build ${word}!` : 'Which letter is missing?'), destroy: () => ((dead = true), timers.forEach(clearTimeout), pic.remove(), row.remove(), tray.remove()) };
}

/**
 * "Read the word": the word is written with big letters; touching a letter says its sound; then she picks the picture of the word
 * among three. (The first step to reading: she works the word out from the sounds.)
 */
export function readTask(env: TaskEnv, word: string, options: string[], seed = 10): TaskHandle {
  const letters = soundsOf(word);
  const row = el('div', 'read-word', env.stage);
  row.setAttribute('dir', 'ltr');
  letters.forEach((l) => {
    const b = el('button', 'read-letter', row);
    b.type = 'button';
    b.setAttribute('aria-label', l);
    b.innerHTML = toyLetter(l);
    b.addEventListener('click', () => {
      b.classList.remove('hop');
      void b.offsetWidth;
      b.classList.add('hop');
      env.sayLetter(l);
    });
  });
  const pics = el('div', 'choice-row', env.stage);
  const btns = new Map<string, HTMLButtonElement>();
  let locked = false;
  let dead = false;
  shuffled(options, seed).forEach((w) => {
    const b = el('button', 'pic en-choice emoji-choice', pics);
    b.type = 'button';
    b.setAttribute('aria-label', w);
    b.innerHTML = wordPic(w);
    btns.set(w, b);
    b.addEventListener('click', () => {
      if (locked) return;
      if (w === word) {
        locked = true;
        env.sound('correct');
        env.face('dance');
        b.classList.add('win');
        env.say(word, true);
        window.setTimeout(() => !dead && env.done(), 1400);
      } else {
        b.classList.remove('shake');
        void b.offsetWidth;
        b.classList.add('shake');
        const n = env.mistake();
        env.sound('oops');
        env.face('cheer', 'Hmm, try again!');
        if (n >= 2) btns.get(word)!.classList.add('glint');
      }
    });
  });
  return { repeat: () => env.say('Read the word!'), destroy: () => ((dead = true), row.remove(), pics.remove()) };
}
