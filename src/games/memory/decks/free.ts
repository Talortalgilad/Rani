import { DECKS, type DeckId } from './index';
import { INK } from './svg';
import { WORLDS, LEVELS } from '../levels';
import type { Progress } from '../ui/map';

/**
 * The decks of "ערכות" (free play and the game for two): the four of the journey (open when the world is finished), the 3D decks made of
 * the pictures of the English game (open from the start), and "המשפחה שלי" (open with at least six photos).
 */
export type FreeKind = 'journey' | 'english' | 'family';
export interface FreeDeck {
  id: string;
  he: string;
  kind: FreeKind;
  /** the card back (viewBox 0 0 100 125) and the colour of the front's border */
  back: string;
  frame: string;
  /** the pictures: "deck:picture" keys (family: filled in when the photos are loaded) */
  keys: string[];
  /** pictures to show on the cover (a gate picture) */
  cover: string[];
  /** a short word for the deck's colour on the select screen */
  color: string;
}

const EN = (ids: string[]): string[] => ids.map((i) => `en:${i}`);

/** A card back for the 3D decks: a gradient, dots and a badge with a simple symbol. */
function backFor(c1: string, c2: string, symbol: string): string {
  const dots = Array.from({ length: 12 }, (_, i) => `<circle cx="${12 + (i % 4) * 26}" cy="${14 + Math.floor(i / 4) * 48}" r="${i % 2 ? 4 : 6}" fill="#fff" opacity=".35" stroke="none"/>`).join('');
  return `<svg viewBox="0 0 100 125" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs><linearGradient id="g${c1.slice(1)}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
    <rect width="100" height="125" fill="url(#g${c1.slice(1)})"/>${dots}
    <circle cx="50" cy="62" r="30" fill="#fff" stroke="${INK}" stroke-width="4.5"/>
    <g stroke="${INK}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">${symbol}</g></svg>`;
}
const SYM = {
  paw: `<ellipse cx="50" cy="70" rx="13" ry="10" fill="#ff9a3c"/><circle cx="35" cy="55" r="5.5" fill="#ff9a3c"/><circle cx="46" cy="47" r="5.5" fill="#ff9a3c"/><circle cx="58" cy="47" r="5.5" fill="#ff9a3c"/><circle cx="68" cy="55" r="5.5" fill="#ff9a3c"/>`,
  plate: `<circle cx="50" cy="62" r="20" fill="#ffd23f"/><circle cx="50" cy="62" r="11" fill="#fff"/>`,
  swirl: `<path d="M50 62 m0 0 a5 5 0 0 1 10 0 a12 12 0 0 1 -24 0 a19 19 0 0 1 38 0" fill="none" stroke="#ff5d9e" stroke-width="6"/>`,
  star: `<path d="M50 38 L56 55 L74 56 L60 67 L65 84 L50 74 L35 84 L40 67 L26 56 L44 55Z" fill="#ffd23f"/>`,
  shirt: `<path d="M36 44 L45 40 Q50 48 55 40 L64 44 L72 56 L63 60 L63 84 L37 84 L37 60 L28 56Z" fill="#4aa3df"/>`,
  cloud: `<path d="M34 76 Q24 76 26 66 Q27 58 36 59 Q38 48 50 48 Q62 48 64 59 Q74 59 74 68 Q74 76 66 76Z" fill="#8fd3ff"/>`,
  note: `<path d="M44 44 L66 38 L66 70" fill="none" stroke-width="5"/><circle cx="38" cy="72" r="9" fill="#8e5cf0"/><circle cx="60" cy="70" r="9" fill="#8e5cf0"/><path d="M47 72 L47 44" stroke-width="5"/>`,
  heart: `<path d="M50 80 C20 60 28 38 42 42 C46 43 49 46 50 50 C51 46 54 43 58 42 C72 38 80 60 50 80Z" fill="#ff5d73"/>`,
};

export const ENGLISH_DECKS: FreeDeck[] = [
  { id: 'en-animals', he: 'חיות', kind: 'english', color: '#ff9a3c', frame: '#ffb86b', back: backFor('#ffb86b', '#ff7d3c', SYM.paw), cover: EN(['cat', 'lion']),
    keys: EN(['cat', 'dog', 'lion', 'monkey', 'fish', 'bird', 'elephant', 'giraffe', 'rabbit', 'pig', 'zebra', 'hen', 'fox', 'bat']) },
  { id: 'en-food', he: 'אוכל', kind: 'english', color: '#ffc83a', frame: '#ffd86b', back: backFor('#ffd86b', '#ff9a3c', SYM.plate), cover: EN(['pizza', 'apple']),
    keys: EN(['pizza', 'cheese', 'pasta', 'meat', 'apple', 'banana', 'milk', 'cake', 'egg', 'jam']) },
  { id: 'en-sweets', he: 'ממתקים', kind: 'english', color: '#ff7ad0', frame: '#ff9fd8', back: backFor('#ff9fd8', '#ff5d9e', SYM.swirl), cover: EN(['icecream', 'cupcake']),
    keys: EN(['candy', 'lollipop', 'cupcake', 'icecream', 'cookie', 'donut', 'chocolate', 'balloon', 'gift', 'cake']) },
  { id: 'en-toys', he: 'צעצועים', kind: 'english', color: '#6fd3ff', frame: '#8fdcff', back: backFor('#8fdcff', '#4aa3df', SYM.star), cover: EN(['ball', 'doll']),
    keys: EN(['ball', 'doll', 'kite', 'bike', 'skates', 'book', 'crayons', 'yoyo', 'balloon', 'helmet']) },
  { id: 'en-clothes', he: 'בגדים', kind: 'english', color: '#ff8a8a', frame: '#ffa8a8', back: backFor('#ffa8a8', '#ff6b7a', SYM.shirt), cover: EN(['dress', 'hat']),
    keys: EN(['shirt', 'shorts', 'dress', 'skirt', 'shoes', 'socks', 'hat', 'jacket', 'glasses', 'helmet']) },
  { id: 'en-weather', he: 'מזג אוויר', kind: 'english', color: '#8fd3ff', frame: '#a8e0ff', back: backFor('#a8e0ff', '#5aaee8', SYM.cloud), cover: EN(['sun', 'rainbow']),
    keys: EN(['sun', 'cloud', 'rain', 'snowflake', 'wind', 'rainbow', 'umbrella', 'snowman', 'storm', 'kite']) },
  { id: 'en-music', he: 'מוזיקה', kind: 'english', color: '#b58cff', frame: '#c9a8ff', back: backFor('#c9a8ff', '#8e5cf0', SYM.note), cover: EN(['guitar', 'drum']),
    keys: EN(['guitar', 'drum', 'piano', 'trumpet', 'microphone', 'stage', 'star', 'crown', 'dance', 'sing']) },
];

/** "המשפחה שלי": the keys are made when the photos are loaded. */
export const FAMILY_DECK: FreeDeck = { id: 'family', he: 'המשפחה שלי', kind: 'family', color: '#ff5d73', frame: '#ff9fb0', back: backFor('#ff9fb0', '#ff5d73', SYM.heart), cover: [], keys: [] };
export const FAMILY_MIN = 6;
export const FAMILY_MAX = 15;

/** The four decks of the journey, in the order of the worlds. */
export const JOURNEY_DECKS: FreeDeck[] = WORLDS.map((w) => {
  const d = DECKS[w.deck as DeckId];
  return { id: w.deck, he: w.deck === 'sweets' ? 'ממתקי המסע' : w.name, kind: 'journey' as const, color: w.to, frame: d.frame, back: d.back, keys: d.keys.map((k) => (k.includes(':') ? k : `${w.deck}:${k}`)), cover: [`${w.deck}:${d.keys[0]}`, `${w.deck}:${d.keys[1]}`] };
});

export const ALL_FREE_DECKS: FreeDeck[] = [...JOURNEY_DECKS, ...ENGLISH_DECKS, FAMILY_DECK];
export const freeDeckById = (id: string): FreeDeck | undefined => ALL_FREE_DECKS.find((d) => d.id === id);

/** A world of the journey is finished when all four of its levels were won. */
export const worldDone = (p: Progress, world: number): boolean => LEVELS.filter((l) => l.world === world).every((l) => (p.levels[l.id]?.stars ?? 0) > 0);

export type Lock = null | 'world' | 'photos';
/** Why a deck cannot be played yet: a journey deck until its world is finished, the family deck until it has six photos. */
export function lockOf(d: FreeDeck, p: Progress, photoCount: number): Lock {
  if (d.kind === 'journey') return worldDone(p, WORLDS.findIndex((w) => w.deck === d.id) + 1) ? null : 'world';
  if (d.kind === 'family') return photoCount >= FAMILY_MIN ? null : 'photos';
  return null;
}

/** The pictures of the deck as keys, for the family deck from the ids of the photos. */
export const keysOf = (d: FreeDeck, photoIds: string[]): string[] => (d.kind === 'family' ? photoIds.map((id) => `fam:${id}`) : d.keys);
