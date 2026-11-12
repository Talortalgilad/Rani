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
export const setLook = (l: Look): void => void (look = { ...l });
export const getLook = (): Look => look;
const srcFor = (e: Expression): string => (look.buddy ? squishyUrl(look.buddy) : cheesyUrl(e));

export const cheesyImg = (e: Expression): string => {
  const acc = look.buddy ? undefined : accessoryOf(look.accessory);
  return `<span class="cheesy-wrap"><img class="cheesy-img ex-${e}" src="${srcFor(e)}" alt="" draggable="false" decoding="async">${acc ? accessorySvg(acc) : ''}</span>`;
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
