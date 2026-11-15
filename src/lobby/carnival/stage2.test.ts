import { describe, expect, it } from 'vitest';
import { ALWAYS_OPEN, FIRST_ITEM, ITEMS, itemById, itemsOfSlot } from './catalog';
import { emptyProgress, isItemOpen, openItems, progressFromEnglish, reachable } from './unlocks';
import { COUNTS, makeSlots, slotsOf } from './slots';
import { ARRIVAL_LEVELS, MAX_LEVEL, THRESHOLDS, levelOf, levelsGained, progress, span } from './level';
import { TRAITS, nextGap, pickKind } from './wishes';
import { RIDE_QUEUE, RIDE_SECONDS, STALL_QUEUE, CarnivalSim, type SimEvent } from './sim';
import { RESIDENT_INFO, arrivalOrder, residents } from './residents';
import { ISLAND_R, PLOT_PAD, ZS, plots } from './layout';

describe('the catalog and what opens it', () => {
  it('every item has exactly one condition that can really happen, and an item of every kind exists', () => {
    const ids = new Set<string>();
    for (const i of ITEMS) {
      expect(ids.has(i.id), `${i.id} twice`).toBe(false);
      ids.add(i.id);
      expect(reachable(i.unlock), i.id).toBe(true);
      expect(i.price >= 0 && Number.isInteger(i.price), i.id).toBe(true);
    }
    for (const k of ['food', 'drink', 'fun', 'rest', 'shop', 'decor'] as const) expect(ITEMS.some((i) => i.kind === k), k).toBe(true);
  });
  it('the prices are in the ranges of the spec: stalls 10-30 (the first is free), rides 20-50, decorations 2-8', () => {
    for (const i of itemsOfSlot('stall')) expect(i.id === FIRST_ITEM ? i.price === 0 : i.price >= 10 && i.price <= 30, i.id).toBe(true);
    for (const i of itemsOfSlot('ride')) expect(i.price >= 20 && i.price <= 50, i.id).toBe(true);
    for (const i of itemsOfSlot('decor')) expect(i.price >= 2 && i.price <= 8, i.id).toBe(true);
  });
  it('the three that are always open are open in an empty save: the first stall, the water fountain, the bench', () => {
    expect(ALWAYS_OPEN.sort()).toEqual(['bench', 'pizzastand', 'waterfountain']);
    const open = openItems(emptyProgress()).map((i) => i.id);
    for (const id of ALWAYS_OPEN) expect(open).toContain(id);
    expect(isItemOpen(itemById('cheesestand')!, emptyProgress())).toBe(false);
  });
  it('finishing a world opens its items; everything opens when everything was done; every wish can be filled by something that opens early', () => {
    const all = { worlds: Array.from({ length: 12 }, (_, i) => i + 1), units: [1, 2, 3] };
    expect(openItems(all).length).toBe(ITEMS.length);
    expect(isItemOpen(itemById('juicestand')!, { worlds: [2], units: [] })).toBe(true);
    for (const w of ['food', 'drink', 'fun', 'rest'] as const) expect(ITEMS.some((i) => i.fills === w && i.unlock.kind === 'always' || i.fills === w && i.unlock.kind === 'world' && i.unlock.n <= 3), w).toBe(true);
  });
  it('the progress is read from what the English game saved', () => {
    const p = progressFromEnglish({ map: { done: { 1: 5, 2: 5, 3: 4 } }, tutor: { done: ['u1l1', 'u1l2', 'u1l3', 'u1l4', 'u2l1'] } }, { 1: ['u1l1', 'u1l2', 'u1l3', 'u1l4'], 2: ['u2l1', 'u2l2'] });
    expect(p.worlds.sort()).toEqual([1, 2]);
    expect(p.units).toEqual([1]);
    expect(progressFromEnglish(undefined, { 1: ['u1l1'] })).toEqual({ worlds: [], units: [] });
  });
});

describe('the places', () => {
  for (const n of [6, 7, 8, 9]) {
    it(`with ${n} plots: 10 stalls, 8 rides, 24 decorations, none on a plot or on another, and they open with the levels`, () => {
      const s = makeSlots(n);
      expect(slotsOf(s, 'stall').length).toBe(COUNTS.stall);
      expect(slotsOf(s, 'ride').length).toBe(COUNTS.ride);
      expect(slotsOf(s, 'decor').length).toBe(COUNTS.decor);
      const ps = plots(n);
      for (const a of s) {
        expect((a.x / ISLAND_R) ** 2 + (a.z / (ISLAND_R * ZS)) ** 2, a.id).toBeLessThan(1);
        if (a.kind !== 'stall') for (const p of ps) expect(Math.hypot(a.x - p.x, a.z - p.z), `${a.id} on a plot`).toBeGreaterThan(PLOT_PAD);
        expect(a.level >= 1 && a.level <= 12, a.id).toBe(true);
      }
      for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) expect(Math.hypot(s[i].x - s[j].x, s[i].z - s[j].z), `${s[i].id} ${s[j].id}`).toBeGreaterThan(0.9);
      // from the start: 3 stalls, 2 rides, 6 decorations
      expect(slotsOf(s, 'stall').filter((x) => x.level === 1).length).toBe(3);
      expect(slotsOf(s, 'ride').filter((x) => x.level === 1).length).toBe(2);
      expect(slotsOf(s, 'decor').filter((x) => x.level === 1).length).toBe(6);
    });
  }
});

describe('the level of the carnival', () => {
  it('20 levels, the first at 5, 10, 15 hearts, never down, and a pile of hearts can pass several', () => {
    expect(THRESHOLDS.length).toBe(MAX_LEVEL - 1);
    expect(THRESHOLDS.slice(0, 3)).toEqual([5, 10, 15]);
    expect(levelOf(0)).toBe(1);
    expect(levelOf(5)).toBe(2);
    expect(levelOf(14)).toBe(3);
    expect(levelOf(10 ** 6)).toBe(MAX_LEVEL);
    for (let h = 0; h < 900; h++) expect(levelOf(h + 1) >= levelOf(h)).toBe(true);
    expect(levelsGained(4, 16)).toEqual([2, 3, 4]);
    expect(levelsGained(16, 16)).toEqual([]);
    expect(progress(0)).toBe(0);
    expect(progress(7.5)).toBeCloseTo(0.5);
    expect(span(10 ** 6).to).toBeNull();
    for (let i = 1; i < THRESHOLDS.length; i++) expect(THRESHOLDS[i] - THRESHOLDS[i - 1]).toBeGreaterThanOrEqual(5);
  });
  it('six new residents arrive at levels 2, 3, 5, 7, 9, 11, and they are in the list of residents.json with a picture', () => {
    expect(ARRIVAL_LEVELS).toEqual([2, 3, 5, 7, 9, 11]);
    expect(arrivalOrder().length).toBe(6);
    expect(RESIDENT_INFO.length).toBe(22);
    const r = residents('מיצי', null, arrivalOrder());
    expect(r.length).toBe(11);
    expect(new Set(r.map((x) => x.id)).size).toBe(11);
    expect(new Set(r.map((x) => x.name)).size).toBe(11);
    for (const x of r) expect(x.personality, x.id).toBeDefined();
    expect(residents(null, null).length).toBe(5);
  });
});

describe('characters and wishes', () => {
  it('a hungry one wants food most, a playful one a ride or a game, a sleepy one a rest', () => {
    const count = (p: 'hungry' | 'playful' | 'sleepy' | 'curious'): Record<string, number> => {
      const c: Record<string, number> = {};
      for (let i = 0; i < 1000; i++) c[pickKind(p, i / 1000)] = (c[pickKind(p, i / 1000)] ?? 0) + 1;
      return c;
    };
    expect(count('hungry').food).toBeGreaterThan(400);
    expect(count('playful').fun + count('playful').play).toBeGreaterThan(600);
    expect(count('sleepy').rest).toBeGreaterThan(400);
    expect(Object.keys(count('curious')).length).toBe(5);
    expect(TRAITS.curious.calls).toBeGreaterThan(TRAITS.hungry.calls);
    expect(TRAITS.hungry.speed).toBeLessThan(TRAITS.playful.speed);
    expect(pickKind('hungry', 0.99, ['drink'])).toBe('drink');
    for (const p of ['hungry', 'playful', 'sleepy', 'curious'] as const) expect(nextGap(p, 0)).toBeLessThan(nextGap(p, 1));
  });
});

describe('the carnival at work', () => {
  const slots = makeSlots(7);
  const stall = slotsOf(slots, 'stall')[0];
  const ride = slotsOf(slots, 'ride')[0];
  const fronts = { english: { x: 2, z: 10 }, memory: { x: -2, z: 10 } };
  const crowd = (n: number, p: 'hungry' | 'playful' | 'sleepy' | 'curious' = 'hungry'): { id: string; personality: typeof p; game?: string }[] => Array.from({ length: n }, (_, i) => ({ id: `r${i}`, personality: p, game: i % 2 ? 'english' : 'memory' }));
  const run = (sim: CarnivalSim, seconds: number, on?: (ev: SimEvent[]) => void): SimEvent[] => {
    const all: SimEvent[] = [];
    for (let t = 0; t < seconds; t += 0.1) {
      const ev = sim.update(0.1);
      all.push(...ev);
      on?.(ev);
    }
    return all;
  };

  it('with nothing built: wishes wait, nobody gets a heart, nobody is lost, nobody leaves the paths into a queue', () => {
    const sim = new CarnivalSim({ slots, plotFronts: {} }, crowd(5), 3);
    const ev = run(sim, 600);
    expect(ev.some((e) => e.type === 'wish')).toBe(true);
    expect(ev.some((e) => e.type === 'heart')).toBe(false);
    for (const a of sim.agents) expect(Number.isFinite(a.x) && Number.isFinite(a.z)).toBe(true);
    expect(sim.agents.filter((a) => a.wish).length).toBeGreaterThan(0);
    for (const a of sim.agents) expect(a.mode).toBe('wander');
  });
  it('a stall: residents who want food go, wait in a line of at most 3, are served one by one, and leave with a heart; the line is never left', () => {
    const sim = new CarnivalSim({ slots, plotFronts: {} }, crowd(8), 5);
    sim.setBuilt({ [stall.id]: 'pizzastand' });
    let longest = 0;
    const ev = run(sim, 900, () => (longest = Math.max(longest, sim.queueOf(stall.id).length)));
    const hearts = ev.filter((e): e is Extract<SimEvent, { type: 'heart' }> => e.type === 'heart');
    expect(hearts.length).toBeGreaterThan(3);
    for (const h of hearts) expect(h.amount).toBe(1);
    expect(longest).toBeLessThanOrEqual(STALL_QUEUE);
    expect(ev.some((e) => e.type === 'order' && e.item === 'pizzastand')).toBe(true);
    // the one who is served is the one at the front
    expect(sim.agents.every((a) => a.mode !== 'queue' || a.place >= 0)).toBe(true);
  });
  it('a stall that is taken away lets its line go, with nothing lost', () => {
    const sim = new CarnivalSim({ slots, plotFronts: {} }, crowd(6), 9);
    sim.setBuilt({ [stall.id]: 'pizzastand' });
    run(sim, 300);
    sim.setBuilt({});
    run(sim, 5);
    expect(sim.queueOf(stall.id)).toEqual([]);
    for (const a of sim.agents) expect(['wander', 'going']).toContain(a.mode);
  });
  it('a ride: up to 4 wait, 2-4 get on together, ride about 6 seconds, and each leaves with a heart', () => {
    const sim = new CarnivalSim({ slots, plotFronts: {} }, crowd(10, 'playful'), 11);
    sim.setBuilt({ [ride.id]: 'carousel' });
    let boarded = 0;
    let longest = 0;
    const ev = run(sim, 900, (e) => {
      longest = Math.max(longest, sim.queueOf(ride.id).length);
      for (const x of e) if (x.type === 'board') {
        boarded++;
        expect(x.riders.length).toBeGreaterThanOrEqual(1);
        expect(x.riders.length).toBeLessThanOrEqual(RIDE_QUEUE);
      }
    });
    expect(boarded).toBeGreaterThan(1);
    expect(longest).toBeLessThanOrEqual(RIDE_QUEUE);
    expect(ev.filter((e) => e.type === 'heart' && e.why === 'ride').length).toBeGreaterThan(2);
    expect(RIDE_SECONDS).toBe(6);
  });
  it('a resident who wants to play waits near the plot, and a round of that game gives each who waited a double heart', () => {
    const sim = new CarnivalSim({ slots, plotFronts: fronts }, crowd(30, 'playful'), 13);
    let t = 0;
    while (t < 900 && sim.waitingFor('english') + sim.waitingFor('memory') < 2) {
      sim.update(0.1);
      t += 0.1;
    }
    const n = sim.waitingFor('english');
    expect(sim.waitingFor('english') + sim.waitingFor('memory')).toBeGreaterThanOrEqual(2);
    const ev = sim.roundDone('english');
    expect(ev.length).toBe(n);
    for (const e of ev) {
      expect(e.type).toBe('heart');
      expect(e.type === 'heart' && e.amount).toBe(2);
    }
    expect(sim.waitingFor('english')).toBe(0);
    expect(sim.roundDone('english')).toEqual([]);
  });
  it('the board of wishes counts what is wanted now', () => {
    const sim = new CarnivalSim({ slots, plotFronts: {} }, crowd(6), 3);
    run(sim, 200);
    const c = sim.wishCounts();
    expect(Object.values(c).reduce((a, b) => a + b, 0)).toBe(sim.agents.filter((a) => a.wish).length);
  });
  it('a long run with everything built never breaks: positions are numbers, lines are short, no resident is in two places', () => {
    const sim = new CarnivalSim({ slots, plotFronts: fronts }, Array.from({ length: 16 }, (_, i) => ({ id: `r${i}`, personality: (['hungry', 'playful', 'sleepy', 'curious'] as const)[i % 4], game: i % 2 ? 'english' : 'memory' })), 21);
    sim.setBuilt({ [slotsOf(slots, 'stall')[0].id]: 'pizzastand', [slotsOf(slots, 'stall')[1].id]: 'juicestand', [slotsOf(slots, 'stall')[2].id]: 'bench', [slotsOf(slots, 'ride')[0].id]: 'carousel', [slotsOf(slots, 'ride')[1].id]: 'swingride' });
    for (let t = 0; t < 3600; t += 0.2) {
      sim.update(0.2);
      const inLines = new Set<number>();
      for (const s of slots) for (const r of sim.queueOf(s.id)) {
        expect(inLines.has(r), 'two lines').toBe(false);
        inLines.add(r);
      }
      for (const a of sim.agents) expect(Number.isFinite(a.x) && Number.isFinite(a.z)).toBe(true);
    }
  });
});

import { CarnivalWorld, type WorldDeps } from './world';
import { emptySave, loadSave, writeSave } from './save';
import { QUESTS, activeQuest, finishedNow } from './quests';

function mkWorld(over: Partial<WorldDeps> = {}, stars0 = 100): { w: CarnivalWorld; stars: { n: number }; deps: WorldDeps } {
  const stars = { n: stars0 };
  const deps: WorldDeps = {
    save: emptySave(), persist: () => undefined, stars: () => stars.n, spend: (n) => (stars.n -= n), give: (n) => (stars.n += n),
    progress: () => ({ worlds: [], units: [] }), games: ['english', 'memory'], plotCount: 7,
    plotFronts: { english: { x: 2, z: 10 }, memory: { x: -2, z: 10 } }, companion: { name: 'מיצי', buddy: null }, ...over,
  };
  return { w: new CarnivalWorld(deps), stars, deps };
}

describe('building and buying', () => {
  it('the first stall is free; a stall costs its price in stars; with too few stars nothing is built and nothing is lost', () => {
    const { w, stars } = mkWorld({}, 0);
    const s0 = w.freeSlot('stall')!;
    expect(w.build(s0.id, 'pizzastand')).toEqual({ ok: true });
    expect(stars.n).toBe(0);
    expect(w.itemAt(s0.id)?.id).toBe('pizzastand');
    const s1 = w.freeSlot('stall')!;
    expect(w.build(s1.id, 'waterfountain')).toEqual({ ok: false, reason: 'stars' });
    expect(w.itemAt(s1.id)).toBeUndefined();
    stars.n = 12;
    expect(w.build(s1.id, 'waterfountain')).toEqual({ ok: true });
    expect(stars.n).toBe(2);
  });
  it('a locked item cannot be bought, whatever she has; a place that is locked by the level cannot be used; a ride does not go on a stall place', () => {
    const { w } = mkWorld({}, 1000);
    const s = w.freeSlot('stall')!;
    expect(w.build(s.id, 'cheesestand')).toEqual({ ok: false, reason: 'locked' });
    expect(w.canBuy(itemById('cheesestand')!)).toBe('locked');
    expect(w.build(s.id, 'carousel')).toEqual({ ok: false, reason: 'unknown' });
    const locked = slotsOf(w.slots, 'stall').find((x) => x.level > 1)!;
    expect(w.build(locked.id, 'pizzastand')).toEqual({ ok: false, reason: 'level' });
    expect(w.build(s.id, 'pizzastand')).toEqual({ ok: true });
    expect(w.build(s.id, 'waterfountain')).toEqual({ ok: false, reason: 'taken' });
  });
  it('taking it back to the catalog gives all the stars back', () => {
    const { w, stars } = mkWorld({}, 20);
    const s = w.freeSlot('stall')!;
    w.build(s.id, 'waterfountain');
    expect(stars.n).toBe(10);
    expect(w.remove(s.id)).toBe(true);
    expect(stars.n).toBe(20);
    expect(w.itemAt(s.id)).toBeUndefined();
    expect(w.remove(s.id)).toBe(false);
  });
  it('an item that opens with a world can be bought after the world was finished', () => {
    const { w } = mkWorld({ progress: () => ({ worlds: [2], units: [] }) }, 100);
    expect(w.canBuy(itemById('juicestand')!)).toBe('ok');
  });
});

describe('hearts, levels, arrivals and quests', () => {
  it('hearts from the talks raise the level, a new resident arrives at level 2, and nothing goes down', () => {
    const { w } = mkWorld();
    expect(w.residents.length).toBe(5);
    w.save.hearts = 5;
    const ev = w.checkProgress();
    expect(ev.some((e) => e.type === 'levelUp' && e.level === 2)).toBe(true);
    expect(ev.some((e) => e.type === 'arrival')).toBe(true);
    expect(w.residents.length).toBe(6);
    expect(w.sim.agents.length).toBe(6);
    expect(w.level).toBe(2);
    // the same level is not given twice
    expect(w.checkProgress().filter((e) => e.type === 'arrival' || e.type === 'levelUp')).toEqual([]);
    w.save.hearts = 3; // (it cannot happen in the game) the level that was reached stays in the save
    w.checkProgress();
    expect(w.save.levelDone).toBe(2);
  });
  it('a lot of hearts at once give every arrival that was missed, one resident each', () => {
    const { w } = mkWorld();
    w.save.hearts = 200;
    w.checkProgress();
    expect(w.residents.length).toBe(11);
    expect(new Set(w.save.arrived).size).toBe(6);
  });
  it('the quests come in order, each gives its hearts (and sometimes stars), and one that was done before its turn counts at once', () => {
    expect(QUESTS.length).toBe(10);
    expect(activeQuest([])?.id).toBe('pizza');
    const base = { built: {} as Record<string, string>, level: 1, taps: 0, rounds: 0, answers: 0 };
    expect(finishedNow([], base)).toEqual([]);
    const done = finishedNow([], { ...base, built: { s0: 'pizzastand' }, taps: 2 }).map((q) => q.id);
    expect(done).toEqual(['pizza', 'name']);
    expect(activeQuest(['pizza', 'name'])?.id).toBe('drink');
    const { w, stars } = mkWorld({}, 0);
    w.build(w.freeSlot('stall')!.id, 'pizzastand');
    const ev = w.tick(0.1);
    expect(ev.some((e) => e.type === 'quest' && e.quest.id === 'pizza')).toBe(true);
    expect(w.hearts).toBe(3);
    expect(stars.n).toBe(0);
    for (const q of QUESTS) expect(q.he.length, q.id).toBeGreaterThan(5);
  });
  it('rounds played while she was away count when she is back: the ones who waited give a double heart', () => {
    const { w, deps } = mkWorld({}, 0);
    deps.save.pendingRounds.push('english');
    const ev = w.settleRounds();
    expect(deps.save.pendingRounds).toEqual([]);
    expect(deps.save.quests.counts.rounds).toBe(1);
    expect(ev.every((e) => e.type === 'heart' && e.amount === 2)).toBe(true);
  });
});

describe('the save', () => {
  const mem = (): { store: Record<string, string>; api: Pick<Storage, 'getItem' | 'setItem'> } => {
    const store: Record<string, string> = {};
    return { store, api: { getItem: (k) => store[k] ?? null, setItem: (k, v) => void (store[k] = v) } };
  };
  it('a save of version 1 (the talks only) loads, and its hearts are kept', () => {
    const m = mem();
    m.store['rani-carnival-v1'] = JSON.stringify({ v: 1, hearts: 12, answers: 4, last: 'math', retry: [], alerts: { alerts: [], wait: 3 }, count: 9 });
    const s = loadSave(m.api);
    expect(s.v).toBe(2);
    expect(s.hearts).toBe(12);
    expect(s.answers).toBe(4);
    expect(s.built).toEqual({});
    expect(s.arrived).toEqual([]);
    expect(s.quests).toEqual({ done: [], counts: {} });
  });
  it('what stage 2 saves comes back, and what a later stage saves (unknown keys, or under extra) is kept as it is', () => {
    const m = mem();
    const s = emptySave();
    s.built = { s0: 'pizzastand' };
    s.arrived = ['donut'];
    s.quests.done = ['pizza'];
    s.extra = { friendship: { mozzi: 3 } };
    writeSave(s, m.api);
    const raw = JSON.parse(m.store['rani-carnival-v1']);
    raw.eggs = [{ id: 'e1' }]; // a field of a later stage, unknown now
    m.store['rani-carnival-v1'] = JSON.stringify(raw);
    const back = loadSave(m.api);
    expect(back.built).toEqual({ s0: 'pizzastand' });
    expect(back.arrived).toEqual(['donut']);
    expect(back.extra).toEqual({ friendship: { mozzi: 3 }, eggs: [{ id: 'e1' }] });
    writeSave(back, m.api);
    expect(JSON.parse(m.store['rani-carnival-v1']).extra.eggs).toEqual([{ id: 'e1' }]);
  });
  it('damaged parts are cleaned and nothing breaks', () => {
    const m = mem();
    m.store['rani-carnival-v1'] = JSON.stringify({ v: 2, hearts: -4, built: { a: 5, b: 'bench' }, arrived: [1, 'donut'], levelDone: 99, quests: { done: [3, 'pizza'], counts: { taps: 'x', rounds: 2 } }, pendingRounds: 'no' });
    const s = loadSave(m.api);
    expect(s.hearts).toBe(0);
    expect(s.built).toEqual({ b: 'bench' });
    expect(s.arrived).toEqual(['donut']);
    expect(s.levelDone).toBe(20);
    expect(s.quests.done).toEqual(['pizza']);
    expect(s.quests.counts).toEqual({ rounds: 2 });
    expect(s.pendingRounds).toEqual([]);
    m.store['rani-carnival-v1'] = 'not json';
    expect(loadSave(m.api).hearts).toBe(0);
  });
});
