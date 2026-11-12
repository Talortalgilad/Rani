/** Sentences for "build a sentence" (from world 6): 2-4 words each, with the picture that shows the meaning. Uses what Rani likes. */
export interface Sentence { world: number; words: string[]; picture: string }
export const SENTENCES: Sentence[] = [
  { world: 6, words: ['I', 'love', 'mom'], picture: 'mom' },
  { world: 6, words: ['I', 'love', 'dad'], picture: 'dad' },
  { world: 6, words: ['Ray', 'is', 'my', 'brother'], picture: 'brother' },
  { world: 6, words: ['This', 'is', 'my', 'family'], picture: 'family' },
  { world: 6, words: ['We', 'are', 'friends'], picture: 'friends' },
  { world: 7, words: ['I', 'like', 'my', 'dress'], picture: 'dress' },
  { world: 7, words: ['The', 'hat', 'is', 'yellow'], picture: 'hat' },
  { world: 8, words: ['I', 'can', 'dance'], picture: 'dance' },
  { world: 8, words: ['I', 'can', 'sing'], picture: 'sing' },
  { world: 9, words: ['The', 'sun', 'is', 'hot'], picture: 'sun' },
  { world: 10, words: ['I', 'like', 'cats'], picture: 'cat' },
  { world: 11, words: ['I', 'can', 'jump'], picture: 'jump' },
  { world: 12, words: ['I', 'like', 'pizza'], picture: 'pizza' },
  { world: 12, words: ['I', 'ride', 'my', 'bike'], picture: 'bike' },
];
export const sentencesFor = (world: number): Sentence[] => {
  const own = SENTENCES.filter((s) => s.world === world);
  return own.length ? own : SENTENCES.filter((s) => s.world <= world);
};
