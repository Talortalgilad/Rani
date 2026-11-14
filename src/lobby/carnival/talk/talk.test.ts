import { describe, expect, it } from 'vitest';
import { levelConfig } from '../../../math/levels';
import type { Words } from '../../../games/english/engine/progress';
import { ALERT_WAIT, CHATS, Chatter, FIRST_WAIT, MAX_ALERTS, answered, freshAlerts, nearCentre, tickAlerts } from './alerts';
import { MATH_KINDS, SUBJECT, learnedWords, makeTalk, nextKind, rng, validTalk, type TalkEnv, type TalkKind } from './gen';
import { CARNIVAL_EN, CARNIVAL_LINES } from './lines';
import { emptySave, loadSave, writeSave } from './state';
import { opening } from './speak';
import { linePartsFor } from '../../../games/english/content/heLines';

const word = (level: number, due: number, seen = true): Words[string] => ({ level, due, seen });
const env = (level: number, words: Words = {}): TalkEnv => ({ level, words, today: 100, name: 'רני', otherNames: ['דני', 'נועה', 'תמר'], resident: 'מוצי' });
const MANY: Words = { apple: word(1, 90), ball: word(2, 99), cake: word(3, 120), bed: word(1, 100), doll: word(4, 130), pizza: word(2, 80), unseenword: { level: 0, due: 0, seen: false } };

describe('the questions', () => {
  it('every maths question is inside the level and has exactly one right answer (all levels, 3000 seeds)', () => {
    for (let level = 1; level <= 5; level++)
      for (const kind of MATH_KINDS)
        for (let seed = 1; seed <= 150; seed++) {
          const t = makeTalk(kind, seed * 7919 + level, env(level))!;
          expect(t, `${kind} ${level} ${seed}`).not.toBeNull();
          expect(validTalk(t, level), `${kind} level ${level} seed ${seed}: ${JSON.stringify(t)}`).toBe(true);
          if (t.kind === 'together' || t.kind === 'missing') for (const c of t.choices) expect(c).toBeLessThanOrEqual(levelConfig(level).max);
        }
  });

  it('level 4 does not cross a ten', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const a = makeTalk('together', seed, env(4)) as { a: number; b: number };
      expect((a.a % 10) + (a.b % 10)).toBeLessThan(10);
      const m = makeTalk('missing', seed, env(4)) as { a: number; b: number };
      expect(m.a % 10).toBeGreaterThanOrEqual(m.b % 10);
    }
  });

  it('English talks use only words that were learned, the due ones first', () => {
    const order = learnedWords(MANY, 100);
    expect(order).not.toContain('unseenword');
    expect(order.slice(0, 3)).toEqual(['pizza', 'apple', 'ball']);
    for (let seed = 1; seed <= 300; seed++) for (const kind of ['can', 'what'] as TalkKind[]) {
      const t = makeTalk(kind, seed, env(3, MANY))!;
      expect(validTalk(t, 3)).toBe(true);
      if (t.kind === 'can' || t.kind === 'what') for (const o of t.options) expect(order).toContain(o);
    }
  });

  it('with too few words learned, only Hello (and maths)', () => {
    expect(makeTalk('can', 1, env(3, { apple: word(1, 90), ball: word(1, 90) }))).toBeNull();
    expect(makeTalk('what', 1, env(3, { apple: word(1, 90) }))).toBeNull();
    expect(makeTalk('what', 1, env(3, {}))).toBeNull();
    for (let seed = 1; seed <= 50; seed++) expect(nextKind({ last: 'math', retry: [] }, { words: {}, today: 100 }, seed)).toBe('hello');
    const h = makeTalk('hello', 5, env(1))!;
    expect(validTalk(h, 1)).toBe(true);
    expect(h.kind === 'hello' && h.names[h.answer]).toBe('רני');
  });

  it('maths and English come in turn, and a talk that went wrong comes back', () => {
    const e = { words: MANY, today: 100 };
    expect(SUBJECT[nextKind({ last: null, retry: [] }, e, 1)]).toBe('math');
    expect(SUBJECT[nextKind({ last: 'math', retry: [] }, e, 2)]).toBe('english');
    expect(SUBJECT[nextKind({ last: 'english', retry: [] }, e, 3)]).toBe('math');
    expect(nextKind({ last: 'english', retry: ['missing'] }, e, 4)).toBe('missing');
    expect(nextKind({ last: 'math', retry: ['what'] }, e, 5)).toBe('what');
    // a retry of English with no words is not taken
    expect(nextKind({ last: 'math', retry: ['can'] }, { words: {}, today: 100 }, 6)).toBe('hello');
  });

  it('what is said: numbers are separate lines 1-20, English is an opening and then the word', () => {
    for (let n = 1; n <= 20; n++) expect(CARNIVAL_LINES.some((l) => l.id === `cv_num_${n}`)).toBe(true);
    const t = makeTalk('together', 3, env(2))!;
    const ids = opening(t).filter((p) => 'he' in p || 'num' in p);
    expect(ids.length).toBeGreaterThan(3);
    for (const p of opening(t)) if ('he' in p) expect(linePartsFor(p.he).length).toBeGreaterThan(0);
    const c = makeTalk('can', 3, env(3, MANY))!;
    expect(opening(c).map((p) => ('en' in p ? p.en : 'word' in p ? 'WORD' : '?'))).toEqual(['Can I have the', 'WORD', 'please?']);
    expect(CARNIVAL_EN.map((x) => x.text)).toContain('Can I have the');
  });
});

describe('the bubbles', () => {
  it('"!" bubbles: never more than two, the first after a few seconds, a new one half a minute after one was answered, an ignored one stays', () => {
    const s = freshAlerts();
    let t = 0;
    const spawn: number[] = [];
    for (let i = 0; i < 4000; i++) {
      const a = tickAlerts(s, 0.1, 5, i + 1);
      t += 0.1;
      if (a) spawn.push(Math.round(t));
      expect(s.alerts.length).toBeLessThanOrEqual(MAX_ALERTS);
    }
    // two appeared (the second half a minute after the first) and no more while both are ignored
    expect(spawn).toHaveLength(2);
    expect(spawn[0]).toBeGreaterThanOrEqual(FIRST_WAIT - 1);
    expect(spawn[1] - spawn[0]).toBeGreaterThanOrEqual(ALERT_WAIT - 1);
    expect(s.alerts).toHaveLength(2);
    expect(new Set(s.alerts.map((a) => a.r)).size).toBe(2);
    // one is answered: the next one is half a minute later
    answered(s, s.alerts[0].r);
    expect(s.alerts).toHaveLength(1);
    let again = -1;
    for (let i = 0; i < 400; i++) if (tickAlerts(s, 0.1, 5, 9 + i)) {
      again = (i + 1) / 10;
      break;
    }
    expect(again).toBeGreaterThanOrEqual(ALERT_WAIT - 0.2);
    expect(again).toBeLessThan(ALERT_WAIT + 1);
  });

  it('nothing new while a talk is open', () => {
    const s = freshAlerts();
    for (let i = 0; i < 300; i++) expect(tickAlerts(s, 0.1, 5, i, true)).toBeNull();
    expect(s.alerts).toHaveLength(0);
  });

  it('small bubbles: one resident at a time, every few seconds, never the same one twice', () => {
    const c = new Chatter(rng(3), 1);
    const got: { r: number; at: number }[] = [];
    for (let i = 0; i < 6000; i++) {
      const e = c.tick(0.05, 5);
      if (e) got.push({ r: e.r, at: i * 0.05 });
    }
    expect(got.length).toBeGreaterThan(30);
    for (let i = 1; i < got.length; i++) {
      expect(got[i].r).not.toBe(got[i - 1].r);
      expect(got[i].at - got[i - 1].at).toBeGreaterThanOrEqual(3.9);
    }
    // not for the ones with a "!" bubble
    const c2 = new Chatter(rng(4), 0.1);
    for (let i = 0; i < 4000; i++) expect(c2.tick(0.05, 5, [0, 1, 2])?.r ?? 3).toBeGreaterThanOrEqual(3);
    expect(CHATS.some((x) => x.en) && CHATS.some((x) => x.he)).toBe(true);
  });

  it('the sound is for those near the middle of the screen', () => {
    expect(nearCentre(195, 390, 390, 780)).toBe(true);
    expect(nearCentre(20, 390, 390, 780)).toBe(false);
    expect(nearCentre(195, 40, 390, 780)).toBe(false);
  });
});

describe('what is remembered', () => {
  const mem = (): { s: Map<string, string>; getItem(k: string): string | null; setItem(k: string, v: string): void } => {
    const s = new Map<string, string>();
    return { s, getItem: (k) => s.get(k) ?? null, setItem: (k, v) => void s.set(k, v) };
  };
  it('hearts and bubbles are kept; unreadable or foreign data starts again', () => {
    const m = mem();
    expect(loadSave(m)).toEqual(emptySave());
    const s = emptySave();
    s.hearts = 7;
    s.alerts.alerts.push({ r: 2, seed: 9 });
    s.alerts.wait = 12;
    s.retry = ['can'];
    writeSave(s, m);
    expect(loadSave(m)).toEqual(s);
    m.setItem('rani-carnival-v1', '{nonsense');
    expect(loadSave(m)).toEqual(emptySave());
    m.setItem('rani-carnival-v1', JSON.stringify({ v: 9, hearts: 99 }));
    expect(loadSave(m).hearts).toBe(0);
  });
});
