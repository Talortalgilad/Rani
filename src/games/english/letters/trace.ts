import type { Pt, Stroke } from './strokes';

/** How close the finger has to be (the share of the height of the letter box: SPEC-letters.md 3.1 says 12%). */
export const TOLERANCE = 12;
const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);

/** The length of a line. */
export const lengthOf = (s: Stroke): number => s.slice(1).reduce((a, p, i) => a + dist(s[i], p), 0);

/** `n` points spread evenly along a line (the first and the last included). */
export function resample(s: Stroke, n: number): Stroke {
  if (s.length < 2) return s.length ? Array.from({ length: n }, () => s[0]) : [];
  const cum = [0];
  for (let i = 1; i < s.length; i++) cum.push(cum[i - 1] + dist(s[i - 1], s[i]));
  const total = cum[cum.length - 1] || 1;
  const out: Stroke = [];
  let seg = 0;
  for (let i = 0; i < n; i++) {
    const want = (total * i) / (n - 1);
    while (seg < s.length - 2 && cum[seg + 1] < want) seg++;
    const span = cum[seg + 1] - cum[seg] || 1;
    const t = Math.max(0, Math.min(1, (want - cum[seg]) / span));
    out.push({ x: s[seg].x + (s[seg + 1].x - s[seg].x) * t, y: s[seg].y + (s[seg + 1].y - s[seg].y) * t });
  }
  return out;
}

export interface TraceResult {
  ok: boolean;
  /** the share of the points of the stroke that the finger passed near */
  coverage: number;
  /** the finger passed them in the right order (the right direction) */
  ordered: boolean;
  startOk: boolean;
}

/**
 * Did the finger write this stroke? It must pass near at least 80% of the points of the stroke, in order (so the direction is right),
 * and start near where the stroke starts. A shaky line is fine; the wrong way round, another stroke, or a scribble all over is not.
 */
export function evaluateStroke(target: Stroke, drawn: Stroke, tol = TOLERANCE): TraceResult {
  const fail: TraceResult = { ok: false, coverage: 0, ordered: false, startOk: false };
  if (drawn.length < 2) return fail;
  const t = resample(target, 24);
  const d = resample(drawn, 80);
  const idx: number[] = [];
  let covered = 0;
  for (const p of t) {
    let best = Infinity;
    let at = 0;
    d.forEach((q, j) => {
      const e = dist(p, q);
      if (e < best) (best = e), (at = j);
    });
    if (best <= tol) {
      covered++;
      idx.push(at);
    }
  }
  const coverage = covered / t.length;
  // the order: along the finger's line the passed points come in the order of the stroke (a few steps back are noise), and the line really goes from the start to the end
  const forward = idx.filter((j, i) => i === 0 || j >= idx[i - 1] - 2).length / Math.max(1, idx.length);
  const ordered = idx.length > 1 && forward >= 0.85 && idx[idx.length - 1] - idx[0] > 20;
  const startOk = dist(drawn[0], target[0]) <= tol * 1.8;
  // a scribble (or a different, longer stroke) is longer than the stroke: measured on a smoothed line, so that a shaky hand is not counted as extra length
  const calm = lengthOf(resample(drawn, 20)) <= lengthOf(target) * 1.8 + 15;
  return { ok: coverage >= 0.8 && ordered && startOk && calm, coverage, ordered, startOk };
}
