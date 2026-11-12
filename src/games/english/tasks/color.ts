import { paintUrl } from '../content/paint';
import { COLORS, colorById } from '../content/colors';
import { el, showSolution, type TaskEnv, type TaskHandle } from './common';

/**
 * "Color the ball red!": the object is white; a colour tapped from the palette paints it with `multiply` (the colour is multiplied
 * with the picture, so the light and shade of the white object stay). The right colour stays, a wrong one fades back to white.
 */
export function colorTask(env: TaskEnv, object: string, color: string, met: string[]): TaskHandle {
  const wrap = el('div', 'paint pic', env.stage);
  wrap.style.left = '50%';
  wrap.style.top = '36%';
  wrap.innerHTML = `<img class="item-img" src="${paintUrl(object)}" alt="" draggable="false"><div class="paint-tint" style="-webkit-mask-image:url(${paintUrl(object)});mask-image:url(${paintUrl(object)})"></div>`;
  const tint = wrap.querySelector<HTMLElement>('.paint-tint')!;
  const paintWith = (hex: string | null): void => {
    tint.style.background = hex ?? 'transparent';
    tint.style.opacity = hex ? '1' : '0';
  };
  paintWith(null);
  const palette = el('div', 'palette', env.stage);
  const options = [color, ...COLORS.map((c) => c.id).filter((c) => c !== color && met.includes(c))].slice(0, 4).sort((a, b) => ((a.charCodeAt(0) * 31 + object.length) % 7) - ((b.charCodeAt(0) * 31 + object.length) % 7));
  const swatches = new Map<string, HTMLButtonElement>();
  let locked = false;
  options.forEach((c) => {
    const b = el('button', 'swatch', palette);
    b.type = 'button';
    b.style.background = colorById(c).hex;
    b.setAttribute('aria-label', c);
    swatches.set(c, b);
    b.addEventListener('click', async () => {
      if (locked) return;
      paintWith(colorById(c).hex);
      env.say(c, true);
      if (c === color) {
        locked = true;
        b.classList.add('win');
        env.sound('correct');
        env.face('dance');
        window.setTimeout(() => env.done(), 1300);
      } else {
        locked = true;
        const n = env.mistake();
        env.sound('oops');
        env.face('cheer', 'Hmm, try again!');
        window.setTimeout(() => {
          paintWith(null);
          locked = false;
        }, 700);
        if (n >= 3) {
          window.setTimeout(async () => {
            locked = true;
            await showSolution(env.stage, swatches.get(color)!);
            env.done();
          }, 800);
        }
      }
    });
  });
  return { repeat: () => env.say(`Color the ${object} ${color}!`), destroy: () => (wrap.remove(), palette.remove()) };
}
