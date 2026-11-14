import { describe, expect, it } from 'vitest';
import { CARNIVAL_EN, CARNIVAL_LINES } from './lines';
import { ASKABLE, ITEMS } from './gen';
import { WORDS } from '../../../games/english/content/words';
import { wordIdOf } from '../../../games/english/voice';
import { CHATS } from './alerts';
import { HELLO_CLIP, opening } from './speak';

const manifest = (lang: 'he' | 'en'): Set<string> => {
  const files = import.meta.glob('../../../../public/english/voice/*/manifest.json', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  const raw = Object.entries(files).find(([k]) => k.includes(`/voice/${lang}/`))![1];
  return new Set((JSON.parse(raw) as { clips: string[] }).clips);
};
const he = manifest('he');
const en = manifest('en');

describe('the carnival lines have their recordings', () => {
  it('every Hebrew line (talks, items, numbers 1-20, "two" before a noun) has a recording; the one that has none is the name line', () => {
    const missing = CARNIVAL_LINES.filter((l) => l.parts.every((p) => p !== null)).filter((l) => !he.has(l.id)).map((l) => l.id);
    expect(missing).toEqual([]);
  });
  it('every item of a talk has its line, and so have all the numbers it can say', () => {
    for (const i of ITEMS) expect(he.has(`cv_item_${i.id}`), i.id).toBe(true);
    for (let n = 1; n <= 20; n++) expect(he.has(`cv_num_${n}`), String(n)).toBe(true);
    expect(he.has('cv_num_2c')).toBe(true);
  });
  it('every English line of the list, every small bubble and every whole hello has a recording; "Hello!" is the old clip', () => {
    for (const l of CARNIVAL_EN) expect(en.has(l.id), l.id).toBe(true);
    for (const c of CHATS) if (c.enId) expect(en.has(c.enId), c.enId).toBe(true);
    expect(en.has(HELLO_CLIP)).toBe(true);
    for (const id of ['cheesy', 'mozzi', 'horiko', 'popcheese']) expect(en.has(`carn_hello_im_${id}`), id).toBe(true);
    expect(en.has('carn_whats_your_name') && en.has('carn_what_is_it') && en.has('carn_thank_you_rani')).toBe(true);
  });
  it('the English opening of "can I have" is the two recordings around the word', () => {
    const ids = opening({ kind: 'can', word: 'cake' } as never).filter((p) => 'enc' in p).map((p) => ('enc' in p ? p.enc.id : ''));
    expect(ids).toEqual(['carn_can_i_have_the', 'carn_please']);
  });
});

describe('the word that "can I have" asks for is played from its recording', () => {
  it('every askable word has an English recording', () => {
    for (const id of ASKABLE) {
      const w = WORDS.find((x) => x.id === id)!;
      const rec = wordIdOf(w.label ?? w.id);
      expect(rec, id).not.toBeNull();
      expect(en.has(rec!), id).toBe(true);
    }
  });
});
