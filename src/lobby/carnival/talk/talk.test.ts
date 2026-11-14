import { describe, expect, it } from 'vitest';
import { levelConfig } from '../../../math/levels';
import type { Words } from '../../../games/english/engine/progress';
import { ALERT_WAIT, CHATS, Chatter, FIRST_WAIT, MAX_ALERTS, answered, freshAlerts, nearCentre, tickAlerts } from './alerts';
import { ITEMS, MATH_KINDS, SUBJECT, learnedWords, makeTalk, nextKind, rng, validTalk, type TalkEnv, type TalkKind } from './gen';
import { CARNIVAL_EN, CARNIVAL_LINES } from './lines';
import { emptySave, loadSave, writeSave } from './state';
import { ALT_NAMES } from '../residents';
import { numberLine, opening } from './speak';
import { WORDS } from '../../../games/english/content/words';
import { ASKABLE } from './gen';
import { linePartsFor } from '../../../games/english/content/heLines';

const word = (level: number, due: number, seen = true): Words[string] => ({ level, due, seen });
const env = (level: number, words: Words = {}): TalkEnv => ({ level, words, today: 100, name: 'רני', otherNames: ['דני', 'נועה', 'תמר'], resident: 'מוצי' });
const MANY: Words = { apple: word(1, 90), ball: word(2, 99), cake: word(3, 120), bed: word(1, 100), doll: word(4, 130), pizza: word(2, 80), unseenword: { level: 0, due: 0, seen: false }, mom: word(1, 50), run: word(1, 50), rain: word(1, 50) };

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
    expect(opening(c).map((p) => ('enc' in p ? p.enc.text : 'word' in p ? 'WORD' : '?'))).toEqual(['Can I have the', 'WORD', 'please?']);
    expect(CARNIVAL_EN.map((x) => x.text)).toContain('Can I have the');
  });
});

describe('the rules of the new corrections', () => {
  it('askable words: no verbs, no family, no weather; and only those are asked', () => {
    for (const w of WORDS) {
      if (w.world === 6 || w.world === 8 || ['sun', 'cloud', 'rain', 'snowflake', 'wind', 'rainbow', 'storm'].includes(w.id)) expect(w.askable, w.id).toBe(false);
      else expect(w.askable, w.id).toBe(true);
    }
    expect(ASKABLE.has('apple') && ASKABLE.has('umbrella') && !ASKABLE.has('mom') && !ASKABLE.has('run') && !ASKABLE.has('rain')).toBe(true);
    // mom, run and rain were learned, and are never asked
    expect(learnedWords(MANY, 100)).not.toContain('mom');
    for (let seed = 1; seed <= 300; seed++) for (const kind of ['can', 'what'] as TalkKind[]) {
      const t = makeTalk(kind, seed, env(3, MANY))!;
      if (t.kind === 'can' || t.kind === 'what') for (const o of t.options) expect(ASKABLE.has(o), o).toBe(true);
    }
  });

  it('Hebrew numbers: before a noun two is "שתי" (cv_num_2c), one is never said before a plural noun, a number alone is the plain line', () => {
    expect(numberLine(2, true)).toBe('cv_num_2c');
    expect(numberLine(2)).toBe('cv_num_2');
    expect(numberLine(3, true)).toBe('cv_num_3');
    expect(CARNIVAL_LINES.find((l) => l.id === 'cv_num_2c')?.parts).toEqual(['שתי']);
    for (let level = 1; level <= 5; level++) for (const kind of ['together', 'exact', 'missing'] as TalkKind[]) for (let seed = 1; seed <= 200; seed++) {
      const t = makeTalk(kind, seed, env(level))!;
      const ps = opening(t);
      ps.forEach((p, i) => {
        const next = ps[i + 1];
        if ('num' in p && next && 'item' in next) {
          // a number before a noun: 2 or more, and 2 is the "before" form
          expect(p.num, `${kind} ${JSON.stringify(t)}`).toBeGreaterThanOrEqual(2);
          expect(p.before).toBe(true);
          expect(numberLine(p.num, p.before)).toBe(p.num === 2 ? 'cv_num_2c' : `cv_num_${p.num}`);
        }
        // the number that stands alone ("I ate one") is the plain line
        if ('num' in p && !(next && 'item' in next)) expect(numberLine(p.num, p.before)).toBe(`cv_num_${p.num}`);
      });
    }
    // "I ate one" has no noun after it
    const one = { kind: 'missing', a: 3, b: 1, item: { id: 'cookie', emoji: '🍪', he: 'עוגיות' }, answer: 2, choices: [1, 2, 3] } as const;
    expect(opening(one as never).some((p) => 'num' in p && p.num === 1 && !p.before)).toBe(true);
  });

  it('Hello: a fixed name has its whole clip, then "What\'s your name?"; the friend that Rani named says Hello', () => {
    const t = makeTalk('hello', 1, env(1))!;
    const fixed = opening(t, { id: 'mozzi', fixed: true, name: 'מוצי' }, 'Mozzi').map((p) => ('enc' in p ? p.enc.id : '?'));
    expect(fixed).toEqual(['carn_hello_im_mozzi', 'carn_whats_your_name']);
    const mine = opening(t, { id: 'companion', fixed: false, name: 'לילה' }).map((p) => ('enc' in p ? p.enc.id : '?'));
    expect(mine).toEqual(['hello', 'carn_whats_your_name']);
    for (const id of ['cheesy', 'mozzi', 'horiko', 'popcheese']) expect(CARNIVAL_EN.some((x) => x.id === `carn_hello_im_${id}`)).toBe(true);
    for (const id of ['carn_lets_play', 'carn_i_am_hungry', 'carn_i_like_ice_cream', 'carn_look_at_me', 'carn_thank_you_rani']) expect(CARNIVAL_EN.some((x) => x.id === id), id).toBe(true);
    expect(CHATS.filter((c) => c.enId).map((c) => c.enId)).toEqual(expect.arrayContaining(['carn_lets_play', 'carn_i_am_hungry', 'carn_i_like_ice_cream', 'carn_look_at_me']));
  });

  it('"who has more": from level 3 the piles differ by 1 to 3', () => {
    for (let level = 1; level <= 5; level++) for (let seed = 1; seed <= 300; seed++) {
      const t = makeTalk('more', seed, env(level))!;
      expect(validTalk(t, level)).toBe(true);
      if (t.kind === 'more' && level >= 3) expect(Math.abs(t.a - t.b)).toBeLessThanOrEqual(3);
    }
  });
});

describe('the second round of corrections', () => {
  it('"what is missing" is only about food; cars stay in the other maths talks', () => {
    const seen = new Set<string>();
    for (let level = 1; level <= 5; level++) for (let seed = 1; seed <= 400; seed++) {
      const m = makeTalk('missing', seed, env(level))!;
      if (m.kind === 'missing') {
        expect(m.item.food, m.item.id).toBe(true);
        expect(m.item.id).not.toBe('car');
      }
      for (const k of ['together', 'exact', 'more'] as TalkKind[]) {
        const t = makeTalk(k, seed, env(level))!;
        if ('item' in t) seen.add(t.item.id);
      }
    }
    expect(seen.has('car')).toBe(true);
    expect(ITEMS.filter((i) => !i.food).map((i) => i.id)).toEqual(['car']);
  });

  it('never more than two "!" bubbles, in a long simulation: talks, leaving for a game and coming back, a switch of tier (the save is read again)', () => {
    const store = new Map<string, string>();
    const mem = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    const rand = rng(2024);
    let save = emptySave();
    let busy = false;
    let spawned = 0;
    let busyFor = 0;
    for (let i = 0; i < 400000; i++) {
      const dt = 0.1;
      const a = tickAlerts(save.alerts, dt, 5, i + 1, busy);
      if (a) spawned++;
      expect(save.alerts.alerts.length, `step ${i}`).toBeLessThanOrEqual(MAX_ALERTS);
      expect(new Set(save.alerts.alerts.map((x) => x.r)).size).toBe(save.alerts.alerts.length);
      if (busy && --busyFor <= 0) {
        // a talk ends: answered, or closed with the X (the bubble stays)
        if (rand() < 0.7 && save.alerts.alerts.length) answered(save.alerts, save.alerts.alerts[0].r);
        busy = false;
      }
      const e = rand();
      if (!busy && e < 0.002 && save.alerts.alerts.length) {
        busy = true;
        busyFor = 80;
      } else if (e < 0.004) {
        // out to a game and back: the save is written and the lobby starts again from it
        writeSave(save, mem);
        save = loadSave(mem);
      } else if (e < 0.0055) {
        // a switch of tier (the 3D carnival to the plain home or back): the same
        writeSave(save, mem);
        save = loadSave(mem);
      }
    }
    expect(spawned).toBeGreaterThan(200);
    // a save with too many in it (from an older build) is cut to two when it is read
    const bad = emptySave();
    bad.alerts.alerts = [1, 2, 3, 4, 0].map((r) => ({ r, seed: r }));
    writeSave(bad, mem);
    expect(loadSave(mem).alerts.alerts.length).toBeLessThanOrEqual(MAX_ALERTS);
  });

  it('the names that can replace a fixed one do not include a name kept for another character', () => {
    expect(ALT_NAMES).not.toContain('לולי');
    expect(ALT_NAMES).toContain('קוקי');
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
