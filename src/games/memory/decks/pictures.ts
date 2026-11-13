import { artSvg } from './index';

/**
 * The pictures of the decks that are not drawn in code: the 3D pictures of the English game (key "en:<id>", files in public/english) and the photos
 * of the family (key "fam:<id>", from the phone's IndexedDB, shown through object URLs: nothing is fetched from a network).
 */
const base = import.meta.env.BASE_URL;
/** Pictures of the English game that are not in public/english/words (the letters journey's pictures are in letter-words). */
export const EN_EXTRA = new Set(['pig', 'zebra', 'hen', 'fox', 'bat', 'yoyo', 'jam']);
export const enUrl = (id: string): string => `${base}english/${EN_EXTRA.has(id) ? 'letter-words' : 'words'}/${id}.webp`;

const familyUrls = new Map<string, string>();
export const setFamilyUrls = (m: Map<string, string>): void => {
  familyUrls.clear();
  m.forEach((v, k) => familyUrls.set(k, v));
};
export const hasFamilyPhoto = (key: string): boolean => familyUrls.has(key);

/** The picture of a card (plain: no face) as html. */
export function pictureHtml(key: string): string {
  const [deck, id] = key.split(':');
  if (deck === 'en') return `<img class="mm-img" src="${enUrl(id)}" alt="" draggable="false" decoding="async">`;
  if (deck === 'fam') return `<img class="mm-img mm-photo" src="${familyUrls.get(key) ?? ''}" alt="" draggable="false">`;
  return artSvg(key);
}

/** Is this picture available now (a family photo may have been deleted since a round was saved)? */
export const hasPicture = (key: string): boolean => (key.startsWith('fam:') ? hasFamilyPhoto(key) : true);
