import * as T from '../../../lobby3d/lib';

/**
 * Where the camera goes so that the whole lot and the station are on the screen, between the title at the top and
 * the helper buttons at the bottom. Pure maths (no DOM), so a test can check every level on every screen size.
 */

export interface SafeArea { top: number; bottom: number }

export interface FrameInput {
  width: number;
  height: number;
  fov: number;
  /** degrees above the floor */
  elevation: number;
  lot: { halfW: number; halfH: number };
  /** z of the middle of the station and the half width of its row of places */
  stationZ: number;
  stationHalfW: number;
  /** the screen rows the picture may use (CSS pixels) */
  safe: SafeArea;
  /** share of the width kept free on each side */
  marginX?: number;
}

export interface Framing { dist: number; tz: number }

/** Height of the vehicles, the highest thing in the lot. */
export const VEHICLE_TOP = 1.5;
/** The pad and its kerb stick out this far past the vehicles. */
export const LOT_RIM = 0.6;

/** The points that must be visible: the lot with its rim at the floor and at vehicle height, and the station. */
export function framePoints(lot: FrameInput['lot'], stationZ: number, stationHalfW: number): T.Vector3[] {
  const pts: T.Vector3[] = [];
  const hw = lot.halfW + LOT_RIM;
  const hh = lot.halfH + LOT_RIM;
  for (const x of [-hw, hw]) for (const z of [-hh, hh]) for (const y of [0, VEHICLE_TOP]) pts.push(new T.Vector3(x, y, z));
  for (const x of [-stationHalfW, stationHalfW]) for (const z of [stationZ - 1.3, stationZ + 1.3]) for (const y of [0, VEHICLE_TOP * 0.8]) pts.push(new T.Vector3(x, y, z));
  return pts;
}

/** Screen position (CSS pixels) of a point seen from the framing. */
export function project(f: FrameInput, fr: Framing, p: T.Vector3, cam = new T.PerspectiveCamera(f.fov, f.width / f.height, 1, 400)): { x: number; y: number } {
  const el = (f.elevation * Math.PI) / 180;
  cam.aspect = f.width / f.height;
  cam.fov = f.fov;
  cam.updateProjectionMatrix();
  cam.position.set(0, Math.sin(el) * fr.dist, fr.tz + Math.cos(el) * fr.dist);
  cam.lookAt(0, 0, fr.tz);
  cam.updateMatrixWorld();
  const v = p.clone().project(cam);
  return { x: ((v.x + 1) / 2) * f.width, y: ((1 - v.y) / 2) * f.height };
}

export function frameCamera(f: FrameInput): Framing {
  const cam = new T.PerspectiveCamera(f.fov, f.width / f.height, 1, 400);
  const pts = framePoints(f.lot, f.stationZ, f.stationHalfW);
  const mx = f.width * (f.marginX ?? 0.02);
  const el = (f.elevation * Math.PI) / 180;
  const extent = (d: number, tz: number) => {
    cam.position.set(0, Math.sin(el) * d, tz + Math.cos(el) * d);
    cam.lookAt(0, 0, tz);
    cam.updateMatrixWorld();
    let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (const p of pts) {
      const v = p.clone().project(cam);
      const x = ((v.x + 1) / 2) * f.width;
      const y = ((1 - v.y) / 2) * f.height;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    return { minX, maxX, minY, maxY };
  };
  // for a distance, slide the camera along z until the bottom of the lot sits on the line above the buttons
  const solveTz = (d: number): number => {
    let lo = -60;
    let hi = 40;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      // moving the target south moves the picture up the screen: maxY gets smaller
      if (extent(d, mid).maxY > f.safe.bottom) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  const fits = (d: number): boolean => {
    const e = extent(d, solveTz(d));
    return e.minX >= mx && e.maxX <= f.width - mx && e.minY >= f.safe.top - 0.5;
  };
  let lo = 6;
  let hi = 400;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid;
    else lo = mid;
  }
  return { dist: hi, tz: solveTz(hi) };
}

// ---- tapping near a vehicle ---------------------------------------------------------------------------------------------

/** A tap this close (CSS pixels) to a vehicle's outline still counts as a tap on it. */
export const HIT_TOLERANCE = 12;
/** Every vehicle is at least this wide to a finger (its outline plus the tolerance on both sides), in CSS pixels. */
export const MIN_TOUCH = 44;

export interface HitShape { id: number; pts: { x: number; y: number }[] }

type P = { x: number; y: number };

/** The convex hull of some points (monotone chain). */
export function convexHull(points: P[]): P[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const cross = (o: P, a: P, b: P) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: P[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: P[] = [];
  for (const p of [...pts].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Distance from a point to a convex polygon: 0 when it is inside. */
export function distanceToHull(hull: P[], x: number, y: number): number {
  let inside = hull.length >= 3;
  let best = Infinity;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2));
    best = Math.min(best, Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy)));
    if (dx * (y - a.y) - dy * (x - a.x) < 0) inside = false;
  }
  return inside ? 0 : best;
}

/**
 * The vehicle a tap means. A tap squarely on one vehicle is that vehicle. Otherwise the candidates are the vehicles whose outline is
 * within `tol` pixels (nearly all taps near several vehicles are like this): if only some of them can drive out (`free`), the
 * nearest of those is chosen; if all or none can, the nearest of all. Null when nothing is close enough.
 */
export function nearestVehicle(shapes: HitShape[], x: number, y: number, tol = HIT_TOLERANCE, free?: (id: number) => boolean): number | null {
  const cands: { id: number; d: number; c: number }[] = [];
  for (const s of shapes) {
    const hull = convexHull(s.pts);
    const d = distanceToHull(hull, x, y);
    if (d > tol) continue;
    const cx = hull.reduce((a, p) => a + p.x, 0) / hull.length;
    const cy = hull.reduce((a, p) => a + p.y, 0) / hull.length;
    cands.push({ id: s.id, d, c: Math.hypot(x - cx, y - cy) });
  }
  if (!cands.length) return null;
  const nearest = (list: typeof cands) => list.reduce((best, k) => (k.d < best.d - 1e-6 || (Math.abs(k.d - best.d) < 1e-6 && k.c < best.c) ? k : best)).id;
  const on = cands.filter((k) => k.d === 0);
  if (on.length === 1) return on[0].id;
  if (free && cands.length > 1) {
    const ok = cands.filter((k) => free(k.id));
    if (ok.length > 0 && ok.length < cands.length) return nearest(ok);
  }
  return nearest(cands);
}

/** Width (CSS pixels) of the outline of a vehicle on the screen. */
export const hullWidth = (pts: P[]): number => Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x));

/** The narrowest the outline of a vehicle gets, in any direction (CSS pixels): what a finger has to land on. */
export function narrowestWidth(pts: P[]): number {
  const hull = convexHull(pts);
  let best = Infinity;
  for (let a = 0; a < 180; a += 3) {
    const c = Math.cos((a * Math.PI) / 180);
    const s = Math.sin((a * Math.PI) / 180);
    const ps = hull.map((p) => p.x * c + p.y * s);
    best = Math.min(best, Math.max(...ps) - Math.min(...ps));
  }
  return best;
}
/**
 * On a 360px-wide screen no vehicle's outline may be narrower than this. With the 12-point tolerance on both sides that is a
 * 50-point target (the guideline is 44). When this and the density rule disagree, this one wins, which is why a level
 * never has more than MAX_VEHICLES vehicles.
 */
export const MIN_OUTLINE = 26;
