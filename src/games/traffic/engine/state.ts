import { firstContact, pathClear, type Obb } from './geometry';

export type VType = 'car' | 'van' | 'bus';
export type ColorId = 'red' | 'orange' | 'yellow' | 'green' | 'cyan' | 'blue' | 'purple' | 'pink' | 'brown';

/** Length and width in cells, and seats. */
export const SIZES: Record<VType, { len: number; wid: number; seats: number }> = {
  car: { len: 2, wid: 1.18, seats: 4 },
  van: { len: 3, wid: 1.18, seats: 6 },
  bus: { len: 4, wid: 1.28, seats: 10 },
};

export interface VehicleDef {
  id: number;
  type: VType;
  color: ColorId;
  x: number;
  z: number;
  /** direction of the arrow, degrees: 0 = +x, 90 = +z (toward the player), 270 = toward the station */
  heading: number;
  /** a "?" vehicle: its colour is hidden until the vehicle in front of it leaves */
  hidden?: boolean;
}

export type VStatus = 'parked' | 'driving' | 'station' | 'gone';

export interface Vehicle extends VehicleDef {
  status: VStatus;
  slot: number | null;
  filled: number;
  /** set when the "?" is uncovered */
  revealed: boolean;
  /** the vehicle whose leaving uncovers this "?" */
  revealedBy: number | null;
  /** when it was sent to the station (0, 1, 2...): the one that was sent first gets the passenger first */
  order: number;
}

export type TapResult =
  | { kind: 'exit'; id: number; slot: number }
  | { kind: 'blocked'; id: number; by: number; distance: number }
  | { kind: 'ignored' }
  | { kind: 'full' };

export type Status = 'playing' | 'won' | 'stuck';

export const REGULAR_SLOTS = 4;
export const MAX_SLOTS = 7;
/** `slot` of a vehicle that sits in the VIP place. */
export const VIP_SLOT = -1;

export interface SaveData {
  veh: { id: number; status: VStatus; slot: number | null; filled: number; revealed: boolean; order: number }[];
  slots: (number | null)[];
  vip: number | null;
  queue: ColorId[];
  boarded: number;
  moves: number;
  sent: number;
}

interface Snapshot {
  veh: { status: VStatus; slot: number | null; filled: number; revealed: boolean; order: number }[];
  slots: (number | null)[];
  vip: number | null;
  queue: ColorId[];
  boarded: number;
  moves: number;
  sent: number;
}

export const boxOf = (v: VehicleDef): Obb => ({ x: v.x, z: v.z, hl: SIZES[v.type].len / 2, hw: SIZES[v.type].wid / 2, heading: v.heading });

/** The rules of the game, with no graphics: tap, exit, blocked, boarding, win and "stuck". */
export class TrafficState {
  vehicles: Vehicle[];
  /** vehicle id per regular station slot; null = free. More slots can be opened with `addSlot` (up to 7). */
  slots: (number | null)[] = Array(REGULAR_SLOTS).fill(null);
  /** the vehicle in the VIP place, if any */
  vip: number | null = null;
  private sent = 0;
  private history: Snapshot[] = [];
  queue: ColorId[];
  readonly total: number;
  boarded = 0;
  moves = 0;

  constructor(defs: VehicleDef[], queue: ColorId[]) {
    this.vehicles = defs.map((d) => ({ ...d, status: 'parked', slot: null, filled: 0, revealed: !d.hidden, revealedBy: null, order: 0 }));
    this.queue = [...queue];
    this.total = queue.length;
    for (const v of this.vehicles.filter((x) => x.hidden)) {
      const hit = firstContact(boxOf(v), this.others(v.id));
      if (hit) v.revealedBy = hit.id;
      else v.revealed = true;
    }
  }

  get(id: number): Vehicle {
    const v = this.vehicles.find((x) => x.id === id);
    if (!v) throw new Error(`no vehicle ${id}`);
    return v;
  }

  private others(except: number): { id: number; box: Obb }[] {
    return this.vehicles.filter((v) => v.id !== except && v.status === 'parked').map((v) => ({ id: v.id, box: boxOf(v) }));
  }

  /** Vehicles still in the lot that can drive out right now. */
  freeVehicles(): Vehicle[] {
    return this.vehicles.filter((v) => v.status === 'parked' && pathClear(boxOf(v), this.others(v.id).map((o) => o.box)));
  }

  /** The colour a vehicle shows to the player ("?" until uncovered). */
  shownColor(v: Vehicle): ColorId | null {
    return v.hidden && !v.revealed ? null : v.color;
  }

  tap(id: number): TapResult {
    const v = this.get(id);
    if (v.status !== 'parked' || this.status !== 'playing') return { kind: 'ignored' };
    const hit = firstContact(boxOf(v), this.others(id));
    if (hit) return { kind: 'blocked', id, by: hit.id, distance: hit.distance }; // a blocked tap is not a move
    const slot = this.slots.findIndex((s) => s === null);
    if (slot < 0) return { kind: 'full' };
    this.history.push(this.snapshot());
    v.status = 'driving';
    v.slot = slot;
    v.order = this.sent++;
    this.slots[slot] = id;
    this.moves++;
    // leaving the lot uncovers the "?" cars that were behind it
    return { kind: 'exit', id, slot };
  }

  /** Vehicles uncovered by `id` leaving the lot. */
  uncovered(id: number): Vehicle[] {
    const out: Vehicle[] = [];
    for (const v of this.vehicles) {
      if (v.hidden && !v.revealed && v.revealedBy === id) {
        v.revealed = true;
        out.push(v);
      }
    }
    return out;
  }

  /** The vehicle reached its place. */
  arrive(id: number): void {
    this.get(id).status = 'station';
  }

  /** Can the passenger at the head of the queue board someone right now? */
  nextBoarding(): { vehicle: Vehicle; color: ColorId } | null {
    const color = this.queue[0];
    if (!color) return null;
    let v: Vehicle | null = null;
    for (const x of this.vehicles) {
      if (x.status !== 'station' || x.color !== color || x.filled >= SIZES[x.type].seats) continue;
      if (!v || x.order < v.order) v = x; // the one that was sent first
    }
    return v ? { vehicle: v, color } : null;
  }

  /** The head passenger boards. Returns the vehicle and whether it is now full. */
  board(): { vehicle: Vehicle; full: boolean; left: number } | null {
    const next = this.nextBoarding();
    if (!next) return null;
    this.queue.shift();
    next.vehicle.filled++;
    this.boarded++;
    const seats = SIZES[next.vehicle.type].seats;
    return { vehicle: next.vehicle, full: next.vehicle.filled >= seats, left: seats - next.vehicle.filled };
  }

  /** A full vehicle honks and leaves; its place is free again. */
  depart(id: number): void {
    const v = this.get(id);
    v.status = 'gone';
    if (v.slot === VIP_SLOT) this.vip = null;
    else if (v.slot !== null) this.slots[v.slot] = null;
  }

  // ---- helpers (stage 2 puts buttons on them; the rules live here)

  private snapshot(): Snapshot {
    return {
      veh: this.vehicles.map((v) => ({ status: v.status, slot: v.slot, filled: v.filled, revealed: v.revealed, order: v.order })),
      slots: [...this.slots],
      vip: this.vip,
      queue: [...this.queue],
      boarded: this.boarded,
      moves: this.moves,
      sent: this.sent,
    };
  }

  /** The state of a game in the middle, for the 10-minute resume. Only meaningful when nothing is on the road. */
  serialize(): SaveData {
    return {
      veh: this.vehicles.map((v) => ({ id: v.id, status: v.status === 'driving' ? 'parked' : v.status, slot: v.status === 'driving' ? null : v.slot, filled: v.filled, revealed: v.revealed, order: v.order })),
      slots: this.slots.map((s) => (s !== null && this.get(s).status === 'driving' ? null : s)),
      vip: this.vip,
      queue: [...this.queue],
      boarded: this.boarded,
      moves: this.moves,
      sent: this.sent,
    };
  }

  /** Puts a saved game back. Returns false when it does not belong to this level. */
  load(d: SaveData): boolean {
    if (d.veh.length !== this.vehicles.length || d.boarded + d.queue.length !== this.total) return false;
    for (const sv of d.veh) {
      const v = this.vehicles.find((x) => x.id === sv.id);
      if (!v) return false;
      Object.assign(v, { status: sv.status, slot: sv.slot, filled: sv.filled, revealed: sv.revealed, order: sv.order });
    }
    this.slots = [...d.slots];
    this.vip = d.vip;
    this.queue = [...d.queue];
    this.boarded = d.boarded;
    this.moves = d.moves;
    this.sent = d.sent;
    this.history = [];
    return true;
  }

  /** Can the last move be taken back? Only when nothing is on the road. */
  canUndo(): boolean {
    return this.history.length > 0 && !this.vehicles.some((v) => v.status === 'driving');
  }

  /** Take back the last tap together with everything that followed it (boarding, departures). */
  undo(): boolean {
    if (!this.canUndo()) return false;
    const s = this.history.pop()!;
    this.vehicles.forEach((v, i) => Object.assign(v, s.veh[i]));
    this.slots = s.slots;
    this.vip = s.vip;
    this.queue = s.queue;
    this.boarded = s.boarded;
    this.moves = s.moves;
    this.sent = s.sent;
    return true;
  }

  /** "Extra place": one more regular slot for this level. */
  addSlot(): boolean {
    if (this.slots.length >= MAX_SLOTS) return false;
    this.slots.push(null);
    return true;
  }

  /** "VIP": any parked vehicle flies straight to the VIP place, whatever is in front of it. */
  sendToVip(id: number): boolean {
    const v = this.get(id);
    if (v.status !== 'parked' || this.vip !== null || this.status !== 'playing') return false;
    this.history.push(this.snapshot());
    v.status = 'driving';
    v.slot = VIP_SLOT;
    v.order = this.sent++;
    this.vip = id;
    return true;
  }

  /** "Shuffle": the passengers that have not boarded yet are put in a new order (given by the caller's random numbers). */
  shuffleQueue(rand: () => number): void {
    const q = this.queue;
    for (let i = q.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [q[i], q[j]] = [q[j], q[i]];
    }
  }

  seatsLeft(v: Vehicle): number {
    return SIZES[v.type].seats - v.filled;
  }

  /** won: everyone is aboard. stuck: the station is full and the next passenger cannot board anybody. */
  get status(): Status {
    if (this.boarded >= this.total) return 'won';
    const driving = this.vehicles.some((v) => v.status === 'driving');
    if (!driving && this.slots.every((s) => s !== null) && !this.nextBoarding()) return 'stuck';
    return 'playing';
  }
}
