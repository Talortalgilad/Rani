import { describe, expect, it } from 'vitest';
import HE from '../../../public/english/voice/he/manifest.json';
import { emptySave } from './talk/state';
import { CarnivalWorld, type WorldDeps } from './world';
import { COLLECT_CAP, FROM_EGGS, collectedFor, dailyOf, dayKey, daysBetween, eggAtLevel, giftFor, greetingAt, growthOf, guestFor, isFriday, letterFor } from './daily';
import { friendsOf, addFriendship } from './friends';
import { QUESTS, finishedNow } from './quests';
import { linePartsFor } from '../../games/english/content/heLines';
import { WORDS } from '../../games/english/content/words';
import { CS_LINES } from './csLines';

const he = new Set((HE as { clips: string[] }).clips);
const items = new Set(Object.keys(import.meta.glob('../../../public/park/items/*.webp', { query: '?url', import: 'default' })).map((k) => k.split('/').pop()!.replace('.webp', '')));

/** a world with a clock that the test moves (a fake clock: nothing waits for a real day) */
function mk(start = new Date(2026, 10, 18, 10, 0)): { w: CarnivalWorld; clock: { d: Date }; deps: WorldDeps } {
  const clock = { d: start };
  const stars = { n: 100 };
  const save = emptySave();
  save.arrived = ['donut', 'icecream', 'watermelon', 'strawberry', 'cupcake', 'popcorn'];
  const deps: WorldDeps = { save, persist: () => undefined, stars: () => stars.n, spend: (n) => (stars.n -= n), give: (n) => (stars.n += n), progress: () => ({ worlds: [2, 3, 5, 7], units: [] }), games: ['english', 'memory'], plotCount: 8, plotFronts: { english: { x: 2, z: 9 }, memory: { x: -2, z: 9 } }, companion: { name: 'מיצי', buddy: null }, now: () => clock.d };
  return { w: new CarnivalWorld(deps), clock, deps };
}
const nextDay = (c: { d: Date }, n = 1): void => void (c.d = new Date(c.d.getFullYear(), c.d.getMonth(), c.d.getDate() + n, c.d.getHours()));
/** hearts up to a level (the world's own checks run: eggs, arrivals) */
const toLevel = (w: CarnivalWorld, hearts: number): ReturnType<CarnivalWorld['checkProgress']> => { w.save.hearts = hearts; return w.checkProgress(); };

describe('the egg (every second level, sleeps one night, hatches on the next visit)', () => {
  it('an egg comes at every second level (4, 6, 8 ...) once, and not at the others', () => {
    expect([2, 3, 4, 5, 6, 7, 8, 20].map(eggAtLevel)).toEqual([false, false, true, false, true, false, true, true]);
    const { w } = mk();
    const ev = toLevel(w, 25);
    expect(ev.filter((e) => e.type === 'egg').length).toBe(1);
    expect(w.eggs()).toBe(1);
    expect(toLevel(w, 26).filter((e) => e.type === 'egg').length).toBe(0);
    toLevel(w, 60);
    expect(w.eggs()).toBe(2);
  });
  it('it does not hatch on the day it was found, and hatches on the first entry of another day: a baby from the album, 60 % small', () => {
    const { w, clock, deps } = mk();
    toLevel(w, 25);
    const before = deps.save.arrived.length;
    expect(w.beginVisit().filter((e) => e.type === 'hatch').length).toBe(0);
    expect(w.eggs()).toBe(1);
    expect(w.eggIsNew()).toBe(true);
    nextDay(clock);
    const w2 = new CarnivalWorld(deps);
    const ev = w2.beginVisit();
    const h = ev.find((e) => e.type === 'hatch');
    expect(h).toBeTruthy();
    expect(w2.eggs()).toBe(0);
    expect(deps.save.arrived.length).toBe(before + 1);
    const i = (h as { index: number }).index;
    expect(w2.isBaby(i)).toBe(true);
    expect(w2.growth(i)).toBe(0.6);
    expect(FROM_EGGS).toContain(w2.residents[i].id);
    // a second visit on the same day does not hatch another
    expect(new CarnivalWorld(deps).beginVisit().filter((e) => e.type === 'hatch').length).toBe(0);
  });
  it('the baby grows with the friendship: 60 %, 80 % at level 2, 100 % at level 3 (a scale in the code, no new pictures)', () => {
    expect([1, 2, 3, 4, 5].map(growthOf)).toEqual([0.6, 0.8, 1, 1, 1]);
    const { w, clock, deps } = mk();
    toLevel(w, 25);
    nextDay(clock);
    const w2 = new CarnivalWorld(deps);
    const i = (w2.beginVisit().find((e) => e.type === 'hatch') as { index: number }).index;
    addFriendship(deps.save, w2.residents[i].id, 5);
    w2.tick(0.6);
    expect(w2.growth(i)).toBe(0.8);
    addFriendship(deps.save, w2.residents[i].id, 7);
    w2.tick(0.6);
    expect(w2.growth(i)).toBe(1);
    // the others are never scaled
    expect(w2.growth(0)).toBe(1);
    expect(w2.sim.agents[i].baby).toBe(true);
  });
  it('nothing sleeps for ever: after a month away the egg hatches, one for each day she comes', () => {
    const { w, clock, deps } = mk();
    toLevel(w, 60);
    expect(w.eggs()).toBe(2);
    nextDay(clock, 30);
    const a = new CarnivalWorld(deps);
    expect(a.beginVisit().filter((e) => e.type === 'hatch').length).toBe(1);
    expect(a.eggs()).toBe(1);
    nextDay(clock);
    expect(new CarnivalWorld(deps).beginVisit().filter((e) => e.type === 'hatch').length).toBe(1);
  });
});

describe('the guest of the day', () => {
  it('one guest a day, who is not living here yet; the same all day; after one talk he asks, and a yes keeps him', () => {
    const { w, deps } = mk();
    const ev = w.beginVisit().find((e) => e.type === 'guest');
    expect(ev).toBeTruthy();
    const i = w.guestIndex();
    expect(i).toBe((ev as { index: number }).index);
    expect(deps.save.arrived).not.toContain(w.residents[i].id);
    expect(w.residents[i].guest).toBe(true);
    // again today: the same one
    const w2 = new CarnivalWorld(deps);
    w2.beginVisit();
    expect(w2.residents[w2.guestIndex()].id).toBe(w.residents[i].id);
    expect(w2.guestTalked()).toBe(true);
    const k = w2.stayGuest();
    expect(deps.save.arrived).toContain(w.residents[i].id);
    expect(w2.residents[k].guest).toBe(false);
    expect(w2.guestIndex()).toBe(-1);
    expect(w2.daily.stayed).toBe(1);
  });
  it('if she does not talk to him he is not here for good, and another comes another day: nothing is lost', () => {
    const { w, clock, deps } = mk();
    w.beginVisit();
    const first = w.residents[w.guestIndex()].id;
    expect(deps.save.arrived).not.toContain(first);
    nextDay(clock);
    const w2 = new CarnivalWorld(deps);
    w2.beginVisit();
    expect(w2.guestIndex()).toBeGreaterThanOrEqual(0);
    expect(deps.save.arrived).not.toContain(first);
    expect(guestFor(deps.save.arrived, dailyOf(deps.save), dayKey(clock.d))).toBe(w2.residents[w2.guestIndex()].id);
  });
});

describe('the mailbox and the gift of the day', () => {
  it('one letter a day, with a picture of the game and a recorded sentence; the letters are kept', () => {
    const { w, clock, deps } = mk();
    expect(w.mailReady()).toBe(true);
    const l = w.openMail()!;
    expect(items.has('envelope') && items.has('mailbox')).toBe(true);
    expect(WORDS.some((x) => x.id === l.pic)).toBe(true);
    expect([0, 1, 2]).toContain(l.line);
    expect(he.has(`cs_letter.${l.line}`)).toBe(true);
    expect(linePartsFor(`cs_letter.${l.line}`).length).toBeGreaterThan(0);
    expect(w.openMail()).toBeNull();
    expect(w.mailReady()).toBe(false);
    nextDay(clock, 3);
    const w2 = new CarnivalWorld(deps);
    expect(w2.mailReady()).toBe(true);
    w2.openMail();
    expect(w2.letters().length).toBe(2);
    expect(JSON.parse(JSON.stringify(deps.save.extra.daily)).letters.length).toBe(2);
    expect(letterFor('2026-11-18', ['a', 'b'])).toEqual(letterFor('2026-11-18', ['a', 'b']));
  });
  it('one box, once a day: it does not pile up when she skips days, and it does not go away', () => {
    const { w, clock, deps } = mk();
    expect(w.giftReady()).toBe(true);
    const g = w.openDailyGift()!;
    expect(g).toBeTruthy();
    expect(w.openDailyGift()).toBeNull();
    nextDay(clock, 9);
    const w2 = new CarnivalWorld(deps);
    expect(w2.giftReady()).toBe(true);
    const before = deps.save.hearts;
    w2.openDailyGift();
    expect(w2.openDailyGift()).toBeNull();
    expect(w2.daily.gifts).toBe(2);
    expect(deps.save.hearts - before).toBeLessThanOrEqual(3);
    expect(items.has('giftbox')).toBe(true);
    expect(['hearts', 'decor', 'accessory']).toContain(giftFor('2026-11-20', ['bush']).kind);
  });
  it('a decoration from the gift is built for free, once', () => {
    const { w } = mk();
    dailyOf(w.save).freeDecor.push('bush');
    const slot = w.freeSlot('decor')!;
    const stars = w.d.stars();
    expect(w.build(slot.id, 'bush').ok).toBe(true);
    expect(w.d.stars()).toBe(stars);
    expect(dailyOf(w.save).freeDecor).toEqual([]);
  });
});

describe('we collected for you, morning and night, the parade of Friday', () => {
  it('hearts for the days away, with a ceiling, and nothing on the same day or on the first visit', () => {
    expect([0, 1, 2, 5, 6, 30, 400].map(collectedFor)).toEqual([0, 2, 4, 10, 10, 10, 10]);
    expect(COLLECT_CAP).toBe(10);
    expect(daysBetween('2026-11-10', '2026-11-18')).toBe(8);
    expect(daysBetween('2026-11-18', '2026-11-10')).toBe(0);
    const { w, clock, deps } = mk();
    expect(w.beginVisit().filter((e) => e.type === 'welcomeBack').length).toBe(0);
    expect(new CarnivalWorld(deps).beginVisit().filter((e) => e.type === 'welcomeBack').length).toBe(0);
    nextDay(clock, 3);
    const h = deps.save.hearts;
    const ev = new CarnivalWorld(deps).beginVisit();
    const wb = ev.find((e) => e.type === 'welcomeBack') as { hearts: number; days: number };
    expect(wb.hearts).toBe(6);
    expect(deps.save.hearts).toBeGreaterThanOrEqual(h + 6);
    expect(new CarnivalWorld(deps).beginVisit().filter((e) => e.type === 'welcomeBack').length).toBe(0);
  });
  it('after a week or a month away nothing was lost: no hearts, level, friendship or egg goes down', () => {
    const { w, clock, deps } = mk();
    toLevel(w, 60);
    addFriendship(deps.save, 'donut', 8);
    w.beginVisit();
    const snap = JSON.stringify({ h: deps.save.hearts, lv: w.level, f: friendsOf(deps.save).hearts, eggs: w.eggs(), arrived: deps.save.arrived.length });
    nextDay(clock, 40);
    const w2 = new CarnivalWorld(deps);
    w2.beginVisit();
    const a = JSON.parse(snap);
    expect(deps.save.hearts).toBeGreaterThanOrEqual(a.h);
    expect(w2.level).toBeGreaterThanOrEqual(a.lv);
    expect(friendsOf(deps.save).hearts.donut).toBe(a.f.donut);
    expect(deps.save.arrived.length).toBeGreaterThanOrEqual(a.arrived);
  });
  it('good morning before noon, good night after 19:00, nothing in between', () => {
    expect([6, 11].map((h) => greetingAt(new Date(2026, 10, 18, h)))).toEqual(['morning', 'morning']);
    expect([12, 15, 18].map((h) => greetingAt(new Date(2026, 10, 18, h)))).toEqual([null, null, null]);
    expect([19, 21, 23].map((h) => greetingAt(new Date(2026, 10, 18, h)))).toEqual(['night', 'night', 'night']);
    const { w } = mk(new Date(2026, 10, 18, 20, 30));
    expect(w.beginVisit().find((e) => e.type === 'greet')).toEqual({ type: 'greet', kind: 'night' });
    expect(he.has('cs_good_night') && he.has('cs_good_morning')).toBe(true);
  });
  it('the parade is on Friday, once for each Friday she joins; the test button can start it any day', () => {
    expect(isFriday(new Date(2026, 10, 20))).toBe(true);
    expect(isFriday(new Date(2026, 10, 19))).toBe(false);
    const { w, deps } = mk(new Date(2026, 10, 20, 11));
    expect(w.beginVisit().some((e) => e.type === 'paradeDay')).toBe(true);
    expect(w.paradeReady()).toBe(true);
    w.startParade();
    expect(w.paradeOn()).toBe(true);
    for (let k = 0; k < 40; k++) w.sim.update(0.5);
    const a = w.sim.agents.filter((x) => x.active);
    const radii = a.map((x) => Math.hypot(x.x, x.z - 0.4));
    expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(0.01);
    w.endParade(true);
    expect(w.paradeOn()).toBe(false);
    expect(w.paradeReady()).toBe(false);
    expect(new CarnivalWorld(deps).beginVisit().some((e) => e.type === 'paradeDay')).toBe(false);
    // not on another day
    expect(mk(new Date(2026, 10, 19, 11)).w.beginVisit().some((e) => e.type === 'paradeDay')).toBe(false);
  });
  it('the skip of the parents\' area moves only the clock of the carnival', () => {
    const { w, deps } = mk();
    const d0 = dayKey(w.now());
    dailyOf(deps.save).skip = 2;
    expect(dayKey(w.now())).not.toBe(d0);
    expect(daysBetween(d0, dayKey(w.now()))).toBe(2);
  });
});

describe('the quests and the rules that are never broken', () => {
  it('qs_egg, qs_mail, qs_gift, qs_visitor and qs_parade are done by what the world counts', () => {
    const { w, clock, deps } = mk();
    const ids = ['egg', 'mail', 'gift', 'visitor', 'parade'];
    for (const id of ids) expect(QUESTS.some((q) => q.id === id), id).toBe(true);
    const done = QUESTS.map((q) => q.id).filter((id) => !ids.includes(id));
    expect(finishedNow(done, w.questCtx()).length).toBe(0);
    w.openMail();
    w.openDailyGift();
    // (a quest counts when its turn comes: the egg is first in line)
    expect(finishedNow(done, w.questCtx()).length).toBe(0);
    toLevel(w, 25);
    nextDay(clock);
    const w2 = new CarnivalWorld(deps);
    w2.beginVisit();
    w2.guestTalked();
    w2.stayGuest();
    w2.startParade();
    w2.endParade(true);
    expect(finishedNow(done, w2.questCtx()).map((q) => q.id)).toEqual(['egg', 'mail', 'gift', 'visitor', 'parade']);
    for (const id of ids) expect(CS_LINES.length > 0 && he.has(`qs_${id}`), id).toBe(true);
  });
  it('the lines and the pictures are the ones that exist in the repo: nothing is drawn or said that was not made', () => {
    for (const id of ['cs_egg_found', 'cs_egg_wait', 'cs_egg_hatch', 'cs_baby_hello', 'cs_mail', 'cs_letter.0', 'cs_letter.1', 'cs_letter.2', 'cs_visitor', 'cs_visitor_stay', 'cs_daily_gift', 'cs_collected', 'cs_welcome_back', 'cs_parade', 'cs_good_night', 'cs_good_morning']) expect(he.has(id), id).toBe(true);
    for (const id of ['egg', 'egg_cracked', 'mailbox', 'giftbox', 'envelope']) expect(items.has(id), id).toBe(true);
  });
  it('no countdown, no streak, no sad squishy, no notification in what this stage adds', async () => {
    const src = (await import('./daily.ts?raw')).default + (await import('./ui/dailyUi.ts?raw')).default;
    const lines = src.split('\n').filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//') && !l.trim().startsWith('/**'));
    const code = lines.join('\n');
    expect(code).not.toMatch(/Notification|serviceWorker|pushManager|setInterval|streak|עצוב|התגעגע|נשארו לך|שעות/);
  });
});
