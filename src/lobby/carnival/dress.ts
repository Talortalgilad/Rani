/**
 * Where an accessory sits on a resident. The residents are very different shapes (a round donut, a tall ice cream, a flat triangle, a cookie), so each picture has its own anchors
 * (anchors.json, made by scripts/accessory-anchors.py: the top of the head, the eyes, the mouth, the neck, the width of the head and of the neck, as fractions of the picture), and
 * every accessory sits by those: the hats and the crowns above the eyes, the glasses on the eyes, the scarf under the mouth, the cape behind the neck. Pure.
 */
import ANCHORS from './anchors.json';

export interface Anchor { top: number; bottom: number; left: number; right: number; cx: number; eyeY: number; mouthY: number; neckY: number; neckW: number; eyeW: number; eyeGap: number }
/** the part of the picture of an accessory that is not transparent (fractions of its square) */
export interface Box { t: number; b: number; l: number; r: number }
export const ACC_BOX: Record<string, Box> = {
  chefhat: { t: 0.088, b: 0.91, l: 0.061, r: 0.938 }, balloons: { t: 0.059, b: 0.938, l: 0.145, r: 0.854 }, medal: { t: 0.059, b: 0.938, l: 0.232, r: 0.764 },
  partyhat: { t: 0.041, b: 0.955, l: 0.168, r: 0.828 }, crown: { t: 0.145, b: 0.854, l: 0.041, r: 0.957 }, glasses: { t: 0.311, b: 0.688, l: 0.041, r: 0.957 },
  scarf: { t: 0.039, b: 0.957, l: 0.092, r: 0.904 }, bow: { t: 0.199, b: 0.799, l: 0.041, r: 0.957 }, sunglasses: { t: 0.293, b: 0.705, l: 0.041, r: 0.957 },
  flowercrown: { t: 0.207, b: 0.789, l: 0.041, r: 0.957 }, cape: { t: 0.145, b: 0.854, l: 0.043, r: 0.957 },
};
const DEFAULT: Anchor = { top: 0.08, bottom: 0.92, left: 0.06, right: 0.94, cx: 0.5, eyeY: 0.42, mouthY: 0.5, neckY: 0.56, neckW: 0.6, eyeW: 0.6, eyeGap: 0.2 };
/** the anchors of a picture (its id: the name of the file without the extension) */
export const anchorOf = (key: string): Anchor => (ANCHORS as Record<string, Anchor>)[key] ?? DEFAULT;
export const imageKey = (img: string): string => (/cheesy\/happy\./.test(img) ? 'cheesy' : (img.split('/').pop() ?? '').replace(/\.\w+(\?.*)?$/, ''));

/** where one accessory goes, in fractions of the picture of the resident: the centre (u, v) and the size of the square of the accessory (s) */
export interface Place { u: number; v: number; s: number }
/** how wide each accessory is, as a part of the width of the head (the neck for the scarf, the body for the cape) */
const WIDTH: Record<string, number> = { partyhat: 0.62, crown: 0.82, chefhat: 0.8, flowercrown: 0.98, bow: 0.5, glasses: 0.9, sunglasses: 0.9, scarf: 0.98, cape: 1.4, balloons: 0.5, medal: 0.34 };

export function place(id: string, a: Anchor): Place {
  const box = ACC_BOX[id] ?? { t: 0, b: 1, l: 0, r: 1 };
  const w = box.r - box.l;
  const head = Math.min(a.eyeW, a.right - a.left);
  const size = (width: number): number => width / w;
  switch (id) {
    case 'partyhat':
    case 'crown':
    case 'chefhat':
    case 'flowercrown': {
      const s = size(WIDTH[id] * head);
      // the lower edge sits on the top of the head, and always above the eyes (a round head is wide and low: the hat must not slide down on the face)
      const edge = Math.min(a.top + 0.07, a.eyeY - 0.085 - (id === 'flowercrown' ? 0.02 : 0));
      return { u: a.cx, v: edge - (box.b - 0.5) * s, s };
    }
    case 'bow': {
      const s = size(WIDTH.bow * head);
      return { u: a.cx - 0.26 * head, v: Math.min(a.top + 0.13, a.eyeY - 0.1) - (box.b - 0.5) * s, s };
    }
    case 'glasses':
    case 'sunglasses': {
      const s = size(Math.min(WIDTH[id] * head, a.eyeGap * 2.6));
      return { u: a.cx, v: a.eyeY - ((box.t + box.b) / 2 - 0.5) * s, s };
    }
    case 'scarf': {
      const s = size(Math.min(WIDTH.scarf * Math.max(a.neckW, 0.4), 1.15 * head + 0.1));
      // the top edge of the ring is under the mouth: it never covers the eyes or the mouth
      return { u: a.cx, v: a.mouthY + 0.045 - (box.t - 0.5) * s, s };
    }
    case 'cape': {
      const s = size(WIDTH.cape * Math.max(a.neckW, head));
      return { u: a.cx, v: a.mouthY + 0.01 - (box.t - 0.5) * s, s };
    }
    case 'balloons':
      return { u: Math.min(0.95, a.right + 0.02), v: a.top - 0.06, s: 0.7 };
    case 'medal':
      return { u: a.cx, v: a.neckY + 0.1, s: 0.3 };
  }
  return { u: a.cx, v: a.eyeY, s: 0.5 };
}
