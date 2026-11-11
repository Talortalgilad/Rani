import type { ColorId, VehicleDef } from '../engine/state';

/**
 * The one hand-made level of stage 0 (beach world). Drawn by scripts/gen-traffic-slice.ts (seed 99): every vehicle
 * could leave when it was the last one added, so clearing them in reverse id order always works. The queue lists the
 * passengers of the vehicles in that order, shuffled inside groups of three vehicles, so the station never needs more
 * than three different vehicles at once when the lot is cleared in that order.
 */
export const LOT = { halfW: 6.0, halfH: 6.4 };

export const SLICE_VEHICLES: VehicleDef[] = [
  { id: 0, type: 'car', color: 'blue', x: -1.25, z: -4.75, heading: 90 },
  { id: 1, type: 'van', color: 'orange', x: -0.5, z: 2.75, heading: 135 },
  { id: 2, type: 'bus', color: 'pink', x: -3, z: -0.5, heading: 90, hidden: true },
  { id: 3, type: 'bus', color: 'orange', x: 2, z: -1.25, heading: 90 },
  { id: 4, type: 'car', color: 'pink', x: -3.5, z: -4.5, heading: 270 },
  { id: 5, type: 'bus', color: 'pink', x: 0, z: -3, heading: 315 },
  { id: 6, type: 'car', color: 'cyan', x: 3.75, z: -0.75, heading: 270 },
  { id: 7, type: 'bus', color: 'blue', x: 5, z: -1.5, heading: 270 },
  { id: 8, type: 'bus', color: 'blue', x: 1.25, z: 5, heading: 0, hidden: true },
  { id: 9, type: 'van', color: 'red', x: 2.25, z: 1.25, heading: 0 },
  { id: 10, type: 'car', color: 'yellow', x: 4.75, z: 5.25, heading: 0 },
  { id: 11, type: 'car', color: 'green', x: -4, z: 2.5, heading: 90 },
  { id: 12, type: 'bus', color: 'green', x: 3, z: 2.5, heading: 0 },
  { id: 13, type: 'car', color: 'yellow', x: 3.75, z: -3.5, heading: 315, hidden: true },
  { id: 14, type: 'car', color: 'orange', x: -4.75, z: 5, heading: 135 },
  { id: 15, type: 'car', color: 'purple', x: -3, z: 3, heading: 90 },
  { id: 16, type: 'car', color: 'orange', x: 1.75, z: -5, heading: 225 },
  { id: 17, type: 'car', color: 'cyan', x: 4, z: -5.25, heading: 0 },
  { id: 18, type: 'car', color: 'pink', x: -0.25, z: -5.25, heading: 270 },
  { id: 19, type: 'car', color: 'blue', x: -2.75, z: 5, heading: 90 },
  { id: 20, type: 'van', color: 'yellow', x: 3.75, z: 3.75, heading: 0 },
  { id: 21, type: 'car', color: 'blue', x: -1.75, z: 5.25, heading: 90 },
  { id: 22, type: 'van', color: 'purple', x: -3, z: -3, heading: 180 },
  { id: 23, type: 'van', color: 'red', x: -5, z: -2, heading: 270 },
  { id: 24, type: 'car', color: 'orange', x: -4.5, z: -5.25, heading: 270 },
  { id: 25, type: 'car', color: 'cyan', x: 4.75, z: 1.25, heading: 0 },
];

export const SLICE_QUEUE: ColorId[] = ["red", "cyan", "red", "red", "cyan", "red", "cyan", "orange", "cyan", "orange", "red", "red", "orange", "orange", "blue", "purple", "purple", "yellow", "yellow", "purple", "yellow", "yellow", "purple", "yellow", "purple", "blue", "yellow", "purple", "blue", "blue", "blue", "blue", "pink", "cyan", "pink", "pink", "cyan", "cyan", "blue", "blue", "pink", "cyan", "orange", "orange", "orange", "orange", "orange", "orange", "purple", "purple", "orange", "purple", "orange", "purple", "green", "yellow", "green", "yellow", "green", "green", "green", "yellow", "green", "green", "green", "green", "green", "green", "green", "green", "yellow", "green", "yellow", "blue", "red", "red", "blue", "blue", "yellow", "yellow", "blue", "red", "blue", "blue", "red", "blue", "red", "yellow", "red", "blue", "blue", "blue", "blue", "cyan", "pink", "pink", "pink", "blue", "blue", "pink", "pink", "pink", "pink", "blue", "blue", "cyan", "pink", "blue", "pink", "blue", "blue", "cyan", "blue", "cyan", "pink", "blue", "pink", "pink", "orange", "pink", "pink", "pink", "orange", "orange", "pink", "pink", "orange", "pink", "orange", "pink", "pink", "orange", "pink", "orange", "orange", "pink", "pink", "pink", "orange", "orange", "blue", "orange", "blue", "orange", "blue", "blue", "orange", "orange", "orange", "orange"];

export const SLICE_LEVEL = 12;
