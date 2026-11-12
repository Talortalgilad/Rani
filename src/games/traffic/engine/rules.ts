import { densityOf, angledShare } from './analyze';
import type { LevelData } from './level';
import { firstContact, largestHole } from './geometry';
import { MAX_HOLE, minDensityFor, paramsFor, quarterOf, worldOf } from './generator';
import { sameDirectionClusters, type Item } from './packing';
import { boxOf } from './solver-types';

/** The class of a direction: 0 horizontal, 1 vertical, 2 and 3 the two diagonals. */
export const classOfHeading = (heading: number): number => ({ 0: 0, 90: 1, 45: 2, 135: 3 } as Record<number, number>)[heading % 180];

/**
 * The rules every numbered level has to meet (apart from being solvable, which the solver checks). Returns what is wrong; an
 * empty list means the level is fine. The same function is used when the levels are picked and in the tests.
 */
export function levelRuleProblems(l: LevelData, near = 0.15): string[] {
  const out: string[] = [];
  const n = l.number;
  const vs = l.vehicles;
  const big = vs.filter((v) => v.type !== 'car');
  const d = densityOf(l);
  if (d < minDensityFor(n)) out.push(`density ${d.toFixed(3)}`);
  if (n >= 10 && angledShare(vs) < 0.3) out.push('angled share under 30%');
  if (n >= 10 && big.length && big.filter((v) => v.heading % 90 !== 0).length / big.length < 0.25) out.push('big vehicles at 45 degrees under 25%');
  if (n >= 6 && big.length / vs.length < 0.35) out.push('vans and buses under 35%');
  if (l.hard && vs.filter((v) => v.type === 'bus').length < 3) out.push('fewer than 3 buses');
  const items: Item[] = vs.map((v) => ({ type: v.type, cls: classOfHeading(v.heading), x: v.x, z: v.z, rot: v.rotator }));
  if (Math.max(...sameDirectionClusters(items, near).map((c) => c.length)) > 3) out.push('more than 3 neighbours in the same direction');
  if (n >= 6) for (let q = 0; q < 4; q++) {
    const inQ = vs.filter((v) => quarterOf(v.x, v.z) === q);
    if (!inQ.some((v) => v.type === 'car')) out.push(`quarter ${q} has no small vehicle`);
    if (!inQ.some((v) => v.type !== 'car')) out.push(`quarter ${q} has no big vehicle`);
    if (n >= 10 && !inQ.some((v) => v.heading % 90 === 0)) out.push(`quarter ${q} has no straight vehicle`);
    if (n >= 10 && !inQ.some((v) => v.heading % 90 !== 0)) out.push(`quarter ${q} has no diagonal vehicle`);
  }
  // the world, and the special vehicles that belong to this level
  const want = paramsFor(n);
  if (l.world !== worldOf(n)) out.push(`world ${l.world}, expected ${worldOf(n)}`);
  if ((l.belts?.length ?? 0) !== want.belts) out.push(`${l.belts?.length ?? 0} belts, expected ${want.belts}`);
  if (vs.filter((v) => v.rotator).length !== want.rotators) out.push(`rotators: expected ${want.rotators}`);
  if (vs.filter((v) => v.type === 'fire').length !== want.fires) out.push(`fire trucks: expected ${want.fires}`);
  // no big empty space in the middle (a ring of vehicles around a hole)
  const hole = largestHole(vs.map(boxOf), l.lot.halfW, l.lot.halfH);
  if (n >= 4 && hole > MAX_HOLE) out.push(`a hole of radius ${hole.toFixed(2)} between the vehicles`);
  // "?" vehicles: from level 8, each with a visible vehicle right in front of it
  const hidden = vs.filter((v) => v.hidden);
  if (n >= 8 && hidden.length < 1) out.push('no "?" vehicle');
  if (n < 8 && hidden.length) out.push('"?" before level 8');
  const boxes = vs.map((v) => ({ id: v.id, box: boxOf(v) }));
  for (const h of hidden) {
    const hit = firstContact(boxOf(h), boxes.filter((b) => b.id !== h.id));
    if (!hit) out.push(`"?" vehicle ${h.id} has nothing in front of it`);
    else if (vs.find((v) => v.id === hit.id)!.hidden) out.push(`"?" vehicle ${h.id} is covered by another "?"`);
  }
  return out;
}
