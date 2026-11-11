import { farm } from './farm';
import { LETTERS, lettersArt, type LetterEntry } from './letters';
import { sea } from './sea';
import { space } from './space';
import { sweets } from './sweets';
import { svg, type Deck } from './svg';

export type DeckId = 'farm' | 'sea' | 'space' | 'sweets';

export const DECKS: Record<DeckId, Deck> = { farm, sea, space, sweets };
export const DECK_IDS = Object.keys(DECKS) as DeckId[];
export type { Deck, LetterEntry };
export { LETTERS };

/** Art key = "deck:picture", e.g. "sea:fish"; "letters:*" are the extra pictures for the letter cards. */
export function artDrawing(key: string): string {
  const [deck, name] = key.split(':');
  const found = deck === 'letters' ? lettersArt[name] : DECKS[deck as DeckId]?.art[name];
  if (!found) throw new Error(`unknown picture ${key}`);
  return found;
}

export const artSvg = (key: string): string => svg(artDrawing(key));

/** All "deck:picture" keys of one deck. */
export const deckKeys = (id: DeckId): string[] => DECKS[id].keys.map((k) => `${id}:${k}`);
