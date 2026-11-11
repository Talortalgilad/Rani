/**
 * Draws the one hand-made level of "Traffic Jam" stage 0 (run once: `npx vite-node scripts/gen-traffic-slice.ts`).
 * It builds the lot backwards: each new vehicle must have a clear way out of the lot at the moment it is added, and
 * is placed so that it blocks vehicles added earlier. The reverse of that order is therefore a valid way to clear it.
 * The result is pasted into src/games/traffic/levels/beach-slice.ts; the generator proper arrives in stage 1.
 */
import { insideLot, overlaps, pathClear } from '../src/games/traffic/engine/geometry';
import { SIZES, boxOf, type ColorId, type VType, type VehicleDef } from '../src/games/traffic/engine/state';

const HW = 6.0;
const HH = 6.4;
const COLORS: ColorId[] = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink'];

function mulberry(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function build(seed: number): VehicleDef[] {
  const r = mulberry(seed);
  const out: VehicleDef[] = [];
  for (let attempt = 0; attempt < 40000 && out.length < 46; attempt++) {
    const t = r();
    const type: VType = t < 0.32 ? 'car' : t < 0.68 ? 'van' : 'bus';
    const heading = [0, 90, 180, 270, 45, 135, 225, 315][r() < 0.68 ? Math.floor(r() * 4) : 4 + Math.floor(r() * 4)];
    const def: VehicleDef = {
      id: out.length, type, color: COLORS[Math.floor(r() * COLORS.length)],
      x: Math.round((r() * 2 - 1) * (HW - 1) * 4) / 4, z: Math.round((r() * 2 - 1) * (HH - 1) * 4) / 4, heading,
    };
    const box = boxOf(def);
    if (!insideLot(box, HW, HH, 0.1)) continue;
    if (out.some((o) => overlaps(box, boxOf(o), 0.04))) continue;
    if (!pathClear(box, out.map(boxOf))) continue; // it must be able to leave when it is the last one in
    // from the 8th vehicle on it must block somebody, or the lot is too easy
    if (out.length >= 8 && !out.some((o) => !pathClear(boxOf(o), [box]))) continue;
    out.push(def);
  }
  return out;
}

let best: VehicleDef[] = [];
let bestSeed = 0;
for (let seed = 1; seed <= 120; seed++) {
  const l = build(seed);
  const area = (a: VehicleDef[]) => a.reduce((s, v) => s + SIZES[v.type].len * SIZES[v.type].wid, 0);
  if (l.length >= 26 && area(l) > area(best)) {
    best = l;
    bestSeed = seed;
  }
}
console.log(JSON.stringify({ seed: bestSeed, count: best.length, vehicles: best }));
