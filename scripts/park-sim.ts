/**
 * Checks the 40 challenges of the park (SPEC-park.md 3.4, 4) and writes the star targets of the fun meter.
 * For every level, with each of the maths levels (5, 10, 20): the reference solution has to finish and satisfy all the goals; a lazy track (a straight
 * line from the crest to the station) must NOT satisfy the goals of a level that has any (so that the goals mean something).
 * The targets: 2 stars from 60% of the fun of the solution, 3 stars from 90% of it (of the lowest over the maths levels).
 * Run: npx vite-node scripts/park-sim.ts   (DRY=1 does not write src/games/park/parkTargets.ts)
 */
import { writeFileSync } from 'node:fs';
import { simulate } from '../src/games/park/coaster/physics';
import { END, buildPath, newTrack } from '../src/games/park/coaster/track';
import { evaluate } from '../src/games/park/goals';
import { funOf } from '../src/games/park/fun';
import { LEVEL_COUNT, makeLevel } from '../src/games/park/levels';

const DRY = !!process.env.DRY;
const MAXES = [5, 10, 20];
const targets: Record<number, [number, number]> = {};
let bad = 0;
const rows: string[] = [];
rows.push('lvl  zone  hills stars obst gate   height parts           finish  fun  2★  3★  lazy-track');
for (let id = 1; id <= LEVEL_COUNT; id++) {
  let fun = Infinity;
  let problem = '';
  let lazy = '';
  for (const max of MAXES) {
    const lv = makeLevel(id, max);
    const path = buildPath(lv.solution);
    const ride = simulate(path);
    if (ride.outcome !== 'finished') problem += ` max${max}:${ride.outcome}`;
    else {
      const e = evaluate(lv.goals, lv.solution, path, ride);
      if (!e.ok) problem += ` max${max}:${e.fails.map((f) => f.kind).join('+')}`;
      fun = Math.min(fun, funOf(lv.solution, path, ride).score);
    }
    if (max === 10) {
      // the lazy track: straight to the station
      const t = newTrack();
      t.pts.push({ ...END });
      t.complete = true;
      const lp = buildPath(t);
      const lr = simulate(lp);
      const g = lv.goals;
      const hasGoals = g.stars.length || g.obstacles.length || g.speed || g.height || g.parts.length;
      const le = lr.outcome === 'finished' ? evaluate(g, t, lp, lr) : null;
      lazy = !hasGoals ? '-' : le === null ? 'does not finish' : le.ok ? 'PASSES (bad)' : `fails ${le.fails.map((f) => f.kind).join('+')}`;
      if (hasGoals && le?.ok) problem += ' lazy-passes';
    }
  }
  const lv = makeLevel(id, 10);
  const g = lv.goals;
  targets[id] = [Math.round(fun * 0.6), Math.round(fun * 0.9)];
  if (problem) bad++;
  rows.push(
    `${String(id).padStart(3)}  ${lv.zone}.${String(lv.n).padStart(2)}  ${String(lv.solution.pts.length - 2).padStart(5)} ${String(g.stars.length).padStart(5)} ${String(g.obstacles.length).padStart(4)} ${(g.speed?.mode ?? '-').padEnd(6)} ${(g.height ? `${g.height.kind}${g.height.h}` : '-').padEnd(6)} ${(g.parts.map((p) => p.kind + (p.n > 1 ? p.n : '')).join(',') || '-').padEnd(15)} ${problem ? 'NO' + problem : 'yes   '}  ${String(fun).padStart(3)} ${String(targets[id][0]).padStart(3)} ${String(targets[id][1]).padStart(3)}  ${lazy}`,
  );
}
console.log(rows.join('\n'));
console.log(`\n${LEVEL_COUNT - bad}/${LEVEL_COUNT} levels have a solution that finishes and does all the goals (maths levels ${MAXES.join(', ')})`);
if (!DRY) {
  const body = Object.entries(targets).map(([id, [a, b]]) => `  ${id}: [${a}, ${b}],`).join('\n');
  writeFileSync('src/games/park/parkTargets.ts', `/** The star targets of the fun meter, per level: [two stars, three stars]. Written by scripts/park-sim.ts. */\nexport const PARK_TARGETS: Record<number, [number, number]> = {\n${body}\n};\n`);
  console.log('written: src/games/park/parkTargets.ts');
}
if (bad) process.exit(1);
