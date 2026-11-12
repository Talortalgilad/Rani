import { firstContact, pathClear, type Obb } from './geometry';

export type VType = 'car' | 'van' | 'bus' | 'fire';
/** 'fire' is the colour of the firefighters (the passengers of a fire truck), not of an ordinary vehicle. */
export type ColorId = 'red' | 'orange' | 'yellow' | 'green' | 'cyan' | 'blue' | 'purple' | 'pink' | 'brown' | 'fire';

/** Length and width in cells, and seats. */
export const SIZES: Record<VType, { len: number; wid: number; seats: number }> = {
  car: { len: 2, wid: 1.18, seats: 4 },
  van: { len: 3, wid: 1.18, seats: 6 },
  bus: { len: 4, wid: 1.28, seats: 10 },
  fire: { len: 4, wid: 1.28, seats: 8 },
};

/** A "turntable": the vehicle that turns on the spot has a square place of this side, so that it can face any way. */
export const TURNTABLE = 2.34;
/** The cars of a conveyor belt stand this far apart (centre to centre) and the belt is this wide. */
export const BELT_PITCH = 2.25;
export const BELT_WIDTH = 1.34;

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
  /** turns 90 degrees at every tap; a long press sends it (from level 45) */
  rotator?: boolean;
  /** a car on a conveyor belt: which belt, and its place on it (0 = the front) */
  belt?: { id: number; slot: number };
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
  | { kind: 'exit'; id: number; slot: number; /** conveyor belt: the cars behind move up to these places */ shifts: { id: number; x: number; z: number; slot: number }[] }
  | { kind: 'blocked'; id: number; by: number; distance: number }
  | { kind: 'ignored' }
  | { kind: 'full' };

export type Status = 'playing' | 'won' | 'stuck';

export const REGULAR_SLOTS = 4;
export const MAX_SLOTS = 7;
/** `slot` of a vehicle that sits in the VIP place. */
export const VIP_SLOT = -1;

export interface SaveData {
  veh: { id: number; status: VStatus; slot: number | null; filled: number; revealed: boolean; order: number; x: number; z: number; heading: number; beltSlot: number | null }[];
  slots: (number | null)[];
  vip: number | null;
  queue: ColorId[];
  boarded: number;
  moves: number;
  sent: number;
}

interface Snapshot {
  veh: { status: VStatus; slot: number | null; filled: number; revealed: boolean; order: number; x: number; z: number; heading: number; beltSlot: number | null }[];
  slots: (number | null)[];
  vip: number | null;
  queue: ColorId[];
  boarded: number;
  moves: number;
  sent: number;
}

/** The vehicle's real footprint, turned the way it faces. */
export const ownBox = (v: VehicleDef): Obb => ({ x: v.x, z: v.z, hl: SIZES[v.type].len / 2, hw: SIZES[v.type].wid / 2, heading: v.heading });

/** What the vehicle is to the others: its footprint, or the whole turntable (a square) when it turns on the spot. */
export const boxOf = (v: VehicleDef): Obb => (v.rotator ? { x: v.x, z: v.z, hl: TURNTABLE / 2, hw: TURNTABLE / 2, heading: 0 } : ownBox(v));

/** Area of the place a vehicle takes in the lot (a turntable is a part of its vehicle). */
export const placeArea = (v: Pick<VehicleDef, 'type' | 'rotator'>): number => (v.rotator ? TURNTABLE * TURNTABLE : SIZES[v.type].len * SIZES[v.type].wid);

/** The rules of the game, with no graphics: tap, exit, blocked, boarding, win and "stuck". */
export interface BeltDef {
  id: number;
  /** the direction the cars on the belt drive, degrees */
  heading: number;
  /** where the cars stand, the front one first */
  slots: [number, number][];
}

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

  /** conveyor belts: the places of the cars on each (front first) */
  readonly belts: BeltDef[];

  constructor(defs: VehicleDef[], queue: ColorId[], belts: BeltDef[] = []) {
    this.belts = belts;
    this.vehicles = defs.map((d) => ({ ...d, status: 'parked', slot: null, filled: 0, revealed: !d.hidden, revealedBy: null, order: 0 }));
    this.queue = [...queue];
    this.total = queue.length;
    for (const v of this.vehicles.filter((x) => x.hidden)) {
      const hit = firstContact(ownBox(v), this.others(v.id));
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
    return this.vehicles.filter((v) => v.status === 'parked' && pathClear(ownBox(v), this.others(v.id).map((o) => o.box)));
  }

  /** The colour a vehicle shows to the player ("?" until uncovered). */
  shownColor(v: Vehicle): ColorId | null {
    return v.hidden && !v.revealed ? null : v.color;
  }

  /** Can the vehicle drive out right now (a vehicle that turns: in any of its four directions)? */
  canLeave(id: number): boolean {
    const v = this.get(id);
    if (v.status !== 'parked') return false;
    const others = this.others(id);
    for (let k = 0; k < (v.rotator ? 4 : 1); k++) {
      if (!firstContact({ ...ownBox(v), heading: (v.heading + 90 * k) % 360 }, others)) return true;
    }
    return false;
  }

  tap(id: number): TapResult {
    const v = this.get(id);
    if (v.status !== 'parked' || this.status !== 'playing') return { kind: 'ignored' };
    const hit = firstContact(ownBox(v), this.others(id));
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
    return { kind: 'exit', id, slot, shifts: this.shiftBelt(v) };
  }

  /** The cars behind a car that left a conveyor belt move up one place. */
  private shiftBelt(v: Vehicle): { id: number; x: number; z: number; slot: number }[] {
    if (!v.belt) return [];
    const belt = this.belts.find((b) => b.id === v.belt!.id);
    if (!belt) return [];
    const left = v.belt.slot;
    const out: { id: number; x: number; z: number; slot: number }[] = [];
    for (const m of this.vehicles) {
      if (!m.belt || m.belt.id !== v.belt.id || m.status !== 'parked' || m.belt.slot <= left) continue;
      const slot = m.belt.slot - 1;
      const [x, z] = belt.slots[slot];
      m.belt = { ...m.belt, slot };
      m.x = x;
      m.z = z;
      out.push({ id: m.id, x, z, slot });
    }
    return out;
  }

  /** A vehicle that turns on the spot: 90 degrees to the right. It is not a move. */
  rotate(id: number): number | null {
    const v = this.get(id);
    if (!v.rotator || v.status !== 'parked' || this.status !== 'playing') return null;
    v.heading = (v.heading + 90) % 360;
    return v.heading;
  }

  /** Turns the vehicle (up to three times) until its way out is clear. False when no way is clear. */
  autoRotate(id: number): boolean {
    const v = this.get(id);
    for (let k = 0; k < 4; k++) {
      if (!firstContact(ownBox(v), this.others(id))) return true;
      if (!v.rotator) return false;
      v.heading = (v.heading + 90) % 360;
    }
    return false;
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
      veh: this.vehicles.map((v) => ({ status: v.status, slot: v.slot, filled: v.filled, revealed: v.revealed, order: v.order, x: v.x, z: v.z, heading: v.heading, beltSlot: v.belt ? v.belt.slot : null })),
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
      veh: this.vehicles.map((v) => ({ id: v.id, status: v.status === 'driving' ? 'parked' : v.status, slot: v.status === 'driving' ? null : v.slot, filled: v.filled, revealed: v.revealed, order: v.order, x: v.x, z: v.z, heading: v.heading, beltSlot: v.belt ? v.belt.slot : null })),
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
      Object.assign(v, { status: sv.status, slot: sv.slot, filled: sv.filled, revealed: sv.revealed, order: sv.order, x: sv.x, z: sv.z, heading: sv.heading });
      if (v.belt && sv.beltSlot !== null) v.belt = { ...v.belt, slot: sv.beltSlot };
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
    this.vehicles.forEach((v, i) => {
      const { beltSlot, ...rest } = s.veh[i];
      Object.assign(v, rest);
      if (v.belt && beltSlot !== null) v.belt = { ...v.belt, slot: beltSlot };
    });
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
    if (v.status !== 'parked' || this.vip !== null || this.status === 'won') return false; // allowed when stuck: that is what it is for
    this.history.push(this.snapshot());
    v.status = 'driving';
    v.slot = VIP_SLOT;
    v.order = this.sent++;
    v.revealed = true; // a "?" vehicle that flies to the VIP place shows its colour
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
