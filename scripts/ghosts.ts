import { TrafficState } from '../src/games/traffic/engine/state';
import { overlaps } from '../src/games/traffic/engine/geometry';
import { ALL_LEVELS } from '../src/games/traffic/levels';
import { RoadFlow, poseAt } from '../src/games/traffic/render/roadflow';
import { buildRoute, stationSlotX, stationZOf } from '../src/games/traffic/render/route';
for (const gap of [12, 4, 30]) {
  let ghosts = 0, bad = 0, sent = 0, overl = 0; const badLv: string[] = [];
  for (const l of ALL_LEVELS.filter((x) => x.stats?.solution)) {
    const st = new TrafficState(l.vehicles, l.queue, l.belts); const flow = new RoadFlow(); flow.onHop = (c, by) => { if (process.env.SHOW && gap === 30) console.log('GHOST level', l.key, 'car', c.id, c.type, 's', c.s.toFixed(2), 'why', c.why, 'by', by.id, by.type, 's', by.s.toFixed(2), by.why, JSON.stringify(poseAt(c.route, c.s)), JSON.stringify(poseAt(by.route, by.s)), 'routes enter', c.route.enterAt.toFixed(1), by.route.enterAt.toFixed(1), 'top', c.route.topDir, by.route.topDir); };
    const land = () => { for (const c of flow.step(1 / 30)) { st.arrive(c.id); for (let g = 0; g < 1000; g++) { const b = st.board(); if (!b) break; if (b.full) st.depart(b.vehicle.id); } }
      const cars = flow.cars; for (let a = 0; a < cars.length; a++) for (let b = a + 1; b < cars.length; b++) if (overlaps(flow.boxOf(cars[a]), flow.boxOf(cars[b]), 0.02)) overl++; };
    for (const id of l.stats!.solution) {
      let g = 0; while (!st.slots.includes(null) && g++ < 3000) land();
      st.autoRotate(id); const v = st.get(id); const r = st.tap(id); if (r.kind !== 'exit') break;
      const ss = v.type === 'car' ? 0.98 : v.type === 'van' ? 0.7 : 0.53;
      flow.add({ id, type: v.type, route: buildRoute({ x: v.x, z: v.z, heading: v.heading, type: v.type, lot: l.lot, slotX: stationSlotX(l.lot.halfW, r.slot + 1), stationZ: stationZOf(l.lot.halfH), stationScale: ss }), order: sent++ }); st.uncovered(id);
      for (let k = 0; k < gap; k++) land();
    }
    let g = 0; while (flow.cars.length && g++ < 6000) land();
    if (flow.cars.length) bad++;
    if (flow.hops) { ghosts += flow.hops; badLv.push(l.key + ':' + flow.hops); }
  }
  console.log('gap', gap / 30, 's sent', sent, 'ghosts', ghosts, 'levels with ghosts', badLv.join(' '), 'unfinished levels', bad, 'overlap-steps', overl);
}
