import { itemImg } from '../art/images';
import { labelOf, wordById } from '../content/words';
import { el, type TaskEnv, type TaskHandle } from './common';

/** A new word: a card that turns over to show the picture; Cheesy says the word twice, and tapping the card says it again. */
export function wordCard(env: TaskEnv, wordId: string): TaskHandle {
  const w = wordById(wordId);
  const wrap = el('div', 'word-card-wrap', env.stage);
  const card = el('button', 'word-card', wrap);
  card.type = 'button';
  card.setAttribute('aria-label', w.id);
  card.innerHTML = `<div class="wc-inner"><div class="wc-back"><span>?</span></div><div class="wc-front">${itemImg(w.id)}<b class="wc-word">${labelOf(w.id)}</b></div></div>`;
  let flipped = false;
  let timers: number[] = [];
  const later = (f: () => void, ms: number): void => void timers.push(window.setTimeout(f, ms));
  const sayTwice = (): void => {
    env.say(labelOf(w.id), true);
    later(() => env.say(labelOf(w.id), true), 1500);
  };
  card.addEventListener('click', () => {
    if (!flipped) {
      flipped = true;
      card.classList.add('flipped');
      env.sound('pop');
      env.face('surprised');
      later(() => {
        env.face('happy', `${labelOf(w.id)} = ${w.he}`);
        sayTwice();
      }, 450);
      later(() => env.done(), 3600);
    } else {
      env.say(labelOf(w.id), true);
      card.classList.remove('bounce');
      void card.offsetWidth;
      card.classList.add('bounce');
    }
  });
  return { repeat: () => env.say(labelOf(w.id), true), destroy: () => (timers.forEach(clearTimeout), (timers = []), wrap.remove()) };
}
