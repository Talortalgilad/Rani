import { describe, expect, it } from 'vitest';
import { VERBS, WORDS, labelOf, pluralOf } from './content/words';
import { COLORS } from './content/colors';
import { SONGS } from './content/songs';
import { SENTENCES } from './content/sentences';
import { PAINT } from './content/paint';
import { nameOptions } from './content/lines';
import { SQUISHIES } from './art/squishies';
import { LETTERS, ISLANDS } from './letters/journey';
import { ABC_ENDING } from './letters/abc';
import { CARD_IMAGES } from '../memory/decks/cards';
import { DECKS } from '../memory/decks/index';
import { enClipIdOf, wordIdOf } from './voice';

const manifestRaw = (import.meta.glob('../../../public/english/voice/en/manifest.json', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)['../../../public/english/voice/en/manifest.json'];
const clips = new Set((JSON.parse(manifestRaw) as { clips: string[] }).clips);
const idOf = (t: string): string | null => wordIdOf(t) ?? enClipIdOf(t);

/** Everything the English game says in a fixed form (the instructions with a word in them, and the letter sounds, are not here). */
const FIXED = ["Let's go!", 'Let’s go!', 'Help! Help!', 'Great job!', 'Hmm, try again!', 'Almost! Try again!', 'Match!', 'Great try!', 'Can you say it again?', 'Make the sentence!', 'Which letter?', 'Which letter says this sound?', 'What starts with this sound?', 'Match big and small!', "Let's sing the ABC!", 'Let’s sing the ABC!', 'Read the word!', "Let's sing!", 'Let’s sing!', "Hello! I'm your friend. Let's play!", "I'm Bunny!", 'Which letter is missing?', ABC_ENDING];

describe('every English line of the game that is not a template has its recording', () => {
  const check = (what: string, texts: string[]): void => {
    for (const t of texts) {
      const id = idOf(t);
      expect(id, `${what}: "${t}" has no recording`).not.toBeNull();
      expect(clips.has(id!), `${what}: "${t}" -> ${id} is not in en/manifest.json`).toBe(true);
    }
  };
  it('fixed sentences, names of the squishies and of the companion, verbs, numbers, colours', () => {
    check('fixed', FIXED);
    check('squishies', SQUISHIES.map((s) => `I'm ${s.name}!`));
    check('names', nameOptions.map((n) => n.say));
    check('verbs', Object.values(VERBS).map((v) => v.en));
    check('numbers', Array.from({ length: 10 }, (_, i) => String(i + 1)));
    check('colours', COLORS.map((c) => c.id));
  });
  it('letters: the name (a capital), the word of the letter, the words to build', () => {
    check('letter names', LETTERS.map((l) => l.upper));
    check('letter words', LETTERS.map((l) => l.label));
    check('island words', ISLANDS.flatMap((i) => i.words));
  });
  it('the words of the songs, the sentences to build, the cards of the memory game, the paint, the plurals', () => {
    check('songs', Object.values(SONGS).flatMap((s) => s.lines.flat().map((w) => w.t.replace(/[,!]/g, ''))));
    check('sentences', SENTENCES.map((s) => s.words.join(' ')));
    check('cards', [...CARD_IMAGES, ...Object.values(DECKS).flatMap((d) => d.keys.map((k) => (k.includes(':') ? k.split(':')[1] : k)))].map((c) => labelOf(c)));
    check('paint', PAINT.map((p) => p.id));
    check('plurals', WORDS.map((w) => pluralOf(w.id)));
  });
  it('a letter and a word with the same sound are two recordings ("A" the letter, "a" the word)', () => {
    expect(idOf('A')).toBe('letter_a');
    expect(idOf('a')).toBe('a');
  });
});
