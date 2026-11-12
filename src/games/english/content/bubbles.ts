import { SQUISHIES } from '../art/squishies';
import { COLORS } from './colors';
import { he } from './lines';
import { VERBS, WORDS, labelOf } from './words';

/** Every Hebrew line that Cheesy says in a speech bubble, with an English or a Hebrew name where a name goes. Used by the tests. */
export function allBubbleTexts(): string[] {
  const names = ['צ׳יזי', 'Cheesy', 'Pop Cheese', 'מוצי'];
  const out: string[] = [he.askName, he.start, he.newWords, he.cardTap, he.tryAgain, he.show, he.great, 'שמעת? מישהו קורא לעזרה!', 'כל הכבוד!'];
  for (const n of names) out.push(he.iAm(n), he.islandTitle(n), he.proud(n), he.rescued(n));
  for (const v of Object.values(VERBS)) out.push(he.verb(v.en, v.he), `זה ${v.he}!`);
  for (const w of WORDS) out.push(`${labelOf(w.id)} = ${w.he}`);
  for (const c of COLORS) out.push(`${c.id} = ${c.he}`);
  for (const s of SQUISHIES) out.push(`I'm ${s.name}!`);
  out.push('Hmm, try again!', 'Great job!');
  return out;
}
