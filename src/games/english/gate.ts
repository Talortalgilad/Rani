import { WORDS, labelOf } from './content/words';
import type { Words } from './engine/progress';

/**
 * An English question for the gate before a game (SPEC-english.md section 9): "What did you hear?", three pictures, only words that
 * she has already met in the game. Null when she knows fewer than three (the gate then asks maths instead).
 */
export interface GateEnglish { word: string; say: string; choices: string[] }

export function englishGateQuestion(words: Words, rnd: () => number = Math.random): GateEnglish | null {
  const known = WORDS.filter((w) => words[w.id]?.seen).map((w) => w.id);
  if (known.length < 3) return null;
  const pool = [...known];
  const pick = (): string => pool.splice(Math.floor(rnd() * pool.length), 1)[0];
  const word = pick();
  const choices = [word, pick(), pick()];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return { word, say: labelOf(word), choices };
}
