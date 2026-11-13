import { STATIONS_PER_WORLD, type MapProgress } from '../engine/progress';
import { islandInfo } from './journey';

/** The island with b and d together (b is taught here; d was on island 2): it has a special review station for them. */
export const BD_ISLAND = 4;
export type StationKind = 'letter' | 'bd' | 'words';

/** The stations of an island: one for each letter, [b and d review on island 4], then the words station. */
export const stationsOf = (island: number): number => islandInfo(island).letters.length + (island === BD_ISLAND ? 1 : 0) + 1;
export function stationKind(island: number, station: number): StationKind {
  const n = islandInfo(island).letters.length;
  if (station < n) return 'letter';
  return island === BD_ISLAND && station === n ? 'bd' : 'words';
}
export const islandDone = (map: MapProgress, island: number): boolean => (map.done[island] ?? 0) >= stationsOf(island);
/** The first island is open from the start; the next opens when the one before is finished. */
export const islandOpen = (map: MapProgress, island: number, openAll = false): boolean => openAll || island === 1 || islandDone(map, island - 1);
export const stationOpenL = (map: MapProgress, island: number, station: number, openAll = false): boolean => islandOpen(map, island, openAll) && (openAll || station <= (map.done[island] ?? 0));
export const islandStars = (map: MapProgress, island: number): number => Array.from({ length: stationsOf(island) }, (_, s) => map.stars[`${island}-${s}`] ?? 0).reduce((a, b) => a + b, 0);

/** The letter squishy of each island (SPEC-letters.md: S, M, G, R, F, Z). */
export const SQUISHY_LETTER: Record<number, string> = { 1: 's', 2: 'm', 3: 'g', 4: 'r', 5: 'f', 6: 'z' };

export { STATIONS_PER_WORLD };
