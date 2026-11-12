import { mountCheesy } from '../art/cheesy';
import { he, nameOptions } from '../content/lines';
import { speakEn, speakHe } from '../voice';
import type { SoundApi } from '../../../sound';

export const MAX_NAME = 12;
/** A name typed by a parent or by Rani: trimmed, no tags, at most 12 characters. */
export const cleanName = (s: string): string => s.replace(/[<>&"]/g, '').trim().slice(0, MAX_NAME);

/**
 * The first time: the cheese wedge rolls in, squashes, and asks Rani what to call it. Four big buttons say their name when tapped, and
 * "another name" opens a keyboard. After the choice it jumps, says "I am ___!" and confetti falls.
 */
export function showNameScreen(root: HTMLElement, sound: SoundApi, onChosen: (name: string) => void): () => void {
  root.innerHTML = `
    <div class="en-screen en-name">
      <div class="en-sky"></div>
      <div class="name-stage">
        <div class="cheesy-big roll-in" id="ch"></div>
        <div class="bubble big" id="bub">${he.askName}</div>
      </div>
      <div class="name-buttons" id="opts"></div>
      <div class="name-custom" id="custom" hidden>
        <div class="p-sub">${he.typeName}</div>
        <input id="typed" class="name-input" maxlength="${MAX_NAME}" autocomplete="off" aria-label="${he.typeName}" />
        <button class="en-btn go" id="typedOk" type="button">${he.ok}</button>
      </div>
      <div class="confetti" id="confetti"></div>
    </div>`;
  const ch = root.querySelector<HTMLElement>('#ch')!;
  const bub = root.querySelector<HTMLElement>('#bub')!;
  const opts = root.querySelector<HTMLElement>('#opts')!;
  const custom = root.querySelector<HTMLElement>('#custom')!;
  const c = mountCheesy(ch, 'surprised', () => sound.play('pop', 520));
  const timers: number[] = [];
  const later = (f: () => void, ms: number): void => void timers.push(window.setTimeout(f, ms));
  later(() => c.squish(), 900);
  later(() => (c.set('thinking'), void speakHe(he.askName)), 1300);
  let chosen = false;
  const confetti = (): void => {
    const box = root.querySelector<HTMLElement>('#confetti')!;
    const colors = ['#ff5d73', '#ffd23f', '#3fb56b', '#3fa0ff', '#8e5cf0', '#ff8fd0'];
    for (let i = 0; i < 46; i++) {
      const p = document.createElement('i');
      p.style.left = `${Math.random() * 100}%`;
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = `${Math.random() * 0.6}s`;
      p.style.animationDuration = `${1.8 + Math.random() * 1.4}s`;
      box.appendChild(p);
    }
  };
  const choose = (name: string, say: string): void => {
    if (chosen) return;
    chosen = true;
    opts.hidden = true;
    custom.hidden = true;
    c.set('dance');
    sound.play('bonus');
    bub.textContent = he.iAm(name);
    void speakEn(say, 0.8);
    confetti();
    later(() => onChosen(name), 3200);
  };
  nameOptions.forEach((o) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'en-btn name-btn';
    b.innerHTML = `<b>${o.name}</b><small>${o.say}</small>`;
    b.addEventListener('click', () => {
      if (b.dataset.heard !== '1') {
        // the first tap says the name; a second tap picks it
        opts.querySelectorAll<HTMLElement>('.name-btn').forEach((x) => (x.dataset.heard = '0', x.classList.remove('heard')));
        b.dataset.heard = '1';
        b.classList.add('heard');
        c.squish();
        void speakEn(o.say, 0.75);
      } else choose(o.name, o.say);
    });
    opts.appendChild(b);
  });
  const other = document.createElement('button');
  other.type = 'button';
  other.className = 'en-btn name-btn other';
  other.innerHTML = `<b>${he.otherName}</b><small>✏️</small>`;
  other.addEventListener('click', () => {
    custom.hidden = false;
    opts.hidden = true;
    root.querySelector<HTMLInputElement>('#typed')!.focus();
  });
  opts.appendChild(other);
  const typed = root.querySelector<HTMLInputElement>('#typed')!;
  const submit = (): void => {
    const n = cleanName(typed.value);
    if (n) choose(n, n);
  };
  root.querySelector('#typedOk')!.addEventListener('click', submit);
  typed.addEventListener('keydown', (e) => e.key === 'Enter' && submit());
  return () => timers.forEach(clearTimeout);
}
