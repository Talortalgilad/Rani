/** The pictures of the lessons (SPEC-tutor.md section 4, "תמונות"): word:<id>, face:<feeling>, squishy:<name>. thing: and lolly: come in stage 1. */
import { WORDS } from '../content/words';
import { imageUrl } from '../art/images';
import { squishyUrl } from '../art/squishies';
import { cheesyUrl } from '../art/cheesy';
import { faceUrl, lollyImg } from './lolly';

/** A face with a feeling: the 3D picture (face_<feeling>.webp). */
export const faceHtml = (feeling: string): string => `<img class="pic-img" src="${faceUrl(feeling)}" alt="" draggable="false">`;

/** The squishies that say "Hello! I'm ..." (the names of the companion: the pictures are the ones the carnival uses). */
const SQUISHY: Record<string, string> = { mozzi: 'pizza', horiko: 'panda', popcheese: 'cookie' };
export const squishyPic = (name: string): string => (name === 'cheesy' ? cheesyUrl('happy') : squishyUrl(SQUISHY[name] ?? name));

export type Pic = { kind: 'word'; id: string } | { kind: 'face'; feeling: string } | { kind: 'squishy'; name: string } | { kind: 'thing'; thing: string; color: string } | { kind: 'lolly'; like: boolean; food: string };
export function parsePic(s: string): Pic | null {
  const [k, a, b] = s.split(':');
  if (k === 'word' && a) return { kind: 'word', id: a };
  if (k === 'face' && a) return { kind: 'face', feeling: a };
  if (k === 'squishy' && a) return { kind: 'squishy', name: a };
  if (k === 'thing' && a && b) return { kind: 'thing', thing: a, color: b };
  if (k === 'lolly' && a && b) return { kind: 'lolly', like: a === 'like', food: b };
  return null;
}
export const wordExists = (id: string): boolean => WORDS.some((w) => w.id === id);

/** The html of a picture. A picture that stage 0 cannot draw (thing:, lolly:) is a plain tile with its name, so a lesson of a later stage never breaks. */
export function pictureHtml(s: string | null | undefined): string {
  if (!s) return '';
  const p = parsePic(s);
  if (!p) return '';
  switch (p.kind) {
    case 'word':
      return `<img class="pic-img" src="${imageUrl(p.id)}" alt="" draggable="false">`;
    case 'face':
      return faceHtml(p.feeling);
    case 'squishy':
      return `<img class="pic-img" src="${squishyPic(p.name)}" alt="" draggable="false">`;
    case 'lolly':
      return `<span class="pic-lolly">${lollyImg(p.like ? 'happy' : 'confused')}<img class="pic-img small" src="${imageUrl(p.food)}" alt="" draggable="false"></span>`;
    case 'thing':
      return `<span class="pic-todo">${p.thing}<br>${p.color}</span>`;
  }
}
