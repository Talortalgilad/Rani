/**
 * Picks the final 30 levels from the candidates in scripts/.cache and writes
 *   src/games/traffic/levels/levels.json   (what the game loads)
 *   docs/traffic/stage1/levels-table.md    (the numbers of every level)
 * Hard levels (every fifth) take the hardest candidate that meets the rules; the others take the middle one.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import type { LevelData, LevelStats } from '../src/games/traffic/engine/level';
import { paramsFor } from '../src/games/traffic/engine/generator';
import { difficultyScore } from '../src/games/traffic/engine/solver';

interface Cand { seed: number; data: LevelData; stats: LevelStats }
const picked: LevelData[] = [];
const missing: number[] = [];
for (let L = 1; L <= 30; L++) {
  const file = `scripts/.cache/${L}.json`;
  const p = paramsFor(L);
  const all: Cand[] = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
  for (const c of all) c.stats.score = difficultyScore(c.stats.vehicles, c.stats); // the formula may have changed since the candidate was made
  const ok = all.filter((c) => c.stats.exact && c.stats.density >= p.minDensity && c.stats.angled + 1e-9 >= (L >= 10 ? 0.3 : 0) && (!p.hard || c.stats.traps >= 3));
  if (!ok.length) {
    missing.push(L);
    continue;
  }
  ok.sort((a, b) => a.stats.score - b.stats.score);
  // every level takes the candidate closest to its line: a gentle one for the normal levels, a steeper one for the very hard ones
  const target = 22 + 1.9 * (L - 1);
  const line = p.hard ? 70 + 2.6 * (L - 1) : target;
  const c = ok.reduce((best, x) => (Math.abs(x.stats.score - line) < Math.abs(best.stats.score - line) ? x : best));
  picked.push({ ...c.data, stats: c.stats });
}
if (missing.length) console.log('no usable candidate for levels', missing.join(','));
writeFileSync('src/games/traffic/levels/levels.json', JSON.stringify(picked));

mkdirSync('docs/traffic/stage1', { recursive: true });
const rows = picked.map((l) => {
  const s = l.stats!;
  return `| ${l.number}${l.hard ? ' ⚠️' : ''} | ${s.vehicles} | ${s.passengers} | ${s.colors} | ${Math.round(s.density * 100)}% | ${Math.round(s.angled * 100)}% | ${s.free} | ${s.safeMoves} | ${s.traps} | ${s.depth} | ${s.slotsNeeded} | ${s.window} | ${s.score} |`;
});
writeFileSync(
  'docs/traffic/stage1/levels-table.md',
  `| שלב | רכבים | נוסעים | צבעים | צפיפות | באלכסון | חופשיים בהתחלה | מהלכים בטוחים | מלכודות | עומק חשיבה | מקומות בתחנה שנדרשים | חלון ערבוב | ציון קושי |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|\n${rows.join('\n')}\n`,
);
console.log(`${picked.length} levels written`);
let up = 0;
let n = 0;
for (let i = 0; i + 5 < picked.length; i++) {
  n++;
  if (picked[i + 5].stats!.score > picked[i].stats!.score) up++;
}
console.log(`ramp: level N+5 harder than N in ${up}/${n} pairs`);
