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
