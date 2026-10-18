import { farm } from './farm';
import type { Deck } from './svg';

export type DeckId = 'farm';

export const DECKS: Record<DeckId, Deck> = { farm };
export type { Deck };
