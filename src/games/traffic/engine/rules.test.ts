import { describe, expect, it } from 'vitest';
import { MAX_SLOTS, TrafficState, type VehicleDef } from './state';

const car = (id: number, x: number, z: number, heading: number, color: VehicleDef['color'] = 'red'): VehicleDef => ({ id, type: 'car', color, x, z, heading });
const settle = (s: TrafficState, id: number) => {
  s.arrive(id);
  for (;;) {
    const b = s.board();
    if (!b) break;
    if (b.full) s.depart(b.vehicle.id);
  }
};

describe('undo', () => {
  it('takes back the last tap with the boarding that followed it', () => {
    const s = new TrafficState([car(0, 0, 0, 270, 'red')], ['red', 'red']);
    expect(s.canUndo()).toBe(false);
    expect(s.tap(0).kind).toBe('exit');
    expect(s.canUndo()).toBe(false); // still on the road
    settle(s, 0);
    expect(s.boarded).toBe(2);
    expect(s.undo()).toBe(true);
    expect(s.get(0).status).toBe('parked');
    expect(s.boarded).toBe(0);
    expect(s.queue).toEqual(['red', 'red']);
    expect(s.moves).toBe(0);
    expect(s.slots.every((x) => x === null)).toBe(true);
    expect(s.undo()).toBe(false);
  });
  it('can be done several times, newest first', () => {
    const s = new TrafficState([car(0, -3, 0, 270, 'red'), car(1, 3, 0, 270, 'blue')], ['yellow']);
    s.tap(0);
    s.arrive(0);
    s.tap(1);
    s.arrive(1);
    expect(s.slots.filter((x) => x !== null)).toHaveLength(2);
    s.undo();
    expect(s.get(1).status).toBe('parked');
    expect(s.get(0).status).toBe('station');
    s.undo();
    expect(s.get(0).status).toBe('parked');
  });
});

describe('helpers in the engine', () => {
  it('an extra slot opens one more place, up to seven', () => {
    const s = new TrafficState([car(0, 0, 0, 270)], ['red']);
    expect(s.slots).toHaveLength(4);
    for (let i = 4; i < MAX_SLOTS; i++) expect(s.addSlot()).toBe(true);
    expect(s.addSlot()).toBe(false);
    expect(s.slots).toHaveLength(MAX_SLOTS);
  });
  it('VIP sends a blocked vehicle straight to its own place', () => {
    const s = new TrafficState([car(0, 0, 0, 0, 'red'), car(1, 3, 0, 90, 'blue')], ['red', 'red', 'red', 'red']);
    expect(s.tap(0).kind).toBe('blocked');
    expect(s.sendToVip(0)).toBe(true);
    expect(s.sendToVip(1)).toBe(false); // one VIP place
    settle(s, 0);
    expect(s.boarded).toBe(4);
    expect(s.vip).toBeNull(); // it was full and left
  });
  it('shuffle keeps the same passengers', () => {
    const s = new TrafficState([car(0, 0, 0, 270)], ['red', 'blue', 'green', 'yellow', 'red', 'blue']);
    let k = 1;
    s.shuffleQueue(() => ((k = (k * 7919) % 1000) / 1000));
    expect([...s.queue].sort()).toEqual(['blue', 'blue', 'green', 'red', 'red', 'yellow']);
  });
});

describe('saving a game in the middle', () => {
  it('comes back as it was', () => {
    const defs = [car(0, -3, 0, 270, 'red'), car(1, 3, 0, 270, 'blue')];
    const a = new TrafficState(defs, ['red', 'red', 'blue', 'blue', 'blue', 'blue']);
    a.tap(0);
    settle(a, 0);
    const save = JSON.parse(JSON.stringify(a.serialize()));
    const b = new TrafficState(defs, ['red', 'red', 'blue', 'blue', 'blue', 'blue']);
    expect(b.load(save)).toBe(true);
    expect(b.boarded).toBe(2);
    expect(b.queue).toHaveLength(4);
    expect(b.get(0).status).toBe('station');
    expect(b.get(0).filled).toBe(2);
    expect(b.tap(1).kind).toBe('exit');
  });
  it('is refused for another level', () => {
    const a = new TrafficState([car(0, 0, 0, 270)], ['red']);
    const b = new TrafficState([car(0, 0, 0, 270), car(1, 4, 0, 270)], ['red', 'red']);
    expect(b.load(a.serialize())).toBe(false);
  });
});

describe('boarding order', () => {
  it('the vehicle that was sent first gets the passenger', () => {
    const s = new TrafficState([car(0, -3, 0, 270, 'red'), car(1, 3, 0, 270, 'red')], ['yellow', 'red', 'red']);
    s.tap(1);
    s.arrive(1);
    s.tap(0);
    s.arrive(0);
    expect(s.nextBoarding()).toBeNull(); // yellow is first in the queue and nobody is yellow
    s.queue.shift();
    expect(s.nextBoarding()!.vehicle.id).toBe(1);
  });
});
