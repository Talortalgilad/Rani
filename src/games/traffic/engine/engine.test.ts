import { describe, expect, it } from 'vitest';
import { SLICE_QUEUE, SLICE_VEHICLES, LOT } from '../levels/beach-slice';
import { corners, firstContact, insideLot, overlaps, pathClear } from './geometry';
import { SIZES, TrafficState, boxOf, type VehicleDef } from './state';

const car = (id: number, x: number, z: number, heading: number, color: VehicleDef['color'] = 'red'): VehicleDef => ({ id, type: 'car', color, x, z, heading });

describe('geometry', () => {
  it('rotated boxes: touching does not count, overlapping does', () => {
    const a = { x: 0, z: 0, hl: 1, hw: 0.5, heading: 0 };
    expect(overlaps(a, { ...a, x: 2.0 })).toBe(false);
    expect(overlaps(a, { ...a, x: 1.5 })).toBe(true);
    expect(overlaps(a, { x: 0, z: 1.2, hl: 1, hw: 0.5, heading: 90 })).toBe(true);
    expect(overlaps(a, { x: 0, z: 2.5, hl: 1, hw: 0.5, heading: 45 })).toBe(false);
    expect(corners(a)).toHaveLength(4);
  });
  it('a vehicle drives out along its arrow, so only what is in front of it blocks', () => {
    const me = boxOf(car(1, 0, 0, 0));
    expect(pathClear(me, [boxOf(car(2, -4, 0, 0))])).toBe(true); // behind
    expect(pathClear(me, [boxOf(car(2, 0, 3, 0))])).toBe(true); // beside
    expect(pathClear(me, [boxOf(car(2, 5, 0, 90))])).toBe(false); // in front
    expect(pathClear(me, [boxOf(car(2, 5, 0.6, 0))])).toBe(false); // in front, a bit off-centre
    const diag = boxOf(car(1, 0, 0, 45));
    expect(pathClear(diag, [boxOf(car(2, 4, 4, 0))])).toBe(false);
    expect(pathClear(diag, [boxOf(car(2, 4, -4, 0))])).toBe(true);
  });
  it('reports how far it can go and what it hits', () => {
    const hit = firstContact(boxOf(car(1, 0, 0, 0)), [{ id: 2, box: boxOf(car(2, 6, 0, 0)) }]);
    expect(hit!.id).toBe(2);
    expect(hit!.distance).toBeCloseTo(4, 0); // the gap between the two (6 - 1 - 1)
    expect(firstContact(boxOf(car(1, 0, 0, 0)), [])).toBeNull();
  });
});

describe('rules', () => {
  const lot = () => new TrafficState([car(0, 0, 0, 0, 'red'), car(1, 4, 0, 270, 'blue'), car(2, 0, 4, 90, 'red'), car(3, 0, -4, 180, 'yellow'), car(4, 4, 4, 0, 'pink'), car(5, -4, 0, 180, 'cyan')], ['red', 'red', 'red', 'red', 'red', 'red', 'red', 'red']);
  it('a free vehicle exits to the first free place, a blocked one bonks and is not a move', () => {
    const s = lot();
    expect(s.tap(0)).toMatchObject({ kind: 'blocked', by: 1 });
    expect(s.moves).toBe(0);
    expect(s.tap(1)).toEqual({ kind: 'exit', id: 1, slot: 0 });
    expect(s.moves).toBe(1);
    expect(s.tap(0)).toMatchObject({ kind: 'exit', slot: 1 }); // the blocker has gone
  });
  it('a vehicle that is already moving or parked in the station cannot be tapped again', () => {
    const s = lot();
    s.tap(1);
    expect(s.tap(1)).toEqual({ kind: 'ignored' });
    s.arrive(1);
    expect(s.tap(1)).toEqual({ kind: 'ignored' });
  });
  it('passengers board a vehicle of their colour, a full vehicle leaves, and the place is free again', () => {
    const s = lot();
    s.tap(1); s.tap(0);
    s.arrive(0); // red car, 4 seats
    const boarded = [];
    for (let i = 0; i < 4; i++) boarded.push(s.board());
    expect(boarded[3]).toMatchObject({ full: true, left: 0 });
    expect(boarded[0]!.left).toBe(3);
    expect(s.board()).toBeNull(); // the next red passenger has nowhere to go yet
    s.depart(0);
    expect(s.slots[1]).toBeNull();
  });
  it('stuck: every place taken and the head passenger fits nowhere; then it is not a loss, only "try again"', () => {
    const s = lot();
    for (const id of [1, 3, 5, 4]) {
      expect(s.tap(id).kind).toBe('exit');
      s.arrive(id);
    }
    expect(s.status).toBe('stuck');
    expect(s.tap(0)).toEqual({ kind: 'ignored' }); // the round is over; the screen offers "try again"
  });
  it('won when everybody has boarded', () => {
    const s = new TrafficState([car(0, 0, 0, 0, 'red')], ['red', 'red', 'red', 'red']);
    s.tap(0);
    s.arrive(0);
    while (s.board());
    expect(s.status).toBe('won');
  });
  it('a "?" vehicle is uncovered when the vehicle in front of it leaves', () => {
    const s = new TrafficState([car(0, 0, 0, 0, 'red'), { ...car(1, 4, 0, 0, 'blue'), hidden: true }, car(2, 8, 0, 90, 'pink')], ['red']);
    expect(s.get(0).revealedBy).toBeNull();
    expect(s.get(1).revealedBy).toBe(2);
    expect(s.shownColor(s.get(1))).toBeNull();
    s.tap(2);
    expect(s.uncovered(2).map((v) => v.id)).toEqual([1]);
    expect(s.shownColor(s.get(1))).toBe('blue');
  });
});

describe('the hand-made level of stage 0', () => {
  it('has real sizes: inside the lot, nothing overlaps, and 150 seats for 150 passengers', () => {
    const boxes = SLICE_VEHICLES.map(boxOf);
    boxes.forEach((b) => expect(insideLot(b, LOT.halfW, LOT.halfH)).toBe(true));
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < i + boxes.length - i; j++) if (j !== i) expect(overlaps(boxes[i], boxes[j], 0.02)).toBe(false);
    const seats = SLICE_VEHICLES.reduce((n, v) => n + SIZES[v.type].seats, 0);
    expect(seats).toBe(SLICE_QUEUE.length);
    for (const c of new Set(SLICE_VEHICLES.map((v) => v.color))) {
      const need = SLICE_VEHICLES.filter((v) => v.color === c).reduce((n, v) => n + SIZES[v.type].seats, 0);
      expect(SLICE_QUEUE.filter((q) => q === c).length).toBe(need);
    }
  });
  it('is a real jam: many vehicles are blocked at the start, but some can leave', () => {
    const s = new TrafficState(SLICE_VEHICLES, SLICE_QUEUE);
    const free = s.freeVehicles().length;
    expect(free).toBeGreaterThanOrEqual(4);
    expect(free).toBeLessThan(SLICE_VEHICLES.length * 0.6);
    expect(s.vehicles.filter((v) => v.hidden && v.revealedBy !== null).length).toBeGreaterThanOrEqual(2);
  });
  it('can be cleared without helpers (reverse id order), with the station never holding more than 4 vehicles', () => {
    const s = new TrafficState(SLICE_VEHICLES, SLICE_QUEUE);
    let maxStation = 0;
    for (const v of [...SLICE_VEHICLES].reverse()) {
      const r = s.tap(v.id);
      expect(r.kind, `vehicle ${v.id}`).toBe('exit');
      s.uncovered(v.id);
      s.arrive(v.id);
      for (let guard = 0; guard < 200; guard++) {
        const b = s.board();
        if (!b) break;
        if (b.full) s.depart(b.vehicle.id);
      }
      maxStation = Math.max(maxStation, s.slots.filter((x) => x !== null).length);
    }
    expect(s.status).toBe('won');
    expect(maxStation).toBeLessThanOrEqual(4);
  });
});
