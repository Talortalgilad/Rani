import { itemImg } from '../art/images';
import { WORDS } from '../content/words';
import { islandInfo, letterById } from './journey';
import { LETTER_SQUISHY_PICS, LETTER_WORD_PICS, letterWordUrl } from './pictures';

const base = import.meta.env.BASE_URL;
const inWords = (id: string): boolean => WORDS.some((w) => w.id === id);

/** Does the word have a picture (one of the words of the game, or one cut for the letters journey)? */
export const hasPicture = (word: string): boolean => inWords(word) || LETTER_WORD_PICS.includes(word);

/** The picture of a word as html: nothing when there is none. */
export function wordPictureHtml(word: string): string {
  if (inWords(word)) return itemImg(word);
  if (LETTER_WORD_PICS.includes(word)) return `<img class="item-img" src="${letterWordUrl(word)}" alt="" draggable="false" decoding="async">`;
  return '';
}

/** The words of an island that can be offered for building: those with a picture; if there are fewer than three, earlier islands' words fill up (review). */
export function buildableWords(island: number): string[] {
  const own = islandInfo(island).words.filter(hasPicture);
  const out = [...own];
  for (let n = island - 1; n >= 1 && out.length < 3; n--) for (const w of islandInfo(n).words.filter(hasPicture)) if (!out.includes(w) && out.length < 3) out.push(w);
  return out;
}

/** Does the letter's example word have a picture? (If not, its "what starts with" task is left out until it is cut.) */
export const exampleHasPicture = (letter: string): boolean => hasPicture(letterById(letter).word);
export const squishyPicture = (letter: string): string | null => (LETTER_SQUISHY_PICS.includes(letter) ? `${base}english/letter-squishies/${letter}.webp` : null);
