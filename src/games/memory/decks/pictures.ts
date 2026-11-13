import { CARD_IMAGES } from './cards';
import { artSvg } from './index';

/**
 * The pictures of the decks that are not drawn in code: the 3D pictures of the English game (key "en:<id>", files in public/english) and the photos
 * of the family (key "fam:<id>", from the phone's IndexedDB, shown through object URLs: nothing is fetched from a network).
 */
const base = import.meta.env.BASE_URL;
/** Pictures of the English game that are not in public/english/words (the letters journey's pictures are in letter-words). */
export const EN_EXTRA = new Set(['pig', 'zebra', 'hen', 'fox', 'bat', 'yoyo', 'jam', 'octopus']);
export const enUrl = (id: string): string => `${base}english/${EN_EXTRA.has(id) ? 'letter-words' : 'words'}/${id}.webp`;

const familyUrls = new Map<string, string>();
export const setFamilyUrls = (m: Map<string, string>): void => {
  familyUrls.clear();
  m.forEach((v, k) => familyUrls.set(k, v));
};
export const hasFamilyPhoto = (key: string): boolean => familyUrls.has(key);

/** The 3D pictures cut for the worlds of the journey (public/memory/cards): a picture that was not cut keeps its drawn SVG. */
export const cardUrl = (name: string): string => `${base}memory/cards/${name}.webp`;
export const hasCardImage = (name: string): boolean => CARD_IMAGES.includes(name);
const img = (url: string): string => `<img class="mm-img" src="${url}" alt="" draggable="false" decoding="async">`;

/** The url of the picture of a plain card (null when the card is drawn in code). */
export function pictureUrl(key: string): string | null {
  const [deck, id] = key.split(':');
  if (deck === 'en') return enUrl(id);
  if (deck === 'fam') return familyUrls.get(key) ?? null;
  return deck !== 'letters' && hasCardImage(id) ? cardUrl(id) : null;
}

/** The picture of a card (plain: no face) as html. */
export function pictureHtml(key: string): string {
  const [deck, id] = key.split(':');
  if (deck !== 'en' && deck !== 'fam' && deck !== 'letters' && hasCardImage(id)) return img(cardUrl(id));
  if (deck === 'en') return `<img class="mm-img" src="${enUrl(id)}" alt="" draggable="false" decoding="async">`;
  if (deck === 'fam') return `<img class="mm-img mm-photo" src="${familyUrls.get(key) ?? ''}" alt="" draggable="false">`;
  return artSvg(key);
}

/** Is there a picture for this key: a 3D picture, a photo of the family, or a drawn SVG? */
export function knownPicture(key: string): boolean {
  if (pictureUrl(key) !== null) return true;
  try {
    artSvg(key);
    return true;
  } catch {
    return false;
  }
}

/** Is this picture available now (a family photo may have been deleted since a round was saved)? */
export const hasPicture = (key: string): boolean => (key.startsWith('fam:') ? hasFamilyPhoto(key) : true);
