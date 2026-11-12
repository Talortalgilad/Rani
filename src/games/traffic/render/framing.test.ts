import { describe, expect, it } from 'vitest';
import * as T from '../../../lobby3d/lib';
import { corners } from '../engine/geometry';
import { boxOf } from '../engine/solver-types';
import { ALL_LEVELS } from '../levels';
import { CAMERA_ELEVATION } from './scene';
import { HIT_TOLERANCE, LOT_RIM, MIN_TOUCH, VEHICLE_TOP, convexHull, distanceToHull, frameCamera, hullWidth, nearestVehicle, project, type FrameInput, type HitShape } from './framing';

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

/** The outline of every vehicle of a level on the screen of a phone. */
function shapesOf(l: (typeof ALL_LEVELS)[number], w: number, h: number): { shapes: HitShape[]; f: FrameInput } {
  const f = input(l, w, h);
  const fr = frameCamera(f);
  const cam = new T.PerspectiveCamera(30, w / h, 1, 400);
  const shapes = l.vehicles.map((v): HitShape => ({ id: v.id, pts: corners(boxOf(v)).flatMap((c) => [0, VEHICLE_TOP].map((y) => project(f, fr, new T.Vector3(c.x, y, c.z), cam))) }));
  return { shapes, f };
}

describe('a finger can hit every vehicle', () => {
  for (const [w, h] of SCREENS) {
    it(`${w}x${h}: every vehicle is at least ${MIN_TOUCH} points wide to a finger (its outline plus ${HIT_TOLERANCE} on each side)`, () => {
      for (const l of ALL_LEVELS) {
        for (const s of shapesOf(l, w, h).shapes) expect(hullWidth(s.pts) + 2 * HIT_TOLERANCE, `${l.key} vehicle ${s.id}`).toBeGreaterThanOrEqual(MIN_TOUCH);
      }
    });
  }
  it('a tap near a vehicle (up to 12 points) chooses the nearest one', () => {
    const l = ALL_LEVELS.find((x) => x.key === '12')!;
    const { shapes } = shapesOf(l, 360, 640);
    let tested = 0;
    for (const s of shapes) {
      const hull = convexHull(s.pts);
      const cx = hull.reduce((a, p) => a + p.x, 0) / hull.length;
      const cy = hull.reduce((a, p) => a + p.y, 0) / hull.length;
      const top = Math.min(...hull.map((p) => p.y));
      // 8 points above the top edge of the outline
      const x = cx;
      const y = top - 8;
      const d = shapes.map((o) => ({ id: o.id, d: distanceToHull(convexHull(o.pts), x, y) })).sort((a, b) => a.d - b.d);
      const expected = d[0].d <= HIT_TOLERANCE ? d[0].id : null;
      expect(nearestVehicle(shapes, x, y), `vehicle ${s.id}`).toBe(expected);
      // a point in the middle of the outline always chooses a vehicle whose outline holds it
      const inside = nearestVehicle(shapes, cx, cy);
      expect(inside).not.toBeNull();
      tested++;
    }
    expect(tested).toBe(l.vehicles.length);
  });
  it('a tap farther than 12 points from everything chooses nothing', () => {
    const l = ALL_LEVELS.find((x) => x.key === '12')!;
    expect(nearestVehicle(shapesOf(l, 360, 640).shapes, -200, -200)).toBeNull();
  });
});

describe('from level 15 the lot fills at least 55% of the height of the screen', () => {
  for (const [w, h] of SCREENS) {
    it(`${w}x${h}`, () => {
      for (const l of ALL_LEVELS.filter((x) => x.kind === 'level' && x.number >= 15)) {
        const f = input(l, w, h);
        const fr = frameCamera(f);
        const ys = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => project(f, fr, new T.Vector3(sx * (l.lot.halfW + LOT_RIM), 0, sz * (l.lot.halfH + LOT_RIM))).y));
        expect((Math.max(...ys) - Math.min(...ys)) / h, `level ${l.number}`).toBeGreaterThanOrEqual(0.55);
      }
    });
  }
});
