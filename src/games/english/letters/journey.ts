/** The letters journey (SPEC-letters.md): 26 letters in the order of phonics, six islands, words to build at the end of each island. */
export interface Letter { id: string; upper: string; /** the word that shows the sound: its picture is public/english/words/<word>.webp when there is one */ word: string; /** what is said and written for it ("ice cream"-like labels) */ label: string; island: number }

const L = (id: string, word: string, island: number, label = word): Letter => ({ id, upper: id.toUpperCase(), word, label, island });

/** In the order they are taught: after s, a, t, p there are real words (sat, tap, pat). */
export const LETTERS: Letter[] = [
  L('s', 'sun', 1), L('a', 'apple', 1), L('t', 'tree', 1), L('p', 'pizza', 1),
  L('i', 'igloo', 2), L('n', 'nest', 2), L('m', 'monkey', 2), L('d', 'dog', 2),
  L('g', 'gift', 3), L('o', 'octopus', 3), L('c', 'cat', 3), L('k', 'kite', 3),
  L('e', 'egg', 4), L('u', 'umbrella', 4), L('r', 'rabbit', 4), L('h', 'hat', 4), L('b', 'ball', 4),
  L('f', 'fish', 5), L('l', 'lion', 5), L('j', 'jam', 5), L('v', 'van', 5), L('w', 'web', 5),
  L('x', 'fox', 6), L('y', 'yo-yo', 6), L('z', 'zebra', 6), L('q', 'queen', 6),
];
export const letterById = (id: string): Letter => LETTERS.find((l) => l.id === id) ?? LETTERS[0];

export interface Island { n: number; name: string; he: string; emoji: string; color: string; letters: string[]; words: string[]; /** built in this stage */ ready: boolean }
export const ISLANDS: Island[] = [
  { n: 1, name: 'Sand island', he: 'אי החול', emoji: '🏝️', color: '#ffc83a', letters: ['s', 'a', 't', 'p'], words: ['sat', 'tap', 'pat', 'sap'], ready: true },
  { n: 2, name: 'Moon island', he: 'אי הירח', emoji: '🌙', color: '#9aa8ff', letters: ['i', 'n', 'm', 'd'], words: ['pin', 'tin', 'man', 'dad', 'sit', 'mat'], ready: false },
  { n: 3, name: 'Forest island', he: 'אי היער', emoji: '🌲', color: '#4fbf6a', letters: ['g', 'o', 'c', 'k'], words: ['dog', 'cat', 'cot', 'pot', 'dig', 'kit'], ready: false },
  { n: 4, name: 'Rainbow island', he: 'אי הקשת', emoji: '🌈', color: '#ff8a5c', letters: ['e', 'u', 'r', 'h', 'b'], words: ['bed', 'bus', 'sun', 'hen', 'red', 'hut', 'cub'], ready: false },
  { n: 5, name: 'Flower island', he: 'אי הפרחים', emoji: '🌸', color: '#ff7ad0', letters: ['f', 'l', 'j', 'v', 'w'], words: ['fun', 'leg', 'jam', 'van', 'web', 'fig'], ready: false },
  { n: 6, name: 'Star island', he: 'אי הכוכבים', emoji: '⭐', color: '#b58cff', letters: ['x', 'y', 'z', 'q'], words: ['fox', 'box', 'yes', 'zip', 'quiz'], ready: false },
];
export const islandInfo = (n: number): Island => ISLANDS.find((i) => i.n === n) ?? ISLANDS[0];

/** The letters taught up to and including an island (what may appear in its tasks). */
export const lettersUpTo = (island: number): string[] => ISLANDS.filter((i) => i.n <= island).flatMap((i) => i.letters);

/** Words to build have no picture file yet: an emoji stands for each until the sheets are made. */
export const WORD_EMOJI: Record<string, string> = {
  sat: '🪑', tap: '🚰', pat: '🐾', sap: '🌳',
  pin: '📌', tin: '🥫', man: '👨', dad: '👨‍👧', sit: '🧘', mat: '🧺',
  dog: '🐶', cat: '🐱', cot: '🛏️', pot: '🍲', dig: '⛏️', kit: '🧰',
  bed: '🛏️', bus: '🚌', sun: '☀️', hen: '🐔', red: '🔴', hut: '🛖', cub: '🐻',
  fun: '🎉', leg: '🦵', jam: '🍓', van: '🚐', web: '🕸️', fig: '🫒',
  fox: '🦊', box: '📦', yes: '👍', zip: '🤐', quiz: '❓',
};

/** The sounds of a word, one letter each ("sat" -> s, a, t). */
export const soundsOf = (word: string): string[] => word.split('');

/** The staircase of a words station: the pictures are chosen among the words of the island and earlier ones. */
export const wordsUpTo = (island: number): string[] => ISLANDS.filter((i) => i.n <= island).flatMap((i) => i.words);
