/**
 * Picks the final 100 levels from the candidates in scripts/.cache and writes
 *   src/games/traffic/levels/levels.json   (what the game loads)
 *   docs/traffic/stage2b/levels-table.md    (every 10th level) and levels-table-full.md
 * Hard levels (every fifth) take the hardest candidate that meets the rules; the others take the middle one.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import type { LevelData, LevelStats } from '../src/games/traffic/engine/level';
import { paramsFor } from '../src/games/traffic/engine/generator';
import { difficultyScore, type ScoreExtra } from '../src/games/traffic/engine/solver';
import { levelRuleProblems } from '../src/games/traffic/engine/rules';
import { MIN_OUTLINE } from '../src/games/traffic/render/framing';
import { minWidth } from './touch';

/** A little stricter than the test (0.15), so that rounding can never push a level over the line. */

interface Cand { seed: number; data: LevelData; stats: LevelStats }
const picked: LevelData[] = [];
const missing: number[] = [];
const extraOf = (d: LevelData): ScoreExtra => ({ hidden: d.vehicles.filter((v) => v.hidden).length, belts: d.belts?.length ?? 0, rotators: d.vehicles.filter((v) => v.rotator).length, fires: d.vehicles.filter((v) => v.type === 'fire').length });
const pool = new Map<number, Cand[]>();
for (let L = 1; L <= 100; L++) {
  const file = `scripts/.cache/${L}.json`;
  const p = paramsFor(L);
  const all: Cand[] = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
  for (const c of all) c.stats.score = difficultyScore(c.stats.vehicles, c.stats, extraOf(c.data)); // the formula may have changed since the candidate was made
  const strict = all.filter((c) => c.stats.exact && levelRuleProblems(c.data, 0.17).length === 0 && minWidth(c.data).minShort >= MIN_OUTLINE && (!p.hard || c.stats.traps >= 3));
  // when nothing meets every rule, the best candidate that is solvable is used and reported
  const usable = strict.length ? strict : all.filter((c) => c.stats.exact).sort((a, b) => levelRuleProblems(a.data, 0.17).length - levelRuleProblems(b.data, 0.17).length).slice(0, 1);
  if (!strict.length && usable.length) console.log(`level ${L}: no candidate meets every rule; used the best one: ${levelRuleProblems(usable[0].data, 0.17).join('; ') || 'outline narrower than ' + MIN_OUTLINE}`);
  if (!usable.length) missing.push(L);
  pool.set(L, usable);
}
// the very hard levels take the hardest candidate; the others take the gentlest one that is still harder than the level five before
// and (next to a very hard level) easier than it
const chosen = new Map<number, Cand>();
for (let L = 5; L <= 100; L += 5) {
  const c = pool.get(L)!;
  if (c.length) chosen.set(L, c.reduce((best, x) => (x.stats.score > best.stats.score ? x : best)));
}
for (let L = 1; L <= 100; L++) {
  if (chosen.has(L) || !pool.get(L)!.length) continue;
  const c = [...pool.get(L)!].sort((a, b) => a.stats.score - b.stats.score);
  const lo = L > 5 && chosen.has(L - 5) ? chosen.get(L - 5)!.stats.score : -Infinity;
  const caps = [L - 1, L + 1].filter((n) => n % 5 === 0 && chosen.has(n)).map((n) => chosen.get(n)!.stats.score - 1);
  const cap = caps.length ? Math.min(...caps) : Infinity;
  const fit = c.filter((x) => x.stats.score > lo && x.stats.score <= cap);
  chosen.set(L, fit.length ? fit[0] : c.filter((x) => x.stats.score <= cap).pop() ?? c[0]);
}
for (let L = 1; L <= 100; L++) if (chosen.has(L)) picked.push({ ...chosen.get(L)!.data, stats: chosen.get(L)!.stats });
if (missing.length) console.log('no usable candidate for levels', missing.join(','));
if (process.env.ONLY_DOCS) { picked.length = 0; picked.push(...JSON.parse(readFileSync('src/games/traffic/levels/levels.json', 'utf8'))); } else writeFileSync('src/games/traffic/levels/levels.json', JSON.stringify(picked));

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
  const parts = [(l.belts?.length ?? 0) ? `מסוע ×${l.belts!.length}` : '', l.vehicles.some((v) => v.rotator) ? `מסתובב ×${l.vehicles.filter((v) => v.rotator).length}` : '', t('fire') ? `כבאית ×${t('fire')}` : ''].filter(Boolean);
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
