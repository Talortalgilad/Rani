import { describe, expect, it } from 'vitest';
import { Solver } from './solver';
import { MAX_SLOTS, TrafficState, type ColorId, type VehicleDef } from './state';

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

describe('conveyor belt', () => {
  // three cars in a row driving to the right: the front one at x = 2.25, then 0, then -2.25
  const belt = { id: 0, heading: 0, slots: [[2.25, 0], [0, 0], [-2.25, 0]] as [number, number][] };
  const cars = [0, 1, 2].map((i): VehicleDef => ({ id: i, type: 'car', color: 'red', x: belt.slots[i][0], z: 0, heading: 0, belt: { id: 0, slot: i } }));
  it('only the front car can leave; the others are blocked by the car in front', () => {
    const s = new TrafficState(cars, ['red', 'red', 'red', 'red'], [belt]);
    expect(s.tap(1).kind).toBe('blocked');
    expect(s.tap(2).kind).toBe('blocked');
    expect(s.tap(0).kind).toBe('exit');
  });
  it('when the first car leaves, the others move up one place', () => {
    const s = new TrafficState(cars, Array<ColorId>(12).fill('red'), [belt]);
    const r = s.tap(0);
    expect(r.kind === 'exit' && r.shifts).toEqual([{ id: 1, x: 2.25, z: 0, slot: 0 }, { id: 2, x: 0, z: 0, slot: 1 }]);
    expect(s.get(1).x).toBe(2.25);
    expect(s.get(2).belt!.slot).toBe(1);
    settle(s, 0);
    expect(s.tap(2).kind).toBe('blocked'); // still behind car 1
    expect(s.tap(1).kind).toBe('exit');
  });
  it('undo puts the belt back', () => {
    const s = new TrafficState(cars, ['red', 'red', 'red', 'red'], [belt]);
    s.tap(0);
    s.arrive(0);
    expect(s.undo()).toBe(true);
    expect(s.get(1).x).toBe(0);
    expect(s.get(1).belt!.slot).toBe(1);
  });
  it('a saved game keeps the belt as it was', () => {
    const s = new TrafficState(cars, ['red', 'red', 'red', 'red'], [belt]);
    s.tap(0);
    settle(s, 0);
    const t = new TrafficState(cars, ['red', 'red', 'red', 'red'], [belt]);
    expect(t.load(JSON.parse(JSON.stringify(s.serialize())))).toBe(true);
    expect(t.get(1).x).toBe(2.25);
    expect(t.get(2).belt!.slot).toBe(1);
  });
  it('the solver knows that a car behind waits for the one in front', () => {
    const lvl = { vehicles: cars, queue: ['red', 'red', 'red', 'red', 'red', 'red', 'red', 'red', 'red', 'red', 'red', 'red'] as ColorId[], belts: [belt] };
    const sol = new Solver(lvl).solve();
    expect(sol.solvable).toBe(true);
    expect(sol.path).toEqual([0, 1, 2]);
  });
});

describe('a vehicle that turns on the spot', () => {
  // a car with another car right in front of it (to the right) and nothing above: it has to turn to leave
  const defs: VehicleDef[] = [
    { id: 0, type: 'car', color: 'red', x: 0, z: 0, heading: 0, rotator: true },
    { id: 1, type: 'car', color: 'blue', x: 3, z: 0, heading: 90 },
  ];
  it('is blocked until it faces a free way; turning is not a move', () => {
    const s = new TrafficState(defs, ['red', 'red', 'red', 'red', 'blue', 'blue', 'blue', 'blue']);
    expect(s.tap(0).kind).toBe('blocked');
    expect(s.rotate(0)).toBe(90);
    expect(s.moves).toBe(0);
    expect(s.tap(0).kind).toBe('exit');
  });
  it('only the vehicle itself can turn', () => {
    const s = new TrafficState(defs, ['red']);
    expect(s.rotate(1)).toBeNull();
  });
  it('autoRotate finds a clear heading, and the solver knows it is free as soon as any way is clear', () => {
    const s = new TrafficState(defs, ['red', 'red', 'red', 'red', 'blue', 'blue', 'blue', 'blue']);
    expect(s.autoRotate(0)).toBe(true);
    const sv = new Solver({ vehicles: defs, queue: ['red', 'red', 'red', 'red', 'blue', 'blue', 'blue', 'blue'] });
    expect(sv.isFree(sv.initial(), 0)).toBe(true);
  });
  it('its turntable (a square) is what the others see', () => {
    // a car whose way passes beside the turntable is blocked by it, wherever the car on it points
    const d2: VehicleDef[] = [{ id: 0, type: 'car', color: 'red', x: 0, z: 0, heading: 0, rotator: true }, { id: 1, type: 'car', color: 'blue', x: 0, z: 2.1, heading: 270 }];
    const s = new TrafficState(d2, ['blue', 'blue', 'blue', 'blue']);
    expect(s.tap(1).kind).toBe('blocked');
  });
});

describe('a fire truck', () => {
  it('carries 8 firefighters, and only a fire truck takes them', () => {
    const defs: VehicleDef[] = [
      { id: 0, type: 'fire', color: 'fire', x: -3, z: 0, heading: 270 },
      { id: 1, type: 'bus', color: 'red', x: 3, z: 0, heading: 270 },
    ];
    const s = new TrafficState(defs, [...Array<ColorId>(8).fill('fire'), ...Array<ColorId>(10).fill('red')]);
    s.tap(1);
    s.arrive(1);
    expect(s.nextBoarding()).toBeNull(); // the first in the queue is a firefighter: the red bus does not take him
    s.tap(0);
    s.arrive(0);
    expect(s.nextBoarding()!.vehicle.id).toBe(0);
    let n = 0;
    for (;;) {
      const b = s.board();
      if (!b) break;
      n++;
      if (b.full) s.depart(b.vehicle.id);
      if (n > 40) break;
    }
    expect(s.boarded).toBe(18);
  });
});
