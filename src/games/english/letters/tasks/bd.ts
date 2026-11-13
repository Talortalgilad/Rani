import { wordPictureHtml } from '../art';
import { el, type TaskEnv, type TaskHandle } from '../../tasks/common';
import { toyLetter } from '../ui/glyph';

/**
 * b and d: the two letters side by side, each with its picture (ball, dog) and its "belly" shown as a round shadow: b has a stem first and
 * then the belly forward (to the right, where we read on), d has the belly first and the stem at the back. Chiefly said in Hebrew by Cheesy.
 */
export function bdTask(env: TaskEnv): TaskHandle {
  const wrap = el('div', 'bd-card', env.stage);
  wrap.setAttribute('dir', 'ltr');
  wrap.innerHTML = `
    <div class="bd-one" id="bdb"><div class="bd-letter b">${toyLetter('b')}<i class="belly"></i></div><div class="bd-pic">${wordPictureHtml('ball')}</div><b dir="ltr">ball</b></div>
    <div class="bd-one" id="bdd"><div class="bd-letter d">${toyLetter('d')}<i class="belly"></i></div><div class="bd-pic">${wordPictureHtml('dog')}</div><b dir="ltr">dog</b></div>`;
  const timers: number[] = [];
  const later = (f: () => void, ms: number): void => void timers.push(window.setTimeout(f, ms));
  const mark = (id: string): void => {
    wrap.querySelectorAll('.bd-one').forEach((e) => e.classList.remove('on'));
    wrap.querySelector(id)?.classList.add('on');
  };
  const play = (): void => {
    timers.forEach(clearTimeout);
    timers.length = 0;
    later(() => (mark('#bdb'), env.sayHe('l_bd_b')), 600);
    later(() => env.sayLetter('b'), 4300);
    later(() => (mark('#bdd'), env.sayHe('l_bd_d')), 6000);
    later(() => env.sayLetter('d'), 9500);
    later(() => env.done(), 11500);
  };
  wrap.querySelector('#bdb')!.addEventListener('click', () => (mark('#bdb'), env.sayLetter('b')));
  wrap.querySelector('#bdd')!.addEventListener('click', () => (mark('#bdd'), env.sayLetter('d')));
  play();
  return { repeat: play, destroy: () => (timers.forEach(clearTimeout), wrap.remove()) };
}
