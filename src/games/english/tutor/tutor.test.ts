import { describe, expect, it } from 'vitest';
import { WORDS } from '../content/words';
import { TUTOR_CLIPS } from '../content/tutorClips';
import { DATA, LESSONS, type Step } from './lessons';
import { parsePic } from './pictures';
import { STAGE_OF, STEPS } from './steps';
import { access, emptyTutor, finish, loadTutor, markSeenSentence, nextNew, saveProgress, setSparkle, unitOpen } from './state';
import { canRun } from './engine';
import { nextPraise, PRAISE } from './shell';

const manifest = (lang: 'he' | 'en'): Set<string> => {
  const files = import.meta.glob('../../../../public/english/voice/*/manifest.json', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
  const raw = Object.entries(files).find(([k]) => k.includes(`/voice/${lang}/`))![1];
  return new Set((JSON.parse(raw) as { clips: string[] }).clips);
};
const he = manifest('he');
const en = manifest('en');
const recorded = (id: string): boolean => (TUTOR_CLIPS[id]?.lang === 'he' ? he : en).has(id);

/** every clip id that a step names */
function clipsOf(s: Step): string[] {
  const out: string[] = [];
  const one = (x: unknown): void => void (typeof x === 'string' && x.startsWith('t_') && out.push(x));
  for (const k of ['clip', 'en', 'he', 'intro']) one(s[k]);
  for (const k of ['clips', 'choiceClips']) if (Array.isArray(s[k])) (s[k] as unknown[]).forEach(one);
  if (Array.isArray(s.turns)) for (const t of s.turns as { squishy: string; choices: string[] }[]) { one(t.squishy); t.choices.forEach(one); }
  const fix = s.fixChoices as { clips: string[] } | null | undefined;
  if (fix) fix.clips.forEach(one);
  if (Array.isArray(s.items)) for (const i of s.items as { clip?: string; choiceClips?: string[] }[]) { one(i.clip); i.choiceClips?.forEach(one); }
  one(s.prompt);
  one(s.answer);
  return out;
}
/** every picture that a step names */
function picturesOf(s: Step): string[] {
  const out: string[] = [];
  if (typeof s.picture === 'string') out.push(s.picture);
  if (Array.isArray(s.squishies)) out.push(...(s.squishies as string[]));
  if (s.type === 'challenge') for (const i of s.items as { kind: string; choices?: string[] }[]) if (i.kind === 'pick') out.push(...i.choices!);
  if (Array.isArray(s.choices) && s.type !== 'answerPick' && s.type !== 'dialogue') out.push(...(s.choices as string[]));
  return out;
}

describe('tutor-lessons.json: every clip exists, every answer is in range, every picture is real', () => {
  it('has the 12 lessons of units 1-3, each ending with a sticker', () => {
    expect(LESSONS.length).toBe(12);
    for (const l of LESSONS) expect(l.steps.some((s) => s.type === 'sticker'), l.id).toBe(true);
  });
  it('every clip of every lesson is in the manifest of its language', () => {
    for (const l of LESSONS) for (const [i, s] of l.steps.entries()) for (const id of clipsOf(s)) {
      expect(TUTOR_CLIPS[id], `${l.id}#${i} ${s.type}: ${id} is not a clip of the tutor`).toBeDefined();
      expect(recorded(id), `${l.id}#${i} ${s.type}: ${id} is not in the manifest`).toBe(true);
    }
  });
  it('every `correct` is an index of its choices', () => {
    for (const l of LESSONS) for (const [i, s] of l.steps.entries()) {
      const at = `${l.id}#${i} ${s.type}`;
      if (['listenPick', 'whoSaid', 'answerPick'].includes(s.type)) {
        const n = (s.choices as unknown[]).length;
        expect(Number.isInteger(s.correct) && (s.correct as number) >= 0 && (s.correct as number) < n, at).toBe(true);
        if (s.type === 'answerPick') expect((s.choiceClips as unknown[]).length, `${at}: choiceClips`).toBe(n);
      }
      if (s.type === 'challenge') {
        const items = s.items as { kind: string; choices?: string[]; choiceClips?: string[]; correct: number }[];
        expect(items.length, `${at}: three questions`).toBe(3);
        for (const [k, it] of items.entries()) {
          const n = (it.kind === 'pick' ? it.choices : it.choiceClips)!.length;
          expect(n, `${at} item ${k}: exactly four choices`).toBe(4);
          expect(Number.isInteger(it.correct) && it.correct >= 0 && it.correct < n, `${at} item ${k}: correct`).toBe(true);
          expect(['pick', 'answer']).toContain(it.kind);
        }
      }
      if (s.type === 'meet') {
        expect((s.squishies as unknown[]).length, `${at}: a clip for each squishy`).toBe((s.clips as unknown[]).length);
        expect((s.squishies as string[]).every((x) => x.startsWith('squishy:')), at).toBe(true);
      }
      if (s.type === 'sayFirst') expect(typeof s.answer, at).toBe('string');
      if (s.type === 'dialogue') for (const t of s.turns as { choices: unknown[]; correct: number }[]) expect(t.correct >= 0 && t.correct < t.choices.length, at).toBe(true);
      if (s.type === 'trueFalse' && s.fixChoices) {
        const f = s.fixChoices as { clips: unknown[]; correct: number };
        expect(f.correct >= 0 && f.correct < f.clips.length, at).toBe(true);
        expect(typeof s.truth, at).toBe('boolean');
      }
    }
  });
  it('every word:<id> is an existing word, every picture is of a known kind, the things and colours are in the lists', () => {
    const words = new Set(WORDS.map((w) => w.id));
    for (const l of LESSONS) for (const s of l.steps) for (const p of picturesOf(s)) {
      const pic = parsePic(p);
      expect(pic, `${l.id}: ${p}`).not.toBeNull();
      if (pic!.kind === 'word') expect(words.has(pic!.id), `${l.id}: ${p} is not a word`).toBe(true);
      if (pic!.kind === 'face') expect(DATA.feelings).toContain(pic!.feeling);
      if (pic!.kind === 'thing') { expect(DATA.things).toContain(pic!.thing); expect(DATA.colors).toContain(pic!.color); }
      if (pic!.kind === 'lolly') expect(DATA.foods).toContain(pic!.food);
    }
    for (const f of DATA.foods) expect(words.has(f), f).toBe(true);
    for (const t of DATA.things) expect(words.has(t), t).toBe(true);
  });
  it('the clips that the engine itself says exist (the hellos, the goodbyes, the reactions to a feeling, the praise, the mistakes)', () => {
    const ids = ['t_welcome', 't_hi.0', 't_hi.1', 't_hi.2', 't_bye.0', 't_bye.1', 't_hello_rani', 't_how_are_you_today', 't_feel_ask', 't_review', 't_say_it_with_me', 't_say_aloud', 't_sentence_of_day', 't_sticker', 't_unit_done', 't_see_you_tomorrow', 't_who_said', 't_right_or_wrong', 't_am_i_right', 't_silly_me', 't_oops', 't_i_was_right', 't_fix_me', 't_almost', 't_show', 't_chant_intro', 't_chant_again', 't_done_today', 't_now_you', 't_now_you_he', 't_self_check', 't_challenge_intro', 't_challenge_perfect', 't_challenge_ok', 't_challenge', 't_listen_carefully', 't_what_do_you_see', 't_perfect', 't_amazing', 't_very_good', 't_excellent', 't_you_got_it', 't_super', 't_well_done', ...DATA.feelings.map((f) => `t_re_${f}`), ...DATA.foods.map((f) => `t_you_like_${f}`)];
    for (const id of ids) expect(recorded(id), id).toBe(true);
  });
  it('a lesson of unit 1 can be run by this stage; the types of stage 1 are named, not missing by mistake', () => {
    for (const l of LESSONS.filter((x) => x.unit === 1)) expect(canRun(l), l.id).toBe(true);
    const later = new Set(['likes', 'likeOrNot', 'ask', 'recall', 'paint']); // the types of stage 1
    for (const l of LESSONS) for (const s of l.steps) expect(s.type in STEPS || later.has(s.type), `${l.id}: ${s.type}`).toBe(true);
    for (const t of Object.keys(STEPS)) expect(t in STAGE_OF, t).toBe(true);
  });
  it('the three songs: each chant clip exists and has as many lines as the file says', () => {
    for (const l of LESSONS) for (const s of l.steps) if (s.type === 'chant') {
      expect(recorded(s.clip as string)).toBe(true);
      expect((s.lines as string[]).length).toBe(4);
    }
  });
});

describe('what Lolly remembers: one new lesson a day, the old ones again, a lesson left in the middle', () => {
  const can = canRun;
  it('unit 1 is open, unit 2 opens after the four lessons of unit 1', () => {
    let s = emptyTutor();
    expect(unitOpen(LESSONS, s, 1)).toBe(true);
    expect(unitOpen(LESSONS, s, 2)).toBe(false);
    for (const id of ['u1l1', 'u1l2', 'u1l3', 'u1l4']) s = finish(s, id, 'cake', 100);
    expect(unitOpen(LESSONS, s, 2)).toBe(true);
  });
  it('after a new lesson, a new one waits for tomorrow, an old one is open', () => {
    let s = emptyTutor();
    expect(nextNew(LESSONS, s, can)?.id).toBe('u1l1');
    expect(access(LESSONS, s, LESSONS[0], 100, can)).toBe('ok');
    s = finish(s, 'u1l1', 'cake', 100);
    expect(access(LESSONS, s, LESSONS[1], 100, can)).toBe('doneToday');
    expect(access(LESSONS, s, LESSONS[0], 100, can)).toBe('ok');
    expect(access(LESSONS, s, LESSONS[1], 101, can)).toBe('ok');
    expect(access(LESSONS, s, LESSONS[2], 101, can)).toBe('locked');
  });
  it('doing an old lesson again changes nothing; leaving in the middle keeps the place', () => {
    let s = finish(emptyTutor(), 'u1l1', 'cake', 100);
    const again = finish(s, 'u1l1', 'pizza', 105);
    expect(again.lastDay).toBe(100);
    expect(again.stickers.u1l1).toBe('cake');
    s = saveProgress(s, 'u1l2', 5, 14);
    expect(s.progress).toEqual({ lesson: 'u1l2', step: 5, n: 14 });
    expect(access(LESSONS, s, LESSONS[1], 100, can)).toBe('ok');
    s = finish(s, 'u1l2', 'milk', 101);
    expect(s.progress).toBeNull();
  });
  it('a lesson whose steps this stage cannot run is locked, not broken', () => {
    expect(access(LESSONS, emptyTutor(), LESSONS.find((l) => l.id === 'u2l1')!, 1, can)).toBe('locked');
  });
});

describe('a save from before is not lost (lessons of version 4)', () => {
  const steps = Object.fromEntries(LESSONS.map((l) => [l.id, l.steps.length]));
  it('a lesson that was finished stays finished, with its sticker and the day', () => {
    const old = { v: 1, done: ['u1l1'], lastDay: 20771, progress: null, feeling: null, likes: { pizza: true }, weak: [], stickers: { u1l1: 'bridge' } };
    const s = loadTutor(old, steps);
    expect(s.done).toEqual(['u1l1']);
    expect(s.lastDay).toBe(20771);
    expect(s.stickers.u1l1).toBe('bridge');
    expect(s.likes.pizza).toBe(true);
    expect(s.seen).toEqual([]);
    expect(s.sparkle).toEqual({});
  });
  it('the place in the middle of a lesson goes back to the start when the lesson changed (or was saved before the steps were counted)', () => {
    const before = loadTutor({ v: 1, done: ['u1l1'], progress: { lesson: 'u1l2', step: 6 } }, steps);
    expect(before.progress).toMatchObject({ lesson: 'u1l2', step: 0 });
    const changed = loadTutor({ v: 1, done: [], progress: { lesson: 'u1l2', step: 6, n: steps.u1l2 - 1 } }, steps);
    expect(changed.progress?.step).toBe(0);
    const same = loadTutor({ v: 1, done: [], progress: { lesson: 'u1l2', step: 6, n: steps.u1l2 } }, steps);
    expect(same.progress?.step).toBe(6);
    expect(loadTutor({ v: 1, done: [], progress: { lesson: 'gone', step: 3, n: 9 } }, steps).progress?.step).toBe(0);
  });
  it('the sentences whose Hebrew was heard, and the sparkling stickers, are kept', () => {
    let s = markSeenSentence(emptyTutor(), 't_hello');
    s = markSeenSentence(s, 't_hello');
    expect(s.seen).toEqual(['t_hello']);
    s = setSparkle(s, 'u1l2');
    expect(loadTutor(s, steps).sparkle.u1l2).toBe(true);
    expect(loadTutor(s, steps).seen).toEqual(['t_hello']);
  });
});

describe('the praises', () => {
  it('the new ones are in the pool, every one has a recording, and the same praise never comes twice in a row', () => {
    expect(PRAISE).toEqual(expect.arrayContaining(['t_perfect', 't_amazing', 't_very_good', 't_excellent', 't_you_got_it', 't_super', 't_well_done']));
    for (const p of PRAISE) expect(recorded(p), p).toBe(true);
    for (const before of ['', ...PRAISE]) for (let i = 0; i < 40; i++) expect(nextPraise(before, i / 40)).not.toBe(before);
    expect(new Set(Array.from({ length: 40 }, (_, i) => nextPraise('t_super', i / 40))).size).toBe(PRAISE.length - 1);
  });
});
