import { describe, expect, it } from 'vitest';
import * as T from '../../../lobby3d/lib';
import { corners } from '../engine/geometry';
import { boxOf } from '../engine/solver-types';
import { ALL_LEVELS } from '../levels';
import { CAMERA_ELEVATION } from './scene';
import { VEHICLE_TOP, frameCamera, project, type FrameInput } from './framing';

// phones from small to large, and a tablet. The title takes the top ~110 px, the helper buttons the bottom ~122 px.
const SCREENS: [number, number][] = [[360, 640], [375, 667], [390, 844], [412, 915], [430, 932], [768, 1024]];

function input(l: (typeof ALL_LEVELS)[number], w: number, h: number): FrameInput {
  const fitHalf = Math.max(l.lot.halfW + 0.6, 3.7);
  const pads = fitHalf >= 5.7 ? 8 : 5;
  const pitch = Math.min(1.42, (fitHalf * 2 * 0.95) / pads);
  return { width: w, height: h, fov: 30, elevation: CAMERA_ELEVATION, lot: l.lot, stationZ: -(l.lot.halfH + 1.75), stationHalfW: (pads * pitch) / 2 + 0.3, safe: { top: 110, bottom: h - 122 }, marginX: 0.02 };
}

describe('the camera shows every vehicle in the visible area', () => {
  for (const [w, h] of SCREENS) {
    it(`${w}x${h}: all vehicles of all ${ALL_LEVELS.length} levels are between the title and the buttons`, () => {
      const cam = new T.PerspectiveCamera(30, w / h, 1, 400);
      for (const l of ALL_LEVELS) {
        const f = input(l, w, h);
        const fr = frameCamera(f);
        for (const v of l.vehicles) {
          for (const c of corners(boxOf(v))) for (const y of [0, VEHICLE_TOP]) {
            const p = project(f, fr, new T.Vector3(c.x, y, c.z), cam);
            expect(p.x, `${l.key} vehicle ${v.id} x`).toBeGreaterThanOrEqual(0);
            expect(p.x, `${l.key} vehicle ${v.id} x`).toBeLessThanOrEqual(w);
            expect(p.y, `${l.key} vehicle ${v.id} y`).toBeGreaterThanOrEqual(f.safe.top - 1);
            expect(p.y, `${l.key} vehicle ${v.id} y`).toBeLessThanOrEqual(f.safe.bottom + 1);
          }
        }
      }
    });
  }
  it('the lot fills the width of a phone when the height allows it', () => {
    const l = ALL_LEVELS.find((x) => x.key === '10')!;
    const f = input(l, 390, 844);
    const fr = frameCamera(f);
    const left = project(f, fr, new T.Vector3(-l.lot.halfW - 0.6, 0, l.lot.halfH + 0.6));
    const right = project(f, fr, new T.Vector3(l.lot.halfW + 0.6, 0, l.lot.halfH + 0.6));
    expect((right.x - left.x) / 390).toBeGreaterThan(0.9);
  });
});
