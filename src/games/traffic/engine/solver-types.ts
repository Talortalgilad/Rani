import type { Obb } from './geometry';
import { SIZES, type ColorId, type VehicleDef } from './state';

/** The part of a level the solver needs. */
export interface LevelDataLike { vehicles: VehicleDef[]; queue: ColorId[] }

export const boxOf = (v: VehicleDef): Obb => ({ x: v.x, z: v.z, hl: SIZES[v.type].len / 2, hw: SIZES[v.type].wid / 2, heading: v.heading });
