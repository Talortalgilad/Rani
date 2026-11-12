import { accessoryOf, accessorySvg } from './accessories';
import { squishyUrl } from './squishies';
/**
 * The squishy cheese wedge, as pictures: nine expressions. The breathing, the squash when pressed and the hop are CSS animations
 * (scale and translate) on the picture, so they work on any expression.
 */
export type Expression = 'happy' | 'thinking' | 'surprised' | 'cheer' | 'dance' | 'wave' | 'sad' | 'sleep' | 'squished';
export const EXPRESSIONS: Expression[] = ['happy', 'thinking', 'surprised', 'cheer', 'dance', 'wave', 'sad', 'sleep', 'squished'];

export const cheesyUrl = (e: Expression): string => `${import.meta.env.BASE_URL}english/cheesy/${e}.webp`;

/** Fetches the nine pictures (a few KB each): the service worker keeps them for offline in the runtime cache of the English game. */
export function preloadCheesy(): void {
  if (look.buddy) new Image().src = squishyUrl(look.buddy);
  for (const e of EXPRESSIONS) {
    const im = new Image();
    im.src = cheesyUrl(e);
  }
}

/**
 * How the companion looks now: Cheesy (with an accessory he won) or a squishy that Rani chose as her friend for the adventure
 * (SPEC-english.md 3.2). A squishy has one picture, so its expressions are small movements (the CSS class ex-<expression>).
 */
export interface Look { buddy: string | null; accessory: string | null }
let look: Look = { buddy: null, accessory: null };
/** In the ninja park whoever goes with Rani wears a red ninja headband (instead of an accessory), so that "the ninja" is clear. */
let headband = false;
export const setHeadband = (on: boolean): void => void (headband = on);
const BAND = '<svg class="cheesy-acc" viewBox="0 0 100 100" aria-hidden="true"><path d="M26,27 Q50,15 74,27 L74,35 Q50,23 26,35 Z" fill="#e8283c" stroke="#3a2f4b" stroke-width="2.2" stroke-linejoin="round"/><path d="M74,29 L90,22 L86,31 L93,36 L76,34 Z" fill="#e8283c" stroke="#3a2f4b" stroke-width="2" stroke-linejoin="round"/><rect x="45" y="22" width="10" height="9" rx="2" fill="#c0c7d0" stroke="#3a2f4b" stroke-width="1.6"/></svg>';
export const setLook = (l: Look): void => void (look = { ...l });
export const getLook = (): Look => look;
const srcFor = (e: Expression): string => (look.buddy ? squishyUrl(look.buddy) : cheesyUrl(e));

export const cheesyImg = (e: Expression): string => {
  const acc = look.buddy || headband ? undefined : accessoryOf(look.accessory);
  return `<span class="cheesy-wrap"><img class="cheesy-img ex-${e}" src="${srcFor(e)}" alt="" draggable="false" decoding="async">${headband ? BAND : acc ? accessorySvg(acc) : ''}</span>`;
};

/** A living wedge: breathes, squashes when pressed (and shows the squished face for a moment), hops. `el` is the element to fill. */
export function mountCheesy(el: HTMLElement, e: Expression = 'happy', onPress?: () => void): { set(e: Expression): void; squish(): void; hop(): void } {
  el.classList.add('cheesy');
  let current: Expression = e;
  let squishTimer = 0;
  const paint = (x: Expression): void => {
    current = x;
    el.innerHTML = cheesyImg(x);
    el.classList.toggle('dance', x === 'dance');
  };
  paint(e);
  const squish = (): void => {
    el.classList.remove('squish');
    void el.offsetWidth;
    el.classList.add('squish');
    const img = el.querySelector<HTMLImageElement>('img');
    if (img) {
      img.src = srcFor('squished');
      img.classList.add('ex-squished');
    }
    window.clearTimeout(squishTimer);
    squishTimer = window.setTimeout(() => {
      const i = el.querySelector<HTMLImageElement>('img');
      if (i) {
        i.src = srcFor(current);
        i.classList.remove('ex-squished');
      }
    }, 650);
  };
  const hop = (): void => {
    el.classList.remove('hop');
    void el.offsetWidth;
    el.classList.add('hop');
  };
  el.addEventListener('pointerdown', () => {
    squish();
    onPress?.();
  });
  return { set: paint, squish, hop };
}
