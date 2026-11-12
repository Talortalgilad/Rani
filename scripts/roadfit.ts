import { corners, overlaps } from '../src/games/traffic/engine/geometry';
import { TrafficState, boxOf } from '../src/games/traffic/engine/state';
import { ALL_LEVELS } from '../src/games/traffic/levels';
import { ROAD, boxAt, buildRoute, stationSlotX, stationZOf } from '../src/games/traffic/render/route';
function run(): { reenter: number; touch: number; routes: number } {
  let reenter = 0, touch = 0, routes = 0;
  for (const l of ALL_LEVELS) {
    const st = new TrafficState(l.vehicles, l.queue, l.belts);
    for (const id of l.stats?.solution ?? []) {
      st.autoRotate(id);
      const v = st.get(id);
      const others = st.vehicles.filter((o) => o.id !== id && o.status === 'parked').map((o) => boxOf(o));
      const r = st.tap(id);
      if (r.kind !== 'exit') break;
      const ss = v.type === 'car' ? 0.98 : v.type === 'van' ? 0.7 : 0.53;
      const route = buildRoute({ x: v.x, z: v.z, heading: v.heading, type: v.type, lot: l.lot, slotX: stationSlotX(l.lot.halfW, r.slot + 1), stationZ: stationZOf(l.lot.halfH), stationScale: ss });
      routes++;
      let out = false, bad = false, tch = false;
      for (const q of route.pts) {
        const b = boxAt(v.type, q);
        if (others.some((o) => overlaps(b, o, 0.02))) tch = true;
        const inLot = corners(b).some((c) => Math.abs(c.x) < l.lot.halfW - 0.02 && Math.abs(c.z) < l.lot.halfH - 0.02);
        if (!inLot) out = true; else if (out) bad = true;
      }
      if (bad) reenter++;
      if (tch) touch++;
      st.uncovered(id); st.arrive(id);
      for (let g = 0; g < 1000; g++) { const b = st.board(); if (!b) break; if (b.full) st.depart(b.vehicle.id); }
    }
  }
  return { reenter, touch, routes };
}
for (const [off, scale, corner, extra] of [[0.8, 0.42, 0.5, 0.3], [0.9, 0.42, 0.5, 0.3], [0.9, 0.4, 0.4, 0.5], [1.0, 0.4, 0.4, 0.4], [0.9, 0.4, 0.4, 0.8]]) {
  (ROAD as any).extra = extra; (ROAD as any).off = off; (ROAD as any).scale = scale; (ROAD as any).corner = corner;
  console.log(off, scale, corner, JSON.stringify(run()));
}
