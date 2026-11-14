import { describe, expect, it } from 'vitest';
import { CORRIDOR, buildCurve, groundDistance, placeScenery, sway } from './scenery';
import { addLoop, buildPath, finish, newTrack, pathLength, type Track } from './track';

function make(points: [number, number][], loopAt: number | null = null, loopX = 0): Track {
  const t = newTrack();
  for (const [x, y] of points) t.pts.push({ x, y });
  if (loopAt !== null) addLoop(t, loopX);
  finish(t);
  return t;
}
const TRACKS: [string, Track][] = [
  ['a loop and hills', make([[8.5, 0.9], [11.5, 0.9], [14, 1.8], [16.5, 2.8], [18.5, 1.8], [20.4, 1.6]], 1, 8.5)],
  ['hills only', make([[8.5, 3], [10.8, 0.8], [13.5, 3.5], [16, 0.8], [18.5, 3], [20.4, 1.6]])],
];

describe('the 3D ride keeps a clean corridor round the track', () => {
  for (const [name, t] of TRACKS) {
    const path = buildPath(t);
    for (const tier of ['high', 'medium'] as const) {
      const seed = 7;
      const curve = buildCurve(path, seed, false);
      const land = placeScenery(path, curve, seed, tier);

      it(`${name} (${tier}): no tree, post or flag is nearer than ${CORRIDOR} units to the middle of the track`, () => {
        expect(land.trees.length).toBeGreaterThan(20);
        expect(land.posts.length).toBeGreaterThan(4);
        for (const o of [...land.trees, ...land.posts]) expect(groundDistance(curve, o.x, o.z) - (o.r > 0.6 && o.h > 0 && o.y > 0 ? 0 : 0), `${o.x.toFixed(1)},${o.z.toFixed(1)}`).toBeGreaterThanOrEqual(CORRIDOR);
        // a flag hangs to the side of its post
        for (const o of land.posts) expect(groundDistance(curve, o.x + 0.8, o.z)).toBeGreaterThanOrEqual(CORRIDOR - 0.8);
      });

      it(`${name} (${tier}): along the whole way of the camera nothing is inside the camera: no tree, post or other part of the track within reach`, () => {
        let worst = Infinity;
        for (let i = 0; i < curve.n; i += 1) {
          const cam = curve.P[i].clone().addScaledVector(curve.Up[i], 0.85);
          // the scenery
          for (const tr of land.trees) worst = Math.min(worst, Math.hypot(cam.x - tr.x, cam.y - tr.y, cam.z - tr.z) - tr.r);
          for (const po of land.posts) worst = Math.min(worst, Math.hypot(cam.x - po.x, Math.max(0, Math.abs(cam.y - po.h / 2) - po.h / 2), cam.z - po.z));
          // the pillars of other parts of the track (a pillar is a vertical line from its point of the track down to the ground)
          for (const pl of land.pillars) {
            if (Math.abs(path.s[Math.min(path.n - 1, i * 3)] - pl.s!) < 4) continue;
            const yy = Math.min(Math.max(cam.y, 0), pl.y);
            worst = Math.min(worst, Math.hypot(cam.x - pl.x, cam.y - yy, cam.z - pl.z));
          }
          // the track itself: the parts that are far along the way (the other lane of the loop, a crossing) are not near the camera
          for (let j = 0; j < curve.n; j++) {
            if (Math.abs(path.s[Math.min(path.n - 1, j * 3)] - path.s[Math.min(path.n - 1, i * 3)]) < 4) continue;
            worst = Math.min(worst, cam.distanceTo(curve.P[j]));
          }
        }
        expect(worst).toBeGreaterThan(1.5);
      });

      it(`${name} (${tier}): no pillar goes through the track`, () => {
        for (const pl of land.pillars) {
          for (let j = 0; j < curve.n; j++) {
            const p = curve.P[j];
            // the pillar is the vertical line below its own point of the track
            if (Math.abs(path.s[Math.min(path.n - 1, j * 3)] - pl.s!) < 4) continue; // its own part of the track
            if (Math.hypot(p.x - pl.x, p.z - pl.z) < 0.5 && p.y < pl.y - 0.4) throw new Error(`a pillar at ${pl.x.toFixed(1)} goes through the track at height ${p.y.toFixed(1)}`);
          }
        }
        expect(land.pillars.length).toBeGreaterThan(0);
      });
    }
  }

  it('the two lanes of the loop are apart sideways, so that the track does not cross itself', () => {
    const t = TRACKS[0][1];
    const path = buildPath(t);
    const [a, b] = path.loops[0];
    expect(Math.abs(sway(path, a + 0.01, 7) - sway(path, b - 0.01, 7))).toBeGreaterThan(1.5);
    expect(pathLength(path)).toBeGreaterThan(20);
  });
});
