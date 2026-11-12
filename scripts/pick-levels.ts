/**
 * Picks the final 30 levels from the candidates in scripts/.cache and writes
 *   src/games/traffic/levels/levels.json   (what the game loads)
 *   docs/traffic/stage2a/levels-table.md    (the numbers of every level)
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
for (let L = 1; L <= 30; L++) {
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

mkdirSync('docs/traffic/stage2a', { recursive: true });
const rows = picked.map((l) => {
  const s = l.stats!;
  const big = l.vehicles.filter((v) => v.type !== 'car');
  const bigDiag = big.length ? Math.round((100 * big.filter((v) => v.heading % 90 !== 0).length) / big.length) : 0;
  const hidden = l.vehicles.filter((v) => v.hidden).length;
  return `| ${l.number}${l.hard ? ' ⚠️' : ''} | ${s.vehicles} | ${Math.round((100 * big.length) / s.vehicles)}% | ${l.number >= 10 ? bigDiag + '%' : '-'} | ${hidden} | ${s.passengers} | ${Math.round(s.density * 100)}% | ${Math.round(s.angled * 100)}% | ${s.free} | ${s.traps} | ${s.depth} | ${s.score} |`;
});
writeFileSync(
  'docs/traffic/stage2a/levels-table.md',
  `# 30 השלבים של עולם העיר (שלב 2א)

- **גדולים**: חלק הוואנים והאוטובוסים מכל הרכבים. **גדולים באלכסון**: חלק הגדולים שעומדים ב-45° (מ-10).
- **צפיפות**: שטח הרכבים (גלגלים כלולים) חלקי שטח החניון. **חופשיים**: רכבים שיכולים לצאת בהתחלה.
- **מלכודות**: מהלכים שנראים בסדר ומובילים לתקיעה, בכל מצב שעדיין אפשר לנצח ממנו, עד עומק 8 מהלכים.
- **ציון קושי**: \`1.5 × רכבים + 8 × מקומות + 2 × עומק + 1.5 × log₂(1 + מלכודות)\`. ⚠️ = "קשה מאוד!".

| שלב | רכבים | גדולים | גדולים באלכסון | רכבי "?" | נוסעים | צפיפות | באלכסון | חופשיים | מלכודות | עומק | ציון |
|---|---|---|---|---|---|---|---|---|---|---|---|
${rows.join('\n')}
`,
);
console.log(`${picked.length} levels written`);
let up = 0;
let n = 0;
for (let i = 0; i + 5 < picked.length; i++) {
  n++;
  if (picked[i + 5].stats!.score > picked[i].stats!.score) up++;
}
console.log(`ramp: level N+5 harder than N in ${up}/${n} pairs`);
