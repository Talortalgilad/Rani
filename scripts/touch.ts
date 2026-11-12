import { readFileSync, existsSync } from 'node:fs';
import * as T from '../src/lobby3d/lib';
import { corners } from '../src/games/traffic/engine/geometry';
import { boxOf } from '../src/games/traffic/engine/solver-types';
import { CAMERA_ELEVATION } from '../src/games/traffic/render/scene';
import { VEHICLE_TOP, frameCamera, hullWidth, project, convexHull, narrowestWidth, type FrameInput } from '../src/games/traffic/render/framing';
export function minWidth(l: any, w = 360, h = 640): { min: number; minShort: number } {
  const fitHalf = Math.max(l.lot.halfW + 0.6, 3.7);
  const pads = fitHalf >= 5.7 ? 8 : 5;
  const pitch = Math.min(1.42, (fitHalf * 2 * 0.95) / pads);
  const f: FrameInput = { width: w, height: h, fov: 30, elevation: CAMERA_ELEVATION, lot: l.lot, stationZ: -(l.lot.halfH + 1.75), stationHalfW: (pads * pitch) / 2 + 0.3, safe: { top: 110, bottom: h - 122 }, marginX: 0.02 };
  const fr = frameCamera(f);
  const cam = new T.PerspectiveCamera(30, w / h, 1, 400);
  let min = 1e9, minShort = 1e9;
  for (const v of l.vehicles) {
    const pts = corners(boxOf(v)).flatMap((c: any) => [0, VEHICLE_TOP].map((y) => project(f, fr, new T.Vector3(c.x, y, c.z), cam)));
    min = Math.min(min, hullWidth(pts));
    // narrowest width of the hull over all directions
    const hull = convexHull(pts);
    let nar = 1e9;
    for (let a = 0; a < 180; a += 5) { const c = Math.cos((a * Math.PI) / 180), s = Math.sin((a * Math.PI) / 180); const ps = hull.map((p) => p.x * c + p.y * s); nar = Math.min(nar, Math.max(...ps) - Math.min(...ps)); }
    minShort = Math.min(minShort, narrowestWidth(pts));
  }
  return { min, minShort };
}
if (process.env.TOUCH) {
  for (let L = 1; L <= 100; L++) {
    const f = `scripts/.cache/${L}.json`;
    if (!existsSync(f)) continue;
    const c = JSON.parse(readFileSync(f, 'utf8'))[0];
    if (!c) continue;
    const m = minWidth(c.data);
    console.log(L, c.data.vehicles.length, 'hull-x', m.min.toFixed(0), 'narrowest', m.minShort.toFixed(0));
  }
}
