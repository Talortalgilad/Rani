/**
 * Saying a talk aloud: Hebrew pieces from the recordings (the numbers 1-20 are lines of their own; before a noun, "two" is "שתי"), English as whole clips
 * (an opening, a hello with a name) or an opening and then the recording of the word. Until the English clips are recorded, the voice of the phone says
 * them. A new thing said cuts the old one.
 */
import { linePartsFor } from '../../../games/english/content/heLines';
import { playWord, speakEn, speakHeLine, stopSpeech } from '../../../games/english/voice';
import { ITEMS, type Item, type Talk } from './gen';
import { cv } from './lines';
import type { Resident } from '../residents';

/** `before`: the number is followed by a noun ("two" is then "שתי"). A number alone (counting, "I ate one") is the plain line. */
export type Piece = { he: string } | { num: number; before?: boolean } | { item: Item } | { en: string } | { word: string } | { enc: { id: string; text: string } };

/** The line of a number: before a noun, 2 is cv_num_2c; everything else is cv_num_N. */
export const numberLine = (n: number, before = false): string => (before && n === 2 ? 'cv_num_2c' : `cv_num_${n}`);

let token = 0;
/** One English clip: the recording (public/english/voice/en/<id>.mp3) if there is one, else the voice of the phone says the text. */
export async function speakClip(id: string, text: string): Promise<void> {
  stopSpeech();
  if (!(await playWord(id).catch(() => false))) await speakEn(text);
}

/** Says the pieces one after the other. Stops when something newer is said. */
export async function say(pieces: Piece[]): Promise<void> {
  const mine = ++token;
  stopSpeech();
  for (const p of pieces) {
    if (mine !== token) return;
    if ('he' in p) await speakHeLine(linePartsFor(p.he));
    else if ('num' in p) await speakHeLine(linePartsFor(numberLine(p.num, p.before)));
    else if ('item' in p) await speakHeLine(linePartsFor(`cv_item_${p.item.id}`));
    else if ('enc' in p) await speakClip(p.enc.id, p.enc.text);
    else if ('en' in p) await speakEn(p.en);
    else await speakEn(p.word);
  }
}
export const quiet = (): void => {
  token++;
  stopSpeech();
};

/** "Hello!" is the clip that already exists (no recording of its own) */
export const HELLO_CLIP = 'hello';
export const WHATS_YOUR_NAME = { id: 'carn_whats_your_name', text: "What's your name?" };
/** What a talk says when it opens. `who` is the resident that talks (a fixed name has its own whole clip). */
export function opening(t: Talk, who?: Pick<Resident, 'id' | 'fixed' | 'name'>, enName = ''): Piece[] {
  switch (t.kind) {
    case 'together':
      return [{ he: 'cv_have' }, { num: t.a, before: true }, { item: t.item }, { he: 'cv_got' }, { num: t.b, before: true }, { item: t.item }, { he: 'cv_howmany' }];
    case 'exact':
      return [{ he: 'cv_want' }, { num: t.n, before: true }, { item: t.item }];
    case 'more':
      return [{ he: t.ask === 'more' ? 'cv_more' : 'cv_less' }];
    case 'missing':
      // "I ate one": the number alone; "I ate two cookies": before the noun
      return [{ he: 'cv_had' }, { num: t.a, before: true }, { item: t.item }, { he: 'cv_ate' }, ...(t.b === 1 ? [{ num: 1 }] : [{ num: t.b, before: true }, { item: t.item }]), { he: 'cv_left' }];
    case 'can':
      return [{ en: 'Can I have the' }, { word: t.word }, { en: 'please?' }];
    case 'what':
      return [{ enc: { id: 'carn_what_is_it', text: 'What is it?' } }];
    case 'hello':
      // a friend with a fixed name has his own whole clip; the friend that Rani named says a plain hello
      return who?.fixed
        ? [{ enc: { id: `carn_hello_im_${who.id}`, text: `Hello! I'm ${enName || t.self}` } }, { enc: WHATS_YOUR_NAME }]
        : [{ enc: { id: HELLO_CLIP, text: 'Hello!' } }, { enc: WHATS_YOUR_NAME }];
  }
}
export const items = ITEMS;
export const textOf = (id: keyof typeof cv): string => cv[id];
