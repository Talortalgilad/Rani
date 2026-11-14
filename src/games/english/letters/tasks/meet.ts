import { wordPictureHtml } from '../art';
import { el, type TaskEnv, type TaskHandle } from '../../tasks/common';
import { letterById } from '../journey';
import { exampleWord, toyLetter } from '../ui/glyph';

/** "Meet the letter": the big capital and small letter and the picture of its word. "This is S! S says /s/, like sun!": the name, the sound, the word. */
export function meetTask(env: TaskEnv, letterId: string): TaskHandle {
  const L = letterById(letterId);
  const wrap = el('div', 'letter-card', env.stage);
  wrap.innerHTML = `
    <div class="lc-letters">${toyLetter(L.upper)}${toyLetter(L.id, 'small')}</div>
    <div class="lc-pic">${wordPictureHtml(L.word)}</div>
    <div class="lc-word" dir="ltr">${exampleWord(L.id)}</div>`;
  const seq = meetSequence({
    name: () => env.say(L.upper, true), // the name
    sound: () => env.sayLetter(L.id), // the sound
    word: () => env.say(L.label, true), // the word
    intro: () => env.sayHe('l_new'),
    done: () => env.done(),
    bounce: () => {
      wrap.classList.remove('bounce');
      void wrap.offsetWidth;
      wrap.classList.add('bounce');
    },
  });
  wrap.addEventListener('click', seq.play);
  return { repeat: seq.play, destroy: () => (seq.stop(), wrap.remove()) };
}

export interface MeetHooks { name(): void; sound(): void; word(): void; intro(): void; done(): void; bounce(): void }
/**
 * The timing of the meet card, apart from the screen. The card says the name, the sound and the word, and then it ends by itself: `done` is its own timer, which a
 * replay (a tap on the card, the speaker) moves later but never cancels. (A replay used to clear every timer, `done` included, and the card stayed for ever.)
 */
export function meetSequence(h: MeetHooks): { play(): void; stop(): void } {
  let seq: number[] = [];
  let doneTimer = 0;
  let intro = 0;
  let ended = false;
  const later = (f: () => void, ms: number): void => void seq.push(window.setTimeout(f, ms));
  const end = (ms: number): void => {
    window.clearTimeout(doneTimer);
    doneTimer = window.setTimeout(() => {
      if (!ended) {
        ended = true;
        h.done();
      }
    }, ms);
  };
  const play = (first = false): void => {
    seq.forEach(clearTimeout);
    seq = [];
    h.bounce();
    later(h.name, 100);
    later(h.sound, 1500);
    later(h.word, 3400);
    // the card ends 4 s after the word starts (7.6 s after the start the first time, as before)
    end(first ? 7000 : 5200);
  };
  const t = window.setTimeout(() => play(true), 600);
  intro = window.setTimeout(h.intro, 5200);
  return {
    play: () => play(false),
    stop: () => {
      ended = true;
      [t, intro, doneTimer].forEach(clearTimeout);
      seq.forEach(clearTimeout);
    },
  };
}
