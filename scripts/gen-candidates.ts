/**
 * Generates and analyses candidate levels for "Traffic Jam" and keeps them in scripts/.cache/<level>.json.
 * `LEVELS=10,20 CAND=12 TRY=600 npx vite-node scripts/gen-candidates.ts`
 * Picking the final 30 from the candidates is scripts/pick-levels.ts.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { analyze } from '../src/games/traffic/engine/analyze';
import { generate, lastFail, paramsFor } from '../src/games/traffic/engine/generator';
import type { LevelData, LevelStats } from '../src/games/traffic/engine/level';

const levels = (process.env.LEVELS ?? '1').split(',').map(Number);
const want = Number(process.env.CAND ?? 10);
const maxTry = Number(process.env.TRY ?? 400);
mkdirSync('scripts/.cache', { recursive: true });

for (const L of levels) {
  const file = `scripts/.cache/${L}.json`;
  const have: { seed: number; data: LevelData; stats: LevelStats }[] = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : [];
  const p = paramsFor(L);
  const t0 = Date.now();
  const fails: Record<string, number> = {};
  let seed = have.reduce((m, c) => Math.max(m, c.seed), 0) + 1;
  for (let tried = 0; have.length < want && tried < maxTry; tried++, seed++) {
    const b = generate(p, 9000 * L + seed);
    if (!b) {
      const k = lastFail.split(' ')[0];
      fails[k] = (fails[k] ?? 0) + 1;
      continue;
    }
    const stats = analyze(b.data, p.window);
    if (!stats) {
      fails.unsolved = (fails.unsolved ?? 0) + 1;
      continue;
    }
    have.push({ seed: 9000 * L + seed, data: b.data, stats });
    writeFileSync(file, JSON.stringify(have));
  }
  console.log(`L${L}: ${have.length} candidates, scores ${have.map((c) => c.stats.score).sort((a, b) => a - b).join(',')} fails ${JSON.stringify(fails)} ${Math.round((Date.now() - t0) / 1000)}s`);
}
