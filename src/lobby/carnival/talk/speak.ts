/**
 * Saying a talk aloud: Hebrew pieces from the recordings (the numbers 1-20 are lines of their own), English as a fixed opening and then the
 * recording of the word. Until the English openings are recorded, the voice of the phone says them. A new thing said cuts the old one.
 */
import { linePartsFor } from '../../../games/english/content/heLines';
import { speakEn, speakHeLine, stopSpeech } from '../../../games/english/voice';
import { ITEMS, type Item, type Talk } from './gen';
import { cv } from './lines';

export type Piece = { he: string } | { num: number } | { item: Item } | { en: string } | { word: string };

let token = 0;
/** Says the pieces one after the other. Stops when something newer is said. */
export async function say(pieces: Piece[]): Promise<void> {
  const mine = ++token;
  stopSpeech();
  for (const p of pieces) {
    if (mine !== token) return;
    if ('he' in p) await speakHeLine(linePartsFor(p.he));
    else if ('num' in p) await speakHeLine(linePartsFor(`cv_num_${p.num}`));
    else if ('item' in p) await speakHeLine(linePartsFor(`cv_item_${p.item.id}`));
    else if ('en' in p) await speakEn(p.en);
    else await speakEn(p.word);
  }
}
export const quiet = (): void => {
  token++;
  stopSpeech();
};

/** What a talk says when it opens. */
export function opening(t: Talk, name = ''): Piece[] {
  switch (t.kind) {
    case 'together':
      return [{ he: 'cv_have' }, { num: t.a }, { item: t.item }, { he: 'cv_got' }, { num: t.b }, { item: t.item }, { he: 'cv_howmany' }];
    case 'exact':
      return [{ he: 'cv_want' }, { num: t.n }, { item: t.item }];
    case 'more':
      return [{ he: t.ask === 'more' ? 'cv_more' : 'cv_less' }];
    case 'missing':
      return [{ he: 'cv_had' }, { num: t.a }, { item: t.item }, { he: 'cv_ate' }, { num: t.b }, { item: t.item }, { he: 'cv_left' }];
    case 'can':
      return [{ en: 'Can I have the' }, { word: t.word }, { en: 'please?' }];
    case 'what':
      return [{ en: 'What is it?' }];
    case 'hello':
      return [{ en: "Hello! I'm" }, { en: name || t.self }, { en: "What's your name?" }];
  }
}
export const items = ITEMS;
export const textOf = (id: keyof typeof cv): string => cv[id];
