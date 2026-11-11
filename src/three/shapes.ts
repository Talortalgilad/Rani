import * as T from './lib';
import { Materials, PALETTE } from './materials';

function roundedRect(w: number, h: number, r: number): T.Shape {
  const s = new T.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

/** Box with rounded edges, centred on the origin. Total size is w × h × d. */
export function roundedBox(w: number, h: number, d: number, r: number): T.ExtrudeGeometry {
  const bevel = Math.min(r * 0.5, d * 0.3);
  const g = new T.ExtrudeGeometry(roundedRect(w - 2 * bevel, h - 2 * bevel, Math.max(0.001, r - bevel)), {
    depth: d - 2 * bevel, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 6,
  });
  g.center();
  return g;
}

/** Extruded five-point star, centred, facing +z. */
export function starGeometry(outer: number, inner: number, depth: number): T.ExtrudeGeometry {
  const s = new T.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? outer : inner;
    const x = Math.cos(a) * rad;
    const y = Math.sin(a) * rad;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  const b = depth * 0.25;
  const g = new T.ExtrudeGeometry(s, { depth: depth - 2 * b, bevelEnabled: true, bevelSize: b, bevelThickness: b, bevelSegments: 2 });
  g.center();
  return g;
}

/** Golden padlock. Returns the group and the shackle so a scene can rattle it. */
export function makeLock(mats: Materials): { group: T.Group; shackle: T.Mesh } {
  const group = new T.Group();
  const gold = mats.get(PALETTE.gold, { rough: 0.3, metal: 0.6 });
  const body = new T.Mesh(roundedBox(0.7, 0.55, 0.3, 0.12), gold);
  body.position.y = -0.1;
  const shackle = new T.Mesh(new T.TorusGeometry(0.21, 0.065, 8, 16, Math.PI), gold);
  shackle.position.y = 0.17;
  const hole = new T.Mesh(new T.SphereGeometry(0.06, 8, 8), mats.get(PALETTE.ink));
  hole.position.set(0, -0.1, 0.15);
  group.add(body, shackle, hole);
  return { group, shackle };
}

/** A puffy cloud of a few spheres. */
export function makeCloud(mats: Materials, scale = 1): T.Group {
  const g = new T.Group();
  const m = mats.get(PALETTE.cloud, { rough: 0.9 });
  const puffs: [number, number, number, number][] = [
    [0, 0, 0, 0.55], [-0.55, -0.08, 0.1, 0.42], [0.55, -0.1, 0.05, 0.45], [-0.2, 0.3, -0.05, 0.4], [0.28, 0.26, 0.1, 0.36],
  ];
  for (const [x, y, z, r] of puffs) {
    const s = new T.Mesh(new T.SphereGeometry(r, 12, 10), m);
    s.position.set(x, y, z);
    g.add(s);
  }
  g.scale.setScalar(scale);
  return g;
}

/**
 * Slots inside the star jar, filled from the bottom: 7 per layer (centre + 6 around it), each layer turned a bit.
 * Pure maths, so the packing can be tested without WebGL.
 */
export function jarSlots(n: number, radius = 0.34, layerH = 0.095): { x: number; y: number; z: number }[] {
  return Array.from({ length: n }, (_, i) => {
    const layer = Math.floor(i / 7);
    const k = i % 7;
    const a = (k / 6) * Math.PI * 2 + layer * 0.7;
    return k === 0
      ? { x: 0, y: layer * layerH, z: 0 }
      : { x: Math.cos(a - 1) * radius, y: layer * layerH, z: Math.sin(a - 1) * radius };
  });
}
export const JAR_CAPACITY = 70;
