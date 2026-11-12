import { readFileSync } from 'node:fs';
import { levelRuleProblems } from '../src/games/traffic/engine/rules';
import { minWidth } from './touch';
const ls = JSON.parse(readFileSync('src/games/traffic/levels/levels.json', 'utf8'));
const out: string[] = [];
for (const l of ls) { const pr = levelRuleProblems(l, 0.15); const w = minWidth(l).minShort; if (pr.length || w < 24) out.push(`${l.number}: ${pr.join('; ') || 'ok'} outline ${w.toFixed(1)}`); }
console.log(out.join('\n') || 'all levels meet all rules');
