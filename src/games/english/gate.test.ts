import { describe, expect, it } from 'vitest';
import { englishGateQuestion } from './gate';
import { friendsOnIsland } from './lobby-island';

const seen = (...ids: string[]) => Object.fromEntries(ids.map((id) => [id, { level: 1, due: 0, seen: true }]));

describe('English questions in the gate', () => {
  it('none until three words were met; then three different learned pictures with the answer among them', () => {
    expect(englishGateQuestion({})).toBeNull();
    expect(englishGateQuestion(seen('ball', 'bed'))).toBeNull();
    for (let i = 0; i < 50; i++) {
      const q = englishGateQuestion(seen('ball', 'bed', 'book', 'pizza', 'cat'))!;
      expect(new Set(q.choices).size).toBe(3);
      expect(q.choices).toContain(q.word);
      q.choices.forEach((c) => expect(['ball', 'bed', 'book', 'pizza', 'cat']).toContain(c));
    }
  });
  it('a word that was not met never shows up, and the spoken text is the label ("TV")', () => {
    const q = englishGateQuestion(seen('tv', 'ball', 'bed'), () => 0)!;
    expect(q.choices.sort()).toEqual(['ball', 'bed', 'tv']);
    expect(englishGateQuestion(seen('tv', 'ball', 'bed'), () => 0)!.say).toMatch(/TV|ball|bed/);
  });
});

describe('the lobby island', () => {
  it('shows the last six rescued squishies, in the order of the worlds', () => {
    expect(friendsOnIsland([])).toEqual([]);
    expect(friendsOnIsland(['Pizza', 'Bunny'])).toEqual(['bunny', 'pizza']);
    expect(friendsOnIsland(['Bunny', 'Pizza', 'Leafy', 'Rainbow', 'Cookie', 'Cloud', 'Panda'])).toEqual(['pizza', 'leafy', 'rainbow', 'cookie', 'cloud', 'panda']);
  });
});
