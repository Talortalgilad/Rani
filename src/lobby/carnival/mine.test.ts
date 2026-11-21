import { describe, expect, it } from 'vitest';
import entrySrc from './entry.ts?raw';
import { mineInfo, mineResident, toyHolders, mineOf } from './mine';
import { CarnivalWorld, type WorldDeps } from './world';
import { emptySave } from './talk/state';
import { CANNOT_WEAR, canWear, friendsOf, wearing } from './friends';
import { EXTRA_INFO, infoOf, type Resident } from './residents';
import { anchorOf } from './dress';
import { newSquishy, loadStore, MAX_CARNIVAL, MAX_TOYS, type SquishyData } from '../../games/squishy/save';
import { SHAPES } from '../../games/squishy/shapes';

const made = (shape: string, name: string, food = 'icecream'): SquishyData => ({ ...newSquishy(shape), name, food, base: [255, 143, 177], colors: [] });
const deps = (mine: Resident[]): WorldDeps => {
  const stars = { n: 100 };
  return { save: emptySave(), persist: () => undefined, stars: () => stars.n, spend: (n) => (stars.n -= n), give: (n) => (stars.n += n), progress: () => ({ worlds: [2, 3, 5], units: [] }), games: ['english', 'memory'], plotCount: 8, plotFronts: { english: { x: 2, z: 9 }, memory: { x: -2, z: 9 } }, companion: { name: 'מיצי', buddy: null }, mine: () => mine };
};

describe('the squishies that Rani made live in the carnival (workshop stage 3)', () => {
  it('his favourite food is the one that she chose, his favourite colour is the main colour of his body, and he is a resident like the others', () => {
    const d = made('cat', 'לולו', 'donut');
    const i = mineInfo(d);
    expect(i.food).toBe('donut');
    expect(i.color).toBe('pink');
    expect(i.he).toBe('לולו');
    const r = mineResident(d);
    expect(r.mine).toBe(true);
    expect(r.fixed).toBe(false);
    expect(infoOf(r.id)).toBe(EXTRA_INFO.get(r.id));
    const w = new CarnivalWorld(deps([r]));
    expect(w.residents[w.residents.length - 1].id).toBe(r.id);
    expect(w.sim.agents[w.sim.agents.length - 1].food).toBe('donut');
    expect(w.levelOf(w.residents.length - 1)).toBe(1);
  });
  it('up to 8 live there, kept by the saved data: the ones that are not on the shelf are dropped, and a ninth is not taken', () => {
    const shelf = Array.from({ length: 12 }, (_, k) => made(SHAPES[k], `s${k}`));
    const s = loadStore({ draft: null, shelf, carnival: [...shelf.map((d) => d.id), 'gone', shelf[0].id] });
    expect(s.carnival.length).toBe(MAX_CARNIVAL);
    expect(MAX_CARNIVAL).toBe(8);
    expect(s.carnival).not.toContain('gone');
    expect(mineOf({ shelf: s.shelf, carnival: s.carnival, toys: [] }).map((d) => d.id)).toEqual(s.carnival);
  });
  it('the limit of the tier is for the others: the ones that she made are always out', () => {
    const mine = Array.from({ length: 8 }, (_, k) => mineResident(made('star', `m${k}`)));
    const w = new CarnivalWorld(deps(mine));
    w.chooseHome(2, 3);
    const out = w.agents().filter((a) => a.active).length;
    expect(out).toBe(2 + 8);
    expect(w.agents().slice(-8).every((a) => a.active)).toBe(true);
  });
  it('the accessories work on them: the anchors of the 18 molds exist, and a donut that she made has no scarf', () => {
    for (const s of SHAPES) expect(anchorOf(`shape:${s}`).eyeY, s).toBeGreaterThan(0);
    const donut = mineResident(made('donut', 'דונה'));
    const cat = mineResident(made('cat', 'חתי'));
    expect(canWear(donut.id, 'scarf')).toBe(false);
    expect(canWear(cat.id, 'scarf')).toBe(true);
    expect(CANNOT_WEAR[cat.id]).toBeUndefined();
    const w = new CarnivalWorld(deps([donut, cat]));
    friendsOf(w.save).owned.crown = 0;
    friendsOf(w.save).owned.partyhat = 1;
    expect(w.dress(w.residents.length - 1, 'partyhat')).toBe(true);
    expect(wearing(w.save, cat.id)).toContain('partyhat');
  });
  it('the toy goes to the one who ordered it (the resident with his picture, else one of the others), one toy for each', () => {
    const w = new CarnivalWorld(deps([]));
    const toys = [{ to: 'pizza', data: made('cat', 'a') }, { to: 'bunny', data: made('star', 'b') }, { to: 'cloud', data: made('apple', 'c') }];
    const h = toyHolders(w.residents, toys);
    expect(h.size).toBe(3);
    const mozzi = w.residents.findIndex((r) => r.id === 'mozzi');
    expect(h.get(mozzi)?.to).toBe('pizza');
    expect(new Set([...h.keys()]).size).toBe(3);
    expect(toyHolders(w.residents, []).size).toBe(0);
    expect(MAX_TOYS).toBe(8);
  });
  it('the name that she gave is never said: the two places that say a name skip the ones she made, and nothing reads it with the voice of the phone', () => {
    expect(entrySrc).toMatch(/if \(!world\.residents\[i\]\.mine\) void sayLineQ\('carnival_name'/);
    expect(entrySrc).toMatch(/if \(!r\.mine\) void sayLineQ\('carnival_name'/);
  });
});
