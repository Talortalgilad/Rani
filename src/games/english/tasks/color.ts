import { tintedCanvas } from '../art/tint';
import { imageUrl } from '../art/images';
import { COLORS, colorById } from '../content/colors';
import { labelOf } from '../content/words';
import { el, showSolution, type TaskEnv, type TaskHandle } from './common';

/** "Color the ball red!": the picture is grey; tapping a colour paints it. The right colour stays, a wrong one fades back to grey. */
export function colorTask(env: TaskEnv, object: string, color: string, met: string[]): TaskHandle {
  const wrap = el('div', 'color-obj pic', env.stage);
  wrap.style.left = '50%';
  wrap.style.top = '34%';
  const img = new Image();
  img.src = imageUrl(object);
  const canvas = el('canvas', 'color-canvas', wrap);
  const draw = (hex: string | null): void => {
    canvas.width = canvas.height = 360;
    canvas.getContext('2d')!.drawImage(tintedCanvas(img, hex), 0, 0);
  };
  img.onload = () => draw(null);
  const palette = el('div', 'palette', env.stage);
  const options = [color, ...COLORS.map((c) => c.id).filter((c) => c !== color && met.includes(c))].slice(0, 4).sort(() => 0.5 - ((color.charCodeAt(0) * 7 + object.length) % 10) / 10);
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
      draw(colorById(c).hex);
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
        env.face('encourage', 'Hmm, try again!');
        window.setTimeout(() => {
          draw(null);
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
  return { repeat: () => env.say(`Color the ${labelOf(object)} ${color}!`), destroy: () => (wrap.remove(), palette.remove()) };
}
