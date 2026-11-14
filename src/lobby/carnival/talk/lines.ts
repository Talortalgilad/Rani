/** The Hebrew of the talks, each with an id (recorded like the other lines: src/games/english/content/heLines.ts takes this list). The numbers 1-20 are separate lines. */
import { numberToHebrew } from '../../../math/hebrew';
import { ITEMS } from './gen';

export const cv = {
  have: 'יש לי',
  got: 'וקיבלתי עוד',
  howmany: 'כמה יש לי בסך הכול?',
  want: 'אני רוצה',
  more: 'למי יש יותר?',
  less: 'למי יש פחות?',
  had: 'היו לי',
  ate: 'ואכלתי',
  left: 'כמה נשארו?',
  enough: 'זה מספיק',
  thanks: 'תודה רבה!',
  great: 'יופי!',
  almost: 'כמעט! בואי נספור יחד.',
  tryagain: 'עכשיו נסי שוב.',
  rani: 'רני! רני!',
  tapthis: 'הקישי על מה שהוא מבקש.',
  tapword: 'הקישי על המילה הנכונה.',
  tapname: 'הקישי על השם שלך.',
  chat_hi: 'היי רני!',
  chat_day: 'איזה יום יפה!',
  chat_play: 'בואי נשחק!',
  chat_fun: 'כיף לי כאן!',
  hearts: 'לבבות',
};
export const CARNIVAL_LINES: { id: string; parts: (string | null)[] }[] = [
  { id: 'carnival_name', parts: [null] },
  ...(Object.keys(cv) as (keyof typeof cv)[]).map((k) => ({ id: `cv_${k}`, parts: [cv[k]] })),
  ...ITEMS.map((i) => ({ id: `cv_item_${i.id}`, parts: [i.he] })),
  ...Array.from({ length: 20 }, (_, i) => ({ id: `cv_num_${i + 1}`, parts: [numberToHebrew(i + 1)] })),
];

/** The English sentences of the talks, for the list that goes to the recording (the opening of a sentence is fixed; the word after it is the recording of the word). */
export const CARNIVAL_EN: { id: string; text: string; note: string }[] = [
  { id: 'carn_can_i_have_the', text: 'Can I have the', note: 'opening, then the word' },
  { id: 'carn_please', text: 'please?', note: 'after the word' },
  { id: 'carn_what_is_it', text: 'What is it?', note: 'whole' },
  { id: 'carn_hello_im', text: "Hello! I'm", note: 'opening, then the name (Cheesy, Mozzi, Horiko, Pop Cheese)' },
  { id: 'carn_whats_your_name', text: "What's your name?", note: 'after the name' },
  { id: 'carn_hello', text: 'Hello!', note: 'small bubble (already recorded)' },
  { id: 'carn_i_love_pizza', text: 'I love pizza!', note: 'small bubble' },
  { id: 'carn_hi_rani', text: 'Hi Rani!', note: 'small bubble' },
  { id: 'carn_nice_day', text: 'Nice day!', note: 'small bubble' },
];
