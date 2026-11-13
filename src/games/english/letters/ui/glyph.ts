import { squishyPicture } from '../art';
import { letterById } from '../journey';

/** A letter as a toy (Fredoka, big, with a gradient and a soft shadow: the CSS class toy-letter). The shape is always exact: it is text, not a picture. */
export const toyLetter = (ch: string, cls = ''): string => `<b class="toy-letter ${cls}" dir="ltr" aria-hidden="true">${ch}</b>`;

/** The word that shows the sound, with the letter picked out: sun -> <mark>s</mark>un */
export function exampleWord(letterId: string): string {
  const l = letterById(letterId);
  const i = l.label.toLowerCase().indexOf(l.id);
  return `${l.label.slice(0, i)}<mark>${l.label.slice(i, i + 1)}</mark>${l.label.slice(i + 1)}`;
}

/** A squishy letter: the letter as a soft toy with big eyes and rosy cheeks (CSS, so the shape of the letter is always right). */
export const letterSquishy = (ch: string, color: string): string => `<div class="letter-squishy" style="--c:${color}" role="img" aria-label="${ch.toUpperCase()}"><b dir="ltr">${ch.toUpperCase()}</b><span class="ls-cheeks"></span><span class="ls-eyes"><i></i><i></i></span><span class="ls-mouth"></span></div>`;

/** The squishy of a letter: the picture of sheet 15 when it was cut, else the CSS toy. */
export function letterSquishyArt(ch: string, color: string): string {
  const url = squishyPicture(ch);
  return url ? `<img class="squishy-img" src="${url}" alt="${ch.toUpperCase()}" draggable="false" decoding="async">` : letterSquishy(ch, color);
}
