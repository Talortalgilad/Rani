/**
 * The camera of the carnival (SPEC-carnival.md 2): a fixed slant from above; a drag moves it, a pinch brings it near or far (inside limits),
 * "home" brings it back. It never moves by itself while a finger is on the screen. A touch that moves less than 10 pt and is quick is a tap
 * (a choice), and a drag never is one. Pure maths: the scene gives it the pointers.
 */
export const TAP_MOVE = 10;
export const TAP_MS = 400;
export const PITCH = (54 * Math.PI) / 180;
export const DIST_MIN = 15;
export const DIST_MAX = 48;
export const PAN_LIMIT = 8.5;
export const FOV = 46;

export interface CamState { x: number; z: number; dist: number }
export const clampDist = (d: number): number => Math.min(DIST_MAX, Math.max(DIST_MIN, d));
export function clampTarget(s: CamState): CamState {
  const r = Math.hypot(s.x, s.z);
  const k = r > PAN_LIMIT ? PAN_LIMIT / r : 1;
  return { x: s.x * k, z: s.z * k, dist: clampDist(s.dist) };
}
/** The distance from which a circle of `radius` round the middle fills the width of the screen. */
export function fitDist(aspect: number, radius: number): number {
  const half = Math.tan(((FOV / 2) * Math.PI) / 180);
  return clampDist(radius / (half * Math.min(aspect, 1.3)));
}
/** A touch is a tap when it was quick and moved little. */
export const isTap = (movedPx: number, ms: number): boolean => movedPx <= TAP_MOVE && ms <= TAP_MS;

/** Where the camera is, for a target on the ground and a distance. */
export function eye(s: CamState): { x: number; y: number; z: number } {
  return { x: s.x, y: Math.sin(PITCH) * s.dist, z: s.z + Math.cos(PITCH) * s.dist };
}

/** The ground distance for one pixel of a drag at this zoom (so that the ground follows the finger). */
export function groundPerPx(dist: number, heightPx: number): number {
  const span = 2 * Math.tan(((FOV / 2) * Math.PI) / 180) * dist;
  return span / heightPx;
}
