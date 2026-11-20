import { clipText } from '../audio';
import { pictureHtml, squishyLabel } from '../pictures';
import { hop, type StepRun } from '../shell';

const arr = <T>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);

/**
 * meet: the squishies are shown in a row; each in its turn jumps and says its clip ("Hello! I'm Mozzi."), and its name in Hebrew appears under it and stays.
 * At the end a tap on any of them says it again, and after 1.5 s without anything being said the lesson goes on.
 */
export const meet: StepRun = async (sh, step) => {
  const c = sh.clear();
  sh.listenOnly();
  const pics = arr<string>(step.squishies);
  const clips = arr<string>(step.clips);
  c.innerHTML = `<div class="tutor-meet">${pics
    .map((p, i) => `<div class="tutor-meetone"><button class="tutor-meetcard" type="button" data-i="${i}">${pictureHtml(p)}</button><i class="tutor-optlabel" data-l="${i}"></i></div>`)
    .join('')}</div>`;
  const cards = [...c.querySelectorAll<HTMLElement>('.tutor-meetcard')];
  const labels = [...c.querySelectorAll<HTMLElement>('.tutor-optlabel')];
  const speak = async (i: number): Promise<void> => {
    hop(cards[i]);
    labels[i].textContent = squishyLabel(pics[i].replace(/^squishy:/, ''));
    labels[i].classList.add('on');
    await sh.say(clips[i], { asGuest: true });
  };
  cards.forEach((el, i) => el.addEventListener('click', () => void speak(i).catch(() => {})));
  for (let i = 0; i < pics.length; i++) await speak(i);
  void clipText;
  await sh.advance(1500);
};
