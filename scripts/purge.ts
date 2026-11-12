import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { levelRuleProblems } from '../src/games/traffic/engine/rules';
import { MAX_VEHICLES } from '../src/games/traffic/engine/generator';
import { MIN_OUTLINE } from '../src/games/traffic/render/framing';
import { minWidth } from './touch';
const need: number[] = [];
for (let L = 1; L <= 100; L++) {
  const f = `scripts/.cache/${L}.json`;
  if (!existsSync(f)) { need.push(L); continue; }
  const all = JSON.parse(readFileSync(f, 'utf8'));
  const ok = all.filter((c: any) => c.data.vehicles.length <= MAX_VEHICLES && levelRuleProblems(c.data, 0.17).length === 0 && minWidth(c.data).minShort >= MIN_OUTLINE && c.stats.exact);
  if (ok.length !== all.length) { writeFileSync(f, JSON.stringify(ok)); console.log(L, all.length, '->', ok.length); }
  if (ok.length < 2) need.push(L);
}
console.log('need', need.join(','));
