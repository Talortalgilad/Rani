import { readFileSync, existsSync } from 'node:fs';
import { levelRuleProblems } from '../src/games/traffic/engine/rules';
import { paramsFor } from '../src/games/traffic/engine/generator';
import { MIN_OUTLINE } from '../src/games/traffic/render/framing';
import { minWidth } from './touch';
for (const L of (process.env.LEVELS ?? '').split(',').map(Number)) {
  const f = `scripts/.cache/${L}.json`;
  if (!existsSync(f)) { console.log(L, 'no file'); continue; }
  for (const c of JSON.parse(readFileSync(f, 'utf8'))) console.log(L, c.data.vehicles.length, 'exact', c.stats.exact, 'traps', c.stats.traps, 'rules', levelRuleProblems(c.data, 0.17).join('; '), 'outline', minWidth(c.data).minShort.toFixed(1), 'hard', paramsFor(L).hard);
}
