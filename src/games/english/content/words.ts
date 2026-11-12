export interface Word {
  /** the English word, also the key of its picture */
  id: string;
  world: number;
  /** what Cheesy says in Hebrew when the word first appears */
  he: string;
}

/** World 1, "my room": the three new words of the first station, and the others of the room that come in the next stations. */
export const WORDS: Word[] = [
  { id: 'ball', world: 1, he: 'כדור' },
  { id: 'book', world: 1, he: 'ספר' },
  { id: 'bed', world: 1, he: 'מיטה' },
  { id: 'phone', world: 1, he: 'טלפון' },
  { id: 'TV', world: 1, he: 'טלוויזיה' },
  { id: 'doll', world: 1, he: 'בובה' },
];
export const wordById = (id: string): Word => WORDS.find((w) => w.id === id) ?? WORDS[0];
export const artKey = (id: string): string => id.toLowerCase();

/** The verbs of the instructions, with a short Hebrew explanation the first times. */
export const VERBS: Record<string, { en: string; he: string }> = {
  circle: { en: 'Circle', he: 'להקיף בעיגול' },
  tap: { en: 'Tap', he: 'להקיש' },
  put: { en: 'Put', he: 'לשים' },
  match: { en: 'Match', he: 'לחבר' },
  listen: { en: 'Listen', he: 'להקשיב' },
};
