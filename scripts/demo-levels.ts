/** Temporary levels for looking at the new worlds and vehicles before the real levels exist: `npx vite-node scripts/demo-levels.ts`. */
import { writeFileSync } from 'node:fs';
import { generate, paramsFor } from '../src/games/traffic/engine/generator';
const out: Record<string, unknown> = {};
for (const L of [26, 31, 47, 51, 61, 76]) {
  const p = { ...paramsFor(L), minDensity: 0.5 };
  for (let s = 1; s < 60; s++) {
    const b = generate(p, 777 * L + s);
    if (b) { out['d' + L] = b.data; console.log('demo', L, 'density', b.density.toFixed(2), 'vehicles', b.data.vehicles.length); break; }
  }
}
writeFileSync('/tmp/demo-levels.json', JSON.stringify(out));
