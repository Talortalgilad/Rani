/**
 * Picks the final 100 levels from the candidates in scripts/.cache and writes
 *   src/games/traffic/levels/levels.json   (what the game loads)
 *   docs/traffic/stage2b/levels-table.md    (every 10th level) and levels-table-full.md
 * Hard levels (every fifth) take the hardest candidate that meets the rules; the others take the middle one.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import type { LevelData, LevelStats } from '../src/games/traffic/engine/level';
import { paramsFor } from '../src/games/traffic/engine/generator';
import { difficultyScore } from '../src/games/traffic/engine/solver';
import { levelRuleProblems } from '../src/games/traffic/engine/rules';

/** A little stricter than the test (0.15), so that rounding can never push a level over the line. */

interface Cand { seed: number; data: LevelData; stats: LevelStats }
const picked: LevelData[] = [];
const missing: number[] = [];
for (let L = 1; L <= 100; L++) {
  const file = `scripts/.cache/${L}.json`;
  const p = paramsFor(L);
  const all: Cand[] = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
  for (const c of all) c.stats.score = difficultyScore(c.stats.vehicles, c.stats); // the formula may have changed since the candidate was made
  const ok = all.filter((c) => c.stats.exact &&  levelRuleProblems(c.data, 0.17).length === 0 && (!p.hard || c.stats.traps >= 3));
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

mkdirSync('docs/traffic/stage2b', { recursive: true });
const rows = picked.map((l) => {
  const s = l.stats!;
  const big = l.vehicles.filter((v) => v.type !== 'car');
  const bigDiag = big.length ? Math.round((100 * big.filter((v) => v.heading % 90 !== 0).length) / big.length) : 0;
  const hidden = l.vehicles.filter((v) => v.hidden).length;
  return `| ${l.number}${l.hard ? ' ⚠️' : ''} | ${s.vehicles} | ${Math.round((100 * big.length) / s.vehicles)}% | ${l.number >= 10 ? bigDiag + '%' : '-'} | ${hidden} | ${s.passengers} | ${Math.round(s.density * 100)}% | ${Math.round(s.angled * 100)}% | ${s.free} | ${s.traps} | ${s.depth} | ${s.score} |`;
});
const head = `- **גדולים**: חלק הוואנים והאוטובוסים מכל הרכבים. **גדולים באלכסון**: חלק הגדולים שעומדים ב-45° (מ-10).
- **צפיפות**: שטח הרכבים (גלגלים כלולים) חלקי שטח החניון. **חופשיים**: רכבים שיכולים לצאת בהתחלה.
- **מלכודות**: מהלכים שנראים בסדר ומובילים לתקיעה, עד עומק 8 מהלכים. ⚠️ = "קשה מאוד!".
- **מיוחדים**: מסוע / מסתובב / כבאית (כמות).

| שלב | עולם | רכבים | גדולים | גדולים באלכסון | "?" | מיוחדים | צפיפות | באלכסון | חופשיים | מלכודות | עומק | ציון |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
`;
const withWorld = picked.map((l, i) => rows[i].replace(/^\| (\S+(?: ⚠️)?) \|/, `| $1 | ${l.world} |`).replace(/(\| \d+ \| )(\d+% \|)/, '$1$2'));
void withWorld;
const special = (l: LevelData) => {
  const t = (x: string) => l.vehicles.filter((v) => v.type === x).length;
  const parts = [(l.belts?.length ?? 0) ? `מסוע ×${l.belts!.length}` : '', t('rotator') ? `מסתובב ×${t('rotator')}` : '', t('fire') ? `כבאית ×${t('fire')}` : ''].filter(Boolean);
  return parts.join(', ') || '-';
};
const tableRows = picked.map((l, i) => {
  const cells = rows[i].split('|').map((c) => c.trim());
  // cells: ['', num, vehicles, big, bigDiag, hidden, pass, density, angled, free, traps, depth, score, '']
  const out = [cells[1], l.world, cells[2], cells[3], cells[4], cells[5], special(l), cells[7], cells[8], cells[9], cells[10], cells[11], cells[12]];
  return `| ${out.join(' | ')} |`;
});
writeFileSync('docs/traffic/stage2b/levels-table-full.md', `# כל 100 השלבים (שלב 2ב)\n\n${head}${tableRows.join('\n')}\n`);
writeFileSync('docs/traffic/stage2b/levels-table.md', `# טבלה מקוצרת: כל שלב עשירי (שלב 2ב)\n\n${head}${tableRows.filter((_, i) => (i + 1) % 10 === 0).join('\n')}\n`);
console.log(`${picked.length} levels written`);
let up = 0;
let n = 0;
for (let i = 0; i + 5 < picked.length; i++) {
  n++;
  if (picked[i + 5].stats!.score > picked[i].stats!.score) up++;
}
console.log(`ramp: level N+5 harder than N in ${up}/${n} pairs`);
