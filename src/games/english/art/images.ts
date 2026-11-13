import { WORDS, wordsOfWorld } from '../content/words';
import { PAINT, paintUrl } from '../content/paint';
import { preloadVoice } from '../content/heLines';
import { ISLANDS, letterById } from '../letters/journey';
import { LETTER_PICTURES } from '../letters/plan';
import { bgUrl } from './scenes';
import { squishyOfWorld, squishyUrl } from './squishies';

/** The picture of a word: a transparent WebP, 512 x 512, one for each word in the whole game. */
export const imageUrl = (id: string): string => `${import.meta.env.BASE_URL}english/words/${id}.webp`;
export const BODY_URL = `${import.meta.env.BASE_URL}english/body.webp`;

/** The picture as an element: sits on the scene with a soft shadow under it (the shadow is in the CSS). */
export const itemImg = (id: string): string => `<img class="item-img" src="${imageUrl(id)}" alt="" draggable="false" decoding="async">`;

const loaded = new Set<number>();
/**
 * The pictures of a world are fetched when the world is entered (not with the app): the service worker keeps them for offline in a
 * runtime cache (`english-images`) the first time. Resolves when every picture is ready (a picture that fails does not hold the game).
 */
export function preloadWorld(world: number): Promise<void> {
  if (loaded.has(world)) return Promise.resolve();
  // the nine words, the room (background), the squishy to be rescued, and the white objects of the colouring task
  const urls = [...wordsOfWorld(world).map((w) => imageUrl(w.id)), bgUrl(world), squishyUrl(squishyOfWorld(world).id), `${import.meta.env.BASE_URL}english/words/gift.webp`, ...(world >= 4 ? PAINT.map((p) => paintUrl(p.id)) : [])];
  const jobs = urls.map(
    (u) =>
      new Promise<void>((res) => {
        const im = new Image();
        im.decoding = 'async';
        im.onload = () => res();
        im.onerror = () => res();
        im.src = u;
      }),
  );
  jobs.push(preloadVoice(world));
  return Promise.all(jobs).then(() => void loaded.add(world));
}

/** The pictures of an island of letters: the example word of each of its letters, and the pictures that "what starts with..." may show. */
export function preloadLetters(island: number): Promise<void> {
  const ids = [...ISLANDS.filter((i) => i.n <= island).flatMap((i) => i.letters.map((l) => letterById(l).word)), ...LETTER_PICTURES];
  const urls = [...new Set(ids)].map(imageUrl).concat(bgUrl(3));
  return Promise.all(urls.map((u) => new Promise<void>((res) => { const im = new Image(); im.onload = im.onerror = () => res(); im.src = u; }))).then(() => preloadVoice(0));
}

/** Every file name that has a word (for the tests that no picture is missing or left over). */
export const allImageNames = (): string[] => WORDS.map((w) => w.id);
