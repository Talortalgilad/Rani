import { firstContact, pathClear, type Obb } from './geometry';

export type VType = 'car' | 'van' | 'bus';
export type ColorId = 'red' | 'orange' | 'yellow' | 'green' | 'cyan' | 'blue' | 'purple' | 'pink' | 'brown';

/** Length and width in cells, and seats. */
export const SIZES: Record<VType, { len: number; wid: number; seats: number }> = {
  car: { len: 2, wid: 1, seats: 4 },
  van: { len: 3, wid: 1, seats: 6 },
  bus: { len: 4, wid: 1.1, seats: 10 },
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
}

export type TapResult =
  | { kind: 'exit'; id: number; slot: number }
  | { kind: 'blocked'; id: number; by: number; distance: number }
  | { kind: 'ignored' }
  | { kind: 'full' };

export type Status = 'playing' | 'won' | 'stuck';

export const REGULAR_SLOTS = 4;

export const boxOf = (v: VehicleDef): Obb => ({ x: v.x, z: v.z, hl: SIZES[v.type].len / 2, hw: SIZES[v.type].wid / 2, heading: v.heading });

/** The rules of the game, with no graphics: tap, exit, blocked, boarding, win and "stuck". */
export class TrafficState {
  vehicles: Vehicle[];
  /** vehicle id per station slot; null = free. The first slot is the VIP place (kept for stage 2). */
  slots: (number | null)[] = Array(REGULAR_SLOTS).fill(null);
  queue: ColorId[];
  readonly total: number;
  boarded = 0;
  moves = 0;

  constructor(defs: VehicleDef[], queue: ColorId[]) {
    this.vehicles = defs.map((d) => ({ ...d, status: 'parked', slot: null, filled: 0, revealed: !d.hidden, revealedBy: null }));
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
    v.status = 'driving';
    v.slot = slot;
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
    const v = this.vehicles.find((x) => x.status === 'station' && this.shownColorOrReal(x) === color && x.filled < SIZES[x.type].seats);
    return v ? { vehicle: v, color } : null;
  }
  private shownColorOrReal(v: Vehicle): ColorId {
    return v.color;
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
    if (v.slot !== null) this.slots[v.slot] = null;
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
