import { WORDS, artKey, wordsOfWorld } from '../content/words';

/** The picture of a word: a transparent WebP, 512 x 512, one for each word in the whole game. */
export const imageUrl = (id: string): string => `${import.meta.env.BASE_URL}english/words/${artKey(id)}.webp`;
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
  const jobs = wordsOfWorld(world).map(
    (w) =>
      new Promise<void>((res) => {
        const im = new Image();
        im.decoding = 'async';
        im.onload = () => res();
        im.onerror = () => res();
        im.src = imageUrl(w.id);
      }),
  );
  return Promise.all(jobs).then(() => void loaded.add(world));
}

/** Every file name that has a word (for the tests that no picture is missing or left over). */
export const allImageNames = (): string[] => WORDS.map((w) => artKey(w.id));
