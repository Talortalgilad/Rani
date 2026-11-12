import { bunnySvg } from '../art/bunny';
import { mountCheesy } from '../art/cheesy';
import { he, en } from '../content/lines';
import { mixed } from './text';
import { speakEn, speakHe } from '../voice';
import type { SoundApi } from '../../../sound';

/**
 * The rescue: a gift box shakes and a tiny voice calls. A tap opens it, the lid pops and Bunny jumps out in an arc, squashes
 * on landing and says its name. It joins the shelf of rescued squishies.
 */
export function showRescue(root: HTMLElement, name: string, sound: SoundApi, onDone: () => void): () => void {
  root.innerHTML = `
    <div class="en-screen en-rescue">
      <div class="en-sky"></div>
      <div class="rescue-stage">
        <div class="cheesy-side" id="ch"></div>
        <div class="bubble" id="bub">שמעת? מישהו קורא לעזרה!</div>
        <div class="gift" id="gift"><div class="gift-lid"></div><div class="gift-body"></div><div class="gift-help">help!</div></div>
        <div class="bunny-out" id="bunny" hidden><div class="bunny-in" id="bunnyIn">${bunnySvg()}</div></div>
      </div>
      <div class="rescue-actions" id="acts" hidden>
        <button class="en-btn go" id="home" type="button">🏠 ${he.home}</button>
        <button class="en-btn" id="again" type="button">↻ ${he.again}</button>
      </div>
      <div class="confetti" id="rc"></div>
    </div>`;
  const ch = mountCheesy(root.querySelector<HTMLElement>('#ch')!, 'surprised');
  const bub = root.querySelector<HTMLElement>('#bub')!;
  const gift = root.querySelector<HTMLElement>('#gift')!;
  const bunny = root.querySelector<HTMLElement>('#bunny')!;
  const bunnyIn = root.querySelector<HTMLElement>('#bunnyIn')!;
  const acts = root.querySelector<HTMLElement>('#acts')!;
  const timers: number[] = [];
  const later = (f: () => void, ms: number): void => void timers.push(window.setTimeout(f, ms));
  void speakHe('שמעת? מישהו קורא לעזרה!');
  later(() => void speakEn('Help! Help!', 0.8), 1800);
  let opened = false;
  gift.addEventListener('click', () => {
    if (opened) return;
    opened = true;
    gift.classList.add('open');
    sound.play('pop', 700);
    ch.set('surprised');
    later(() => {
      bunny.hidden = false;
      bunny.classList.add('jump');
      sound.play('bonus');
    }, 350);
    later(() => {
      bunny.classList.remove('jump');
      bunny.classList.add('land');
      sound.play('pop', 440);
      ch.set('dance');
      bub.innerHTML = mixed(en.imBunny);
      void speakEn(en.imBunny, 0.8);
      const colors = ['#ff5d73', '#ffd23f', '#3fb56b', '#3fa0ff', '#8e5cf0', '#ff8fd0'];
      const box = root.querySelector<HTMLElement>('#rc')!;
      for (let i = 0; i < 50; i++) {
        const p = document.createElement('i');
        p.style.left = `${Math.random() * 100}%`;
        p.style.background = colors[i % colors.length];
        p.style.animationDelay = `${Math.random() * 0.6}s`;
        box.appendChild(p);
      }
    }, 1300);
    later(() => {
      bub.innerHTML = mixed(he.rescued(name));
      void speakHe(he.rescued(name));
      acts.hidden = false;
    }, 3000);
  });
  bunny.addEventListener('pointerdown', () => {
    bunnyIn.classList.remove('squish');
    void bunnyIn.offsetWidth;
    bunnyIn.classList.add('squish');
    sound.play('pop', 560);
    void speakEn(en.imBunny, 0.8);
  });
  root.querySelector('#home')!.addEventListener('click', () => onDone());
  root.querySelector('#again')!.addEventListener('click', () => {
    onDone();
  });
  return () => timers.forEach(clearTimeout);
}
