/** The pictures of the lessons (SPEC-tutor.md section 4, "תמונות"): word:<id>, face:<feeling>, squishy:<name>. thing: and lolly: come in stage 1. */
import { WORDS } from '../content/words';
import { imageUrl } from '../art/images';
import { squishyUrl } from '../art/squishies';
import { cheesyUrl } from '../art/cheesy';
import { lollySvg } from './lolly';

const INK = '#3a2f4b';
/** A round squishy face with a feeling, drawn in code. */
export function faceSvg(feeling: string): string {
  const base: Record<string, string> = { happy: '#ffd84a', sad: '#9ccbff', sleepy: '#c9b8ff', hungry: '#ffb27a', great: '#7be0a4' };
  const eyes: Record<string, string> = {
    happy: `<path d="M34 46 Q42 36 50 46 M70 46 Q78 36 86 46" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`,
    sad: `<circle cx="42" cy="46" r="6" fill="${INK}"/><circle cx="78" cy="46" r="6" fill="${INK}"/><path d="M30 36 L50 40 M90 36 L70 40" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="M42 54 Q38 66 44 72" fill="none" stroke="#4aa8ff" stroke-width="5" stroke-linecap="round"/>`,
    sleepy: `<path d="M32 48 Q42 54 52 48 M68 48 Q78 54 88 48" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><text x="84" y="26" font-size="22" font-weight="800" fill="${INK}" font-family="sans-serif">z</text><text x="96" y="14" font-size="15" font-weight="800" fill="${INK}" font-family="sans-serif">z</text>`,
    hungry: `<circle cx="42" cy="46" r="7" fill="#fff" stroke="${INK}" stroke-width="3.5"/><circle cx="78" cy="46" r="7" fill="#fff" stroke="${INK}" stroke-width="3.5"/><circle cx="44" cy="49" r="3.4" fill="${INK}"/><circle cx="80" cy="49" r="3.4" fill="${INK}"/>`,
    great: `<path d="M42 38 l3 7 7 .5 -5.500 4.500 2 7 -6.500 -4 -6.500 4 2 -7 -5.500 -4.500 7 -.5z M78 38 l3 7 7 .5 -5.500 4.500 2 7 -6.500 -4 -6.500 4 2 -7 -5.500 -4.500 7 -.5z" fill="#fff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`,
  };
  const mouth: Record<string, string> = {
    happy: `<path d="M38 70 Q60 94 82 70" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`,
    sad: `<path d="M42 86 Q60 70 78 86" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`,
    sleepy: `<ellipse cx="60" cy="80" rx="7" ry="9" fill="#a284e8" stroke="${INK}" stroke-width="4"/>`,
    hungry: `<path d="M40 74 Q60 100 80 74 Z" fill="#c2325f" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M72 84 Q76 96 72 102" fill="none" stroke="#4aa8ff" stroke-width="4.500" stroke-linecap="round"/>`,
    great: `<path d="M36 68 Q60 100 84 68 Z" fill="#fff" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`,
  };
  return `<svg class="pic-svg" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="62" r="50" fill="${base[feeling] ?? '#ffd84a'}" stroke="${INK}" stroke-width="5"/><ellipse cx="38" cy="30" rx="12" ry="6" fill="#fff" opacity=".45" transform="rotate(-25 38 30)"/>${eyes[feeling] ?? ''}${mouth[feeling] ?? ''}</svg>`;
}

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
      return faceSvg(p.feeling);
    case 'squishy':
      return `<img class="pic-img" src="${squishyPic(p.name)}" alt="" draggable="false">`;
    case 'lolly':
      return `<span class="pic-lolly">${lollySvg(p.like ? 'happy' : 'confused')}<img class="pic-img small" src="${imageUrl(p.food)}" alt="" draggable="false"></span>`;
    case 'thing':
      return `<span class="pic-todo">${p.thing}<br>${p.color}</span>`;
  }
}
