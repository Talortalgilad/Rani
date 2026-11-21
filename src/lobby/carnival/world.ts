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
import { clockOf, collectedFor, dailyOf, dayKey, daysBetween, eggAtLevel, giftFor, greetingAt, growthOf, guestFor, hatchable, isFriday, letterFor, nextNewcomer, type Gift, type Letter } from './daily';
import { addFriendship, canWear, friendLevel, friendOf, friendsOf, giftOf, isPartyDay, levelOfResident, maxFriendLevel, partyKey, priceOf, putOn, trickOf, wearing, type Trick } from './friends';

export type WorldEvent =
  | SimEvent
  | { type: 'levelUp'; level: number }
  | { type: 'arrival'; resident: Resident; index: number }
  | { type: 'newPlace'; level: number; count: number }
  | { type: 'quest'; quest: Quest }
  | { type: 'built'; slot: string; item: string }
  | { type: 'removed'; slot: string; item: string }
  | { type: 'unlocked'; items: string[] }
  | { type: 'friendUp'; r: number; level: number }
  /** stage 4 (SPEC-carnival.md 4.7): the reasons to come back */
  | { type: 'welcomeBack'; hearts: number; days: number }
  | { type: 'egg'; level: number }
  | { type: 'hatch'; resident: Resident; index: number }
  | { type: 'guest'; resident: Resident; index: number }
  | { type: 'greet'; kind: 'morning' | 'night' }
  | { type: 'mailWaiting' }
  | { type: 'giftWaiting' }
  | { type: 'paradeDay' };

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
  external?(): { lolly: number; workshop: number; orders?: number };
  /** the squishies that Rani made and sent from her shelf (at most 8): residents like the others */
  mine?(): Resident[];
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
    this.residents = [...residents(d.companion.name, d.companion.buddy, d.save.arrived), ...(d.mine?.() ?? [])];
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
  /** the clock of the carnival: the real one plus the days that the parents' area skipped (for testing) */
  now(): Date {
    return clockOf(this.d.now?.() ?? new Date(), dailyOf(this.d.save).skip);
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
    if (!r || (f.owned[id] ?? 0) < 1 || !canWear(r.id, id)) return false;
    f.owned[id]--;
    if (!f.owned[id]) delete f.owned[id];
    for (const off of putOn(f, r.id, id)) f.owned[off] = (f.owned[off] ?? 0) + 1;
    if (id === 'partyhat' || id === 'flowercrown' || id === 'chefhat' || id === 'crown') f.hats++;
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
  chooseHome(limit: number, visit: number, keep: number[] = []): void {
    // the squishies that Rani made are always out (they are hers, and they are at most 8), and so are those in `keep`: the limit is for the others
    const others = this.residents.map((r, i) => (r.mine || keep.includes(i) ? -1 : i)).filter((i) => i >= 0);
    const n = others.length;
    const away = new Set<number>();
    if (n > limit) {
      const order = others.slice(1).sort((a, b) => ((a * 7919 + visit * 104729) % 1009) - ((b * 7919 + visit * 104729) % 1009));
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
    return this.d.stars() >= item.price || dailyOf(this.d.save).freeDecor.includes(item.id) ? 'ok' : 'stars';
  }
  build(slotId: string, itemId: string): Buy {
    const slot = this.slot(slotId);
    const item = itemById(itemId);
    if (!slot || !item || slot.kind !== item.slot) return { ok: false, reason: 'unknown' };
    if (!this.isSlotOpen(slot)) return { ok: false, reason: 'level' };
    if (this.d.save.built[slotId]) return { ok: false, reason: 'taken' };
    if (!isItemOpen(item, this.d.progress())) return { ok: false, reason: 'locked' };
    // a decoration from the gift of the day is built for free (once)
    const dd = dailyOf(this.d.save);
    const free = dd.freeDecor.indexOf(itemId);
    if (free < 0 && this.d.stars() < item.price) return { ok: false, reason: 'stars' };
    if (free >= 0) (dd.freeDecor.splice(free, 1), dd.freeBuilt.push(slotId));
    else this.d.spend(item.price);
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
    const dd = dailyOf(this.d.save);
    const fb = dd.freeBuilt.indexOf(slotId);
    if (fb >= 0) dd.freeBuilt.splice(fb, 1);
    else this.d.give(item.price);
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
    const ex = this.d.external?.() ?? { lolly: 0, workshop: 0, orders: 0 };
    return { built: this.d.save.built, level: this.level, taps: c.taps ?? 0, rounds: c.rounds ?? 0, answers: this.d.save.answers, friend: maxFriendLevel(this.d.save), tricks: f.tricks, jobs: f.jobs, hats: f.hats, remembered: f.remembered, parties: f.parties, lolly: ex.lolly, workshop: ex.workshop, orders: ex.orders ?? 0, hatched: dailyOf(this.d.save).hatched, letters: dailyOf(this.d.save).letters.length, gifts: dailyOf(this.d.save).gifts, stayed: dailyOf(this.d.save).stayed, parades: dailyOf(this.d.save).parades };
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
    if ((this.growAge += dt) > 0.5) (this.growStale = true), this.refreshBlink();
    const out: WorldEvent[] = [...this.pending.splice(0), ...this.applyHearts(this.sim.update(dt))];
    out.push(...this.checkProgress());
    return out;
  }

  // ---------------------------------------------------------------- reasons to come back (SPEC-carnival.md 4.7)
  /** a resident of the carnival from the list of newcomers (a baby from an egg, or the guest): added to the world and the sim */
  private addNewcomer(id: string, guest: boolean): { resident: Resident; index: number } {
    const all = residents(this.d.companion.name, this.d.companion.buddy, [...this.d.save.arrived.filter((x) => x !== id), id]);
    const r = { ...all[all.length - 1], ...(guest ? { guest: true } : {}) };
    this.residents.push(r);
    this.sim.add(this.simOf(r));
    return { resident: r, index: this.residents.length - 1 };
  }
  /** the first minute of a visit, in the order of SPEC 4.8: she is welcomed (and the hearts that were collected), the egg that slept hatches, the gift and the mail wait, the guest comes in. A visit on the same day does nothing twice. */
  beginVisit(): WorldEvent[] {
    const out: WorldEvent[] = [];
    const s = this.d.save, d = dailyOf(s), now = this.now(), day = dayKey(now);
    // 1. back after a day or more: the squishies collected hearts for her (a few for each day, with a ceiling: nothing is lost by staying away, nothing is said about the days)
    const away = daysBetween(d.lastDay, day);
    if (d.lastDay && away >= 1 && d.collectedDay !== day) {
      const n = collectedFor(away);
      d.collectedDay = day;
      s.hearts += n;
      out.push({ type: 'welcomeBack', hearts: n, days: away });
    }
    // 2. the egg that slept one night hatches (one for each day she comes): a baby from the album
    const egg = hatchable(d, day);
    if (egg && !s.arrived.includes(egg.id)) {
      d.eggs = d.eggs.filter((e) => e !== egg);
      const n = this.addNewcomer(egg.id, false);
      s.arrived.push(egg.id);
      d.baby.push(egg.id);
      d.hatched++;
      this.sim.setBaby(n.index, true);
      out.push({ type: 'hatch', resident: n.resident, index: n.index });
    }
    // 3. the gift of the day and the mail wait (they blink gently; nothing is lost by not opening them)
    if (this.giftReady()) out.push({ type: 'giftWaiting' });
    if (this.mailReady()) out.push({ type: 'mailWaiting' });
    // 4. the guest of the day comes in (the same one all day; one who did not stay may come again another day)
    const gid = guestFor(s.arrived, d, day);
    if (gid && !s.arrived.includes(gid)) {
      if (!d.guest || d.guest.day !== day) d.guest = { day, id: gid, talked: false, stayed: false };
      const n = this.addNewcomer(gid, true);
      out.push({ type: 'guest', resident: n.resident, index: n.index });
    }
    // morning and night, and the parade of Friday
    const g = greetingAt(now);
    if (g) out.push({ type: 'greet', kind: g });
    if (isFriday(now) && d.paradeDay !== day) out.push({ type: 'paradeDay' });
    d.lastDay = day;
    this.wearStale = true;
    this.refreshBlink();
    this.d.persist();
    out.push(...this.checkProgress());
    return out;
  }
  get daily() {
    return dailyOf(this.d.save);
  }
  /** the eggs that sleep in the nest, and whether the one in front was found today (it hatches on another day) */
  eggs(): number {
    return dailyOf(this.d.save).eggs.length;
  }
  eggIsNew(): boolean {
    const d = dailyOf(this.d.save);
    return d.eggs.length > 0 && d.eggs[0].found === dayKey(this.now());
  }
  /** the guest of the day (the index of the resident), while he has not stayed */
  guestIndex(): number {
    const g = dailyOf(this.d.save).guest;
    return g && !g.stayed && g.day === dayKey(this.now()) ? this.residents.findIndex((r) => r.guest && r.id === g.id) : -1;
  }
  /** one talk with the guest was answered: now he asks if he can stay */
  guestTalked(): boolean {
    const g = dailyOf(this.d.save).guest;
    if (!g || g.stayed) return false;
    g.talked = true;
    this.d.persist();
    return true;
  }
  /** "yes": he stays (he is one of the residents for good) */
  stayGuest(): number {
    const s = this.d.save, d = dailyOf(s);
    const g = d.guest;
    const i = this.guestIndex();
    if (!g || i < 0) return -1;
    g.stayed = true;
    if (!s.arrived.includes(g.id)) s.arrived.push(g.id);
    this.residents[i] = { ...this.residents[i], guest: false };
    d.stayed++;
    this.d.persist();
    return i;
  }
  /** what the scene and the page ask in every frame (the gift and the mail blink while they wait): worked out again every half second, not in every frame */
  private blinkG = true;
  private blinkM = true;
  giftBlink(): boolean {
    return this.blinkG;
  }
  mailBlink(): boolean {
    return this.blinkM;
  }
  private refreshBlink(): void {
    this.blinkG = this.giftReady();
    this.blinkM = this.mailReady();
  }
  giftReady(): boolean {
    return dailyOf(this.d.save).giftDay !== dayKey(this.now());
  }
  mailReady(): boolean {
    return dailyOf(this.d.save).mailDay !== dayKey(this.now());
  }
  /** the letter of the day (once a day): it is saved in the album */
  openMail(): Letter | null {
    const d = dailyOf(this.d.save), day = dayKey(this.now());
    if (d.mailDay === day) return null;
    const from = this.residents.filter((r) => !r.guest).map((r) => r.id);
    const l = letterFor(day, from.length ? from : ['companion']);
    d.letters = [...d.letters, l].slice(-80);
    d.mailDay = day;
    this.refreshBlink();
    this.d.persist();
    return l;
  }
  letters(): Letter[] {
    return dailyOf(this.d.save).letters;
  }
  /** the gift of the day (once a day; one box, it does not pile up and it does not go away): hearts, a decoration that is built for free, or an accessory for the stock */
  openDailyGift(): Gift | null {
    const s = this.d.save, d = dailyOf(s), day = dayKey(this.now());
    if (d.giftDay === day) return null;
    const decor = ITEMS.filter((i) => i.kind === 'decor' && i.price <= 6 && isItemOpen(i, this.d.progress())).map((i) => i.id);
    const g = giftFor(day, decor);
    if (g.kind === 'hearts') s.hearts += g.n;
    else if (g.kind === 'decor') d.freeDecor.push(g.id);
    else friendsOf(s).owned[g.id] = (friendsOf(s).owned[g.id] ?? 0) + 1;
    d.giftDay = day;
    d.gifts++;
    this.refreshBlink();
    this.d.persist();
    return g;
  }
  /** is it Friday and did she not join the parade today? */
  paradeReady(): boolean {
    const now = this.now();
    return isFriday(now) && dailyOf(this.d.save).paradeDay !== dayKey(now);
  }
  paradeOn(): boolean {
    return this.sim.parade !== null;
  }
  startParade(): void {
    this.sim.parade = { t: 0 };
    this.wearStale = true;
  }
  /** the parade is over (she tapped to the rhythm: it counts for today) */
  endParade(joined: boolean): void {
    this.sim.endParade();
    if (joined) {
      const d = dailyOf(this.d.save);
      d.paradeDay = dayKey(this.now());
      d.parades++;
      this.d.persist();
    }
  }
  /** puts a resident somewhere (the baby that hatches is put in front of the nest) */
  placeAt(i: number, x: number, z: number): void {
    this.sim.placeAt(i, x, z);
  }
  /** the size of a baby (60 %, 80 % at friendship level 2, 100 % at level 3); the others are 1. Worked out again only when something changes. */
  private growCache: number[] = [];
  private growStale = true;
  private growAge = 0;
  growth(i: number): number {
    if (this.growStale || this.growCache.length !== this.residents.length) {
      const baby = new Set(dailyOf(this.d.save).baby);
      this.growCache = this.residents.map((r) => (baby.has(r.id) ? growthOf(levelOfResident(this.d.save, r.id)) : 1));
      this.growStale = false;
      this.growAge = 0;
    }
    return this.growCache[i] ?? 1;
  }
  isBaby(i: number): boolean {
    const r = this.residents[i];
    return !!r && dailyOf(this.d.save).baby.includes(r.id);
  }

  /** The level (hearts can come from the talks too), the arrivals, the quests, the new items of the word journey. */
  checkProgress(): WorldEvent[] {
    const out: WorldEvent[] = [];
    const s = this.d.save;
    for (const level of levelsGained(this.lastHearts, s.hearts)) {
      out.push({ type: 'levelUp', level });
      // every second level brings an egg to the nest (once for each level): it sleeps one night
      const dly = dailyOf(s);
      if (eggAtLevel(level) && !dly.eggLevels.includes(level)) {
        const id = nextNewcomer(s.arrived, dly, dayKey(this.now()));
        if (id) {
          dly.eggs.push({ id, found: dayKey(this.now()) });
          dly.eggLevels.push(level);
          out.push({ type: 'egg', level });
        }
      }
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
