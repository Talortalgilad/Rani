import type { ColorId, VehicleDef } from '../engine/state';

/**
 * The one hand-made level of stage 0 (beach world). Drawn by scripts/gen-traffic-slice.ts (seed 93): every vehicle
 * could leave when it was the last one added, so clearing them in reverse id order always works. The queue lists the
 * passengers of the vehicles in that order, shuffled inside groups of three vehicles, so the station never needs more
 * than three different vehicles at once when the lot is cleared in that order. The footprints leave a gap of at least
 * 10 cm between any two vehicles, wheels included.
 */
export const LOT = { halfW: 6, halfH: 6.4 };

export const SLICE_VEHICLES: VehicleDef[] = [
  { id: 0, type: 'car', color: 'purple', x: 2.25, z: 0.25, heading: 180 },
  { id: 1, type: 'car', color: 'red', x: -3, z: 1.25, heading: 315 },
  { id: 2, type: 'bus', color: 'orange', x: 2, z: -1.5, heading: 0, hidden: true },
  { id: 3, type: 'car', color: 'green', x: 0.75, z: -4, heading: 225 },
  { id: 4, type: 'bus', color: 'yellow', x: -1.5, z: -2.75, heading: 180 },
  { id: 5, type: 'van', color: 'pink', x: 3, z: -3.75, heading: 315 },
  { id: 6, type: 'van', color: 'purple', x: 0.75, z: 4.75, heading: 180, hidden: true },
  { id: 7, type: 'van', color: 'cyan', x: 0, z: 2.5, heading: 0 },
  { id: 8, type: 'car', color: 'purple', x: -4.75, z: 1, heading: 90 },
  { id: 9, type: 'car', color: 'yellow', x: -3.5, z: 4.75, heading: 90 },
  { id: 10, type: 'van', color: 'pink', x: -1.75, z: -1.25, heading: 180 },
  { id: 11, type: 'car', color: 'orange', x: 3.25, z: 2.25, heading: 0 },
  { id: 12, type: 'bus', color: 'blue', x: -4.75, z: 4.25, heading: 90 },
  { id: 13, type: 'van', color: 'blue', x: -1.75, z: -5.25, heading: 180, hidden: true },
  { id: 14, type: 'car', color: 'cyan', x: -4.25, z: -5, heading: 180 },
  { id: 15, type: 'van', color: 'blue', x: -2.25, z: 4, heading: 90 },
  { id: 16, type: 'van', color: 'red', x: 5, z: -0.25, heading: 90 },
  { id: 17, type: 'van', color: 'cyan', x: 4.25, z: 5, heading: 0 },
  { id: 18, type: 'car', color: 'cyan', x: -4.25, z: -1.25, heading: 180 },
  { id: 19, type: 'car', color: 'green', x: 4.75, z: 3.5, heading: 0 },
  { id: 20, type: 'car', color: 'red', x: -4.75, z: -3.5, heading: 180 },
  { id: 21, type: 'car', color: 'pink', x: 4.75, z: -5, heading: 225 },
  { id: 22, type: 'car', color: 'purple', x: 1.5, z: -5, heading: 225 },
];

export const SLICE_QUEUE: ColorId[] = ["pink","red","purple","pink","purple","red","purple","pink","pink","red","red","purple","cyan","cyan","green","cyan","green","cyan","cyan","cyan","cyan","green","cyan","cyan","cyan","green","red","cyan","blue","cyan","cyan","red","blue","blue","cyan","red","blue","red","blue","blue","red","red","blue","blue","blue","orange","blue","blue","orange","orange","blue","blue","orange","blue","blue","blue","blue","blue","blue","blue","blue","blue","purple","pink","pink","purple","pink","purple","yellow","yellow","yellow","pink","purple","yellow","pink","pink","purple","pink","cyan","purple","cyan","purple","pink","cyan","purple","cyan","cyan","cyan","pink","purple","pink","pink","purple","pink","orange","yellow","yellow","orange","orange","yellow","orange","yellow","green","yellow","orange","green","yellow","yellow","orange","green","orange","orange","orange","yellow","yellow","yellow","green","orange","red","purple","purple","red","purple","red","red","purple"];

export const SLICE_LEVEL = 12;
