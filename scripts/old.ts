import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { levelRuleProblems } from '../src/games/traffic/engine/rules';
import { analyze } from '../src/games/traffic/engine/analyze';
import { paramsFor } from '../src/games/traffic/engine/generator';
import { minWidth } from './touch';
const old = JSON.parse(readFileSync('/tmp/old-levels.json', 'utf8'));
for (const L of [10, 15, 25]) {
  const d = old.find((x: any) => x.number === L && x.kind === 'level') ?? old[L - 1];
  console.log(L, d.number, d.vehicles.length, 'rules:', levelRuleProblems({ ...d, world: 'city' }, 0.17).join('; ') || 'ok', 'outline', minWidth(d).minShort.toFixed(1));
  const stats = analyze({ ...d, world: 'city' }, paramsFor(L).window);
  const f = `scripts/.cache/${L}.json`;
  if (stats && process.env.WRITE) {
    const have = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : [];
    have.push({ seed: -1, data: { ...d, world: 'city' }, stats });
    writeFileSync(f, JSON.stringify(have));
  }
}
