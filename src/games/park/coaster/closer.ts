/**
 * Closing the track (SPEC-park.md 3.4): the shortest way from the end of the track back into the station, with legal pieces only and enough speed,
 * found by A* over (tile, heading, level, speed). When there is none: how many pieces to take off so that there is one. Pure.
 */
import { energyAlong } from './allowed';
import { G, KINDS, STATION, buildCurve, cloneTrack, fits, step, walk, atStation, N, type Cursor, type Kind, type Track } from './track';
import { V_CHAIN, V_MAX } from './physics';

const FR = 0.16;
const LEN: Record<Kind, number> = { straight: 3, up: 3.3, down: 3.3, left: 2.4, right: 2.4, loop: 11.6 };
const DZ: Record<Kind, number> = { straight: 0, up: 1, down: -1, left: 0, right: 0, loop: 0 };
const LH = 1.4;
const LOOP_ENTRY_V2 = 78;

interface Node { cur: Cursor; v2: number; chain: boolean; parent: Node | null; kind: Kind | null; g: number }

function expand(n: Node, k: Kind, minV2: number): { v2: number; chain: boolean } | null {
  let v2 = n.v2;
  let chain = n.chain;
  if (chain && k === 'down') {
    chain = false;
    v2 = V_CHAIN * V_CHAIN;
  }
  if (chain) return k === 'loop' ? null : { v2: V_CHAIN * V_CHAIN, chain };
  if (k === 'loop' && v2 < LOOP_ENTRY_V2) return null;
  v2 = Math.min(V_MAX * V_MAX, v2 - 2 * G * DZ[k] * LH - 2 * FR * LEN[k]);
  if (k === 'loop') v2 = Math.min(v2, V_MAX * V_MAX);
  return v2 < minV2 ? null : { v2, chain };
}

/** The pieces that close the track, or null. */
export function closeTrack(t: Track, margin = 0, limit = 90000): Kind[] | null {
  const w = walk(t);
  if (w.closed) return [];
  if (t.pieces.length === 0) {
    // from the start: any track needs the chain lift first, which is automatic with the first descent
  }
  const e = energyAlong(buildCurve(t), buildCurve(t).piecesEnd);
  const chain = !t.pieces.includes('down');
  const minV2 = (2.2 + margin) ** 2;
  const start: Node = { cur: w.end, v2: chain ? V_CHAIN * V_CHAIN : e.endV * e.endV, chain, parent: null, kind: null, g: 0 };
  const h = (c: Cursor): number => Math.abs(c.c - STATION.c) + Math.abs(c.r - STATION.r) + c.z;
  const open: Node[] = [start];
  const best = new Map<number, number>();
  const sk = (n: Node): number => (((((n.cur.c * N + n.cur.r) * 4 + n.cur.d) * 7 + n.cur.z) * 2 + (n.chain ? 1 : 0)) * 64 + Math.min(63, Math.round(n.v2 / 4)));
  const f = (n: Node): number => n.g + 1.3 * h(n.cur);
  let expansions = 0;
  while (open.length && expansions < limit) {
    // the node with the lowest f (a small heap would be faster; the lists are short)
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (f(open[i]) < f(open[bi])) bi = i;
    const n = open[bi];
    open[bi] = open[open.length - 1];
    open.pop();
    expansions++;
    // the tiles and the pieces up to here
    const occ = new Set(w.occupied);
    const trail: Kind[] = [];
    for (let p: Node | null = n; p && p.kind; p = p.parent) {
      trail.push(p.kind);
      const pc = p.parent!.cur;
      for (const [c, r] of step(pc, p.kind).tiles) occ.add(r * N + c);
    }
    for (const k of KINDS) {
      const fit = fits({ before: [], end: n.cur, occupied: occ, closed: false }, k);
      if (!fit.ok) continue;
      const nx = expand(n, k, minV2);
      if (!nx) continue;
      const child: Node = { cur: fit.next, v2: nx.v2, chain: nx.chain, parent: n, kind: k, g: n.g + 1 };
      if (atStation(fit.next)) {
        const out: Kind[] = [];
        for (let p: Node | null = child; p && p.kind; p = p.parent) out.push(p.kind);
        out.reverse();
        return out;
      }
      const key = sk(child);
      const prev = best.get(key);
      if (prev !== undefined && prev <= child.g) continue;
      best.set(key, child.g);
      open.push(child);
    }
    void trail;
  }
  return null;
}

/** The exact check of a closed track (the approximation of the search is not trusted). */
function exact(t: Track, add: Kind[]): boolean {
  const c = cloneTrack(t);
  c.pieces.push(...add);
  const w = walk(c);
  if (!w.closed) return false;
  return energyAlong(buildCurve(c), Infinity).ok;
}

export interface Closing { pieces: Kind[]; /** pieces taken off first, to make room */ undo: number }

/** Closes the track; when it cannot be, the smallest number of pieces to take off for it to be possible. null: nothing works (cannot happen from an empty track with room). */
export function closeOrUndo(t: Track): Closing | null {
  for (let undo = 0; undo <= t.pieces.length; undo++) {
    const base = cloneTrack(t);
    base.pieces.length = t.pieces.length - undo;
    for (const margin of [0, 1.2, 2.5]) {
      const way = closeTrack(base, margin);
      if (way && exact(base, way)) return { pieces: way, undo };
    }
  }
  return null;
}
