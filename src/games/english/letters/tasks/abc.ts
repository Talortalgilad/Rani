import { SQUISHY_LETTER } from '../progress';
import { squishyPicture } from '../art';
import { el, type TaskEnv, type TaskHandle } from '../../tasks/common';
import { ABC_ENDING, abcTimeline, alphabet } from '../abc';
import { toyLetter } from '../ui/glyph';

/** The ABC song: the letters stand on the stage in rows; each one lights up and hops as it is said; at the end all of them dance, with the squishy letters, and the sparkles fly. */
export function abcTask(env: TaskEnv, rescued: string[] = []): TaskHandle {
  const stage = el('div', 'abc-stage', env.stage);
  stage.setAttribute('dir', 'ltr');
  const tiles = new Map<string, HTMLElement>();
  for (const l of alphabet()) {
    const t = el('div', 'abc-tile', stage);
    t.innerHTML = toyLetter(l.toUpperCase());
    tiles.set(l, t);
  }
  const crew = el('div', 'abc-crew', env.stage);
  for (const id of Object.values(SQUISHY_LETTER)) {
    const url = squishyPicture(id);
    if (url && (rescued.includes(id) || rescued.length === 0)) crew.insertAdjacentHTML('beforeend', `<img src="${url}" alt="" draggable="false">`);
  }
  const timers: number[] = [];
  const later = (f: () => void, ms: number): void => void timers.push(window.setTimeout(f, ms));
  let last = '';
  const steps = abcTimeline();
  for (const s of steps) {
    later(() => {
      if (s.letter) {
        tiles.get(last)?.classList.remove('on');
        last = s.letter;
        const t = tiles.get(s.letter)!;
        t.classList.add('on', 'said');
        env.sound('pop', 420 + alphabet().indexOf(s.letter) * 14);
        env.say(s.letter.toUpperCase(), true);
      } else {
        tiles.get(last)?.classList.remove('on');
        stage.classList.add('dance');
        crew.classList.add('dance');
        env.sound('bonus');
        env.face('dance');
        env.say(s.text ?? ABC_ENDING);
        const b = stage.getBoundingClientRect();
        const st = env.stage.getBoundingClientRect();
        for (let i = 0; i < 6; i++) later(() => env.sparkle(b.left - st.left + Math.random() * b.width, b.top - st.top + Math.random() * b.height), i * 250);
        later(() => env.sayHe('abc_done'), 2600);
      }
    }, s.at);
  }
  const end = steps[steps.length - 1].at;
  later(() => env.done(), end + 6200);
  return { repeat: () => undefined, destroy: () => (timers.forEach(clearTimeout), stage.remove(), crew.remove()) };
}
