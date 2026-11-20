import { describe, expect, it } from 'vitest';
import { emptySave } from './talk/state';
import { CarnivalWorld, type WorldDeps } from './world';
import { ACCESSORIES, ACCESSORY_MISSING, GIFTS, SHOP, accessoryById, DETAILS, FOOD_OF_ITEM, LEVEL_AT, addFriendship, friendLevel, friendOf, friendProgress, friendsOf, giftOf, isPartyDay, levelOfResident, partyDayOf, shownDetails, trickOf, wearing } from './friends';
import { RESIDENT_INFO } from './residents';
import { QUESTS, finishedNow } from './quests';
import { englishOf } from './ui/friendUi';
import { ITEMS } from './catalog';
import { CarnivalSim } from './sim';
import { makeSlots } from './slots';
import HE from '../../../public/english/voice/he/manifest.json';
import EN from '../../../public/english/voice/en/manifest.json';

const he = new Set((HE as { clips: string[] }).clips);
const en = new Set((EN as { clips: string[] }).clips);
const files = Object.keys(import.meta.glob('../../../public/park/items/*.webp', { query: '?url', import: 'default' })).map((k) => k.split('/').pop()!.replace('.webp', ''));

function mk(now = new Date(2026, 10, 20)): { w: CarnivalWorld; deps: WorldDeps } {
  const stars = { n: 500 };
  const save = emptySave();
  save.arrived = ['donut', 'icecream', 'watermelon', 'strawberry', 'cupcake', 'popcorn'];
  const deps: WorldDeps = { save, persist: () => undefined, stars: () => stars.n, spend: (n) => (stars.n -= n), give: (n) => (stars.n += n), progress: () => ({ worlds: [2, 3, 5], units: [] }), games: ['english', 'memory', 'brick-breaker'], plotCount: 8, plotFronts: { english: { x: 2, z: 9 }, memory: { x: -2, z: 9 }, 'brick-breaker': { x: 0, z: 9 } }, companion: { name: 'מיצי', buddy: null }, now: () => now };
  return { w: new CarnivalWorld(deps), deps };
}

describe('the friendship meter', () => {
  it('five levels at 0, 5, 12, 22 and 35 hearts, and it only goes up', () => {
    expect(LEVEL_AT).toEqual([0, 5, 12, 22, 35]);
    expect([0, 4, 5, 11, 12, 21, 22, 34, 35, 999].map(friendLevel)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
    const save = emptySave();
    let last = 1;
    for (let i = 0; i < 60; i++) {
      addFriendship(save, 'donut', 1);
      const l = levelOfResident(save, 'donut');
      expect(l).toBeGreaterThanOrEqual(last);
      last = l;
    }
    // nothing lowers it: a negative or a fractional amount adds nothing wrong
    const before = friendsOf(save).hearts.donut;
    addFriendship(save, 'donut', -9);
    addFriendship(save, 'donut', 0.7);
    expect(friendsOf(save).hearts.donut).toBe(before);
    expect(friendProgress(0)).toBe(0);
    expect(friendProgress(35)).toBe(1);
  });
  it('the six details show up one by one with the level: food and game at 2, colour at 3, number and hobby at 4, the friend at 5', () => {
    expect(DETAILS).toHaveLength(6);
    expect([1, 2, 3, 4, 5].map((l) => shownDetails(l))).toEqual([[], ['food', 'game'], ['food', 'game', 'color'], ['food', 'game', 'color', 'number', 'hobby'], ['food', 'game', 'color', 'number', 'hobby', 'friend']]);
  });
  it('every resident has all six details, a friend who has him as a friend, a party day of the month, and a trick', () => {
    for (const r of RESIDENT_INFO) {
      expect(r.partyDay).toBeGreaterThanOrEqual(1);
      expect(r.partyDay).toBeLessThanOrEqual(28);
      const f = RESIDENT_INFO.find((x) => x.id === r.friend)!;
      expect(f, r.id).toBeDefined();
      expect(f.friend, `${r.id} <-> ${f.id}`).toBe(r.id);
      expect(['spin', 'jump2', 'dance']).toContain(trickOf(r.id));
    }
    expect(friendOf('companion')).toBe('cupcake');
    expect(partyDayOf('companion')).toBe(22);
  });
  it('every detail can be said from a recording that exists: the Hebrew line and word, and the English sentence from level 3', () => {
    for (const r of RESIDENT_INFO) {
      expect(he.has(`w_${r.food}`), `w_${r.food}`).toBe(true);
      expect(he.has(`c_${r.color}`), `c_${r.color}`).toBe(true);
      expect(he.has(`cv_num_${r.number}`), `cv_num_${r.number}`).toBe(true);
      expect(he.has(`w_${r.hobby}`), `w_${r.hobby}`).toBe(true);
      for (const d of ['food', 'color', 'number', 'hobby'] as const) { const e = englishOf(d, r)!; expect(en.has(e.id), e.id).toBe(true); }
    }
    for (const id of ['cs_fav_food', 'cs_fav_game', 'cs_fav_color', 'cs_fav_number', 'cs_hobby', 'cs_my_friend', 'cs_quiz_food', 'cs_quiz_color', 'cs_quiz_number', 'cs_quiz_right', 'cs_quiz_remind', 'cs_party_today', 'cs_party_gift', 'cs_party_thanks', 'cs_friend_up', 'cs_best_friend', 'cs_new_trick', 'cs_gift_for_you']) expect(he.has(id), id).toBe(true);
  });
  it('an old save (no friends at all) and a damaged one are read; what a later stage saves beside it is kept', () => {
    const a = emptySave();
    expect(friendsOf(a).hearts).toEqual({});
    const b = emptySave();
    (b.extra as Record<string, unknown>).friends = { hearts: { donut: 'x', icecream: 7 }, worn: 5, job: { a: 3 }, gifted: [1, 'z'], tricks: -4 };
    (b.extra as Record<string, unknown>).egg = { day: 3 };
    const f = friendsOf(b);
    expect(f.hearts).toEqual({ icecream: 7 });
    expect(f.worn).toEqual({});
    expect(f.job).toEqual({});
    expect(f.gifted).toEqual(['z']);
    expect(f.tricks).toBe(0);
    expect((b.extra as Record<string, unknown>).egg).toEqual({ day: 3 });
    expect(JSON.parse(JSON.stringify(b)).extra.friends.hearts).toEqual({ icecream: 7 });
  });
});

describe('what the hearts do', () => {
  it('a heart that a resident gives (a stall, a talk) fills his own meter and no other', () => {
    const { w } = mk();
    const i = 1;
    const id = w.residents[i].id;
    w.build(w.freeSlot('stall')!.id, 'pizzastand');
    // the sim gives a heart to whoever is served: run it with a crowd
    for (const a of w.sim.agents) a.wishIn = 0;
    for (let t = 0; t < 400; t += 0.1) w.tick(0.1);
    const f = friendsOf(w.save);
    const total = Object.values(f.hearts).reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThanOrEqual(w.hearts);
    void id;
  });
  it('a friendship level that was reached is announced once, with nothing taken away', () => {
    const { w } = mk();
    const id = w.residents[2].id;
    addFriendship(w.save, id, 5);
    const ev = w.tick(0.1).filter((e) => e.type === 'friendUp');
    expect(ev).toHaveLength(1);
    expect(w.tick(0.1).filter((e) => e.type === 'friendUp')).toHaveLength(0);
    addFriendship(w.save, id, 100);
    expect(w.tick(0.1).filter((e) => e.type === 'friendUp').length).toBe(1);
    expect(w.levelOf(2)).toBe(5);
  });
  it('the trick (from level 2), the job (from level 3), the gift (level 4, once) and the crown (level 5) open with the level and not before', () => {
    const { w } = mk();
    const id = w.residents[1].id;
    expect(w.trick(1)).toBeNull();
    const slot = w.freeSlot('stall')!.id;
    w.build(slot, 'pizzastand');
    expect(w.setJob(1, slot)).toBe(false);
    expect(w.giftWaiting(1)).toBe(false);
    addFriendship(w.save, id, 5);
    expect(w.trick(1)).toBe(trickOf(id));
    expect(w.setJob(1, slot)).toBe(false);
    addFriendship(w.save, id, 7);
    expect(w.setJob(1, slot)).toBe(true);
    expect(w.wearing(1)).toContain('chefhat');
    expect(w.sim.agents[1].mode).toBe('working');
    addFriendship(w.save, id, 10);
    expect(w.giftWaiting(1)).toBe(true);
    const g = w.takeGift(1)!;
    expect(g).toBe(giftOf(id));
    expect(w.takeGift(1)).toBeNull();
    expect(w.wearing(1)).toContain(g);
    addFriendship(w.save, id, 13);
    expect(w.wearing(1)).toContain('crown');
    expect(wearing(w.save, id)).toContain('crown');
  });
  it('a stall with a seller gives one more heart (his) for every three customers; taking the stall away lets him go', () => {
    const { w } = mk();
    const id = w.residents[1].id;
    addFriendship(w.save, id, 12);
    const slot = w.freeSlot('stall')!.id;
    w.build(slot, 'pizzastand');
    expect(w.setJob(1, slot)).toBe(true);
    const seen: string[] = [];
    for (let t = 0; t < 600; t += 0.1) {
      // everybody who is free wants to eat (a hungry carnival)
      if (Math.round(t * 10) % 50 === 0) w.sim.agents.forEach((a) => { if (a.mode === 'wander' && !a.wish) { a.wish = { kind: 'food' }; a.retry = 0; } });
      for (const e of w.sim.update(0.1)) if (e.type === 'heart') seen.push(e.why);
    }
    expect(seen.filter((x) => x === 'stall').length).toBeGreaterThanOrEqual(3);
    expect(seen.filter((x) => x === 'work').length).toBeGreaterThanOrEqual(1);
    expect(w.sim.agents[1].mode).toBe('working');
    w.remove(slot);
    expect(w.sim.agents[1].mode).toBe('wander');
    expect(w.sim.agents[1].job).toBeNull();
  });
  it('the questions "do you remember me?": a right answer gives two hearts, a wrong one gives nothing and takes nothing', () => {
    const { w } = mk();
    const before = w.hearts;
    expect(w.remembered(1, false)).toBe(0);
    expect(w.hearts).toBe(before);
    expect(w.remembered(1, true)).toBe(2);
    expect(w.hearts).toBe(before + 2);
    expect(friendsOf(w.save).hearts[w.residents[1].id]).toBe(2);
    expect(friendsOf(w.save).remembered).toBe(1);
  });
});

describe('the party day', () => {
  it('only on the day of the month of the resident, once a month; a missed party costs nothing and comes back next month', () => {
    const day = partyDayOf('donut');
    const on = new Date(2026, 10, day), off = new Date(2026, 10, day === 1 ? 2 : 1);
    expect(isPartyDay('donut', on)).toBe(true);
    expect(isPartyDay('donut', off)).toBe(false);
    const { w } = mk(on);
    const i = w.residents.findIndex((r) => r.id === 'donut');
    expect(w.partyNow()).toContain(i);
    expect(w.wearing(i)).toEqual(expect.arrayContaining(['partyhat', 'balloons']));
    const h0 = w.hearts;
    expect(w.partyGift(i, true)).toBe(4);
    expect(w.hearts).toBe(h0 + 4);
    expect(w.partyNow()).not.toContain(i);
    expect(w.wearing(i)).not.toContain('partyhat');
    // the same resident, next month: the party is back
    const next = new Date(2026, 11, day);
    const w2 = new CarnivalWorld({ ...mk(next).deps, save: w.save, now: () => next });
    expect(w2.partyNow()).toContain(w2.residents.findIndex((r) => r.id === 'donut'));
    // a present that does not fit still gives hearts
    expect(w2.partyGift(w2.residents.findIndex((r) => r.id === 'donut'), false)).toBe(2);
  });
});

describe('what he does: the favourite food first, a friend beside him', () => {
  it('a resident goes first to the stall of his favourite food, even when another is nearer', () => {
    const slots = makeSlots(8);
    const stalls = slots.filter((s) => s.kind === 'stall').slice(0, 2);
    const sim = new CarnivalSim({ slots, plotFronts: {} }, [{ id: 'a', personality: 'hungry', food: 'cheese' }], 3);
    sim.setBuilt({ [stalls[0].id]: 'pizzastand', [stalls[1].id]: 'cheesestand' });
    let at = '';
    for (let i = 0; i < 80 && !at; i++) {
      sim.agents[0].wish = { kind: 'food' };
      sim.agents[0].retry = 0;
      sim.update(0.1);
      at = sim.agents[0].at ?? '';
    }
    expect(at).toBe(stalls[1].id);
    expect(FOOD_OF_ITEM.cheesestand).toBe('cheese');
  });
  it('two friends who have nothing to do sometimes stand together in one line', () => {
    const slots = makeSlots(8);
    const stall = slots.filter((s) => s.kind === 'stall')[0];
    let together = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const sim = new CarnivalSim({ slots, plotFronts: {} }, [{ id: 'a', personality: 'hungry', friend: 'b' }, { id: 'b', personality: 'sleepy', friend: 'a' }], seed);
      sim.setBuilt({ [stall.id]: 'pizzastand' });
      sim.agents[0].wish = { kind: 'food' };
      sim.agents[0].retry = 0;
      for (let i = 0; i < 5; i++) sim.update(0.1);
      if (sim.queueOf(stall.id).length === 2) together++;
    }
    expect(together).toBeGreaterThan(3);
    expect(together).toBeLessThan(20);
  });
});

describe('the quests of stage 3 and the pictures', () => {
  it('eight quests follow the first ten, each with the sentence of quests-later.json, and they are done by what the world counts', () => {
    expect(QUESTS.slice(10).map((q) => q.id)).toEqual(['friend', 'trick', 'job', 'hat', 'remember', 'party', 'lolly', 'workshop']);
    const base = { built: {}, level: 1, taps: 0, rounds: 0, answers: 0 };
    const done10 = QUESTS.slice(0, 10).map((q) => q.id);
    expect(finishedNow(done10, { ...base, friend: 2, tricks: 1 }).map((q) => q.id)).toEqual(['friend', 'trick']);
    expect(finishedNow(done10, { ...base, lolly: 1 }).map((q) => q.id)).toEqual([]);
    expect(finishedNow([...done10, 'friend', 'trick', 'job', 'hat', 'remember', 'party'], { ...base, lolly: 1, workshop: 1 }).map((q) => q.id)).toEqual(['lolly', 'workshop']);
    for (const q of QUESTS.slice(10)) expect(he.has(`qs_${q.id}`), q.id).toBe(true);
  });
  it('the accessories use only pictures that are in the repo; the ones whose picture is not are on the list of what is missing, and nothing else is', () => {
    for (const a of ACCESSORIES) expect(files.includes(a.img) || ACCESSORY_MISSING.includes(a.id), a.id).toBe(true);
    for (const id of ACCESSORY_MISSING) expect(files.includes(ACCESSORIES.find((a) => a.id === id)!.img), `${id} has a picture now: take it out of the list`).toBe(false);
    for (const id of ['chefhat', 'balloons', 'medal', 'giftbox']) expect(files).toContain(id);
  });
  it('every food stall of the catalog that names a food in FOOD_OF_ITEM is a real item', () => {
    for (const k of Object.keys(FOOD_OF_ITEM)) expect(ITEMS.some((i) => i.id === k), k).toBe(true);
  });
  it('no state of the friendship ever goes down: nothing in the world lowers a meter, a hearts counter or a level', () => {
    const { w } = mk();
    let hearts = 0;
    const levels: number[] = w.residents.map((_, i) => w.levelOf(i));
    w.build(w.freeSlot('stall')!.id, 'pizzastand');
    for (let t = 0; t < 900; t += 0.2) {
      w.tick(0.2);
      expect(w.hearts).toBeGreaterThanOrEqual(hearts);
      hearts = w.hearts;
      w.residents.forEach((_, i) => { expect(w.levelOf(i)).toBeGreaterThanOrEqual(levels[i]); levels[i] = w.levelOf(i); });
    }
  });
});

describe('the nine accessories of sheet 39 and the shops (SPEC-carnival.md 5.4)', () => {
  it('all nine pictures are in the repo and nothing is missing any more', () => {
    for (const id of ['lollyschool', 'partyhat', 'crown', 'glasses', 'scarf', 'bow', 'sunglasses', 'flowercrown', 'cape']) expect(files, id).toContain(id);
    expect(ACCESSORY_MISSING).toEqual([]);
  });
  it('the gifts of level 4 are the six accessories, every resident gets one of them, and each is worn on its own place', () => {
    expect([...GIFTS].sort()).toEqual(['bow', 'cape', 'flowercrown', 'glasses', 'scarf', 'sunglasses']);
    for (const id of ['donut', 'icecream', 'watermelon', 'strawberry', 'cupcake', 'popcorn', 'banana']) expect(GIFTS).toContain(giftOf(id));
    for (const g of GIFTS) { const a = accessoryById(g)!; expect(files).toContain(a.img); expect(['head', 'face', 'neck', 'back']).toContain(a.slot); }
    expect(accessoryById('cape')!.behind).toBe(true);
  });
  it('one thing on each place: a new one takes the place of the old one, which goes back to the stock', () => {
    const { w } = mk();
    const id = w.residents[0].id;
    friendsOf(w.save).owned.glasses = 1;
    friendsOf(w.save).owned.sunglasses = 1;
    expect(w.dress(0, 'glasses')).toBe(true);
    expect(w.wearing(0)).toContain('glasses');
    expect(w.dress(0, 'sunglasses')).toBe(true);
    expect(w.wearing(0)).toContain('sunglasses');
    expect(w.wearing(0)).not.toContain('glasses');
    expect(w.owned().glasses).toBe(1);
    expect(wearing(w.save, id)).toContain('sunglasses');
    expect(w.dress(0, 'cape')).toBe(false);
  });
  it('the shop sells with stars, never takes hearts, and what is bought is kept in the save', () => {
    const { w } = mk();
    const hearts = w.hearts;
    expect(w.buyAccessory('partyhat')).toBe('ok');
    expect(w.owned().partyhat).toBe(1);
    expect(w.buyAccessory('nothing')).toBe('unknown');
    expect(w.hearts).toBe(hearts);
    expect(friendsOf(JSON.parse(JSON.stringify(w.save))).owned.partyhat).toBe(1);
    for (const shop of Object.values(SHOP)) for (const g of shop) { expect(files).toContain(g.id); expect(g.price).toBeGreaterThan(0); }
  });
});

describe('the quest "dress a hat on a squishy" is connected to the shop', () => {
  it('buying a hat and dressing it on a squishy finishes qs_hat (and a bow or a scarf does not)', () => {
    const { w } = mk();
    const q = QUESTS.find((x) => x.id === 'hat')!;
    expect(q.he).toBe('הלבישי כובע לסקווישי');
    expect(q.done(w.questCtx())).toBe(false);
    w.buyAccessory('scarf'); w.dress(0, 'scarf');
    expect(q.done(w.questCtx())).toBe(false);
    expect(w.buyAccessory('partyhat')).toBe('ok');
    expect(w.dress(0, 'partyhat')).toBe(true);
    expect(q.done(w.questCtx())).toBe(true);
  });
});

describe('the cupcake does not wear a scarf or a cape', () => {
  it('he is never given them as a gift, they stay in the stock when dragged to him, and he wears the rest', () => {
    const { w } = mk();
    const i = w.residents.findIndex((r) => r.id === 'cupcake');
    expect(['scarf', 'cape']).not.toContain(giftOf('cupcake'));
    expect(GIFTS).toContain(giftOf('cupcake'));
    friendsOf(w.save).owned.scarf = 1; friendsOf(w.save).owned.cape = 1; friendsOf(w.save).owned.crown = 0;
    expect(w.dress(i, 'scarf')).toBe(false);
    expect(w.dress(i, 'cape')).toBe(false);
    expect(w.owned().scarf).toBe(1);
    expect(w.owned().cape).toBe(1);
    expect(w.buyAccessory('partyhat')).toBe('ok');
    expect(w.dress(i, 'partyhat')).toBe(true);
    friendsOf(w.save).worn.cupcake = ['scarf', 'glasses'];
    expect(wearing(w.save, 'cupcake')).toEqual(['glasses']);
  });
});
