import { LETTERS } from './journey';

/**
 * The ABC song: the letters in the order of the alphabet, said in the groups of the tune (A B C D E F G - H I J K - L M N O P - Q R S -
 * T U V - W X - Y and Z), one letter on each beat and a beat of rest between the groups, and then "Now I know my ABC!".
 */
export const ABC_GROUPS: string[][] = [['a', 'b', 'c', 'd', 'e', 'f', 'g'], ['h', 'i', 'j', 'k'], ['l', 'm', 'n', 'o', 'p'], ['q', 'r', 's'], ['t', 'u', 'v'], ['w', 'x'], ['y', 'z']];
export const ABC_ENDING = 'Now I know my ABC!';

export interface AbcStep { at: number; letter?: string; group: number; text?: string }
/** When each letter is said (ms from the start), a count-in of one beat first. */
export function abcTimeline(beat = 640): AbcStep[] {
  const out: AbcStep[] = [];
  let t = beat;
  ABC_GROUPS.forEach((g, gi) => {
    g.forEach((letter) => {
      out.push({ at: t, letter, group: gi });
      t += beat;
    });
    t += Math.round(beat * 0.6); // a short rest between groups
  });
  out.push({ at: t + beat * 0.4, group: ABC_GROUPS.length, text: ABC_ENDING });
  return out;
}
export const alphabet = (): string[] => [...LETTERS.map((l) => l.id)].sort();
