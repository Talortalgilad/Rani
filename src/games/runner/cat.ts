/**
 * The runner of stage 0: the ready-made cat of the squishy workshop, drawn once at the start of the run from the same saved-data format as every squishy:
 * from behind (no face, no decorations) while she runs, and with its face when it turns round at the finish line.
 */
import { loadShape, originalColors } from '../squishy/shapes';
import { newSquishy, type SquishyData } from '../squishy/save';
import { drawSquishy } from '../squishy/squishy';

export const readyCat = (): SquishyData => ({ ...newSquishy('cat'), colors: originalColors('cat'), name: 'חתול' });

/** two pictures cropped to the shape: [from behind, from the front] */
export async function drawRunner(d: SquishyData = readyCat()): Promise<{ back: HTMLCanvasElement; front: HTMLCanvasElement }> {
  const loaded = await loadShape(d.shape);
  const big = document.createElement('canvas');
  big.width = big.height = 512;
  const g = big.getContext('2d', { willReadFrequently: true })!;
  const { x0, y0, x1, y1 } = loaded.box;
  const crop = (face: boolean): HTMLCanvasElement => {
    drawSquishy(g, loaded, d, face ? { face: 'open' } : { noFace: true, noDecor: true });
    const c = document.createElement('canvas');
    // 256 px high at the most: it is drawn about 150 px high on a phone
    const k = Math.min(1, 256 / (y1 - y0));
    c.width = Math.max(1, Math.round((x1 - x0) * k));
    c.height = Math.max(1, Math.round((y1 - y0) * k));
    c.getContext('2d')!.drawImage(big, x0, y0, x1 - x0, y1 - y0, 0, 0, c.width, c.height);
    return c;
  };
  return { back: crop(false), front: crop(true) };
}
