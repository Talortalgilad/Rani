/**
 * Draws the one hand-made level of "Traffic Jam" stage 0 (run once: `npx vite-node scripts/gen-traffic-slice.ts`).
 * It builds the lot backwards: each new vehicle must have a clear way out of the lot at the moment it is added, and
 * is placed so that it blocks vehicles added earlier. The reverse of that order is therefore a valid way to clear it.
 * The result is pasted into src/games/traffic/levels/beach-slice.ts; the generator proper arrives in stage 1.
 */
import { writeFileSync } from 'node:fs';
import { insideLot, overlaps, pathClear } from '../src/games/traffic/engine/geometry';
import { SIZES, boxOf, type ColorId, type VType, type VehicleDef } from '../src/games/traffic/engine/state';

const HW = Number(process.env.HW ?? 6.0);
const HH = Number(process.env.HH ?? 6.4);
const WANT = Number(process.env.WANT ?? 26);
/** Each footprint is shrunk by this before the overlap test, so real gaps are at least twice as big. */
const GAP = 0.05;
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
    if (out.some((o) => overlaps(box, boxOf(o), GAP))) continue;
    if (!pathClear(box, out.map(boxOf))) continue; // it must be able to leave when it is the last one in
    // from the 8th vehicle on it must block somebody, or the lot is too easy
    if (out.length >= 8 && !out.some((o) => !pathClear(boxOf(o), [box]))) continue;
    out.push(def);
  }
  return out;
}

let best: VehicleDef[] = [];
let maxCount = 0;
let bestSeed = 0;
for (let seed = 1; seed <= 120; seed++) {
  const l = build(seed);
  maxCount = Math.max(maxCount, l.length);
  const area = (a: VehicleDef[]) => a.reduce((s, v) => s + SIZES[v.type].len * SIZES[v.type].wid, 0);
  if (l.length >= WANT && area(l) > area(best)) {
    best = l;
    bestSeed = seed;
  }
}

if (best.length === 0) {
  console.log(`no seed reached ${WANT} vehicles (best ${maxCount})`);
  process.exit(1);
}
// ---- hidden "?" vehicles and the passenger queue, then write the level file
const free = (v: VehicleDef, all: VehicleDef[]) => pathClear(boxOf(v), all.filter((o) => o.id !== v.id).map(boxOf));
const blocked = best.filter((v) => !free(v, best)).map((v) => v.id);
const hiddenIds = [blocked[Math.floor(blocked.length / 6)], blocked[Math.floor(blocked.length / 2)], blocked[Math.floor((blocked.length * 5) / 6)]];
const defs = best.map((v) => (hiddenIds.includes(v.id) ? { ...v, hidden: true } : v));
const r2 = mulberry(7);
const queue: ColorId[] = [];
const order = [...defs].sort((a, b) => b.id - a.id);
for (let i = 0; i < order.length; i += 3) {
  const group: ColorId[] = [];
  for (const v of order.slice(i, i + 3)) for (let k = 0; k < SIZES[v.type].seats; k++) group.push(v.color);
  for (let k = group.length - 1; k > 0; k--) {
    const j = Math.floor(r2() * (k + 1));
    [group[k], group[j]] = [group[j], group[k]];
  }
  queue.push(...group);
}
const line = (v: VehicleDef & { hidden?: boolean }) => `  { id: ${v.id}, type: '${v.type}', color: '${v.color}', x: ${v.x}, z: ${v.z}, heading: ${v.heading}${v.hidden ? ', hidden: true' : ''} },`;
const out = `import type { ColorId, VehicleDef } from '../engine/state';

/**
 * The one hand-made level of stage 0 (beach world). Drawn by scripts/gen-traffic-slice.ts (seed ${bestSeed}): every vehicle
 * could leave when it was the last one added, so clearing them in reverse id order always works. The queue lists the
 * passengers of the vehicles in that order, shuffled inside groups of three vehicles, so the station never needs more
 * than three different vehicles at once when the lot is cleared in that order. The footprints leave a gap of at least
 * 10 cm between any two vehicles, wheels included.
 */
export const LOT = { halfW: ${HW}, halfH: ${HH} };

export const SLICE_VEHICLES: VehicleDef[] = [
${defs.map(line).join('\n')}
];

export const SLICE_QUEUE: ColorId[] = ${JSON.stringify(queue)};

export const SLICE_LEVEL = 12;
`;
writeFileSync('src/games/traffic/levels/beach-slice.ts', out);
console.log(JSON.stringify({ seed: bestSeed, count: best.length, hidden: hiddenIds, passengers: queue.length }));
