import { describe, expect, it } from 'vitest';
import { WORDS, labelOf } from './content/words';
import { wordIdOf } from './voice';

// the recordings of the words (public/english/voice/en): the manifest and the files
const manifestRaw = (import.meta.glob('../../../public/english/voice/en/manifest.json', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)['../../../public/english/voice/en/manifest.json'];
const files = Object.keys(import.meta.glob('../../../public/english/voice/en/*.mp3')).map((f) => f.split('/').pop()!.replace(/\.mp3$/, ''));

describe('the recorded English words', () => {
  it('every word of the game is found by its label, its id, or the way it was recorded ("Ice cream.")', () => {
    for (const w of WORDS) {
      expect(wordIdOf(labelOf(w.id)), w.id).toBe(w.id);
      expect(wordIdOf(w.id), w.id).toBe(w.id);
      expect(wordIdOf(`${labelOf(w.id)[0].toUpperCase()}${labelOf(w.id).slice(1)}.`), w.id).toBe(w.id);
    }
  });

  it('a sentence, a name, or a word of the letters journey (no recording yet) is not one of the 108 words: the phone reads those', () => {
    for (const t of ["Let's go!", 'Great job!', "I'm Bunny!", 'Hello! I\'m your friend. Let\'s play!', 'yo-yo', 'zebra', '']) expect(wordIdOf(t), t).toBeNull();
  });

  it('every word has its file, and the manifest lists exactly the files', () => {
    const clips = (JSON.parse(manifestRaw) as { clips: string[] }).clips;
    for (const w of WORDS) expect(clips, w.id).toContain(w.id);
    expect([...clips].sort()).toEqual([...files].sort());
  });
});
