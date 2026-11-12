/**
 * The squishy cheese wedge, as pictures: nine expressions. The breathing, the squash when pressed and the hop are CSS animations
 * (scale and translate) on the picture, so they work on any expression.
 */
export type Expression = 'happy' | 'thinking' | 'surprised' | 'cheer' | 'dance' | 'wave' | 'sad' | 'sleep' | 'squished';
export const EXPRESSIONS: Expression[] = ['happy', 'thinking', 'surprised', 'cheer', 'dance', 'wave', 'sad', 'sleep', 'squished'];

export const cheesyUrl = (e: Expression): string => `${import.meta.env.BASE_URL}english/cheesy/${e}.webp`;

/** Fetches the nine pictures (a few KB each): the service worker keeps them for offline in the runtime cache of the English game. */
export function preloadCheesy(): void {
  for (const e of EXPRESSIONS) {
    const im = new Image();
    im.src = cheesyUrl(e);
  }
}

export const cheesyImg = (e: Expression): string => `<img class="cheesy-img" src="${cheesyUrl(e)}" alt="" draggable="false" decoding="async">`;

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
    const img = el.querySelector('img');
    if (img) img.src = cheesyUrl('squished');
    window.clearTimeout(squishTimer);
    squishTimer = window.setTimeout(() => {
      const i = el.querySelector('img');
      if (i) i.src = cheesyUrl(current);
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
