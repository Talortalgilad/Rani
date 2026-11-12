import { dirOf, overlaps, type Obb } from '../engine/geometry';
import { boxAt, type Route, type RoutePoint, type VType } from './route';

/**
 * Vehicles on the road at the same time never go through each other. A vehicle that would run into one ahead of it slows down and
 * waits. The top road, where vehicles from the two sides meet, runs one way at a time: a vehicle that would come the other way
 * waits at the corner until it is empty. Pure maths, tested on every level.
 */
export interface FlowCar {
  id: number;
  type: VType;
  route: Route;
  /** length travelled */
  s: number;
  v: number;
  order: number;
  done: boolean;
  /** called once, when the car is in its place */
  arrived?: () => void;
  /** why the car is waiting (for tests and debugging) */
  why?: string;
  /** waiting for the top road: it will not move, so it claims no right of way */
  locked?: boolean;
  /** held this step (by anything): it claims no right of way over whoever is not blocked */
  blocked?: boolean;
  /** the vehicle sent earlier that this one is waiting for (when it is) */
  by?: FlowCar;
  /** how long it has stood still, seconds */
  still?: number;
  /** a vehicle wedged with one sent earlier hops over it (0.4 s, in an arc) so that nothing ever stays stuck; seconds left of the hop */
  hopLeft?: number;
}

export interface FlowOpts { vmax: number; accel: number; brake: number; gap: number; zone: number }
/** how long a hop over another vehicle takes, seconds */
export const HOP_TIME = 0.4;
export const FLOW: FlowOpts = { vmax: 8.5, accel: 15, brake: 14, gap: 0.22, zone: 3.4 };

export function poseAt(route: Route, s: number): RoutePoint {
  const pts = route.pts;
  const n = pts.length - 1;
  const f = Math.min(n, Math.max(0, (s / Math.max(1e-6, route.length)) * n));
  const k = Math.min(n - 1, Math.floor(f));
  const t = f - k;
  const a = pts[Math.max(0, k)];
  const b = pts[Math.min(n, k + 1)];
  if (!b || a === b) return a;
  // the heading is turned the short way
  let dh = b.heading - a.heading;
  while (dh > 180) dh -= 360;
  while (dh < -180) dh += 360;
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, heading: a.heading + dh * t, scale: a.scale + (b.scale - a.scale) * t, s };
}

export class RoadFlow {
  cars: FlowCar[] = [];
  /** how many times a vehicle had to hop over another (rare) */
  hops = 0;
  onHop?: (c: FlowCar, over: FlowCar) => void;
  opts: FlowOpts;
  constructor(opts: Partial<FlowOpts> = {}) {
    this.opts = { ...FLOW, ...opts };
  }

  add(car: Omit<FlowCar, 's' | 'v' | 'done'>): FlowCar {
    const c: FlowCar = { ...car, s: 0, v: 0, done: false };
    this.cars.push(c);
    return c;
  }

  boxOf(c: FlowCar, s = c.s): Obb {
    return boxAt(c.type, poseAt(c.route, s));
  }

  private onTop(c: FlowCar): boolean {
    const r = c.route;
    return r.topDir !== 0 && r.topFrom !== null && r.topTo !== null && c.s >= r.topFrom - 1e-6 && c.s < r.topTo;
  }

  /** Moves every car by dt seconds; returns the cars that arrived. */
  step(dt: number, instant = false): FlowCar[] {
    const arrived: FlowCar[] = [];
    const o = this.opts;
    const order = [...this.cars].sort((a, b) => a.order - b.order);
    for (const c of order) {
      if (c.done) continue;
      const L = c.route.length;
      if (instant) {
        c.s = L;
      } else {
        let v = Math.min(c.v + o.accel * dt, o.vmax, Math.sqrt(2 * o.brake * Math.max(0.002, L - c.s)) + 0.35);
        if (c.hopLeft) v = Math.max(v, o.vmax * 0.7); // in the air it goes on at a good pace
        let s2 = Math.min(L, c.s + v * dt);
        if (!this.canMove(c, s2)) {
          // the whole step is not possible: go as far as it can without touching anything
          let ok = c.s;
          if (!c.locked && c.why?.startsWith('touch')) for (const f of [0.75, 0.5, 0.25, 0.1]) if (this.canMove(c, c.s + (s2 - c.s) * f)) { ok = c.s + (s2 - c.s) * f; break; }
          v = 0;
          s2 = ok;
        }
        c.still = v === 0 && s2 === c.s ? (c.still ?? 0) + dt : 0;
        if (c.still > 1.2 && c.by && c.by.by === c && (c.by.still ?? 0) > 1.2 && c.by.order < c.order && !c.locked && !c.hopLeft) {
          c.hopLeft = HOP_TIME;
          this.hops++;
          this.onHop?.(c, c.by);
        }
        // a vehicle that is wedged in the way of one sent earlier (which waits for it) backs up out of the way
        if (c.still > 0.35 && c.by && c.by.order < c.order && c.s > 0.05 && (c.by.still ?? 0) > 0.2) {
          const back = Math.max(0, c.s - 2.5 * dt);
          const b2 = this.boxOf(c, back);
          if (!this.cars.some((d) => d !== c && !d.done && overlaps(b2, this.boxOf(d), 0.02))) s2 = back;
        }
        c.v = v;
        c.s = s2;
        if (c.hopLeft) c.hopLeft = c.hopLeft - dt > 0 ? c.hopLeft - dt : undefined;
      }
      if (c.s >= L - 0.001) {
        c.done = true;
        arrived.push(c);
      }
    }
    this.cars = this.cars.filter((c) => !c.done);
    return arrived;
  }

  /**
   * The gate: may this vehicle go out onto the road? Not while a vehicle sent before it still has to pass (or is in) the places where
   * this one comes out. It does not matter how fast that one goes or whether it is held up on the way.
   */
  private clearAhead(c: FlowCar): boolean {
    const r = c.route;
    const entry: Obb[] = [];
    for (let s = Math.max(0, r.enterAt - 0.2); s <= Math.min(r.length, r.enterAt + 3.0); s += 0.25) {
      const b = this.boxOf(c, s);
      entry.push({ ...b, hl: b.hl + 0.2, hw: b.hw + 0.2 });
    }
    for (const d of this.cars) {
      if (d === c || d.done || d.order > c.order) continue;
      for (let s = d.s; s <= d.route.length + 0.3; s += 0.3) {
        const bd = this.boxOf(d, Math.min(d.route.length, s));
        for (const e of entry) if (Math.abs(bd.x - e.x) < 3.2 && Math.abs(bd.z - e.z) < 3.2 && overlaps(e, bd, 0)) return false;
      }
    }
    return true;
  }

  private canMove(c: FlowCar, s2: number): boolean {
    const r = c.route;
    if (c.hopLeft) return true; // in the air: it may touch
    c.locked = false;
    c.blocked = false;
    c.by = undefined;
    // the top road: one direction at a time
    if (r.topDir !== 0 && r.topFrom !== null && c.s < r.topFrom && s2 >= r.topFrom) {
      for (const d of this.cars) {
        if (d === c || d.done || d.route.topDir !== -r.topDir) continue;
        if (this.onTop(d)) { c.why = `lock ${d.id}`; c.locked = true; c.blocked = true; return false; }
      }
    }
    // the gate: a vehicle leaves its place only when, if it and the vehicles sent before it all went on at their usual pace, they would
    // not meet anywhere on the way
    if (c.s <= r.enterAt + 0.3 && s2 > c.s && !this.clearAhead(c)) { c.why = 'gate'; c.blocked = true; return false; }
    const me = this.boxOf(c, s2);
    const here = this.boxOf(c);
    const dir = dirOf(here.heading);
    const ahead: Obb = { ...me, hl: me.hl + this.opts.gap };
    const wide: Obb = { ...me, hl: me.hl + this.opts.gap + 0.1, hw: me.hw + 0.12 };
    for (const d of this.cars) {
      if (d === c || d.done) continue;
      const other = this.boxOf(d);
      // never move into another vehicle, whoever is in front
      if (overlaps(me, other, 0.02) && !overlaps(here, other, 0.02)) { c.why = `touch ${d.id}`; c.blocked = true; c.by = d; return false; }
      const dd = dirOf(other.heading);
      const dAhead = (other.x - here.x) * dir.x + (other.z - here.z) * dir.z > 0.05;
      const cAhead = (here.x - other.x) * dd.x + (here.z - other.z) * dd.z > 0.05;
      if (overlaps(ahead, other, 0.0)) {
        // only a vehicle in front of this one makes it wait; when each is in front of the other (they cross at a corner) the one sent first goes
        // (a vehicle going the same way in front is followed whoever was sent first; one that crosses gives way to the one sent earlier)
        const same = dir.x * dd.x + dir.z * dd.z > 0.87;
        if (dAhead && (same ? !cAhead || d.order < c.order : d.order < c.order)) { c.why = `ahead ${d.id}`; c.blocked = true; c.by = d; return false; }
      }
      // a vehicle sent earlier has the right of way: wait if it is about to come through the place this one is moving into
      if (d.order < c.order && !d.locked && !d.blocked && !(cAhead && !dAhead)) {
        const reach = Math.max(1.35, d.v * 0.7);
        for (let k = 1; k <= 14; k++) {
          if (overlaps(wide, this.boxOf(d, Math.min(d.route.length, d.s + (k / 14) * reach)), 0.0)) { c.why = `right of way ${d.id}`; c.blocked = true; return false; }
        }
      }
    }
    return true;
  }
}
