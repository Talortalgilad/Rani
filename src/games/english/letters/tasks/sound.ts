import { itemImg } from '../../art/images';
import { el, pictureButton, shuffled, showSolution, type TaskEnv, type TaskHandle } from '../../tasks/common';
import { letterById } from '../journey';
import { toyLetter } from '../ui/glyph';

/** "Which letter says this sound?": the sound is played, she taps the right one of three letters. The big speaker plays it again. */
export function soundTask(env: TaskEnv, letterId: string, options: string[], seed = 5): TaskHandle {
  const speaker = el('button', 'big-speaker', env.stage);
  speaker.type = 'button';
  speaker.textContent = '🔊';
  speaker.setAttribute('aria-label', 'שמעי שוב');
  const row = el('div', 'choice-row mid', env.stage);
  const tiles = new Map<string, HTMLButtonElement>();
  let locked = false;
  const timers: number[] = [];
  const later = (f: () => void, ms: number): void => void timers.push(window.setTimeout(f, ms));
  const play = (): void => env.sayLetter(letterId);
  shuffled(options, seed).forEach((id) => {
    const b = pictureButton(row, toyLetter(id), id, 'pic en-choice letter-choice');
    tiles.set(id, b);
    b.addEventListener('click', async () => {
      if (locked) return;
      if (id === letterId) {
        locked = true;
        env.sound('correct');
        env.face('dance');
        b.classList.add('win');
        env.say(letterById(id).upper, true);
        later(() => env.done(), 1300);
      } else {
        b.classList.remove('shake');
        void b.offsetWidth;
        b.classList.add('shake');
        const n = env.mistake();
        env.sound('oops');
        env.face('cheer', 'Hmm, try again!');
        later(play, 600);
        if (n >= 3) {
          locked = true;
          await showSolution(env.stage, tiles.get(letterId)!);
          env.done();
        } else if (n >= 2) tiles.get(letterId)!.classList.add('glint');
      }
    });
  });
  speaker.addEventListener('click', play);
  later(play, 1700); // after the instruction
  return { repeat: play, destroy: () => (timers.forEach(clearTimeout), speaker.remove(), row.remove()) };
}

/** "What starts with /s/?": the sound is played, she taps the picture of the word that starts with it. */
export function firstSoundTask(env: TaskEnv, letterId: string, ids: string[], seed = 6): TaskHandle {
  const L = letterById(letterId);
  const speaker = el('button', 'big-speaker', env.stage);
  speaker.type = 'button';
  speaker.textContent = '🔊';
  speaker.setAttribute('aria-label', 'שמעי שוב');
  const row = el('div', 'choice-row mid', env.stage);
  const pics = new Map<string, HTMLButtonElement>();
  let locked = false;
  const timers: number[] = [];
  const later = (f: () => void, ms: number): void => void timers.push(window.setTimeout(f, ms));
  const play = (): void => env.sayLetter(letterId);
  shuffled(ids, seed).forEach((id) => {
    const b = pictureButton(row, itemImg(id), id, 'pic en-choice');
    pics.set(id, b);
    b.addEventListener('click', async () => {
      if (locked) return;
      if (id === L.word) {
        locked = true;
        env.sound('correct');
        env.face('dance');
        b.classList.add('win');
        env.say(L.label, true);
        later(() => env.done(), 1400);
      } else {
        b.classList.remove('shake');
        void b.offsetWidth;
        b.classList.add('shake');
        const n = env.mistake();
        env.sound('oops');
        env.face('cheer', 'Hmm, try again!');
        later(play, 600);
        if (n >= 3) {
          locked = true;
          await showSolution(env.stage, pics.get(L.word)!);
          env.done();
        } else if (n >= 2) pics.get(L.word)!.classList.add('glint');
      }
    });
  });
  speaker.addEventListener('click', play);
  later(play, 2300);
  return { repeat: play, destroy: () => (timers.forEach(clearTimeout), speaker.remove(), row.remove()) };
}
