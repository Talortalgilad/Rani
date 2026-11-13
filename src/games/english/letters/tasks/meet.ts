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
  let timers: number[] = [];
  const later = (f: () => void, ms: number): void => void timers.push(window.setTimeout(f, ms));
  const play = (): void => {
    timers.forEach(clearTimeout);
    timers = [];
    wrap.classList.remove('bounce');
    void wrap.offsetWidth;
    wrap.classList.add('bounce');
    later(() => env.say(L.upper, true), 100); // the name
    later(() => env.sayLetter(L.id), 1500); // the sound
    later(() => env.say(L.label, true), 3400); // the word
  };
  later(play, 600);
  later(() => env.sayHe('l_new'), 5200);
  later(() => env.done(), 7600);
  wrap.addEventListener('click', play);
  return { repeat: play, destroy: () => (timers.forEach(clearTimeout), wrap.remove()) };
}
