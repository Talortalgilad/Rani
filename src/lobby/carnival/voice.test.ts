import { describe, expect, it } from 'vitest';
import { QUIET_MS, SPONT_GAP_MS, VoiceQueue } from './voice';
import { EFFECT_WINDOW_MS, MAX_EFFECTS, effectSlot, resetEffects } from '../../sound';

/** a fake clock and a fake speaker: a clip lasts `dur` ms, and `stop` cuts it */
function rig(): { q: VoiceQueue; clip: (name: string, dur: number) => () => Promise<void>; advance: (ms: number) => Promise<void>; playing: () => string[]; log: string[]; at: () => number } {
  let t = 0;
  const timers: { at: number; f: () => void }[] = [];
  const playing = new Set<string>();
  const waiters: { name: string; end: number; done: () => void }[] = [];
  const log: string[] = [];
  const q = new VoiceQueue({
    now: () => t,
    stop: () => {
      for (const w of waiters.splice(0)) (playing.delete(w.name), w.done());
    },
    after: (ms, f) => void timers.push({ at: t + ms, f }),
  });
  const advance = async (ms: number): Promise<void> => {
    const end = t + ms;
    while (t < end) {
      t = Math.min(end, t + 50);
      for (const w of waiters.filter((x) => x.end <= t)) (waiters.splice(waiters.indexOf(w), 1), playing.delete(w.name), w.done());
      for (const x of timers.filter((x2) => x2.at <= t)) (timers.splice(timers.indexOf(x), 1), x.f());
      await Promise.resolve();
      await Promise.resolve();
    }
  };
  const clip = (name: string, dur: number) => () =>
    new Promise<void>((ok) => {
      if (playing.size) log.push(`OVERLAP: ${name} starts while ${[...playing].join(',')} plays at ${t}`);
      playing.add(name);
      log.push(`${t} start ${name}`);
      waiters.push({ name, end: t + dur, done: ok });
    });
  return { q, clip, advance, playing: () => [...playing], log, at: () => t };
}

describe('the one voice of the carnival', () => {
  it('a tap cuts what plays; the banner of the entry comes before the others; a squishy talks last', async () => {
    const r = rig();
    r.q.begin();
    void r.q.request(r.clip('welcome', 1500), { prio: 'entry' });
    void r.q.request(r.clip('quest', 1500), { prio: 'banner' });
    await r.advance(300);
    expect(r.playing()).toEqual(['welcome']);
    // a tap cuts the banner that plays
    void r.q.request(r.clip('card', 1000), { prio: 'tap' });
    await r.advance(100);
    expect(r.playing()).toEqual(['card']);
    expect(r.log.some((l) => l.startsWith('OVERLAP'))).toBe(false);
    // the entry banner and the quest that waited were not lost by the tap? (the entry stays; the other banners were thrown away by the tap)
    await r.advance(6000);
    expect(r.log.filter((l) => l.includes('start')).map((l) => l.split(' ')[2])).toEqual(['welcome', 'card']);
  });
  it('in the first 5 seconds only the banner of the entry speaks (and a tap): the squishies are silent and the other banners wait for the end of the window', async () => {
    const r = rig();
    r.q.begin();
    const heard: string[] = [];
    const say = (name: string, dur: number, o: Parameters<VoiceQueue['request']>[1]): void => void r.q.request(r.clip(name, dur), o).then((p) => p && heard.push(name));
    say('entry', 2000, { prio: 'entry' });
    say('hello-from-a-squishy', 1000, { prio: 'resident', spont: true, onScreen: true });
    say('quest', 1000, { prio: 'banner' });
    await r.advance(4900);
    expect(heard).toEqual(['entry']);
    expect(r.playing()).toEqual([]);
    await r.advance(2500);
    expect(heard).toEqual(['entry', 'quest']);
    expect(QUIET_MS).toBe(5000);
  });
  it('a squishy talks on his own at most once in 8 seconds, only when he is on the screen, and what did not get in is thrown away (nothing waits)', async () => {
    const r = rig();
    r.q.begin();
    await r.advance(QUIET_MS + 100);
    const heard: string[] = [];
    const dropped: string[] = [];
    const spont = (name: string, onScreen = true): void => void r.q.request(r.clip(name, 800), { prio: 'resident', spont: true, onScreen }).then((p) => (p ? heard : dropped).push(name));
    spont('off-screen', false);
    spont('a');
    spont('b');
    spont('c');
    await r.advance(1000);
    expect(heard).toEqual(['a']);
    expect(dropped).toEqual(['off-screen', 'b', 'c']);
    // the thrown ones do not come back later
    await r.advance(10000);
    expect(heard).toEqual(['a']);
    spont('d');
    await r.advance(1000);
    expect(heard).toEqual(['a', 'd']);
    expect(SPONT_GAP_MS).toBe(8000);
    expect(r.log.some((l) => l.startsWith('OVERLAP'))).toBe(false);
  });
  it('a whole entry with 24 squishies, an egg, a letter, a gift and a guest: ten seconds of everything that wants to talk, and never two clips at once', async () => {
    const r = rig();
    r.q.begin();
    const rnd = ((): (() => number) => { let s = 7; return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648); })();
    let started = 0;
    const ask = (name: string, dur: number, o: Parameters<VoiceQueue['request']>[1]): void => void r.q.request(() => { started++; return r.clip(name, dur)(); }, o);
    // the banners of the entry: "Rani is back", the egg hatches (the guest comes when there is no egg)
    ask('welcome-back', 1800, { prio: 'entry' });
    ask('egg-hatch', 1600, { prio: 'entry' });
    // the quest strip, the gift and the letter (bubbles of the world), a level-up banner
    ask('quest', 1500, { prio: 'banner' });
    ask('level-up', 1200, { prio: 'banner' });
    for (let sec = 0; sec < 10; sec++) {
      // 24 squishies, each with something to say now and then: English sentences, wishes, small bubbles, the baby's hello, the guest asking to stay
      for (let k = 0; k < 24; k++) if (rnd() < 0.18) ask(`s${k}@${sec}`, 900, { prio: 'resident', spont: true, onScreen: rnd() < 0.6 });
      if (sec === 3) ask('baby-hello', 1000, { prio: 'resident', onScreen: true });
      if (sec === 6) ask('guest-asks', 1200, { prio: 'resident', onScreen: true });
      if (sec === 7) ask('tap-on-a-squishy', 1000, { prio: 'tap' });
      await r.advance(1000);
    }
    expect(r.log.filter((l) => l.startsWith('OVERLAP'))).toEqual([]);
    // the log of the queue itself: every start comes after the end of the one before
    let open = 0;
    for (const e of r.q.log) {
      open += e.ev === 'start' ? 1 : -1;
      expect(open).toBeLessThanOrEqual(1);
    }
    // in the first 5 seconds only the entry's banners (and nothing of the squishies)
    const early = r.log.filter((l) => /start/.test(l) && Number(l.split(' ')[0]) < QUIET_MS).map((l) => l.split(' ')[2]);
    expect(early.every((n) => ['welcome-back', 'egg-hatch'].includes(n))).toBe(true);
    // and at most one spontaneous squishy every 8 seconds
    const spontStarts = r.log.filter((l) => /start s\d+@/.test(l)).map((l) => Number(l.split(' ')[0]));
    for (let i = 1; i < spontStarts.length; i++) expect(spontStarts[i] - spontStarts[i - 1]).toBeGreaterThanOrEqual(SPONT_GAP_MS);
    expect(started).toBeGreaterThan(3);
    expect(r.q.stats.asked).toBeGreaterThan(r.q.stats.started);
  });
  it('short effects never queue and at most three sound together', () => {
    resetEffects();
    const t = 10_000;
    expect([1, 2, 3, 4, 5].map(() => effectSlot(t))).toEqual([true, true, true, false, false]);
    expect(effectSlot(t + EFFECT_WINDOW_MS + 1)).toBe(true);
    expect(MAX_EFFECTS).toBe(3);
    resetEffects();
  });
});
