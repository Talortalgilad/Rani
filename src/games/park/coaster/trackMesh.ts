/**
 * The track as it is drawn (SPEC-park.md 2): two round steel rails, sleepers, a spine beam under the middle, and supports (A-frames with a foot) that go
 * down to the ground; a chain on the lift. Built from the curve and its frames into a few merged geometries (few draw calls).
 */
import * as T from '../../../lobby3d/lib';
import type { Frames } from './frames';
import { DS, type Curve } from './track';

export interface TrackGeos { rails: T.BufferGeometry; spine: T.BufferGeometry; wood: T.BufferGeometry; legs: T.BufferGeometry; chain: T.BufferGeometry }

const GAUGE = 0.6;

/** A tube (or a bar) lofted along the curve: `ring` is the cross section as pairs (right, up), `off` where its middle is. */
function loft(c: Curve, f: Frames, i0: number, i1: number, ring: number[][], offR: number, offU: number, step: number): T.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  const idxs: number[] = [];
  for (let i = i0; i < i1; i += step) idxs.push(i);
  idxs.push(i1);
  idxs.forEach((i, k) => {
    for (const [a, b] of ring) {
      const rr = offR + a, uu = offU + b;
      pos.push(c.X[i] + f.r[i * 3] * rr + f.u[i * 3] * uu, c.Y[i] + f.r[i * 3 + 1] * rr + f.u[i * 3 + 1] * uu, c.Z[i] + f.r[i * 3 + 2] * rr + f.u[i * 3 + 2] * uu);
    }
    if (k > 0) {
      const m = ring.length, b0 = (k - 1) * m, b1 = k * m;
      for (let j = 0; j < m; j++) {
        const j2 = (j + 1) % m;
        idx.push(b0 + j, b1 + j, b1 + j2, b0 + j, b1 + j2, b0 + j2);
      }
    }
  });
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
const circle = (r: number, n = 7): number[][] => Array.from({ length: n }, (_, k) => [Math.cos((k / n) * Math.PI * 2) * r, Math.sin((k / n) * Math.PI * 2) * r]);
const rect = (w: number, h: number): number[][] => [[-w, -h], [w, -h], [w, h], [-w, h]];

const mergeAll = (gs: T.BufferGeometry[]): T.BufferGeometry => {
  if (!gs.length) return new T.BufferGeometry();
  const ng = gs.map((g) => {
    const x = g.index ? g.toNonIndexed() : g;
    for (const name of Object.keys(x.attributes)) if (name !== 'position' && name !== 'normal') x.deleteAttribute(name);
    return x;
  });
  return T.mergeGeometries(ng, false) ?? new T.BufferGeometry();
};

/** The geometry of the part of the curve between the distances `s0` and `s1`. */
export function buildTrackGeos(c: Curve, f: Frames, s0: number, s1: number): TrackGeos {
  const i0 = Math.max(0, Math.round(s0 / DS)), i1 = Math.min(c.n - 1, Math.round(s1 / DS));
  const empty = new T.BufferGeometry();
  if (i1 - i0 < 2) return { rails: empty, spine: empty.clone(), wood: empty.clone(), legs: empty.clone(), chain: empty.clone() };
  const rails = mergeAll([loft(c, f, i0, i1, circle(0.115), GAUGE, 0, 3), loft(c, f, i0, i1, circle(0.115), -GAUGE, 0, 3)]);
  const spine = loft(c, f, i0, i1, rect(0.17, 0.12), 0, -0.3, 4);
  // sleepers
  const wood: T.BufferGeometry[] = [];
  const box = new T.BoxGeometry(1.75, 0.07, 0.24);
  const m = new T.Matrix4();
  const stepT = Math.max(1, Math.round(0.42 / DS));
  for (let i = i0 + 2; i < i1; i += stepT) {
    m.makeBasis(new T.Vector3(f.t[i * 3], f.t[i * 3 + 1], f.t[i * 3 + 2]), new T.Vector3(f.u[i * 3], f.u[i * 3 + 1], f.u[i * 3 + 2]), new T.Vector3(f.r[i * 3], f.r[i * 3 + 1], f.r[i * 3 + 2]));
    // the long side of the box across the track: rotate it a quarter
    const rot = new T.Matrix4().makeRotationY(Math.PI / 2);
    m.setPosition(c.X[i] - f.u[i * 3] * 0.13, c.Y[i] - f.u[i * 3 + 1] * 0.13, c.Z[i] - f.u[i * 3 + 2] * 0.13);
    wood.push(box.clone().applyMatrix4(rot).applyMatrix4(m));
  }
  // supports: two slanted legs under the track every 1.6 units, down to the ground (none inside a loop, none where the track is on the ground)
  const legs: T.BufferGeometry[] = [];
  const leg = new T.CylinderGeometry(0.11, 0.14, 1, 7);
  const up = new T.Vector3(0, 1, 0);
  for (let i = i0 + Math.round(0.8 / DS); i < i1; i += Math.round(1.6 / DS)) {
    if (c.inLoop[i] || c.Y[i] < 1.0) continue;
    const top = new T.Vector3(c.X[i] - f.u[i * 3] * 0.32, c.Y[i] - f.u[i * 3 + 1] * 0.32, c.Z[i] - f.u[i * 3 + 2] * 0.32);
    for (const side of [-1, 1]) {
      const a = top.clone().addScaledVector(new T.Vector3(f.r[i * 3], 0, f.r[i * 3 + 2]).normalize(), side * 0.4);
      const b = new T.Vector3(top.x, 0, top.z).addScaledVector(new T.Vector3(f.r[i * 3], 0, f.r[i * 3 + 2]).normalize(), side * 1.1);
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const dir = b.clone().sub(a);
      const len = dir.length();
      const q = new T.Quaternion().setFromUnitVectors(up, dir.normalize());
      legs.push(leg.clone().applyMatrix4(new T.Matrix4().compose(mid, q, new T.Vector3(1, len, 1))));
    }
    // a foot
    legs.push(new T.CylinderGeometry(0.5, 0.58, 0.1, 10).applyMatrix4(new T.Matrix4().makeTranslation(top.x, 0.05, top.z)));
  }
  // the chain of the lift: dark teeth along the spine
  const chain: T.BufferGeometry[] = [];
  const tooth = new T.BoxGeometry(0.2, 0.1, 0.46);
  for (const [a, b] of c.chains) {
    for (let d = Math.max(a, s0); d <= Math.min(b, s1); d += 0.34) {
      const i = Math.round(d / DS);
      if (i <= i0 || i >= i1) continue;
      m.makeBasis(new T.Vector3(f.t[i * 3], f.t[i * 3 + 1], f.t[i * 3 + 2]), new T.Vector3(f.u[i * 3], f.u[i * 3 + 1], f.u[i * 3 + 2]), new T.Vector3(f.r[i * 3], f.r[i * 3 + 1], f.r[i * 3 + 2]));
      m.setPosition(c.X[i] - f.u[i * 3] * 0.16, c.Y[i] - f.u[i * 3 + 1] * 0.16, c.Z[i] - f.u[i * 3 + 2] * 0.16);
      chain.push(tooth.clone().applyMatrix4(new T.Matrix4().makeRotationY(Math.PI / 2)).applyMatrix4(m));
    }
  }
  return { rails, spine, wood: mergeAll(wood), legs: mergeAll(legs), chain: mergeAll(chain) };
}

/** Every geometry of the set in one (for the ghost). */
export const mergeGeos = (g: TrackGeos): T.BufferGeometry => mergeAll([g.rails, g.spine, g.wood]);

/** The shadow of the track: its rails, spine and legs flattened on the ground, pushed away from the sun (a little to the side). */
export function shadowGeo(g: TrackGeos): T.BufferGeometry {
  const src = mergeAll([g.rails, g.spine, g.legs].filter((x) => x.attributes.position));
  const pos = src.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    pos.setXYZ(i, pos.getX(i) - y * 0.45, 0.035, pos.getZ(i) - y * 0.25);
  }
  pos.needsUpdate = true;
  src.deleteAttribute('normal');
  return src;
}
