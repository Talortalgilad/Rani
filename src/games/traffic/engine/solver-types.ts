import { boxOf, ownBox, type BeltDef, type ColorId, type VehicleDef } from './state';

/** The part of a level the solver needs. */
export interface LevelDataLike { vehicles: VehicleDef[]; queue: ColorId[]; belts?: BeltDef[] }

export { boxOf, ownBox };
