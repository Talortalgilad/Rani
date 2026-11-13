import { itemImg } from '../art/images';
import { labelOf } from '../content/words';
import { heardWord } from '../engine/say';
import { listenOnce } from '../voice';
import { el, type TaskEnv, type TaskHandle } from './common';

/**
 * "Say ball!": the picture, a big microphone. She presses it and says the word. A close match counts. Not understood: "Can you say it
 * again?"; after the second try it moves on anyway with "Great try!" (it never gets stuck, and a miss costs nothing).
 */
export function sayTask(env: TaskEnv, word: string): TaskHandle {
  const label = labelOf(word);
  const pic = el('div', 'say-pic', env.stage);
  pic.innerHTML = itemImg(word);
  const mic = el('button', 'say-mic', env.stage);
  mic.type = 'button';
  mic.setAttribute('aria-label', 'דברי');
  mic.textContent = '🎤';
  let tries = 0;
  let busy = false;
  let dead = false;
  const ok = (): void => {
    mic.classList.remove('listening');
    env.sound('correct');
    env.face('dance');
    pic.classList.add('win');
    env.say(label, true);
    window.setTimeout(() => !dead && env.done(), 1400);
  };
  mic.addEventListener('click', async () => {
    if (busy) return;
    busy = true;
    mic.classList.add('listening');
    const heard = await listenOnce();
    mic.classList.remove('listening');
    busy = false;
    if (dead) return;
    if (heard === null || heard.length === 0 || !heardWord(heard, label)) {
      tries += 1;
      if (tries >= 2 || heard === null) {
        env.face('cheer', 'Great try!');
        env.say('Great try!');
        env.sound('pop', 440);
        window.setTimeout(() => !dead && env.done(), 1500);
      } else {
        env.face('thinking', 'Can you say it again?');
        env.say('Can you say it again?');
      }
      return;
    }
    ok();
  });
  return { repeat: () => env.say(`Say ${label}!`), destroy: () => ((dead = true), pic.remove(), mic.remove()) };
}
