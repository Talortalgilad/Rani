import { accessorySvg, type Accessory } from '../art/accessories';
import { cheesyUrl, mountCheesy } from '../art/cheesy';
import { squishyImg, type Squishy } from '../art/squishies';
import { he } from '../content/lines';
import { speakEn } from '../voice';
import type { SoundApi } from '../../../sound';
import { mixed } from './text';
import { sayLine } from '../content/heLines';

/**
 * The rescue: the gift shakes and a tiny voice calls. A tap opens it: the gift hops and pops, and the squishy jumps out in an arc,
 * squashes on landing and says its name. It joins the shelf of rescued squishies.
 */
export function showRescue(root: HTMLElement, name: string, squishy: Squishy, sound: SoundApi, onDone: (toShelf: boolean) => void, extra: { prize?: Accessory; /** the last world: the golden squishy, fireworks */ finale?: boolean } = {}): () => void {
  root.innerHTML = `
    <div class="en-screen en-rescue ${extra.finale ? 'finale' : ''}">
      <div class="en-sky"></div>
      <div class="rescue-stage">
        <div class="cheesy-side" id="ch"></div>
        <div class="bubble" id="bub">שמעת? מישהו קורא לעזרה!</div>
        <div class="gift" id="gift"><img class="gift-img" src="${import.meta.env.BASE_URL}english/words/gift.webp" alt="" draggable="false"><div class="gift-help" dir="ltr">help!</div></div>
        <div class="bunny-out" id="bunny" hidden><div class="bunny-in" id="bunnyIn">${squishyImg(squishy.id)}</div></div>
      </div>
      <div class="rescue-actions" id="acts" hidden>
        ${extra.prize ? `<div class="prize"><span class="prize-pic"><img src="${cheesyUrl('happy')}" alt="" draggable="false">${accessorySvg(extra.prize)}</span><b>${he.newAccessory(extra.prize.he)}</b></div>` : ''}
        <button class="en-btn go" id="home" type="button">🏠 ${he.home}</button>
        <button class="en-btn" id="shelf" type="button">🧸 ${he.shelf}</button>
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
  void sayLine('help_call');
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
      ch.set('cheer');
      bub.innerHTML = mixed(`I'm ${squishy.name}!`);
      void speakEn(`I'm ${squishy.name}!`, 0.8);
      const colors = extra.finale ? ['#ffc83a', '#ffe58a', '#fff', '#ffb52e', '#ff8fd0', '#6fd3ff'] : ['#ff5d73', '#ffd23f', '#3fb56b', '#3fa0ff', '#8e5cf0', '#ff8fd0'];
      const box = root.querySelector<HTMLElement>('#rc')!;
      for (let i = 0; i < (extra.finale ? 160 : 50); i++) {
        const p = document.createElement('i');
        p.style.left = `${Math.random() * 100}%`;
        p.style.background = colors[i % colors.length];
        p.style.animationDelay = `${Math.random() * 0.6}s`;
        box.appendChild(p);
      }
    }, 1300);
    later(() => {
      bub.innerHTML = mixed(he.rescued(name));
      void sayLine('rescued', name);
      acts.hidden = false;
      if (extra.prize) void sayLine(`new_acc_${extra.prize.id}`);
    }, 3000);
  });
  bunny.addEventListener('pointerdown', () => {
    bunnyIn.classList.remove('squish');
    void bunnyIn.offsetWidth;
    bunnyIn.classList.add('squish');
    sound.play('pop', 560);
    void speakEn(`I'm ${squishy.name}!`, 0.8);
  });
  root.querySelector('#home')!.addEventListener('click', () => onDone(false));
  root.querySelector('#shelf')!.addEventListener('click', () => onDone(true));
  return () => timers.forEach(clearTimeout);
}
