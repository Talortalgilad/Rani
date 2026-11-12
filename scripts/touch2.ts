import { readFileSync } from 'node:fs';
import { minWidth } from './touch';
const ls = JSON.parse(readFileSync('src/games/traffic/levels/levels.json', 'utf8'));
const bad: string[] = []; let min = 99;
for (const l of ls) { const m = minWidth(l).minShort; min = Math.min(min, m); if (m < 25.9) bad.push(`${l.number}:${m.toFixed(1)}`); }
console.log('min', min.toFixed(1), 'below 26:', bad.length, bad.join(' '));
