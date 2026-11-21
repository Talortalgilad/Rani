/**
 * The carnival at work (SPEC-carnival.md 4.3, 4.5): residents get wishes, walk to a stall or a ride that fills them, stand in a queue (up to 3 at a stall, 4 at a ride), are
 * served, ride (2-4 together, about 6 seconds), and leave with a heart. A resident who wants to play waits near the plot of his game, and when Rani finishes a round
 * of that game everyone who waited there "played with her" and gives a double heart. Pure and deterministic (no DOM, no clock: `update(dt)`).
 *
 * Nothing here is ever negative: a wish that nothing fills just waits (and is tried again now and then), a queue is never left, nothing is lost when nobody plays.
 */
import { itemById, type Item } from './catalog';
import { FOOD_OF_ITEM } from './friends';
import { makeGraph, nearestNode, route, rng, Walker, type Graph } from './walk';
import type { Slot } from './slots';
import { fillers, nextGap, pickKind, TRAITS, type Personality, type Wish, type WishType } from './wishes';

export const STALL_QUEUE = 3;
export const RIDE_QUEUE = 4;
export const RIDE_SECONDS = 6;
export const SERVE_SECONDS = 1.6;
export const REST_SECONDS = 4;
export const RETRY_SECONDS = 3;
export const WALK_SPEED = 1.5;

export interface SimResident { id: string; personality: Personality; /** the game that he likes (an id of the registry) */ game?: string; /** his favourite food (a word id) and his friend (a resident id): they change where he goes */ food?: string; friend?: string }
export type Mode = 'wander' | 'going' | 'queue' | 'served' | 'riding' | 'resting' | 'waitplay' | 'working';
export interface Agent {
  id: string;
  personality: Personality;
  x: number;
  z: number;
  face: number;
  walking: boolean;
  wish: Wish | null;
  mode: Mode;
  /** the slot or plot that he is going to / standing at */
  at: string | null;
  /** his place in the line (0 is the first) */
  place: number;
  /** on the screen (false: at home, this visit) */
  active: boolean;
  /** standing still (tapped) */
  held: boolean;
  /** a baby (hatched from an egg): small steps */
  baby?: boolean;
}
export type SimEvent =
  | { type: 'wish'; r: number; wish: Wish }
  | { type: 'order'; r: number; item: string }
  | { type: 'heart'; r: number; amount: number; why: 'stall' | 'ride' | 'rest' | 'play' | 'work'; item?: string }
  | { type: 'board'; riders: number[]; item: string; slot: string }
  | { type: 'chat'; r: number; line: string };

interface Inner extends Agent {
  walker: Walker;
  route: { x: number; z: number }[];
  wishIn: number;
  retry: number;
  timer: number;
  game?: string;
  food?: string;
  friend?: string;
  slot: Slot | null;
  /** the stall where he works (a slot id): he stands behind the counter and does not wish */
  job: string | null;
  /** he follows the camera (level 5 of the friendship) */
  follower: boolean;
}

export interface SimWorld {
  slots: Slot[];
  /** the places of the games (the front of each plot), by the id of the game */
  plotFronts: Record<string, { x: number; z: number }>;
}

export class CarnivalSim {
  readonly graph: Graph = makeGraph();
  readonly agents: Inner[] = [];
  private built = new Map<string, string>();
  private rand: () => number;
  /** per slot: who waits (in order), who is being served / riding, and the timer */
  private lines = new Map<string, { waiting: number[]; busy: number[]; t: number }>();
  /** who waits near the plot of each game */
  private plays = new Map<string, number[]>();
  private ridePhase = new Map<string, number>();

  constructor(private world: SimWorld, residents: SimResident[], seed = 7, private tmult = 1) {
    this.rand = rng(seed);
    residents.forEach((r) => this.add(r));
  }

  add(r: SimResident): number {
    const i = this.agents.length;
    const start = (i * 7 + 1) % this.graph.nodes.length;
    const speed = (1.15 + (i % 3) * 0.12) * TRAITS[r.personality].speed;
    const walker = new Walker(this.graph, start, rng(100 + i), speed);
    this.agents.push({
      id: r.id, personality: r.personality, x: walker.x, z: walker.z, face: 1, walking: false, wish: null, mode: 'wander', at: null, place: 0, active: true, held: false,
      walker, route: [], wishIn: (8 + this.rand() * 25) * this.tmult, retry: 0, timer: 0, game: r.game, food: r.food, friend: r.friend, slot: null, job: null, follower: false,
    });
    return i;
  }

  /** a resident works at a stall (null: he stops); only a stall that is built */
  setJob(i: number, slotId: string | null): boolean {
    const a = this.agents[i];
    if (!a) return false;
    if (a.job) a.mode = 'wander';
    a.job = null;
    if (slotId) {
      const s = this.world.slots.find((x) => x.id === slotId);
      if (!s || !this.built.has(slotId) || this.item(slotId)?.slot !== 'stall') return false;
      if (a.mode !== 'wander') this.release(i);
      a.wish = null;
      a.job = slotId;
      a.mode = 'working';
      a.x = s.x + 0.85;
      a.z = s.z + 0.2;
      a.face = -1;
    } else a.walker.setAt(a.x, a.z, nearestNode(this.graph, a.x, a.z));
    return true;
  }
  jobOf(slotId: string): number {
    return this.agents.findIndex((a) => a.job === slotId);
  }
  setFollower(i: number, on: boolean): void {
    if (this.agents[i]) this.agents[i].follower = on;
  }
  /** where the camera looks (the followers walk towards it) */
  follow: { x: number; z: number } | null = null;
  private served = new Map<string, number>();

  hold(i: number, on: boolean): void {
    if (this.agents[i]) this.agents[i].held = on;
  }
  /** the ones who are "at home" this visit (the carnival shows only as many as the tier can draw) do not wish and are not shown */
  setActive(i: number, on: boolean): void {
    if (this.agents[i]) this.agents[i].active = on;
  }

  setBuilt(built: Record<string, string>): void {
    this.built = new Map(Object.entries(built));
    this.agents.forEach((a, i) => { if (a.job && !this.built.has(a.job)) this.setJob(i, null); });
    for (const [id, l] of this.lines) if (!this.built.has(id)) {
      // a stall that was taken away: whoever waited there is let go (he wanders and wishes again; nothing is lost)
      [...l.waiting, ...l.busy].forEach((r) => this.release(r));
      this.lines.delete(id);
    }
  }
  private item(slotId: string): Item | undefined {
    const id = this.built.get(slotId);
    return id ? itemById(id) : undefined;
  }
  /** how many wait near the plot of a game (the number on its card in the plain lobby) */
  waitingFor(game: string): number {
    return (this.plays.get(game) ?? []).length;
  }
  /** how many residents want each kind of thing now (the board of wishes) */
  wishCounts(): Record<WishType, number> {
    const c: Record<WishType, number> = { food: 0, drink: 0, fun: 0, rest: 0, play: 0 };
    for (const a of this.agents) if (a.wish) c[a.wish.kind]++;
    return c;
  }
  queueOf(slotId: string): number[] {
    return [...(this.lines.get(slotId)?.busy ?? []), ...(this.lines.get(slotId)?.waiting ?? [])];
  }
  /** a ride that is turning (0..1 of its time), for the picture */
  rideProgress(slotId: string): number | null {
    return this.ridePhase.get(slotId) ?? null;
  }

  private release(r: number): void {
    const a = this.agents[r];
    a.mode = 'wander';
    a.at = null;
    a.slot = null;
    a.route = [];
    a.walker.setAt(a.x, a.z, nearestNode(this.graph, a.x, a.z));
  }

  /** A round of a game was played: everyone who waited for it gives a double heart and goes. Returns the events. */
  roundDone(game: string): SimEvent[] {
    const ev: SimEvent[] = [];
    for (const r of this.plays.get(game) ?? []) {
      ev.push({ type: 'heart', r, amount: 2, why: 'play' });
      this.finish(r);
    }
    this.plays.delete(game);
    return ev;
  }
  private finish(r: number): void {
    const a = this.agents[r];
    a.wish = null;
    a.wishIn = nextGap(a.personality, this.rand()) * this.tmult;
    this.release(r);
  }

  private pathTo(a: Inner, to: { x: number; z: number }): { x: number; z: number }[] {
    const from = nearestNode(this.graph, a.x, a.z);
    const end = nearestNode(this.graph, to.x, to.z);
    const nodes = route(this.graph, from, end).map((n) => ({ x: this.graph.nodes[n].x, z: this.graph.nodes[n].z }));
    return [...nodes, to];
  }
  private goTo(r: number, mode: Mode, at: string, spot: { x: number; z: number }, place: number): void {
    const a = this.agents[r];
    a.mode = mode;
    a.at = at;
    a.place = place;
    a.route = this.pathTo(a, spot);
  }
  private spot(s: Slot, k: number): { x: number; z: number } {
    return { x: s.front.x + s.step.x * k, z: s.front.z + s.step.z * k };
  }

  /** Looks for something that fills his wish. Returns true when he set off. */
  private seek(r: number, prefer?: string): boolean {
    const a = this.agents[r];
    const w = a.wish;
    if (!w) return false;
    if (w.kind === 'play') {
      const front = this.world.plotFronts[w.game];
      if (!front) return false;
      const list = this.plays.get(w.game) ?? [];
      this.plays.set(w.game, [...list, r]);
      this.goTo(r, 'waitplay', w.game, { x: front.x + (list.length % 4) * 0.5 - 0.7, z: front.z + Math.floor(list.length / 4) * 0.5 }, list.length);
      return true;
    }
    const open = this.world.slots
      .filter((s) => this.built.has(s.id) && fillers(w, [this.item(s.id)!]).length > 0)
      .map((s) => ({ s, load: this.queueOf(s.id).length }))
      .filter(({ s, load }) => load < (s.kind === 'ride' ? RIDE_QUEUE : STALL_QUEUE))
      // his favourite food first (the stall of it counts as much nearer), and the stall where his friend goes
      .map(({ s, load }) => ({ s, load, cost: Math.hypot(s.front.x - a.x, s.front.z - a.z) + load * 2 - (a.food && FOOD_OF_ITEM[this.built.get(s.id) ?? ''] === a.food ? 6 : 0) - (s.id === prefer ? 8 : 0) }))
      .sort((p, q) => p.cost - q.cost);
    if (!open.length) return false;
    const { s } = open[0];
    const l = this.lines.get(s.id) ?? { waiting: [], busy: [], t: 0 };
    const place = l.waiting.length + l.busy.length;
    l.waiting.push(r);
    this.lines.set(s.id, l);
    a.slot = s;
    this.goTo(r, 'going', s.id, this.spot(s, place), place);
    // a friend who has nothing to do comes along and stands next to him in the line (sometimes)
    if (prefer === undefined && a.friend && this.rand() < 0.45) {
      const fi = this.agents.findIndex((x) => x.id === a.friend);
      const f = this.agents[fi];
      if (f && f.active && f.mode === 'wander' && !f.held && !f.job && !f.wish) {
        f.wish = { ...w };
        f.retry = 0.2;
        this.seek(fi, s.id);
      }
    }
    return true;
  }

  /** the parade of Friday: everybody walks round the plaza in a line, at the same pace (null: no parade) */
  parade: { t: number } | null = null;
  setBaby(i: number, on: boolean): void {
    if (this.agents[i]) this.agents[i].baby = on;
  }
  /** the places of the parade: in a ring round the plaza, every one a step behind the one before */
  private paradeStep(dt: number): void {
    const p = this.parade!;
    p.t += dt;
    const on = this.agents.filter((a) => a.active);
    const n = Math.max(1, on.length);
    on.forEach((a, k) => {
      const ang = p.t * 0.45 + (k / n) * Math.PI * 2;
      const nx = Math.cos(ang) * 2.7, nz = Math.sin(ang) * 2.7 + 0.4;
      a.face = nx - a.x > 0.001 ? 1 : nx - a.x < -0.001 ? -1 : a.face;
      a.x = nx;
      a.z = nz;
      a.walking = true;
      a.mode = 'wander';
      a.wish = null;
      a.held = false;
    });
  }
  /** puts one somewhere (a baby in front of the nest) */
  placeAt(i: number, x: number, z: number): void {
    const a = this.agents[i];
    if (!a) return;
    a.x = x;
    a.z = z;
    a.walker.setAt(x, z, nearestNode(this.graph, x, z));
  }
  /** the parade ends: they go on from where they stand */
  endParade(): void {
    this.parade = null;
    this.agents.forEach((a) => {
      a.walking = false;
      a.walker.setAt(a.x, a.z, nearestNode(this.graph, a.x, a.z));
    });
  }
  update(dt: number): SimEvent[] {
    const ev: SimEvent[] = [];
    if (this.parade) {
      this.paradeStep(dt);
      return ev;
    }
    this.agents.forEach((a, r) => {
      if (!a.active) return;
      if (a.mode === 'working') {
        a.walking = false;
        return;
      }
      // wishes: a new one now and then (never two), and an old one that nothing filled is tried again
      if (!a.wish) {
        a.wishIn -= dt;
        if (a.wishIn <= 0 && a.mode === 'wander') {
          const allowed: WishType[] = ['food', 'drink', 'fun', 'rest'];
          if (a.game) allowed.push('play');
          const kind = pickKind(a.personality, this.rand(), allowed);
          a.wish = kind === 'play' ? { kind, game: a.game! } : { kind };
          a.retry = 0.5;
          ev.push({ type: 'wish', r, wish: a.wish });
        }
      } else if (a.mode === 'wander') {
        a.retry -= dt;
        if (a.retry <= 0) {
          a.retry = RETRY_SECONDS;
          this.seek(r);
        }
      }
      // moving
      if (a.held && a.mode === 'wander') {
        a.walking = false;
      } else if (a.mode === 'wander' && a.follower && this.follow && !a.wish && Math.hypot(this.follow.x - a.x, this.follow.z - a.z) > 1.6) {
        // a best friend goes after the camera, to a place a little beside its centre
        const dx = this.follow.x + 0.9 * (1 + (r % 3) * 0.5) - a.x, dz = this.follow.z + 0.6 - a.z, d = Math.hypot(dx, dz) || 1;
        const st = Math.min(d, WALK_SPEED * 1.1 * dt);
        a.x += (dx / d) * st;
        a.z += (dz / d) * st;
        a.face = dx > 0 ? 1 : -1;
        a.walking = true;
        a.walker.setAt(a.x, a.z, nearestNode(this.graph, a.x, a.z));
      } else if (a.mode === 'wander') {
        a.walker.update(a.baby ? dt * 0.7 : dt);
        a.x = a.walker.x;
        a.z = a.walker.z;
        a.face = a.walker.face;
        a.walking = a.walker.walking;
      } else if (a.route.length) {
        const t = a.route[0];
        const d = Math.hypot(t.x - a.x, t.z - a.z);
        const step = WALK_SPEED * TRAITS[a.personality].speed * dt;
        if (d <= step) {
          a.x = t.x;
          a.z = t.z;
          a.route.shift();
        } else {
          a.x += ((t.x - a.x) / d) * step;
          a.z += ((t.z - a.z) / d) * step;
        }
        if (Math.abs(t.x - a.x) > 0.01) a.face = t.x > a.x ? 1 : -1;
        a.walking = true;
      } else a.walking = false;
    });
    // the lines
    for (const [slotId, l] of this.lines) {
      const s = this.world.slots.find((x) => x.id === slotId)!;
      const item = this.item(slotId);
      if (!item) continue;
      const ready = (r: number): boolean => this.agents[r].route.length === 0;
      l.waiting.forEach((r, k) => {
        const a = this.agents[r];
        // moving up in the line
        if (a.place !== k + l.busy.length) {
          a.place = k + l.busy.length;
          a.route = this.pathTo(a, this.spot(s, a.place));
        }
        if (a.mode === 'going' && ready(r)) {
          a.mode = 'queue';
          if (a.place >= 1 && this.rand() < 0.3) ev.push({ type: 'chat', r, line: 'cs_queue' });
        }
      });
      if (s.kind === 'ride') this.updateRide(s, item, l, dt, ev);
      else if (item.kind === 'rest') this.updateRest(l, dt, ev);
      else this.updateStall(item, l, dt, ev);
    }
    return ev;
  }

  private updateStall(item: Item, l: { waiting: number[]; busy: number[]; t: number }, dt: number, ev: SimEvent[]): void {
    if (l.busy.length) {
      l.t -= dt;
      if (l.t <= 0) {
        const r = l.busy.shift()!;
        ev.push({ type: 'heart', r, amount: 1, why: 'stall', item: item.id });
        // a stall with a seller gives one more heart for every three customers (the heart is the seller's)
        const slotId = this.agents[r].at ?? '';
        const w = this.agents.findIndex((x) => x.job === slotId && slotId);
        if (w >= 0) {
          const n = (this.served.get(slotId) ?? 0) + 1;
          this.served.set(slotId, n);
          if (n % 3 === 0) ev.push({ type: 'heart', r: w, amount: 1, why: 'work', item: item.id });
        }
        this.finish(r);
      }
      return;
    }
    const first = l.waiting[0];
    if (first === undefined) return;
    const a = this.agents[first];
    if (a.mode === 'queue' && a.route.length === 0 && a.place === 0) {
      l.waiting.shift();
      l.busy.push(first);
      a.mode = 'served';
      l.t = SERVE_SECONDS;
      ev.push({ type: 'order', r: first, item: item.id });
    }
  }
  private updateRest(l: { waiting: number[]; busy: number[]; t: number }, dt: number, ev: SimEvent[]): void {
    if (l.busy.length) {
      l.t -= dt;
      if (l.t <= 0) {
        const r = l.busy.shift()!;
        ev.push({ type: 'heart', r, amount: 1, why: 'rest' });
        ev.push({ type: 'chat', r, line: 'cs_rested' });
        this.finish(r);
      }
      return;
    }
    const first = l.waiting[0];
    const a = first === undefined ? null : this.agents[first];
    if (a && a.mode === 'queue' && a.route.length === 0 && a.place === 0) {
      l.waiting.shift();
      l.busy.push(first!);
      a.mode = 'resting';
      l.t = REST_SECONDS;
    }
  }
  private updateRide(s: Slot, item: Item, l: { waiting: number[]; busy: number[]; t: number }, dt: number, ev: SimEvent[]): void {
    if (l.busy.length) {
      l.t -= dt;
      this.ridePhase.set(s.id, Math.min(1, 1 - l.t / RIDE_SECONDS));
      l.busy.forEach((r, k) => {
        const a = this.agents[r];
        const ang = (k / l.busy.length) * Math.PI * 2 + (1 - l.t / RIDE_SECONDS) * 6;
        a.x = s.x + Math.cos(ang) * 0.5;
        a.z = s.z + 0.15 + Math.sin(ang) * 0.25;
      });
      if (l.t <= 0) {
        for (const r of l.busy) {
          ev.push({ type: 'heart', r, amount: 1, why: 'ride', item: item.id });
          ev.push({ type: 'chat', r, line: 'cs_fun' });
          this.finish(r);
        }
        l.busy = [];
        this.ridePhase.delete(s.id);
      }
      return;
    }
    // it is free: the first 2-4 who stand at the entrance get on (one alone gets on after a few seconds)
    const here = l.waiting.filter((r) => this.agents[r].mode === 'queue' && this.agents[r].route.length === 0);
    if (!here.length) return;
    this.agents[here[0]].timer += dt;
    if (here.length >= 2 || this.agents[here[0]].timer >= 4) {
      const riders = here.slice(0, RIDE_QUEUE);
      l.waiting = l.waiting.filter((r) => !riders.includes(r));
      l.busy = riders;
      l.t = RIDE_SECONDS;
      riders.forEach((r, k) => {
        this.agents[r].mode = 'riding';
        this.agents[r].timer = 0;
        // only the first says that his turn came
        if (k === 0) ev.push({ type: 'chat', r, line: 'cs_my_turn' });
      });
      ev.push({ type: 'board', riders, item: item.id, slot: s.id });
    }
  }
}
