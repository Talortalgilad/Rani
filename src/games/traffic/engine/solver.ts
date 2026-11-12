import { MAX_SLOTS, SIZES, REGULAR_SLOTS, type ColorId, type TrafficState } from './state';
import { boxOf, ownBox, type LevelDataLike } from './solver-types';
import { overlaps, swept, FAR, type Obb } from './geometry';

/**
 * Searches the game for a way to clear a level without helpers, and measures how hard the level is.
 * It plays the same rules as TrafficState on a compact state: which vehicles are still parked, what stands in the
 * station and how many passengers have boarded. Boarding is automatic and forced, so a move is "tap one vehicle".
 */

interface Entry { v: number; filled: number }
interface State { parked: bigint; station: Entry[]; qi: number }

export interface Metrics {
  free: number;
  safeMoves: number;
  traps: number;
  depth: number;
  slotsNeeded: number;
  exact: boolean;
}

export interface Solution {
  solvable: boolean;
  /** true when the search ran out of budget before it could tell */
  unknown: boolean;
  path: number[];
  nodes: number;
}

/** One way a vehicle can drive out: the vehicles (bits) that must be gone, and the conveyor belts whose first places must be empty. */
interface Way { mask: bigint; belts: { g: number; min: number }[] }

export class Solver {
  private n: number;
  private seats: number[];
  private color: ColorId[];
  private ways: Way[][];
  private beltMembers: number[][];
  private queue: ColorId[];
  private fail = new Map<number, Set<string>>();
  private ok = new Map<number, Map<string, number>>();
  private budget = 0;
  private spent = 0;
  private out = false;

  constructor(level: LevelDataLike) {
    const vs = [...level.vehicles].sort((a, b) => a.id - b.id);
    this.n = vs.length;
    this.seats = vs.map((v) => SIZES[v.type].seats);
    this.color = vs.map((v) => v.color);
    this.queue = level.queue;
    this.ids = vs.map((v) => v.id);
    const belts = level.belts ?? [];
    const slotBoxes = belts.map((b) => b.slots.map(([x, z]): Obb => ({ x, z, hl: SIZES.car.len / 2, hw: SIZES.car.wid / 2, heading: b.heading })));
    const beltIdx = new Map(belts.map((b, g) => [b.id, g]));
    this.beltMembers = belts.map(() => []);
    vs.forEach((v, i) => {
      if (v.belt) this.beltMembers[beltIdx.get(v.belt.id)!].push(i);
    });
    this.beltMembers.forEach((m) => m.sort((a, b) => vs[a].belt!.slot - vs[b].belt!.slot));
    // what every vehicle is to the others: its footprint (a belt car: its place on the belt, handled below)
    const col: (Obb | null)[] = vs.map((v) => (v.belt ? null : boxOf(v)));
    this.ways = vs.map((v, i) => {
      const headings = v.rotator ? [0, 90, 180, 270] : [v.heading];
      const g0 = v.belt ? beltIdx.get(v.belt.id)! : -1;
      return headings.map((h): Way => {
        let own: Obb = { ...ownBox(v), heading: h };
        // a car on a belt drives out of the front place
        if (g0 >= 0) own = { ...own, x: belts[g0].slots[0][0], z: belts[g0].slots[0][1], heading: belts[g0].heading };
        const sw = swept(own, FAR);
        let mask = 0n;
        col.forEach((c, j) => {
          if (j !== i && c && overlaps(sw, c)) mask |= 1n << BigInt(j);
        });
        const bl: { g: number; min: number }[] = [];
        slotBoxes.forEach((boxes, g) => {
          if (g === g0) return;
          const hit = boxes.findIndex((bx) => overlaps(sw, bx));
          if (hit >= 0) bl.push({ g, min: hit });
        });
        // the cars ahead of it on its own belt
        if (g0 >= 0) for (const m of this.beltMembers[g0]) if (vs[m].belt!.slot < v.belt!.slot) mask |= 1n << BigInt(m);
        return { mask, belts: bl };
      });
    });
  }
  private ids: number[];

  initial(): State {
    return { parked: (1n << BigInt(this.n)) - 1n, station: [], qi: 0 };
  }

  private key(s: State): string {
    return s.parked.toString(36) + '|' + s.station.map((e) => `${e.v}:${e.filled}`).join(',') + '|' + s.qi;
  }

  /** The position of a game in progress (the queue of this solver must be the queue that is left). */
  stateOf(ts: TrafficState): State {
    let parked = 0n;
    const station: Entry[] = [];
    const idx = new Map(this.ids.map((id, i) => [id, i]));
    for (const v of ts.vehicles) if (v.status === 'parked') parked |= 1n << BigInt(idx.get(v.id)!);
    for (const v of [...ts.vehicles].filter((x) => x.status === 'station' || x.status === 'driving').sort((a, b) => a.order - b.order)) station.push({ v: idx.get(v.id)!, filled: v.filled });
    return { parked, station, qi: 0 };
  }

  /** A vehicle flies to the VIP place: it joins the station whatever is in front of it. */
  applyAny(s: State, i: number): State {
    return this.apply({ ...s, parked: s.parked | (1n << BigInt(i)) }, i);
  }

  /** The vehicles that are still parked, as indexes. */
  parkedList(s: State): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.n; i++) if ((s.parked >> BigInt(i)) & 1n) out.push(i);
    return out;
  }

  /** How many cars of a conveyor belt are still parked. */
  private onBelt(s: State, g: number): number {
    let c = 0;
    for (const m of this.beltMembers[g]) if ((s.parked >> BigInt(m)) & 1n) c++;
    return c;
  }

  isFree(s: State, i: number): boolean {
    if (!((s.parked >> BigInt(i)) & 1n)) return false;
    return this.ways[i].some((w) => (w.mask & s.parked) === 0n && w.belts.every((b) => this.onBelt(s, b.g) <= b.min));
  }

  won(s: State): boolean {
    return s.qi >= this.queue.length;
  }

  /** The vehicles that can be tapped now: free, and a place in the station is open. */
  legal(s: State, cap: number): number[] {
    if (s.station.length >= cap) return [];
    const out: number[] = [];
    for (let i = 0; i < this.n; i++) if (this.isFree(s, i)) out.push(i);
    return out;
  }

  apply(s: State, i: number): State {
    const station = s.station.map((e) => ({ ...e }));
    station.push({ v: i, filled: 0 });
    let qi = s.qi;
    for (;;) {
      const c = this.queue[qi];
      if (!c) break;
      const e = station.find((x) => this.color[x.v] === c && x.filled < this.seats[x.v]);
      if (!e) break;
      e.filled++;
      qi++;
      if (e.filled >= this.seats[e.v]) station.splice(station.indexOf(e), 1);
    }
    return { parked: s.parked & ~(1n << BigInt(i)), station, qi };
  }

  /** Move order: the vehicles whose passengers are next first, then the newest vehicles (the generator builds backwards). */
  private ordered(s: State, cap: number): number[] {
    const next = this.queue.slice(s.qi, s.qi + 6);
    const w = (i: number) => {
      const k = next.indexOf(this.color[i]);
      return (k < 0 ? 0 : 8 - k) * 1000 + i;
    };
    return this.legal(s, cap).sort((a, b) => w(b) - w(a));
  }

  private memo(cap: number) {
    if (!this.fail.has(cap)) {
      this.fail.set(cap, new Set());
      this.ok.set(cap, new Map());
    }
    return { fail: this.fail.get(cap)!, ok: this.ok.get(cap)! };
  }

  /** null = ran out of budget. */
  private dfs(s: State, cap: number): boolean | null {
    if (this.won(s)) return true;
    const { fail, ok } = this.memo(cap);
    const k = this.key(s);
    if (fail.has(k)) return false;
    if (ok.has(k)) return true;
    if (++this.spent > this.budget) {
      this.out = true;
      return null;
    }
    let unknown = false;
    for (const m of this.ordered(s, cap)) {
      const r = this.dfs(this.apply(s, m), cap);
      if (r === true) {
        ok.set(k, m);
        return true;
      }
      if (r === null) {
        unknown = true;
        if (this.spent > this.budget) return null;
      }
    }
    if (unknown) return null;
    fail.add(k);
    return false;
  }

  /** Can the level be cleared from this state? */
  can(s: State, cap = REGULAR_SLOTS, budget = 60000): boolean | null {
    this.budget = budget;
    this.spent = 0;
    this.out = false;
    return this.dfs(s, cap);
  }

  /** A full solution from the start, as vehicle ids. */
  solve(cap = REGULAR_SLOTS, budget = 400000): Solution {
    let s = this.initial();
    const r = this.can(s, cap, budget);
    const nodes = this.spent;
    if (r !== true) return { solvable: false, unknown: r === null, path: [], nodes };
    const { ok } = this.memo(cap);
    const path: number[] = [];
    while (!this.won(s)) {
      const m = ok.get(this.key(s));
      if (m === undefined) break;
      path.push(this.ids[m]);
      s = this.apply(s, m);
    }
    return { solvable: this.won(s), unknown: false, path, nodes };
  }

  /** The longest run of moves after a mistake before the game is stuck. */
  private longest(s: State, cap: number, depthLeft: number, memo: Map<string, number>): number {
    const k = this.key(s);
    const hit = memo.get(k);
    if (hit !== undefined) return hit;
    if (++this.spent > this.budget) {
      this.out = true;
      return 0;
    }
    let best = 0;
    if (depthLeft > 0) for (const m of this.legal(s, cap)) best = Math.max(best, 1 + this.longest(this.apply(s, m), cap, depthLeft - 1, memo));
    memo.set(k, best);
    return best;
  }

  /**
   * Difficulty numbers. Starting from the first position, the search follows every move that does not lose yet (up to
   * `maxPly` moves deep and `maxStates` positions) and counts the moves that look fine but end in a dead end: the traps.
   */
  measure(_path: number[], opts: { budget?: number; maxPly?: number; maxStates?: number } = {}): Metrics {
    const budget = opts.budget ?? 25000;
    const maxPly = opts.maxPly ?? 8;
    const maxStates = opts.maxStates ?? 2500;
    const s0 = this.initial();
    const m0 = this.legal(s0, REGULAR_SLOTS);
    let safe = 0;
    let traps = 0;
    let depth = 0;
    let exact = true;
    const deadMemo = new Map<string, number>();
    const seen = new Set<string>([this.key(s0)]);
    let level: State[] = [s0];
    let expanded = 0;
    for (let ply = 0; ply < maxPly && level.length && expanded < maxStates; ply++) {
      const nextLevel: State[] = [];
      for (const s of level) {
        if (expanded++ >= maxStates) break;
        for (const m of this.legal(s, REGULAR_SLOTS)) {
          const child = this.apply(s, m);
          const r = this.can(child, REGULAR_SLOTS, budget);
          if (r === null) exact = false;
          if (ply === 0 && r !== false) safe++;
          if (r === false) {
            traps++;
            this.budget = budget * 2;
            this.spent = 0;
            this.out = false;
            depth = Math.max(depth, 1 + this.longest(child, REGULAR_SLOTS, 40, deadMemo));
            if (this.out) exact = false;
          } else if (r === true) {
            const k = this.key(child);
            if (!seen.has(k)) {
              seen.add(k);
              nextLevel.push(child);
            }
          }
        }
      }
      level = nextLevel;
    }
    let slotsNeeded = REGULAR_SLOTS;
    for (let cap = 1; cap <= REGULAR_SLOTS; cap++) {
      const r = this.can(s0, cap, budget * 2);
      if (r === true) {
        slotsNeeded = cap;
        break;
      }
      if (r === null) exact = false;
    }
    return { free: m0.length, safeMoves: safe, traps, depth, slotsNeeded, exact };
  }
}

/**
 * One number for the ramp test. More vehicles, a fuller station and deeper traps all count; the number of traps counts by
 * its logarithm (it can be in the thousands for a big lot, and that must not drown the rest).
 */
export function difficultyScore(vehicles: number, m: Pick<Metrics, 'traps' | 'depth' | 'slotsNeeded'>): number {
  return Math.round(vehicles * 1.5 + 8 * m.slotsNeeded + 2 * Math.min(m.depth, 20) + 1.5 * Math.log2(1 + m.traps));
}

/** What would get a stuck game going again: an extra place, or the VIP place for one of the parked vehicles. */
export function suggestHelper(vehicles: LevelDataLike['vehicles'], ts: TrafficState): { kind: 'slot' | 'vip'; vehicle?: number } | null {
  const solver = new Solver({ vehicles, queue: ts.queue, belts: ts.belts });
  const st = solver.stateOf(ts);
  const cap = ts.slots.length;
  if (cap < MAX_SLOTS && solver.can(st, cap + 1) === true) return { kind: 'slot' };
  if (ts.vip === null) {
    for (const i of solver.parkedList(st)) {
      const child = solver.applyAny(st, i);
      if (solver.can(child, cap + 1) === true) return { kind: 'vip', vehicle: vehicles.slice().sort((a, b) => a.id - b.id)[i].id };
    }
  }
  return null;
}
