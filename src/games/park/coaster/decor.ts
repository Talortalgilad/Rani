/**
 * The things round the plot (trees, bushes, flowers, a fence of flags): all of them outside the plot and at least 4 units from any place where the
 * track can be (the clean corridor of SPEC-park.md 4). Pure: positions only.
 */
import { N, T } from './track';

export const CORRIDOR = 4;
/** the plot is [0, N*T] x [0, N*T]; nothing of the decor is nearer to it than this */
export const MARGIN = CORRIDOR + 1;
export interface Thing { x: number; z: number; kind: 'tree' | 'bush' | 'flower'; s: number; color: string }

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The distance from a point to the plot (0 inside it). */
export function distToPlot(x: number, z: number): number {
  const dx = Math.max(-x, 0, x - N * T), dz = Math.max(-z, 0, z - N * T);
  return Math.hypot(dx, dz);
}

export function decor(seed = 3, count = 70): Thing[] {
  const rand = rng(seed);
  const out: Thing[] = [];
  const colors = ['#4fbf6a', '#6fd16a', '#ff9bb8', '#ffb84d', '#59c9b8', '#ffffff'];
  let guard = 0;
  while (out.length < count && guard++ < 2000) {
    const a = rand() * Math.PI * 2;
    const r = (N * T) / 2 + 12 + rand() * 20;
    const x = (N * T) / 2 + Math.cos(a) * r, z = (N * T) / 2 + Math.sin(a) * r;
    if (distToPlot(x, z) < MARGIN) continue;
    const k = rand();
    out.push({ x, z, kind: k < 0.55 ? 'tree' : k < 0.8 ? 'bush' : 'flower', s: 0.7 + rand() * 0.8, color: colors[Math.floor(rand() * colors.length)] });
  }
  return out;
}
