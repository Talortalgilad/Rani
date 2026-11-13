import type { Words } from '../engine/progress';
import { letterById } from './journey';
import { learnedLetters } from './stats';

/**
 * A letters question for the gate before a game (SPEC-letters.md section 6): "Which letter says /m/?": the sound is played, three letters,
 * only letters that she has learned. Null when she knows fewer than three (the gate then asks something else).
 */
export interface GateLetter { letter: string; word: string; choices: string[] }
export function letterGateQuestion(words: Words, rnd: () => number = Math.random): GateLetter | null {
  const known = learnedLetters(words);
  if (known.length < 3) return null;
  const pool = [...known];
  const pick = (): string => pool.splice(Math.floor(rnd() * pool.length), 1)[0];
  const letter = pick();
  const choices = [letter, pick(), pick()];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return { letter, word: letterById(letter).label, choices };
}

/** What a gate setting asks, in turn. ("both" is what the setting was before letters: maths and English.) */
export type GateKind = 'math' | 'english' | 'letters';
export function gateKinds(setting: string): GateKind[] {
  switch (setting) {
    case 'english': return ['english'];
    case 'letters': return ['letters'];
    case 'both': return ['math', 'english'];
    case 'all': return ['math', 'english', 'letters'];
    default: return ['math'];
  }
}
