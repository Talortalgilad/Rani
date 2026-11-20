import { describe, expect, it } from 'vitest';
import HE from '../../../public/english/voice/he/manifest.json';
import EN from '../../../public/english/voice/en/manifest.json';
import { CARNIVAL_EN, CARNIVAL_LINES } from './talk/lines';
import { QUESTS } from './quests';
import LATER from './quests-later.json';

const he = new Set((HE as { clips: string[] }).clips);
const en = new Set((EN as { clips: string[] }).clips);

describe('the voice of the carnival: nothing is left to the phone', () => {
  it('every Hebrew line of the carnival has a recording (the only exception is the name that Rani chose, which has no line)', () => {
    const missing = CARNIVAL_LINES.filter((l) => l.parts.some((p) => p !== null) && !he.has(l.id)).map((l) => l.id);
    expect(missing).toEqual([]);
  });
  it('the quests of stage 2 are recorded, and the 24 of the later stages are in the list and the manifest (seven of them are quests of stage 3 now)', () => {
    for (const q of QUESTS) expect(he.has(`qs_${q.id}`), q.id).toBe(true);
    expect(LATER).toHaveLength(24);
    for (const l of LATER) {
      expect(he.has(l.id), l.id).toBe(true);
      expect(CARNIVAL_LINES.some((x) => x.id === l.id), l.id).toBe(true);
    }
    // stage 3 built nine of the 24 (friend, trick, job, hat, remember, party, lolly, workshop, order); the other 15 are for stages 4-5
    expect(QUESTS).toHaveLength(19);
  });
  it('every English sentence of the carnival has a recording', () => {
    for (const l of CARNIVAL_EN) expect(en.has(l.id), l.id).toBe(true);
  });
});
