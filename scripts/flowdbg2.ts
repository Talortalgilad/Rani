import { TrafficState } from '../src/games/traffic/engine/state';
import { overlaps } from '../src/games/traffic/engine/geometry';
import { ALL_LEVELS } from '../src/games/traffic/levels';
import { RoadFlow, poseAt } from '../src/games/traffic/render/roadflow';
import { buildRoute, stationSlotX, stationZOf } from '../src/games/traffic/render/route';
const l = ALL_LEVELS.find((x) => x.key === (process.env.K ?? '1'))!;
const st = new TrafficState(l.vehicles, l.queue, l.belts);
const flow = new RoadFlow();
let sent = 0; let t = 0; let shown = 0;
const land = () => { t += 1 / 30; for (const c of flow.step(1 / 30)) { st.arrive(c.id); for (let g = 0; g < 1000; g++) { const b = st.board(); if (!b) break; if (b.full) st.depart(b.vehicle.id); } }
  const cars = flow.cars;
  for (let a = 0; a < cars.length; a++) for (let b = a + 1; b < cars.length; b++) if (overlaps(flow.boxOf(cars[a]), flow.boxOf(cars[b]), 0.02) && shown++ < 3) {
    for (const c of [cars[a], cars[b]]) console.log('t', t.toFixed(2), 'car', c.id, c.type, 'order', c.order, 's', c.s.toFixed(2), JSON.stringify(poseAt(c.route, c.s)), 'v', c.v.toFixed(1)); } };
for (const id of l.stats!.solution) {
  let g = 0; while (!st.slots.includes(null) && g++ < 3000) land();
  st.autoRotate(id); const v = st.get(id); const r = st.tap(id); if (r.kind !== 'exit') break;
  const ss = v.type === 'car' ? 0.98 : v.type === 'van' ? 0.7 : 0.53;
  const route = buildRoute({ x: v.x, z: v.z, heading: v.heading, type: v.type, lot: l.lot, slotX: stationSlotX(l.lot.halfW, r.slot + 1), stationZ: stationZOf(l.lot.halfH), stationScale: ss });
  flow.add({ id, type: v.type, route, order: sent++ }); st.uncovered(id);
  for (let k = 0; k < Number(process.env.GAP ?? 4); k++) land();
}
let g = 0; while (flow.cars.length && g++ < 6000) land();
