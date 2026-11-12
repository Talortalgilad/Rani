import { readFileSync } from 'node:fs';
import * as T from '../src/lobby3d/lib';
import { CAMERA_ELEVATION } from '../src/games/traffic/render/scene';
import { stationZOf } from '../src/games/traffic/render/route';
import { LOT_RIM, frameCamera, project } from '../src/games/traffic/render/framing';
const ls = JSON.parse(readFileSync('src/games/traffic/levels/levels.json', 'utf8'));
for (const l of ls) {
  if (l.number < 15) continue;
  const [w, h] = [360, 640];
  const fitHalf = Math.max(l.lot.halfW + 0.6, 3.7);
  const pads = fitHalf >= 5.7 ? 8 : 5;
  const pitch = Math.min(1.42, (fitHalf * 2 * 0.95) / pads);
  const f: any = { width: w, height: h, fov: 30, elevation: CAMERA_ELEVATION, lot: l.lot, stationZ: stationZOf(l.lot.halfH), stationHalfW: (pads * pitch) / 2 + 0.3, safe: { top: 110, bottom: h - 122 }, marginX: 0.02 };
  const fr = frameCamera(f);
  const ys = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => project(f, fr, new T.Vector3(sx * (l.lot.halfW + LOT_RIM), 0, sz * (l.lot.halfH + LOT_RIM))).y));
  const r = (Math.max(...ys) - Math.min(...ys)) / h;
  if (r < 0.55) console.log(l.number, r.toFixed(2), l.lot.halfW, l.lot.halfH);
}
