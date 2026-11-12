import { TrafficState } from '../src/games/traffic/engine/state';
import { ALL_LEVELS } from '../src/games/traffic/levels';
import { RoadFlow, poseAt } from '../src/games/traffic/render/roadflow';
import { buildRoute, stationSlotX, stationZOf } from '../src/games/traffic/render/route';
const l = ALL_LEVELS.find((x) => x.key === (process.env.K ?? '3'))!;
const st = new TrafficState(l.vehicles, l.queue, l.belts);
const flow = new RoadFlow();
let sent = 0;
const land = () => { for (const c of flow.step(1 / 30)) { st.arrive(c.id); for (let g = 0; g < 1000; g++) { const b = st.board(); if (!b) break; if (b.full) st.depart(b.vehicle.id); } } };
for (const id of l.stats!.solution) {
  let g = 0; while (!st.slots.includes(null) && g++ < 3000) land();
  st.autoRotate(id); const v = st.get(id); const r = st.tap(id); if (r.kind !== 'exit') break;
  const ss = v.type === 'car' ? 0.98 : v.type === 'van' ? 0.7 : 0.53;
  const route = buildRoute({ x: v.x, z: v.z, heading: v.heading, type: v.type, lot: l.lot, slotX: stationSlotX(l.lot.halfW, r.slot + 1), stationZ: stationZOf(l.lot.halfH), stationScale: ss });
  flow.add({ id, type: v.type, route, order: sent++ }); st.uncovered(id);
  for (let k = 0; k < 4; k++) land();
}
let g = 0; while (flow.cars.length && g++ < 6000) land();
for (const c of flow.cars) { const p = poseAt(c.route, c.s); console.log('stuck', c.why, 'order', c.order, 'by', c.by?.id, 'still', c.still?.toFixed(1), 'id', c.id, c.type, 's', c.s.toFixed(2), 'of', c.route.length.toFixed(2), JSON.stringify(p), 'top', c.route.topDir, c.route.topFrom, c.route.topTo); }
console.log('slots', JSON.stringify(st.slots), 'status', st.status, 'queue', st.queue.length);
import { dirOf, overlaps } from '../src/games/traffic/engine/geometry';
for (const c of flow.cars) {
  const s2 = Math.min(c.route.length, c.s + 0.3);
  const me = flow.boxOf(c, s2); const here = flow.boxOf(c); const dir = dirOf(me.heading);
  for (const d of flow.cars) { if (d === c) continue; const o = flow.boxOf(d); const ov = overlaps({ ...me, hl: me.hl + 0.22 }, o, 0); console.log(c.id, 'vs', d.id, 'overlap', ov, 'ahead', ((o.x - here.x) * dir.x + (o.z - here.z) * dir.z).toFixed(2), 'order', c.order, d.order); }
}
for (const c of flow.cars) { const pts = c.route.pts; console.log('route', c.id, c.type, pts.filter((_, i) => i % 25 === 0).map((p) => `(${p.x.toFixed(1)},${p.z.toFixed(1)},${p.heading.toFixed(0)})`).join(' ')); }
const c5 = flow.cars.find((c) => c.type === 'bus');
if (c5) console.log('bus pts', c5.route.pts.filter((p) => p.s > 11.0 && p.s < 15.5 && Math.round(p.s * 100) % 30 < 6).map((p) => `s${p.s.toFixed(1)}(${p.x.toFixed(2)},${p.z.toFixed(2)},h${p.heading.toFixed(0)})`).join(' '));
const [ca, cb] = flow.cars;
if (ca && cb) for (const m of [0, 0.02, 0.03, 0.06, 0.1]) console.log('margin', m, 'here', overlaps(flow.boxOf(ca), flow.boxOf(cb), m), 'a next', overlaps(flow.boxOf(ca, ca.s + 0.05), flow.boxOf(cb), m), 'b next', overlaps(flow.boxOf(cb, cb.s + 0.05), flow.boxOf(ca), m));
for (const c of flow.cars) { const back = Math.max(0, c.s - 0.08); const b2 = flow.boxOf(c, back); for (const d of flow.cars) if (d !== c) console.log('back', c.id, 'vs', d.id, overlaps(b2, flow.boxOf(d), 0.02), overlaps(b2, flow.boxOf(d), 0.0), overlaps(flow.boxOf(c), flow.boxOf(d), 0)); }
