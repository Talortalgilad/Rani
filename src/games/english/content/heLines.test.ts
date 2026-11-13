import { describe, expect, it } from 'vitest';
import csv from '../../../../voice/he-lines.csv?raw';
import { VERBS } from './words';
import { HE_LINES, allClips, clipsOfWorld, linePartsFor, toCsv } from './heLines';
import { nameOptions } from './lines';

describe('the Hebrew lines with a recording', () => {
  it('every sentence and clip has its own fixed id', () => {
    expect(new Set(HE_LINES.map((l) => l.id)).size).toBe(HE_LINES.length);
    expect(new Set(allClips().map((c) => c.id)).size).toBe(allClips().length);
  });
  it('voice/he-lines.csv is up to date (npx vite-node scripts/export-he-lines.ts)', () => {
    expect(csv).toBe(toCsv());
  });
  it('a sentence with the name is cut round it; the four ready names have a clip, another name is read by the phone', () => {
    expect(linePartsFor('proud', 'מוצי')).toEqual([{ clip: 'name.mozzi', text: 'מוצי', lang: 'he' }, { clip: 'proud.1', text: 'גאה בך!', lang: 'he' }]);
    expect(linePartsFor('proud', 'דנדון')[0]).toEqual({ text: 'דנדון', lang: 'he' });
    expect(linePartsFor('rescued', 'Panda').map((p) => p.lang)).toEqual(['he', 'en', 'he']);
    expect(linePartsFor('nothing')).toEqual([]);
    for (const n of nameOptions) expect(linePartsFor('proud', n.name)[0].clip, n.name).toMatch(/^name\./);
  });
  it('every verb has its help sentence, and every clip belongs to a world that is fetched', () => {
    for (const k of Object.keys(VERBS)) expect(HE_LINES.some((l) => l.id === `verb_${k}`), k).toBe(true);
    const total = [0, ...Array.from({ length: 12 }, (_, i) => i + 1)].flatMap(clipsOfWorld).length;
    expect(total).toBe(allClips().length);
  });
});
