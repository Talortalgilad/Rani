/**
 * The world of the carnival (SPEC-carnival.md 5): the places, what stands on them, the stars that it costs, the hearts and the level, the residents that arrive, the quests, and
 * the sim that makes it work. No DOM and no Three.js here: the scene draws it, the page shows it. Everything that is saved is in the one save object (talk/state.ts).
 */
import { ITEMS, itemById, type Item, type SlotKind } from './catalog';
import { ARRIVAL_LEVELS, MAX_LEVEL, arrivalAt, levelOf, levelsGained, progress as levelProgress } from './level';
import { NEW_RESIDENTS, residents, type Resident } from './residents';
import { CarnivalSim, type SimEvent, type SimResident } from './sim';
import { makeSlots, slotsOf, type Slot } from './slots';
import { activeQuest, finishedNow, type Quest, type QuestCtx } from './quests';
import { isItemOpen, type Progress } from './unlocks';
import type { CarnivalSave } from './talk/state';
import type { Personality } from './wishes';
import { addFriendship, friendLevel, friendOf, friendsOf, giftOf, isPartyDay, levelOfResident, maxFriendLevel, partyKey, priceOf, putOn, trickOf, wearing, type Trick } from './friends';

export type WorldEvent =
  | SimEvent
  | { type: 'levelUp'; level: number }
  | { type: 'arrival'; resident: Resident; index: number }
  | { type: 'newPlace'; level: number; count: number }
  | { type: 'quest'; quest: Quest }
  | { type: 'built'; slot: string; item: string }
  | { type: 'removed'; slot: string; item: string }
  | { type: 'unlocked'; items: string[] }
  | { type: 'friendUp'; r: number; level: number };

export type Buy = { ok: true } | { ok: false; reason: 'stars' | 'locked' | 'level' | 'taken' | 'unknown' };

export interface WorldDeps {
  save: CarnivalSave;
  persist(): void;
  /** how many stars Rani has, and how to spend / give them */
  stars(): number;
  spend(n: number): void;
  give(n: number): void;
  /** what she finished in the word journey and in Lolly's lessons */
  progress(): Progress;
  /** the plots (the ids of the games, in the order of the plots) and how many there are in all (games and locked tents) */
  games: string[];
  plotCount: number;
  /** where the front of the plot of each game is (for the residents who wait to play) */
  plotFronts: Record<string, { x: number; z: number }>;
  /** the companion's name and squishy */
  companion: { name: string | null; buddy: string | null };
  /** the date (the party days) and what she did in Lolly's lessons and in the workshop (for the quests); both optional */
  now?(): Date;
  external?(): { lolly: number; workshop: number };
}

export class CarnivalWorld {
  readonly slots: Slot[];
  readonly sim: CarnivalSim;
  residents: Resident[];
  /** how many stalls and rides have been tapped, rounds played, residents tapped (counters of the quests live in the save) */
  private lastHearts: number;
  private knownOpen: Set<string>;

  constructor(readonly d: WorldDeps, seed = 7) {
    this.slots = makeSlots(d.plotCount);
    this.residents = residents(d.companion.name, d.companion.buddy, d.save.arrived);
    this.sim = new CarnivalSim({ slots: this.slots, plotFronts: d.plotFronts }, this.residents.map((r) => this.simOf(r)), seed);
    this.sim.setBuilt(d.save.built);
    this.lastHearts = d.save.hearts;
    this.knownOpen = new Set(ITEMS.filter((i) => isItemOpen(i, d.progress())).map((i) => i.id));
    this.syncFriends();
  }
  /** the jobs that were saved stand at their stalls again, and the best friends follow the camera */
  private syncFriends(): void {
    const f = friendsOf(this.d.save);
    this.residents.forEach((r, i) => {
      const slot = f.job[r.id];
      if (slot && !this.sim.setJob(i, slot)) delete f.job[r.id];
      this.sim.setFollower(i, levelOfResident(this.d.save, r.id) >= 5);
    });
  }
  /** what a resident wears: his gifts, the chef's hat at work, the crown at level 5, and the party hat and balloons on his party day */
  wearing(i: number): string[] {
    const r = this.residents[i];
    if (!r) return [];
    const out = wearing(this.d.save, r.id);
    if (this.partyNow().includes(i)) out.push('partyhat', 'balloons');
    return [...new Set(out)];
  }
  /** what the scene draws: the same as wearing(), worked out again only when something changed (a dress, a gift, a job, a party, a level) or every half second, not in every frame for every resident */
  private wearCache: string[][] = [];
  private wearStale = true;
  private wearAge = 0;
  invalidateWear(): void {
    this.wearStale = true;
  }
  wearingCached(i: number): string[] {
    if (this.wearStale || this.wearCache.length !== this.residents.length) {
      const parties = new Set(this.partyNow());
      this.wearCache = this.residents.map((r, k) => {
        const out = wearing(this.d.save, r.id);
        if (parties.has(k)) out.push('partyhat', 'balloons');
        return [...new Set(out)];
      });
      this.wearStale = false;
      this.wearAge = 0;
    }
    return this.wearCache[i] ?? [];
  }
  now(): Date {
    return this.d.now?.() ?? new Date();
  }
  levelOf(i: number): number {
    const r = this.residents[i];
    return r ? levelOfResident(this.d.save, r.id) : 1;
  }
  /** a resident does his trick (level 2 and more): which one; counts for the quest */
  trick(i: number): Trick | null {
    const r = this.residents[i];
    if (!r || this.levelOf(i) < 2) return null;
    friendsOf(this.d.save).tricks++;
    this.d.persist();
    return trickOf(r.id);
  }
  /** a resident of level 3 works at a stall (null: he stops); only one seller for a stall */
  setJob(i: number, slotId: string | null): boolean {
    this.wearStale = true;
    const r = this.residents[i];
    if (!r) return false;
    const f = friendsOf(this.d.save);
    if (slotId) {
      if (this.levelOf(i) < 3 || this.itemAt(slotId)?.slot !== 'stall') return false;
      const other = this.sim.jobOf(slotId);
      if (other >= 0 && other !== i) { delete f.job[this.residents[other].id]; this.sim.setJob(other, null); }
    }
    if (!this.sim.setJob(i, slotId)) return slotId === null ? (delete f.job[r.id], this.d.persist(), true) : false;
    if (slotId) { f.job[r.id] = slotId; f.jobs++; } else delete f.job[r.id];
    this.d.persist();
    return true;
  }
  /** the camera looks here (the best friends follow) */
  setFollow(p: { x: number; z: number } | null): void {
    this.sim.follow = p;
  }
  /** the residents whose party day it is today and whose party was not celebrated this month */
  partyNow(): number[] {
    const f = friendsOf(this.d.save), now = this.now();
    return this.residents.map((r, i) => (isPartyDay(r.id, now) && f.party[r.id] !== partyKey(now) ? i : -1)).filter((i) => i >= 0);
  }
  /** she chose a present for the party: one that fits his favourite food or colour gives double (4 hearts), another 2. Nobody loses the party by not coming: it is back next month. */
  partyGift(i: number, fits: boolean): number {
    this.wearStale = true;
    const r = this.residents[i];
    const f = friendsOf(this.d.save);
    f.party[r.id] = partyKey(this.now());
    f.parties++;
    const n = fits ? 4 : 2;
    this.d.save.hearts += n;
    addFriendship(this.d.save, r.id, n);
    this.d.persist();
    return n;
  }
  /** "do you remember me?": right gives a double heart, wrong gives nothing and takes nothing */
  remembered(i: number, right: boolean): number {
    const r = this.residents[i];
    if (!right || !r) return 0;
    friendsOf(this.d.save).remembered++;
    this.d.save.hearts += 2;
    addFriendship(this.d.save, r.id, 2);
    this.d.persist();
    return 2;
  }
  /** the gift of level 4: once for each resident; it is put on him (the accessory only he gives) */
  takeGift(i: number): string | null {
    this.wearStale = true;
    const r = this.residents[i];
    const f = friendsOf(this.d.save);
    if (!r || this.levelOf(i) < 4 || f.gifted.includes(r.id)) return null;
    const g = giftOf(r.id);
    f.gifted.push(r.id);
    for (const off of putOn(f, r.id, g)) f.owned[off] = (f.owned[off] ?? 0) + 1;
    this.d.persist();
    return g;
  }
  /** the shop: buys one accessory with stars (it waits in the stock until it is put on a resident) */
  buyAccessory(id: string): 'ok' | 'stars' | 'unknown' {
    const price = priceOf(id);
    if (!price) return 'unknown';
    if (this.d.stars() < price) return 'stars';
    this.d.spend(price);
    const f = friendsOf(this.d.save);
    f.owned[id] = (f.owned[id] ?? 0) + 1;
    this.d.persist();
    return 'ok';
  }
  owned(): Record<string, number> {
    return friendsOf(this.d.save).owned;
  }
  /** drags a bought accessory onto a resident: it stays with him (what he wore on the same place goes back to the stock) */
  dress(i: number, id: string): boolean {
    this.wearStale = true;
    const r = this.residents[i];
    const f = friendsOf(this.d.save);
    if (!r || (f.owned[id] ?? 0) < 1) return false;
    f.owned[id]--;
    if (!f.owned[id]) delete f.owned[id];
    for (const off of putOn(f, r.id, id)) f.owned[off] = (f.owned[off] ?? 0) + 1;
    this.d.persist();
    return true;
  }
  giftWaiting(i: number): boolean {
    const r = this.residents[i];
    return !!r && this.levelOf(i) >= 4 && !friendsOf(this.d.save).gifted.includes(r.id);
  }
  /** the view for the scene */
  agents(): { x: number; z: number; face: number; walking: boolean; active: boolean }[] {
    return this.sim.agents;
  }
  rideProgress(slotId: string): number | null {
    return this.sim.rideProgress(slotId);
  }
  hold(i: number, on: boolean): void {
    this.sim.hold(i, on);
  }
  built(): Record<string, string> {
    return this.d.save.built;
  }
  /**
   * Who is on the screen: all, up to the limit of the tier. Beyond it some are "at home", and they change at every visit (`visit`): the resident of Rani (the first) is always out.
   */
  chooseHome(limit: number, visit: number): void {
    const n = this.residents.length;
    const away = new Set<number>();
    if (n > limit) {
      const order = Array.from({ length: n - 1 }, (_, i) => i + 1).sort((a, b) => ((a * 7919 + visit * 104729) % 1009) - ((b * 7919 + visit * 104729) % 1009));
      order.slice(0, n - limit).forEach((i) => away.add(i));
    }
    this.sim.agents.forEach((_, i) => this.sim.setActive(i, !away.has(i)));
  }
  private simOf(r: Resident): SimResident {
    const f = friendOf(r.id);
    return { id: r.id, personality: (r.personality ?? 'curious') as Personality, game: r.game, food: r.food, friend: f ?? undefined };
  }

  get save(): CarnivalSave {
    return this.d.save;
  }
  get hearts(): number {
    return this.d.save.hearts;
  }
  get level(): number {
    return levelOf(this.d.save.hearts);
  }
  get levelProgress(): number {
    return levelProgress(this.d.save.hearts);
  }
  slot(id: string): Slot | undefined {
    return this.slots.find((s) => s.id === id);
  }
  isSlotOpen(s: Slot): boolean {
    return this.level >= s.level;
  }
  itemAt(slotId: string): Item | undefined {
    const id = this.d.save.built[slotId];
    return id ? itemById(id) : undefined;
  }
  /** the first open free place of a kind (the catalog uses it when she does not pick a place, as in the plain lobby) */
  freeSlot(kind: SlotKind): Slot | null {
    return slotsOf(this.slots, kind).find((s) => this.isSlotOpen(s) && !this.d.save.built[s.id]) ?? null;
  }
  freeSlots(kind: SlotKind): Slot[] {
    return slotsOf(this.slots, kind).filter((s) => this.isSlotOpen(s) && !this.d.save.built[s.id]);
  }
  /** can she buy it now? (a locked item shows what opens it; with no star left the guide says how many are missing) */
  canBuy(item: Item): 'ok' | 'stars' | 'locked' | 'place' {
    if (!isItemOpen(item, this.d.progress())) return 'locked';
    if (this.freeSlot(item.slot) === null) return 'place';
    return this.d.stars() >= item.price ? 'ok' : 'stars';
  }
  build(slotId: string, itemId: string): Buy {
    const slot = this.slot(slotId);
    const item = itemById(itemId);
    if (!slot || !item || slot.kind !== item.slot) return { ok: false, reason: 'unknown' };
    if (!this.isSlotOpen(slot)) return { ok: false, reason: 'level' };
    if (this.d.save.built[slotId]) return { ok: false, reason: 'taken' };
    if (!isItemOpen(item, this.d.progress())) return { ok: false, reason: 'locked' };
    if (this.d.stars() < item.price) return { ok: false, reason: 'stars' };
    this.d.spend(item.price);
    this.d.save.built[slotId] = itemId;
    this.sim.setBuilt(this.d.save.built);
    this.d.persist();
    this.pending.push({ type: 'built', slot: slotId, item: itemId });
    return { ok: true };
  }
  /** takes it back to the catalog: all the stars come back (no penalty) */
  remove(slotId: string): boolean {
    const item = this.itemAt(slotId);
    if (!item) return false;
    delete this.d.save.built[slotId];
    this.d.give(item.price);
    this.sim.setBuilt(this.d.save.built);
    this.d.persist();
    this.pending.push({ type: 'removed', slot: slotId, item: item.id });
    return true;
  }
  /** moves a built thing to another free place of the same kind (no stars change) */
  move(from: string, to: string): boolean {
    const item = this.d.save.built[from];
    const a = this.slot(from), b = this.slot(to);
    if (!item || !a || !b || a.kind !== b.kind || !this.isSlotOpen(b) || this.d.save.built[to]) return false;
    delete this.d.save.built[from];
    this.d.save.built[to] = item;
    this.sim.setBuilt(this.d.save.built);
    this.d.persist();
    return true;
  }
  private pending: WorldEvent[] = [];

  questCtx(): QuestCtx {
    const c = this.d.save.quests.counts;
    const f = friendsOf(this.d.save);
    const ex = this.d.external?.() ?? { lolly: 0, workshop: 0 };
    return { built: this.d.save.built, level: this.level, taps: c.taps ?? 0, rounds: c.rounds ?? 0, answers: this.d.save.answers, friend: maxFriendLevel(this.d.save), tricks: f.tricks, jobs: f.jobs, remembered: f.remembered, parties: f.parties, lolly: ex.lolly, workshop: ex.workshop };
  }
  count(key: 'taps' | 'rounds'): void {
    this.d.save.quests.counts[key] = (this.d.save.quests.counts[key] ?? 0) + 1;
    this.d.persist();
  }
  get quest(): Quest | null {
    return activeQuest(this.d.save.quests.done);
  }

  /** The rounds that were played while the carnival was away count now (the ones who waited for them give their hearts). */
  settleRounds(): WorldEvent[] {
    const out: WorldEvent[] = [];
    const list = this.d.save.pendingRounds.splice(0);
    for (const g of list) {
      this.count('rounds');
      out.push(...this.applyHearts(this.sim.roundDone(g)));
    }
    return out;
  }
  roundDone(game: string): WorldEvent[] {
    this.count('rounds');
    return this.applyHearts(this.sim.roundDone(game));
  }

  private applyHearts(events: SimEvent[]): WorldEvent[] {
    for (const e of events) if (e.type === 'heart') {
      this.d.save.hearts += e.amount;
      const r = this.residents[e.r];
      // the hearts that he gave fill HIS meter (it only goes up)
      if (r) addFriendship(this.d.save, r.id, e.amount);
    }
    return events;
  }

  /** Runs the carnival for `dt` seconds. Returns what happened, for the page to show. */
  tick(dt: number): WorldEvent[] {
    if ((this.wearAge += dt) > 0.5) this.wearStale = true;
    const out: WorldEvent[] = [...this.pending.splice(0), ...this.applyHearts(this.sim.update(dt))];
    out.push(...this.checkProgress());
    return out;
  }

  /** The level (hearts can come from the talks too), the arrivals, the quests, the new items of the word journey. */
  checkProgress(): WorldEvent[] {
    const out: WorldEvent[] = [];
    const s = this.d.save;
    for (const level of levelsGained(this.lastHearts, s.hearts)) {
      out.push({ type: 'levelUp', level });
      const opened = this.slots.filter((x) => x.level === level).length;
      if (opened) out.push({ type: 'newPlace', level, count: opened });
    }
    this.lastHearts = s.hearts;
    // the residents that arrive with the levels that were reached (also after a long time away: each one comes once)
    for (let i = 0; i < ARRIVAL_LEVELS.length; i++) {
      const id = NEW_RESIDENTS[i];
      if (this.level >= ARRIVAL_LEVELS[i] && !s.arrived.includes(id)) {
        s.arrived.push(id);
        const all = residents(this.d.companion.name, this.d.companion.buddy, s.arrived);
        const r = all[all.length - 1];
        this.residents.push(r);
        this.sim.add(this.simOf(r));
        out.push({ type: 'arrival', resident: r, index: this.residents.length - 1 });
      }
    }
    s.levelDone = Math.max(s.levelDone, this.level);
    // a friendship level that was reached (by the hearts of the sim or of the talks): "we are better friends!"
    const fr = friendsOf(s);
    this.residents.forEach((r, i) => {
      const lv = friendLevel(fr.hearts[r.id] ?? 0);
      const seen = fr.seen[r.id] ?? 1;
      if (lv > seen) out.push({ type: 'friendUp', r: i, level: lv });
      if (lv !== (fr.seen[r.id] ?? 0)) fr.seen[r.id] = lv;
      if (lv >= 5) this.sim.setFollower(i, true);
    });
    // quests
    for (const q of finishedNow(s.quests.done, this.questCtx())) {
      s.quests.done.push(q.id);
      s.hearts += q.hearts;
      if (q.stars) this.d.give(q.stars);
      out.push({ type: 'quest', quest: q });
    }
    if (s.hearts !== this.lastHearts) {
      // the hearts of the quests may pass a level too
      out.push(...this.checkProgress());
    }
    // a world was finished in the word journey: the new things in the catalog
    const nowOpen = new Set(ITEMS.filter((i) => isItemOpen(i, this.d.progress())).map((i) => i.id));
    const fresh = [...nowOpen].filter((id) => !this.knownOpen.has(id));
    if (fresh.length) {
      this.knownOpen = nowOpen;
      out.push({ type: 'unlocked', items: fresh });
    }
    if (out.length) this.d.persist();
    return out;
  }

  /** the number of residents on the screen: all of them up to the limit of the tier (the others are "at home", and they change at every visit) */
  static visibleLimit(tier: 'high' | 'medium' | '2d'): number {
    return tier === 'high' ? 16 : tier === 'medium' ? 10 : 11;
  }
  static maxLevel = MAX_LEVEL;
  arrivalIndexAt(level: number): number {
    return arrivalAt(level);
  }
}
