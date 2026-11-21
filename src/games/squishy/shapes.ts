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

/** where the face goes: on the head of an animal (the middle of the top third), and on a sweet or a thing where it can sit (by the shape: the frosting, the scoop, the head of the lollipop, the ring of the donut) */
export function faceAnchor(id: string, map: Uint8ClampedArray, box: Loaded['box']): Loaded['face'] {
  if ((ANIMALS as readonly string[]).includes(id)) return faceOf(map, box);
  const w = box.x1 - box.x0, h = box.y1 - box.y0;
  const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
  const at: Record<string, [number, number, number]> = {
    cupcake: [cx, box.y0 + h * 0.5, w * 0.4], donut: [cx, box.y0 + h * 0.86, w * 0.25], icecream: [cx, box.y0 + h * 0.3, w * 0.4], cookie: [cx, cy, w * 0.4],
    lollipop: [cx, box.y0 + h * 0.33, w * 0.36], apple: [cx, cy + h * 0.08, w * 0.34], star: [cx, cy + h * 0.05, w * 0.26], flower: [cx, cy, w * 0.13], crown: [cx, box.y0 + h * 0.7, w * 0.26],
  };
  const a = at[id];
  return a ? { x: a[0], y: a[1], size: a[2] } : null;
}

/**
 * The picture of a shape seen from behind (an optional second picture of an animal: `shapes/<id>-back.webp` and its own part map `maps/<id>-back.png`, both made by scripts/squishy-art.py
 * with the same colours for the same parts). Null when it is not there: the nine sweets are the same from behind, and use the front picture with no face.
 */
const backs = new Map<string, Promise<Loaded | null>>();
export function loadBackShape(id: string): Promise<Loaded | null> {
  let p = backs.get(id);
  if (!p) {
    p = loadShape(id, true).catch(() => null);
    backs.set(id, p);
  }
  return p;
}

export async function loadShape(id: string, back = false): Promise<Loaded> {
  const name = back ? `${id}-back` : id;
  const [shape, maps] = await Promise.all([loadImage(`${base()}squishy/shapes/${name}.webp`), loadImage(`${base()}squishy/maps/${name}.png`)]);
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
  return { id, map, box, foot, face: back ? null : faceAnchor(id, map, box) };
}
