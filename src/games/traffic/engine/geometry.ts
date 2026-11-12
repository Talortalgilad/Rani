/** Oriented rectangles and sweeps for the parking lot. Pure maths: no DOM, no three. */

export interface V2 { x: number; z: number }

/** A vehicle's footprint: centre, half length (along the heading), half width, heading in degrees (0 = +x, 90 = +z). */
export interface Obb { x: number; z: number; hl: number; hw: number; heading: number }

export const rad = (deg: number): number => (deg * Math.PI) / 180;
export const dirOf = (heading: number): V2 => ({ x: Math.cos(rad(heading)), z: Math.sin(rad(heading)) });

export function corners(o: Obb): V2[] {
  const u = dirOf(o.heading);
  const v = { x: -u.z, z: u.x };
  return [
    [1, 1], [1, -1], [-1, -1], [-1, 1],
  ].map(([a, b]) => ({ x: o.x + u.x * o.hl * a + v.x * o.hw * b, z: o.z + u.z * o.hl * a + v.z * o.hw * b }));
}

/** Separating-axis test. `margin` shrinks both boxes a little so that boxes that merely touch do not count. */
export function overlaps(a: Obb, b: Obb, margin = 0.02): boolean {
  const ca = corners({ ...a, hl: a.hl - margin, hw: a.hw - margin });
  const cb = corners({ ...b, hl: b.hl - margin, hw: b.hw - margin });
  for (const o of [a, b]) {
    const u = dirOf(o.heading);
    for (const axis of [u, { x: -u.z, z: u.x }]) {
      const pa = ca.map((p) => p.x * axis.x + p.z * axis.z);
      const pb = cb.map((p) => p.x * axis.x + p.z * axis.z);
      if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false;
    }
  }
  return true;
}

/** The box a vehicle sweeps when it drives `dist` along its heading. */
export function swept(o: Obb, dist: number): Obb {
  const u = dirOf(o.heading);
  return { ...o, x: o.x + (u.x * dist) / 2, z: o.z + (u.z * dist) / 2, hl: o.hl + dist / 2 };
}

export const FAR = 60;

/** Is the road ahead clear all the way out? */
export function pathClear(o: Obb, others: Obb[]): boolean {
  const s = swept(o, FAR);
  return !others.some((b) => overlaps(s, b));
}

/**
 * How far can it drive before it hits something, and what? null when the way out is clear.
 * Steps of 5 cm, so the "bonk" happens right at the obstacle.
 */
export function firstContact(o: Obb, others: { id: number; box: Obb }[]): { distance: number; id: number } | null {
  if (pathClear(o, others.map((x) => x.box))) return null;
  const u = dirOf(o.heading);
  for (let t = 0; t <= FAR; t += 0.05) {
    const moved = { ...o, x: o.x + u.x * t, z: o.z + u.z * t };
    for (const b of others) if (overlaps(moved, b.box, 0.015)) return { distance: Math.max(0, t - 0.05), id: b.id };
  }
  return null;
}

export const insideLot = (o: Obb, halfW: number, halfH: number, pad = 0): boolean =>
  corners(o).every((p) => Math.abs(p.x) <= halfW - pad && Math.abs(p.z) <= halfH - pad);

/** Distance from a point to a vehicle's footprint (0 inside it). */
export function distanceToBox(px: number, pz: number, o: Obb): number {
  const u = dirOf(o.heading);
  const dx = px - o.x;
  const dz = pz - o.z;
  const a = Math.abs(dx * u.x + dz * u.z) - o.hl;
  const b = Math.abs(-dx * u.z + dz * u.x) - o.hw;
  return Math.hypot(Math.max(a, 0), Math.max(b, 0));
}

/**
 * The radius of the biggest empty circle that fits inside the lot between the vehicles: how big the biggest hole is. A lot built as a
 * ring around an empty middle has a big one; an empty corner does not (a circle does not fit into it).
 */
export function largestHole(boxes: Obb[], halfW: number, halfH: number, step = 0.15): number {
  let best = 0;
  for (let x = -halfW + step; x < halfW; x += step) {
    for (let z = -halfH + step; z < halfH; z += step) {
      let d = Math.min(halfW - Math.abs(x), halfH - Math.abs(z)); // the lot's own edges end the circle
      for (const b of boxes) {
        if (Math.abs(b.x - x) > d + b.hl + b.hw || Math.abs(b.z - z) > d + b.hl + b.hw) continue;
        d = Math.min(d, distanceToBox(x, z, b));
        if (d <= best) break;
      }
      if (d > best) best = d;
    }
  }
  return best;
}
