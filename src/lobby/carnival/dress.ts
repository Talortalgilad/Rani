/**
 * Where an accessory sits on a resident. The residents are very different shapes (a round donut, a tall ice cream, a flat triangle, a cookie), so each picture has its own anchors
 * (anchors.json, made by scripts/accessory-anchors.py: the top of the head, the eyes, the mouth, the neck, the width of the head and of the neck, as fractions of the picture), and
 * every accessory sits by those: the hats and the crowns above the eyes, the glasses on the eyes, the scarf under the mouth, the cape behind the neck. Pure.
 */
import ANCHORS from './anchors.json';

export interface Anchor { top: number; bottom: number; left: number; right: number; cx: number; eyeY: number; mouthY: number; neckY: number; neckW: number; eyeW: number; eyeGap: number; /** the width of the body at 51 heights (0, 0.02 ... 1) */ prof?: number[]; /** the top of the head when the body is higher than the head (the wings of the bee) */ headTop?: number; /** how much a squishy of Rani's mold is scaled to be as big as the residents */ fill?: number }
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

/** the height (fraction of the picture) where the body first is `w` wide, counting from the top: a hat sits there, where the head is as wide as the hat */
export function heightAtWidth(a: Anchor, w: number): number {
  const p = a.prof;
  if (!p) return a.top + 0.07;
  for (let k = 1; k < p.length; k++) {
    if (p[k] >= w) {
      const prev = p[k - 1], f = p[k] > prev ? (w - prev) / (p[k] - prev) : 1;
      return (k - 1 + Math.max(0, Math.min(1, f))) / 50;
    }
  }
  return a.top + 0.07;
}

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
      const s = size((id === 'flowercrown' ? 0.9 : WIDTH[id]) * head);
      // the base of the hat sits on the head, where the head is as wide as the base (a little lower: it overlaps the head), never lower than just above the eyes;
      // the flower crown sits on the forehead, right over the eyes
      const wide = (box.r - box.l) * s * (id === 'flowercrown' ? 0.8 : 0.85);
      const edge = Math.min((a.headTop ?? heightAtWidth(a, wide)) + 0.035, a.eyeY - (id === 'flowercrown' ? 0.055 : 0.075));
      return { u: a.cx, v: edge - (box.b - 0.5) * s, s };
    }
    case 'bow': {
      const s = size(WIDTH.bow * head);
      const edge = Math.min((a.headTop ?? heightAtWidth(a, 0.6 * head)) + 0.04, a.eyeY - 0.09);
      return { u: a.cx - 0.26 * head, v: edge - (box.b - 0.5) * s, s };
    }
    case 'glasses':
    case 'sunglasses': {
      const s = size(Math.min(WIDTH[id] * head, a.eyeGap * 2.6));
      return { u: a.cx, v: a.eyeY - ((box.t + box.b) / 2 - 0.5) * s, s };
    }
    case 'scarf': {
      // as wide as the neck (the body just under the mouth), and short enough that the tails stop above the feet: it hugs the body, it does not lie on the floor
      const top = a.mouthY + 0.045;
      const byWidth = size(Math.min(0.98 * Math.max(a.neckW, 0.4), 1.1 * head + 0.05));
      const byFeet = (a.bottom - 0.05 - top) / (box.b - box.t);
      const s = Math.max(0.1, Math.min(byWidth, byFeet));
      return { u: a.cx, v: top - (box.t - 0.5) * s, s };
    }
    case 'cape': {
      // it hangs from the shoulders, behind the body: the collar is hidden by the head, the sides and the bottom show
      const top = a.top + 0.28 * (a.bottom - a.top);
      const byWidth = size(Math.min(1.3 * Math.max(a.neckW, head), 1.1 * (a.right - a.left)));
      const byFeet = (a.bottom - 0.03 - top) / (box.b - box.t);
      const s = Math.max(0.15, Math.min(byWidth, byFeet));
      // centred on the body, not on the face (the unicorn and the bee look to the side)
      return { u: (a.left + a.right) / 2, v: top - (box.t - 0.5) * s, s };
    }
    case 'balloons':
      return { u: Math.min(0.9, a.right + 0.02), v: a.top - 0.15, s: 0.55 };
    case 'medal':
      return { u: a.cx, v: a.neckY + 0.1, s: 0.3 };
  }
  return { u: a.cx, v: a.eyeY, s: 0.5 };
}

/** what is wrong with an accessory on a resident (empty: nothing): it hides the eyes or the mouth, or goes beyond the body (the cape may stick out a little on the sides, it is behind) or below the feet */
export function fitProblems(id: string, a: Anchor): string[] {
  const box = ACC_BOX[id] ?? { t: 0, b: 1, l: 0, r: 1 };
  const p = place(id, a);
  const L = p.u + (box.l - 0.5) * p.s, R = p.u + (box.r - 0.5) * p.s, T = p.v + (box.t - 0.5) * p.s, B = p.v + (box.b - 0.5) * p.s;
  const out: string[] = [];
  const hit = (x0: number, x1: number, y0: number, y1: number): boolean => L < x1 && R > x0 && T < y1 && B > y0;
  const behind = id === 'cape';
  if (!behind) {
    const half = a.eyeGap / 2 + 0.04;
    if (hit(a.cx - half, a.cx + half, a.eyeY - 0.035, a.eyeY + 0.035) && id !== 'glasses' && id !== 'sunglasses') out.push('eyes');
    if (hit(a.cx - 0.05, a.cx + 0.05, a.mouthY - 0.025, a.mouthY + 0.025) && id !== 'glasses' && id !== 'sunglasses') out.push('mouth');
  }
  if (id === 'scarf' || id === 'cape') {
    if (B > a.bottom + 0.005) out.push('below the feet');
    const slack = behind ? 0.12 : 0.08;
    if (L < a.left - slack || R > a.right + slack) out.push('wider than the body');
  }
  if (['crown', 'flowercrown', 'partyhat', 'chefhat', 'bow'].includes(id) && B > a.eyeY - 0.03) out.push('low on the face');
  return out;
}
