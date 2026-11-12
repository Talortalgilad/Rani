import { itemSvg } from '../art/items';
import { artKey, wordById } from '../content/words';
import { el, type TaskEnv, type TaskHandle } from './common';

/** A new word: a card that turns over to show the picture; Cheesy says the word twice, and tapping the card says it again. */
export function wordCard(env: TaskEnv, wordId: string): TaskHandle {
  const w = wordById(wordId);
  const wrap = el('div', 'word-card-wrap', env.stage);
  const card = el('button', 'word-card', wrap);
  card.type = 'button';
  card.setAttribute('aria-label', w.id);
  card.innerHTML = `<div class="wc-inner"><div class="wc-back"><span>?</span></div><div class="wc-front">${itemSvg(artKey(w.id))}<b class="wc-word">${w.id}</b></div></div>`;
  let flipped = false;
  let timers: number[] = [];
  const later = (f: () => void, ms: number): void => void timers.push(window.setTimeout(f, ms));
  const sayTwice = (): void => {
    env.say(w.id, true);
    later(() => env.say(w.id, true), 1500);
  };
  card.addEventListener('click', () => {
    if (!flipped) {
      flipped = true;
      card.classList.add('flipped');
      env.sound('pop');
      env.face('surprised');
      later(() => {
        env.face('happy', `${w.id} = ${w.he}`);
        sayTwice();
      }, 450);
      later(() => env.done(), 3600);
    } else {
      env.say(w.id, true);
      card.classList.remove('bounce');
      void card.offsetWidth;
      card.classList.add('bounce');
    }
  });
  return { repeat: () => env.say(w.id, true), destroy: () => (timers.forEach(clearTimeout), (timers = []), wrap.remove()) };
}
