/**
 * Runs every level of the journey 200 times with a simple greedy player (SPEC-blocks.md 4.3) and writes the star targets:
 * 3 stars up to the median number of trays, 2 stars up to the 80th percentile, and always one.
 * The player puts a shape where it clears the most; when nothing clears, where it leaves the fewest holes. When the board is full it gets
 * the rescue once and the wave once, as in the game.
 * Run: npx vite-node scripts/blocks-sim.ts [levelsToPrint]   -> src/games/blocks/starTargets.ts
 */
import { writeFileSync } from 'node:fs';
import { Board, N, idx } from '../src/games/blocks/board';
import { Generator } from '../src/games/blocks/generator';
import { Run, itemIndex, startBoard, wave } from '../src/games/blocks/journey';
import { LEVELS, pieceByArt } from '../src/games/blocks/levels';
import type { Piece } from '../src/games/blocks/pieces';
import { rescue } from '../src/games/blocks/rescue';
import { STAR_TARGETS } from '../src/games/blocks/starTargets';
import { Score } from '../src/games/blocks/scoring';

const RUNS = Number(process.env.RUNS ?? 200);
const ONLY = process.env.LEVELS ? process.env.LEVELS.split('-').map(Number) : null;
const DRY = !!process.env.DRY;
const CAP = 60;

function best(board: Board, tray: (Piece | null)[], aim: number): { slot: number; r: number; c: number } | null {
  // how many cells of each unit are full now
  const row = new Array(N).fill(0), col = new Array(N).fill(0), sq = new Array(N).fill(0);
  for (let i = 0; i < N * N; i++) if (board.isFull(i)) { const r = Math.floor(i / N), c = i % N; row[r]++; col[c]++; sq[Math.floor(r / 3) * 3 + Math.floor(c / 3)]++; }
  // what the goal needs in each unit (items to free, ice, chains): the player aims at the units that hold them
  const wRow = new Array(N).fill(0), wCol = new Array(N).fill(0), wSq = new Array(N).fill(0);
  for (let i = 0; i < N * N; i++) {
    const w = (aim >= 0 && board.item[i] === aim ? 2 : 0) + board.ice[i] + (board.lock[i] ? 1 : 0) + (board.crate[i] ? 1 : 0);
    if (!w) continue;
    const r = Math.floor(i / N), c = i % N;
    wRow[r] += w; wCol[c] += w; wSq[Math.floor(r / 3) * 3 + Math.floor(c / 3)] += w;
    // a crate falls apart when a unit next to it clears
    if (board.crate[i]) { if (r > 0) wRow[r - 1] += 1; if (r < N - 1) wRow[r + 1] += 1; if (c > 0) wCol[c - 1] += 1; if (c < N - 1) wCol[c + 1] += 1; }
  }
  let top: { slot: number; r: number; c: number } | null = null;
  let topScore = -1e9;
  tray.forEach((p, slot) => {
    if (!p) return;
    for (let r = 0; r + p.h <= N; r++) {
      for (let c = 0; c + p.w <= N; c++) {
        if (!board.canPlace(p, r, c)) continue;
        const dr = new Map<number, number>(), dc = new Map<number, number>(), ds = new Map<number, number>();
        for (const [a, b] of p.cells) {
          const R = r + a, C = c + b;
          dr.set(R, (dr.get(R) ?? 0) + 1); dc.set(C, (dc.get(C) ?? 0) + 1);
          const s = Math.floor(R / 3) * 3 + Math.floor(C / 3); ds.set(s, (ds.get(s) ?? 0) + 1);
        }
        let units = 0;
        let aimBonus = 0;
        dr.forEach((n, R) => { if (row[R] + n === N) { units++; aimBonus += 120 * wRow[R]; } else aimBonus += (wRow[R] * 10 * (row[R] + n)) / N; });
        dc.forEach((n, C) => { if (col[C] + n === N) { units++; aimBonus += 120 * wCol[C]; } else aimBonus += (wCol[C] * 10 * (col[C] + n)) / N; });
        ds.forEach((n, s) => { if (sq[s] + n === N) { units++; aimBonus += 120 * wSq[s]; } else aimBonus += (wSq[s] * 10 * (sq[s] + n)) / N; });
        // holes: empty cells next to the shape with every neighbour blocked or off the board
        let holes = 0;
        const mine = new Set(p.cells.map(([a, b]) => idx(r + a, c + b)));
        const seen = new Set<number>();
        for (const [a, b] of p.cells) for (const [x, y] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const R = r + a + x, C = c + b + y;
          if (R < 0 || C < 0 || R >= N || C >= N) continue;
          const i = idx(R, C);
          if (mine.has(i) || board.isFull(i) || board.crate[i] || seen.has(i)) continue;
          seen.add(i);
          const blocked = [[-1, 0], [1, 0], [0, -1], [0, 1]].filter(([u, v]) => { const RR = R + u, CC = C + v; return RR < 0 || CC < 0 || RR >= N || CC >= N || mine.has(idx(RR, CC)) || board.isFull(idx(RR, CC)) || board.crate[idx(RR, CC)] === 1; }).length;
          if (blocked === 4) holes++;
        }
        const score = units * 100 - holes * 20 + p.cells.length + aimBonus;
        if (score > topScore) { topScore = score; top = { slot, r, c }; }
      }
    }
  });
  return top;
}

function play(levelIdx: number, seed: number): { trays: number; done: boolean; rescued: number } {
  const level = LEVELS[levelIdx];
  const board = startBoard(level);
  const run = new Run(level, board);
  const gen = new Generator(seed);
  const score = new Score();
  let rescued = 0;
  let tray: (Piece | null)[] = level.forced ? level.forced.map((a) => pieceByArt(a)) : gen.next(board);
  for (;;) {
    if (run.trays > CAP) return { trays: CAP, done: false, rescued };
    const m = best(board, tray, level.goal.kind === 'collect' ? itemIndex(level.goal.item) : -1);
    if (!m) {
      if (rescued === 0) { rescue(board); rescued = 1; } else { wave(board); run.twice = true; rescued = 2; }
      if (!tray.some((p) => p && board.fits(p))) { tray = gen.next(board); }
      continue;
    }
    const p = tray[m.slot]!;
    const cells = board.place(p, m.r, m.c, 0);
    const cl = board.clearFull();
    run.onClears(cl);
    score.move(cells.length, cl.units, board.isEmpty);
    tray[m.slot] = null;
    if (run.view(board, score.total).done) return { trays: run.trays, done: true, rescued };
    if (tray.every((x) => !x)) {
      score.endTray();
      run.trays++;
      tray = gen.next(board);
    }
  }
}

const pct = (a: number[], q: number): number => a[Math.min(a.length - 1, Math.floor(q * a.length))];
// with LEVELS=a-b only those levels are run again and the others keep their targets
const out: Record<number, { three: number; two: number }> = { ...STAR_TARGETS };
const rows: string[] = ['level  goal                 median  p80   done%  rescue%  stars(3/2)'];
for (let i = 0; i < LEVELS.length; i++) {
  const l = LEVELS[i];
  if (ONLY && (l.id < ONLY[0] || l.id > ONLY[1])) continue;
  const res = Array.from({ length: RUNS }, (_, k) => play(i, 7919 * (k + 1) + l.id));
  const trays = res.map((r) => r.trays).sort((a, b) => a - b);
  const three = Math.max(1, pct(trays, 0.5));
  const two = Math.max(three + 1, pct(trays, 0.8));
  out[l.id] = { three, two };
  const g = l.goal.kind === 'score' ? `score ${l.goal.target}` : l.goal.kind === 'clears' ? `clears ${l.goal.target}` : l.goal.kind === 'collect' ? `${l.goal.item} ${l.goal.target}` : 'obstacles';
  rows.push(`${String(l.id).padStart(5)}  ${g.padEnd(20)} ${String(pct(trays, 0.5)).padStart(6)} ${String(pct(trays, 0.8)).padStart(5)} ${String(Math.round((100 * res.filter((r) => r.done).length) / RUNS)).padStart(6)} ${String(Math.round((100 * res.filter((r) => r.rescued > 0).length) / RUNS)).padStart(8)}  ${three}/${two}${l.hard === 3 ? '  hard' : ''}${l.boss ? '  boss' : ''}`);
}
if (!DRY) writeFileSync('src/games/blocks/starTargets.ts', `/** Star targets: trays used for 3 and 2 stars. Written by scripts/blocks-sim.ts (200 runs of a greedy player per level): median and 80th percentile. */\nimport type { StarTarget } from './journey';\nexport const STAR_TARGETS: Record<number, StarTarget> = ${JSON.stringify(out)};\n`);
console.log(rows.slice(0, 1 + Number(process.argv[2] ?? 60)).join('\n'));
if (Number(process.argv[2] ?? 60) < 60) console.log(`(... ${LEVELS.length} levels written to src/games/blocks/starTargets.ts)`);
