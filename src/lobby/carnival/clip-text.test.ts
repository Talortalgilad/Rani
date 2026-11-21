import { describe, expect, it } from 'vitest';
import REVIEW from '../../../public/english/voice/he/_review.json';
import HE from '../../../public/english/voice/he/manifest.json';
import { CARNIVAL_LINES } from './talk/lines';
import { CS_LINES } from './csLines';
import { QUESTS, questLine } from './quests';
import { allClips } from '../../games/english/content/heLines';

const review = new Map((REVIEW as { id: string; text: string }[]).map((r) => [r.id, r.text]));
const recorded = new Set((HE as { clips: string[] }).clips);

/** a clip is found by its ID (never by the number of its row), and the text that the clip was recorded with is the text on the screen */
describe('the text of a line and the text of its recording are the same', () => {
  it('each of the quests: the clip of qs_<id> exists, and its text (_review.json) is the sentence on the screen', () => {
    for (const q of QUESTS) {
      const id = questLine(q);
      expect(id).toBe(`qs_${q.id}`);
      expect(recorded.has(id), `${id} has a clip`).toBe(true);
      expect(review.get(id), `${id}: the text of the clip`).toBe(q.he);
    }
  });
  it('every line of the carnival (talk lines and cs_ lines) that has a recording with a known text is recorded with the very text of the app', () => {
    const bad: string[] = [];
    for (const l of CARNIVAL_LINES) {
      if (l.parts.some((p) => p === null)) continue;
      const t = review.get(l.id);
      if (t !== undefined && t !== l.parts.join(' ')) bad.push(`${l.id}: app "${l.parts.join(' ')}" / clip "${t}"`);
    }
    for (const l of CS_LINES) {
      const t = review.get(l.id);
      if (t !== undefined && t !== l.text) bad.push(`${l.id}: app "${l.text}" / clip "${t}"`);
    }
    expect(bad).toEqual([]);
  });
  it('every line of the English game (he-lines) that has a recording with a known text is recorded with the very text of the app', () => {
    const bad: string[] = [];
    for (const l of allClips() as { id: string; text: string }[]) {
      const t = review.get(l.id);
      if (t !== undefined && t !== l.text) bad.push(`${l.id}: app "${l.text}" / clip "${t}"`);
    }
    expect(bad).toEqual([]);
  });
  it('adding a quest does not move any voice: the clip of a quest depends on its id only', () => {
    const a = QUESTS.map((q) => questLine(q));
    expect(new Set(a).size).toBe(a.length);
    expect(a.every((id, i) => id === `qs_${QUESTS[i].id}`)).toBe(true);
  });
});
