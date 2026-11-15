/** The shapes of the workshop (SPEC-squishy.md 2.2) and how a shape is loaded: its picture, its map (parts, shading, highlight) and its numbers (parts.json). */
import PARTS from './parts.json';
import type { RGB } from './paint';

export const ANIMALS = ['cat', 'dog', 'rabbit', 'fish', 'bird', 'lion', 'monkey', 'elephant', 'giraffe'] as const;
export const TREATS = ['cupcake', 'donut', 'icecream', 'cookie', 'lollipop', 'apple', 'star', 'flower', 'crown'] as const;
export const SHAPES: readonly string[] = [...ANIMALS, ...TREATS];
export const SIZE = 512;

export interface ShapeInfo { parts: number; areas: number[]; colors: number[][]; warnings: string[] }
export const shapeInfo = (id: string): ShapeInfo => (PARTS as Record<string, ShapeInfo>)[id];
/** the colours that the shape had in its picture, one for each part */
export const originalColors = (id: string): RGB[] => shapeInfo(id).colors.map((c) => [c[0], c[1], c[2]] as RGB);

export interface Loaded {
  id: string;
  /** map RGBA (R part, G shading, B highlight) with the alpha of the shape in A, SIZE x SIZE */
  map: Uint8ClampedArray;
  /** the bounding box of the shape and where a face goes (animals only), in pixels of the picture */
  box: { x0: number; y0: number; x1: number; y1: number };
  /** the width of the base (the lowest quarter of the shape: what stands on the table; the tail that sticks out to the side is not in it) */
  foot: { x0: number; x1: number };
  face: { x: number; y: number; size: number } | null;
}

const base = (): string => import.meta.env?.BASE_URL ?? '/';
const loadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((ok, no) => {
    const im = new Image();
    im.onload = () => ok(im);
    im.onerror = () => no(new Error(url));
    im.src = url;
  });
function pixels(im: HTMLImageElement): Uint8ClampedArray {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(im, 0, 0, SIZE, SIZE);
  return g.getImageData(0, 0, SIZE, SIZE).data;
}

/** where the face goes on an animal: in the middle of the top third of the shape (the head is on top) */
export function faceOf(map: Uint8ClampedArray, box: Loaded['box']): Loaded['face'] {
  const h = box.y1 - box.y0;
  const y = Math.round(box.y0 + h * 0.3);
  let l = SIZE, r = 0;
  for (let x = 0; x < SIZE; x++) if (map[(y * SIZE + x) * 4 + 3] > 200) (l = Math.min(l, x)), (r = Math.max(r, x));
  return r > l ? { x: (l + r) / 2, y, size: (r - l) / 2 } : null;
}

export async function loadShape(id: string): Promise<Loaded> {
  const [shape, maps] = await Promise.all([loadImage(`${base()}squishy/shapes/${id}.webp`), loadImage(`${base()}squishy/maps/${id}.png`)]);
  const alpha = pixels(shape);
  const map = new Uint8ClampedArray(pixels(maps));
  let x0 = SIZE, y0 = SIZE, x1 = 0, y1 = 0;
  for (let i = 0; i < map.length; i += 4) {
    map[i + 3] = alpha[i + 3];
    if (alpha[i + 3] > 40) {
      const p = i / 4;
      const x = p % SIZE, y = (p / SIZE) | 0;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
  }
  const box = { x0, y0, x1, y1 };
  let bx0 = SIZE, bx1 = 0;
  for (let y = Math.round(y1 - (y1 - y0) * 0.26); y <= y1; y++) for (let x = 0; x < SIZE; x++) if (alpha[(y * SIZE + x) * 4 + 3] > 120) (bx0 = Math.min(bx0, x)), (bx1 = Math.max(bx1, x));
  const foot = bx1 > bx0 ? { x0: bx0, x1: bx1 } : { x0, x1 };
  return { id, map, box, foot, face: (ANIMALS as readonly string[]).includes(id) ? faceOf(map, box) : null };
}
