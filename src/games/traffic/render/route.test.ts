import { describe, expect, it } from 'vitest';
import { corners, overlaps } from '../engine/geometry';
import { TrafficState, boxOf } from '../engine/state';
import { ALL_LEVELS } from '../levels';
import { RoadFlow } from './roadflow';
import { boxAt, buildRoute, stationSlotX, stationZOf } from './route';

/** Every vehicle of every level, at the moment the saved solution sends it: its route never touches another vehicle or the lot. */
describe('the road to the station', () => {
  it('no point of any route, in any of the levels, touches another vehicle or crosses the lot after leaving it', () => {
    let routes = 0;
    let points = 0;
    const problems: string[] = [];
    for (const l of ALL_LEVELS) {
      const st = new TrafficState(l.vehicles, l.queue, l.belts);
      const order = l.stats?.solution ?? [];
      for (const id of order) {
        st.autoRotate(id);
        const v = st.get(id);
        const others = st.vehicles.filter((o) => o.id !== id && o.status === 'parked').map((o) => ({ id: o.id, box: boxOf(o) }));
        const r = st.tap(id);
        if (r.kind !== 'exit') break;
        const stationScale = v.type === 'car' ? 0.98 : v.type === 'van' ? 0.7 : 0.53;
        const route = buildRoute({ x: v.x, z: v.z, heading: v.heading, type: v.type, lot: l.lot, slotX: stationSlotX(l.lot.halfW, r.slot + 1), stationZ: stationZOf(l.lot.halfH), stationScale });
        routes++;
        for (const q of route.pts) {
          points++;
          const b = boxAt(v.type, q);
          for (const o of others) if (Math.abs(o.box.x - b.x) < 4.5 && Math.abs(o.box.z - b.z) < 4.5 && overlaps(b, o.box, 0.02)) problems.push(`level ${l.key}: vehicle ${id} at s=${q.s.toFixed(2)} touches vehicle ${o.id}`);
        }
        // once it is out of the lot it stays out
        let out = false;
        for (const q of route.pts) {
          const inLot = corners(boxAt(v.type, q)).some((c) => Math.abs(c.x) < l.lot.halfW - 0.02 && Math.abs(c.z) < l.lot.halfH - 0.02);
          if (!inLot) out = true;
          else if (out) problems.push(`level ${l.key}: vehicle ${id} goes back over the lot at s=${q.s.toFixed(2)}`);
        }
        st.uncovered(id);
        st.arrive(id);
        for (let g = 0; g < 1000; g++) {
          const b = st.board();
          if (!b) break;
          if (b.full) st.depart(b.vehicle.id);
        }
      }
    }
    expect(problems.slice(0, 5)).toEqual([]);
    expect(routes).toBeGreaterThan(2500);
    expect(points).toBeGreaterThan(100000);
  });

  for (const [gapSteps, strict, maxGhosts] of [[30, true, 2], [12, true, 12], [4, false, 12]] as const) it(`vehicles sent ${(gapSteps / 30).toFixed(1)} s apart ${strict ? 'do not go through each other on the road' : 'all arrive too, even when sent in a rush'}`, () => {
    let sent = 0;
    let steps = 0;
    let ghosts = 0;
    const problems: string[] = [];
    for (const l of ALL_LEVELS) {
      const st = new TrafficState(l.vehicles, l.queue, l.belts);
      const flow = new RoadFlow();
      const types = new Map<number, (typeof l.vehicles)[number]['type']>();
      const dt = 1 / 30;
      const land = (): void => {
        for (const c of flow.step(dt)) {
          st.arrive(c.id);
          for (let g = 0; g < 1000; g++) {
            const b = st.board();
            if (!b) break;
            if (b.full) st.depart(b.vehicle.id);
          }
        }
        steps++;
        const cars = strict ? flow.cars : [];
        for (let a = 0; a < cars.length; a++) for (let b = a + 1; b < cars.length; b++) {
          if (cars[a].s > 0 && cars[b].s > 0 && cars[a].ghostUntil === undefined && cars[b].ghostUntil === undefined && overlaps(flow.boxOf(cars[a]), flow.boxOf(cars[b]), 0.02)) problems.push(`level ${l.key}: vehicles ${cars[a].id} and ${cars[b].id} meet on the road`);
        }
      };
      for (const id of l.stats?.solution ?? []) {
        let guard = 0;
        while (!st.slots.includes(null) && guard++ < 3000) land();
        st.autoRotate(id);
        const v = st.get(id);
        const r = st.tap(id);
        if (r.kind !== 'exit') break;
        types.set(id, v.type);
        const stationScale = v.type === 'car' ? 0.98 : v.type === 'van' ? 0.7 : 0.53;
        const route = buildRoute({ x: v.x, z: v.z, heading: v.heading, type: v.type, lot: l.lot, slotX: stationSlotX(l.lot.halfW, r.slot + 1), stationZ: stationZOf(l.lot.halfH), stationScale });
        flow.add({ id, type: v.type, route, order: sent++ });
        st.uncovered(id);
        for (let k = 0; k < gapSteps; k++) land();
      }
      let guard = 0;
      while (flow.cars.length && guard++ < 6000) land();
      expect(flow.cars.length, `level ${l.key}: some vehicles never got to the station`).toBe(0);
      ghosts += flow.ghosts;
    }
    expect(problems.slice(0, 5)).toEqual([]);
    // a wedge (two vehicles each waiting for the other) is broken after 1.2 s by letting the later one through: very rare
    expect(ghosts).toBeLessThanOrEqual(maxGhosts);
    expect(sent).toBeGreaterThan(2500);
    expect(steps).toBeGreaterThan(10000);
  });
});
