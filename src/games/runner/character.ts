/**
 * The runner: a squishy of the workshop, drawn once at the start of a run from the same saved-data format as every squishy: from behind (no face, no decorations) while it runs,
 * and with its face when it turns round at the finish line.
 * The picture from behind: an animal has its own (`shapes/<id>-back.webp` and its part map, made by scripts/squishy-art.py: `loadBackShape`); the nine sweets are the same from
 * behind, so they use the front picture with no face. Until the pictures of the backs exist, an animal cannot run: the prototype runs a donut.
 */
import { ANIMALS, loadBackShape, loadShape, originalColors, type Loaded } from '../squishy/shapes';
import { newSquishy, type SquishyData } from '../squishy/save';
import { drawSquishy } from '../squishy/squishy';

/** the ready-made runner of the prototype: a donut (round, the same from every side) */
export const readyRunner = (): SquishyData => ({ ...newSquishy('donut'), colors: originalColors('donut'), name: 'סופגנייה' });

const isAnimal = (shape: string): boolean => (ANIMALS as readonly string[]).includes(shape);

/** can this squishy run now? A sweet always can; an animal only when its picture from behind exists. */
export async function canRun(d: SquishyData): Promise<boolean> {
  return !isAnimal(d.shape) || !!(await loadBackShape(d.shape));
}

/** two pictures cropped to the shape: [from behind, from the front] */
export async function drawRunner(d: SquishyData = readyRunner()): Promise<{ back: HTMLCanvasElement; front: HTMLCanvasElement; shape: string }> {
  if (!(await canRun(d))) d = readyRunner();
  const front = await loadShape(d.shape);
  const behind: Loaded = (isAnimal(d.shape) && (await loadBackShape(d.shape))) || front;
  const big = document.createElement('canvas');
  big.width = big.height = 512;
  const g = big.getContext('2d', { willReadFrequently: true })!;
  const crop = (loaded: Loaded, face: boolean): HTMLCanvasElement => {
    const { x0, y0, x1, y1 } = loaded.box;
    drawSquishy(g, loaded, d, face ? { face: 'open' } : { noFace: true, noDecor: true });
    const c = document.createElement('canvas');
    // 256 px high at the most: it is drawn about 150 px high on a phone
    const k = Math.min(1, 256 / (y1 - y0));
    c.width = Math.max(1, Math.round((x1 - x0) * k));
    c.height = Math.max(1, Math.round((y1 - y0) * k));
    c.getContext('2d')!.drawImage(big, x0, y0, x1 - x0, y1 - y0, 0, 0, c.width, c.height);
    return c;
  };
  return { back: crop(behind, false), front: crop(front, true), shape: d.shape };
}
